/**
 * Shared types and interfaces for the R Formatter VS Code extension.
 *
 * Requirements: 14.1, 14.2
 */

/**
 * Extension configuration read from the `rFormatter` VS Code configuration namespace.
 */
export interface ExtensionConfig {
  /** Path to the Rscript binary. Defaults to 'Rscript' (resolved via PATH). */
  rscriptPath: string;
  /** Subprocess timeout in milliseconds. Clamped to [1000, 300000]. */
  timeoutMs: number;
}

/**
 * Specification for invoking the formatter subprocess.
 */
export interface InvokeSpec {
  /** Path to the Rscript binary to spawn. */
  rscriptPath: string;
  /** Arguments passed as-is to spawn() — never shell-interpolated. */
  args: string[];
  /** Text written to the subprocess stdin, or null if not needed. */
  stdin: string | null;
}

/**
 * Result returned by ProcessRunner after the subprocess exits.
 */
export interface ProcessResult {
  /** UTF-8 decoded stdout from the subprocess. */
  stdout: string;
  /** UTF-8 decoded stderr from the subprocess. */
  stderr: string;
  /** Process exit code, or -1 for timeout/cancellation. */
  exitCode: number;
}

/**
 * Classifies the kind of error that occurred during formatting.
 *
 * `const enum` is used for zero-cost inlining at compile time.
 * The tsconfig does not set `isolatedModules: true`, so this is safe.
 */
export const enum ErrorKind {
  RscriptNotFound,
  PackageNotFound,
  FormattingFailed,
  Timeout,
  Cancelled,
}
