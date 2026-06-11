/**
 * Error classification and reporting for the R Formatter extension.
 *
 * Requirements: 6.4, 8.1, 8.2, 9.1, 9.2, 11.1, 11.2
 */

import * as vscode from 'vscode';
import { ErrorKind } from './types';

/**
 * Classifies the kind of error from subprocess stderr output.
 *
 * - Returns `PackageNotFound` when stderr contains `'could not find function'`,
 *   `'there is no package called'`, or `'Error in library'` (Req 8.1).
 * - Returns `RscriptNotFound` when stderr contains both `'cannot open'` and
 *   `'Rscript'` (Req 9.1).
 * - Otherwise returns `FormattingFailed` (Req 6.4).
 *
 * @param stderr UTF-8 stderr output from the subprocess.
 */
export function classifyError(stderr: string): ErrorKind {
  if (
    stderr.includes('could not find function') ||
    stderr.includes('there is no package called') ||
    stderr.includes('Error in library')
  ) {
    return ErrorKind.PackageNotFound;
  }

  if (stderr.includes('cannot open') && stderr.includes('Rscript')) {
    return ErrorKind.RscriptNotFound;
  }

  return ErrorKind.FormattingFailed;
}

/**
 * Reports errors and warnings to the user via VS Code notification messages.
 *
 * Requirements: 6.4, 8.2, 9.2, 11.1, 11.2
 */
export class ErrorReporter {
  constructor(
    private readonly configuredTimeoutMs: number,
  ) {}

  /**
   * Displays the appropriate VS Code notification for the given `ErrorKind`.
   *
   * - `RscriptNotFound`: error message with guidance to install R or configure
   *   `rFormatter.rscriptPath` (Req 9.2).
   * - `PackageNotFound`: error message with `install.packages('styler')` hint
   *   (Req 8.2).
   * - `FormattingFailed`: error message showing the first 200 chars of `detail`
   *   (Req 6.4).
   * - `Timeout`: warning message with the configured timeout duration (Req 11.1).
   * - `Cancelled`: silent — no message shown (Req 11.2).
   *
   * @param kind   The classified error kind.
   * @param detail Optional additional context (used for FormattingFailed).
   */
  report(kind: ErrorKind, detail?: string): void {
    switch (kind) {
      case ErrorKind.RscriptNotFound:
        vscode.window.showErrorMessage(
          "R Formatter: Rscript not found. Please install R or set 'rFormatter.rscriptPath' to the correct path.",
        );
        break;

      case ErrorKind.PackageNotFound:
        vscode.window.showErrorMessage(
          "R Formatter: The styler package is not installed. Run install.packages('styler') in R to install it.",
        );
        break;

      case ErrorKind.FormattingFailed: {
        const snippet = detail ? detail.slice(0, 200) : '';
        const message = snippet
          ? `R Formatter: Formatting failed — ${snippet}`
          : 'R Formatter: Formatting failed.';
        vscode.window.showErrorMessage(message);
        break;
      }

      case ErrorKind.Timeout:
        vscode.window.showWarningMessage(
          `R Formatter: Formatting timed out after ${this.configuredTimeoutMs} ms.`,
        );
        break;

      case ErrorKind.Cancelled:
        // Silent — no message (Req 11.2)
        break;
    }
  }
}
