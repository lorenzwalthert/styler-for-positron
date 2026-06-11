/**
 * Integration tests for the R Formatter extension.
 *
 * These tests run INSIDE the VS Code Extension Host so `vscode` is the real
 * API — not the mock used by unit tests.
 *
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 5.1, 8.1, 8.2
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Fixtures live in src/test/fixtures/.  At runtime this file is compiled to
// out/test/integration/, so we walk three levels up to the project root and
// then back into src/test/fixtures/.
const FIXTURES_DIR = path.resolve(__dirname, '../../..', 'src/test/fixtures');
const UNFORMATTED_PATH = path.join(FIXTURES_DIR, 'unformatted.r');
const FORMATTED_PATH = path.join(FIXTURES_DIR, 'formatted.r');

/**
 * Wait for the extension to activate.  The extension activates on
 * `onLanguage:r`, which happens when an R document is shown.  We poll the
 * extensions API until it becomes active or we hit the timeout.
 */
async function waitForExtensionActivation(timeoutMs = 15000): Promise<void> {
  const extensionId = 'lorenzwalthert.styler-vscode';
  const ext = vscode.extensions.getExtension(extensionId);
  if (!ext) {
    // Extension may not be registered under an id during testing; continue.
    return;
  }
  const deadline = Date.now() + timeoutMs;
  while (!ext.isActive && Date.now() < deadline) {
    await sleep(200);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Open a file in the VS Code editor and return the document + editor.
 */
async function openFile(
  filePath: string,
): Promise<{ doc: vscode.TextDocument; editor: vscode.TextEditor }> {
  const uri = vscode.Uri.file(filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc);
  return { doc, editor };
}

/**
 * Close all open editors without saving.
 */
async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
}

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('R Formatter extension — integration', function () {
  // Generous timeout for VS Code startup and R subprocess.
  this.timeout(60000);

  afterEach(async () => {
    await closeAllEditors();
  });

  // ── Test 1: Happy path — format document ─────────────────────────────────

  it('formats unformatted.r to match formatted.r (Req 1.1, 2.1, 2.2, 5.1)', async () => {
    // Read expected output from the source fixture.
    const expectedText = fs.readFileSync(FORMATTED_PATH, 'utf8');

    // Open the unformatted file and show it in the editor.
    const { doc } = await openFile(UNFORMATTED_PATH);

    // Wait for the extension to activate on `onLanguage:r`.
    await waitForExtensionActivation();

    // Give the extension host a moment to wire up the formatting provider.
    await sleep(500);

    // Execute the built-in format command — this calls our provider.
    await vscode.commands.executeCommand('editor.action.formatDocument');

    // VS Code applies edits asynchronously; wait briefly for the edit to land.
    await sleep(1000);

    const actualText = doc.getText();
    assert.strictEqual(
      actualText,
      expectedText,
      `Document text after formatting does not match formatted.r.\n` +
        `Expected:\n${expectedText}\nActual:\n${actualText}`,
    );
  });

  // ── Test 2: Bad rscriptPath — error notification / document unchanged ─────

  it('leaves document unchanged when rscriptPath does not exist (Req 1.2, 1.3, 8.1, 8.2)', async () => {
    const originalText = fs.readFileSync(UNFORMATTED_PATH, 'utf8');

    // Set a non-existent Rscript path in global configuration.
    const config = vscode.workspace.getConfiguration('rFormatter');
    const previousPath = config.get<string>('rscriptPath', 'Rscript');
    await config.update(
      'rscriptPath',
      '/nonexistent/Rscript',
      vscode.ConfigurationTarget.Global,
    );

    try {
      const { doc } = await openFile(UNFORMATTED_PATH);

      await waitForExtensionActivation();
      await sleep(500);

      // Execute format — provider should detect the missing binary and show an
      // error notification, returning [] (no edits applied).
      await vscode.commands.executeCommand('editor.action.formatDocument');
      await sleep(1000);

      const actualText = doc.getText();
      assert.strictEqual(
        actualText,
        originalText,
        `Document should be unchanged when Rscript path is invalid.\n` +
          `Expected (original):\n${originalText}\nActual:\n${actualText}`,
      );
    } finally {
      // Restore original setting regardless of test outcome.
      await config.update(
        'rscriptPath',
        previousPath,
        vscode.ConfigurationTarget.Global,
      );
    }
  });
});
