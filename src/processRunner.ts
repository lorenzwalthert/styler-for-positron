/**
 * Spawns the Rscript subprocess and manages stdin/stdout/stderr, timeouts,
 * and cancellation.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 7.1, 7.2, 8.1, 13.1, 13.2
 */

import { spawn, spawnSync } from 'child_process';
import * as vscode from 'vscode';
import { ProcessResult } from './types';

/**
 * Returns true when `command` is a Windows batch/command script (.bat or .cmd).
 *
 * On Windows, `child_process.spawn` with `shell: false` cannot execute .bat
 * or .cmd files directly — doing so produces an EINVAL error.  The default R
 * Windows installer places `Rscript.bat` (a thin wrapper) on the PATH, so
 * users who rely on that wrapper will hit EINVAL unless we enable the shell.
 *
 * Setting `shell: true` only for these extensions keeps the default
 * shell-free path (and its security properties) intact for normal binaries.
 */
function isBatchFile(command: string): boolean {
  const lower = command.toLowerCase();
  return lower.endsWith('.bat') || lower.endsWith('.cmd');
}

/**
 * On Windows, resolves a bare command name (e.g. `'Rscript'`) to its full
 * path using `where.exe`.  This lets us detect when the PATH entry for
 * `Rscript` is actually `Rscript.bat` — a case that requires `shell: true`
 * to spawn correctly — even when the user has not set an explicit path.
 *
 * Returns the first match from `where.exe`, or `command` unchanged if
 * resolution fails or we are not on Windows.
 */
function resolveCommandOnWindows(command: string): string {
  if (process.platform !== 'win32') {
    return command;
  }
  // Skip resolution when the command is already an absolute path — the caller
  // already knows exactly what they want to run.
  if (command.includes('\\') || command.includes('/')) {
    return command;
  }
  try {
    const result = spawnSync('where.exe', [command], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout) {
      // `where` may return multiple matches, one per line; take the first.
      const first = result.stdout.trim().split(/\r?\n/)[0].trim();
      if (first) {
        return first;
      }
    }
  } catch {
    // where.exe not found or other error — fall back to original command.
  }
  return command;
}

/**
 * Spawns a subprocess and returns its result.
 *
 * - Uses `child_process.spawn` with an explicit args array — never `exec` or
 *   shell interpolation (Req 3.1, 13.1, 13.2).
 * - Writes `stdin` as UTF-8 to the subprocess stdin and closes the stream
 *   before waiting for output (Req 3.2).
 * - Accumulates all stdout/stderr data events into separate `Buffer[]`;
 *   decodes to UTF-8 on process exit (Req 3.3).
 * - Kills the process with SIGKILL after `timeoutMs` milliseconds and returns
 *   `exitCode: -1` (Req 6.1, 6.2).
 * - Kills the process with SIGKILL when `token.isCancellationRequested` fires
 *   and returns `exitCode: -1` (Req 7.1, 7.2).
 * - Handles `ENOENT` by resolving with `{ stdout: '', stderr: 'Rscript not
 *   found', exitCode: 1 }` (Req 8.1).
 * - Always resolves with `stdout` and `stderr` as strings (Req 3.5).
 *
 * @param command    The executable to spawn (e.g. `'Rscript'` or a full path).
 * @param args       Explicit arguments array — passed directly to `spawn`, not
 *                   interpreted by a shell.
 * @param stdin      Text to write to the subprocess stdin, or `null`.
 * @param timeoutMs  Maximum milliseconds to wait before killing the process.
 * @param token      VS Code cancellation token.
 */
export async function run(
  command: string,
  args: string[],
  stdin: string | null,
  timeoutMs: number,
  token: vscode.CancellationToken,
): Promise<ProcessResult> {
  // On Windows, resolve bare command names (e.g. 'Rscript') to their full
  // path so we can detect .bat wrappers that require special handling.
  const resolvedCommand = resolveCommandOnWindows(command);

  // On Windows, .bat/.cmd files cannot be launched by CreateProcess directly.
  // Instead of using shell:true (which concatenates args into a string and lets
  // cmd.exe parse them — breaking the R expression), we invoke cmd.exe /c
  // explicitly.  cmd.exe is a real .exe so spawn handles it fine with
  // shell:false, and it delegates to the .bat while keeping args intact.
  const [spawnCommand, spawnArgs] = isBatchFile(resolvedCommand)
    ? ['cmd.exe', ['/c', resolvedCommand, ...args]]
    : [resolvedCommand, args];

  return new Promise<ProcessResult>((resolve) => {
    // Req 3.1, 13.1, 13.2: use spawn with explicit args array, stdio piped.
    const proc = spawn(spawnCommand, spawnArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    } as import('child_process').SpawnOptionsWithStdioTuple<'pipe','pipe','pipe'>);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;

    // Req 8.1: handle ENOENT — Rscript binary not found on PATH.
    // Also handle EINVAL — on Windows, spawning a .bat/.cmd file without
    // shell:true causes CreateProcess to return EINVAL.  Both cases mean the
    // process never started, so we resolve immediately with a clear message.
    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT' || err.code === 'EINVAL') {
        clearTimeout(watchdog);
        cancellationListener.dispose();
        resolve({ stdout: '', stderr: 'Rscript not found', exitCode: 1 });
      }
      // Other spawn errors (e.g. EACCES) fall through to the exit handler
      // where exitCode will be non-zero.
    });

    // Req 3.2: write stdin as UTF-8 then close the write stream.
    // Attach an error handler to swallow EPIPE — on macOS, if the R process
    // exits before we finish writing, the OS sends SIGPIPE which would crash
    // the extension host. Ignoring the error here is safe: the process exit
    // handler will fire regardless and return a non-zero exit code.
    proc.stdin.on('error', () => { /* ignore EPIPE / write-after-close */ });
    if (stdin !== null) {
      proc.stdin.write(stdin, 'utf8');
    }
    proc.stdin.end();

    // Req 3.3: accumulate stdout chunks.
    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    // Req 3.3: accumulate stderr chunks.
    proc.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    // Req 6.1: timeout watchdog — kill with SIGKILL after timeoutMs.
    const watchdog = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeoutMs);

    // Req 7.1: cancellation — kill with SIGKILL when token fires.
    const cancellationListener = token.onCancellationRequested(() => {
      proc.kill('SIGKILL');
    });

    // Await process exit.
    proc.on('exit', (code: number | null) => {
      // Clear watchdog and cancellation listener (Req 6.2, 7.2).
      clearTimeout(watchdog);
      cancellationListener.dispose();

      // Req 6.2, 7.2: return exitCode -1 for timeout or cancellation.
      if (timedOut || token.isCancellationRequested) {
        resolve({ stdout: '', stderr: '', exitCode: -1 });
        return;
      }

      // Req 3.3, 3.4, 3.5: decode buffers to UTF-8 and return actual exit code.
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        exitCode: code ?? 1,
      });
    });
  });
}

/**
 * ProcessRunner class wrapping the `run` function for dependency-injection
 * into `FormattingProvider`.
 */
export class ProcessRunner {
  run(
    command: string,
    args: string[],
    stdin: string | null,
    timeoutMs: number,
    token: vscode.CancellationToken,
  ): Promise<ProcessResult> {
    return run(command, args, stdin, timeoutMs, token);
  }
}
