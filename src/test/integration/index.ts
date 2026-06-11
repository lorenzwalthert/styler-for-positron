/**
 * Mocha test suite loader for @vscode/test-electron.
 *
 * This module is loaded inside the VS Code Extension Host process.
 * It discovers all *.integration.test.js files in its directory and
 * runs them via Mocha, resolving or rejecting the returned Promise
 * based on test results.
 *
 * Requirements: 1.1, 1.2, 1.3
 */

import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';

/**
 * Required export: @vscode/test-electron calls `run()` after loading this module.
 */
export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 60000,
  });

  const testsRoot = __dirname;

  return new Promise<void>((resolve, reject) => {
    // Discover all compiled integration test files in this directory.
    const files = fs
      .readdirSync(testsRoot)
      .filter((f) => f.endsWith('.integration.test.js'));

    for (const file of files) {
      mocha.addFile(path.join(testsRoot, file));
    }

    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} integration test(s) failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
