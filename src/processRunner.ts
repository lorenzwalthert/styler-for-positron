/**
 * Spawns the Rscript subprocess and manages stdin/stdout/stderr, timeouts,
 * and cancellation.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 7.1, 7.2, 8.1, 13.1, 13.2
 */

import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { ProcessResult } from './types';

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
  return new Promise<ProcessResult>((resolve) => {
    // Req 3.1, 13.1, 13.2: use spawn with explicit args array, stdio piped.
    const proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;

    // Req 8.1: handle ENOENT — Rscript binary not found on PATH.
    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        clearTimeout(watchdog);
        cancellationListener.dispose();
        resolve({ stdout: '', stderr: 'Rscript not found', exitCode: 1 });
      }
      // Other spawn errors (e.g. EACCES) fall through to the exit handler
      // where exitCode will be non-zero.
    });

    // Req 3.2: write stdin as UTF-8 then close the write stream.
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
