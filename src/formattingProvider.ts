/**
 * VS Code DocumentFormattingEditProvider for R files.
 *
 * Orchestrates configuration reading, formatter invocation, subprocess
 * execution, and error reporting to produce TextEdit[] for VS Code.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.3, 7.3, 8.3, 9.3, 11.3, 12.1, 12.2
 */

import * as vscode from 'vscode';
import { ConfigurationReader } from './configurationReader';
import { classifyError, ErrorReporter } from './errorReporter';
import { buildInvokeSpec } from './formatterInvoker';
import { ProcessRunner } from './processRunner';
import { ErrorKind } from './types';

/**
 * Implements `vscode.DocumentFormattingEditProvider` for the `r` language.
 *
 * All dependencies are injected via the constructor to keep the class
 * unit-testable without a live VS Code host.
 */
export class FormattingProvider implements vscode.DocumentFormattingEditProvider {
  constructor(
    private readonly configReader: ConfigurationReader,
    private readonly invoker: { buildInvokeSpec: typeof buildInvokeSpec },
    private readonly runner: ProcessRunner,
    private readonly reporter: ErrorReporter,
  ) {}

  /**
   * Formats the given R document and returns a single full-document
   * replacement `TextEdit`, or `[]` when no changes are needed.
   *
   * Promise always resolves — it never rejects (Req 2.4).
   */
  async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options: vscode.FormattingOptions,
    token: vscode.CancellationToken,
  ): Promise<vscode.TextEdit[]> {
    try {
      // Req 2.1: read the full document text.
      const originalText = document.getText();

      // Req 4.1: read configuration fresh on every invocation.
      const config = this.configReader.getConfig();

      // Build the subprocess invocation spec.
      const invokeSpec = this.invoker.buildInvokeSpec(config, originalText);

      // Run the formatter subprocess.
      const result = await this.runner.run(
        invokeSpec.rscriptPath,
        invokeSpec.args,
        invokeSpec.stdin,
        config.timeoutMs,
        token,
      );

      // Req 6.3 / 7.3: exitCode -1 means timeout or cancellation.
      if (result.exitCode === -1) {
        // Req 7.3: cancellation — silent, return [].
        // Req 6.3 / 6.4: timeout — show warning, return [].
        if (!token.isCancellationRequested) {
          this.reporter.report(ErrorKind.Timeout);
        }
        return [];
      }

      // Req 8.3 / 9.3 / 11.3: non-zero exit — classify and report error.
      if (result.exitCode !== 0) {
        const kind = classifyError(result.stderr);
        this.reporter.report(kind, result.stderr);
        return [];
      }

      // Req 12.1 / 12.2: empty output guard — protect against formatter bugs
      // that would otherwise erase the document.
      if (result.stdout.trim() === '' && originalText.length > 0) {
        this.reporter.report(
          ErrorKind.FormattingFailed,
          'Formatter returned empty output; no changes applied.',
        );
        return [];
      }

      // Req 2.3: formatted text equals original — no edits needed.
      if (result.stdout === originalText) {
        return [];
      }

      // Req 2.2: compute full-document range and return a single replacement edit.
      const lastLine = document.lineCount - 1;
      const lastChar = document.lineAt(lastLine).text.length;
      const fullRange = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(lastLine, lastChar),
      );

      return [vscode.TextEdit.replace(fullRange, result.stdout)];
    } catch (error) {
      // Req 2.4: never reject — catch all thrown errors and report them.
      const message =
        error instanceof Error ? error.message : String(error);
      this.reporter.report(ErrorKind.FormattingFailed, message);
      return [];
    }
  }
}
