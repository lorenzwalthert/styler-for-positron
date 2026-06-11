/**
 * Extension entry point.
 *
 * Wires together all components and registers the DocumentFormattingEditProvider
 * for the `r` language.
 *
 * Requirements: 1.1, 1.2, 1.3
 */

import * as vscode from 'vscode';
import { ConfigurationReader } from './configurationReader';
import { ErrorReporter } from './errorReporter';
import { buildInvokeSpec } from './formatterInvoker';
import { FormattingProvider } from './formattingProvider';
import { ProcessRunner } from './processRunner';

/**
 * Called by VS Code when the extension is activated (on `onLanguage:r`).
 *
 * Instantiates all components, creates the `FormattingProvider`, registers it
 * for the `r` language, and pushes the disposable into `context.subscriptions`
 * so it is cleaned up when the extension is deactivated (Req 1.1, 1.3).
 */
export function activate(context: vscode.ExtensionContext): void {
  const configReader = new ConfigurationReader();
  const invoker = { buildInvokeSpec };
  const runner = new ProcessRunner();

  // Read initial config to obtain the timeout for ErrorReporter.
  // ErrorReporter is re-created on configuration change if needed; for the
  // lifetime of this activation, we use the timeout at activation time as the
  // display value in timeout messages.
  const config = configReader.getConfig();
  const reporter = new ErrorReporter(config.timeoutMs);

  const provider = new FormattingProvider(configReader, invoker, runner, reporter);

  // Req 1.1: register the formatting provider for the `r` language.
  const disposable = vscode.languages.registerDocumentFormattingEditProvider(
    { language: 'r' },
    provider,
  );

  context.subscriptions.push(disposable);
}

/**
 * Called by VS Code when the extension is deactivated.
 * No explicit cleanup is required beyond the disposables in `context.subscriptions`.
 */
export function deactivate(): void {
  // no-op
}
