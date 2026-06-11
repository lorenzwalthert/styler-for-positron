/**
 * Entry point for @vscode/test-electron integration test runner.
 *
 * This file is compiled to out/test/runTests.js and invoked by `npm test`.
 * It downloads/reuses a VS Code instance, opens the fixtures folder as the
 * workspace, and loads the integration test suite.
 *
 * Requirements: 1.1, 1.2, 1.3
 */

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  // Root of the extension under test.
  const extensionDevelopmentPath = path.resolve(__dirname, '../..');

  // Points to the compiled index.js that mocha will load inside the VS Code host.
  const extensionTestsPath = path.resolve(__dirname, 'integration/index');

  // Open the fixtures folder as the workspace so R files can be opened.
  // --disable-extensions prevents other installed extensions from interfering.
  const fixturesPath = path.resolve(__dirname, '../../src/test/fixtures');

  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        fixturesPath,
      ],
      // Pass --disable-gpu so tests run in headless CI environments (Xvfb handles display).
      extensionTestsEnv: {
        ELECTRON_DISABLE_GPU: '1',
      },
    });
  } catch (err) {
    console.error('Integration tests failed:', err);
    process.exit(1);
  }
}

main();
