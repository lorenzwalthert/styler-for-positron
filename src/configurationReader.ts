/**
 * Reads extension configuration from the VS Code `rFormatter` namespace.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 14.3, 14.4
 */

import * as vscode from 'vscode';
import { ExtensionConfig } from './types';

/**
 * Reads the `rFormatter` configuration on every call — no caching — so that
 * changes made by the user are picked up immediately (Req 4.5).
 */
export class ConfigurationReader {
  /**
   * Returns the current extension configuration with defaults applied and
   * out-of-range values clamped / substituted.
   *
   * - `rscriptPath`: defaults to `'Rscript'`; empty/undefined values are
   *   substituted with `'Rscript'` (Req 4.2, 14.3).
   * - `stylerScope`: defaults to `'text'`; only `'file'` and `'text'` are
   *   valid (Req 4.4).
   * - `timeoutMs`: defaults to `30000`; clamped to `[1000, 300000]`
   *   (Req 4.3, 14.4).
   */
  getConfig(): ExtensionConfig {
    // Re-read on every invocation so the user sees updated values immediately
    // without reloading the extension window (Req 4.1, 4.5).
    const cfg = vscode.workspace.getConfiguration('rFormatter');

    // rscriptPath — substitute 'Rscript' when empty or undefined (Req 14.3)
    const rawPath = cfg.get<string>('rscriptPath', 'Rscript');
    const rscriptPath = rawPath && rawPath.trim().length > 0 ? rawPath : 'Rscript';

    // stylerScope — accept only the two allowed values; fall back to 'text'
    const rawScope = cfg.get<string>('stylerScope', 'text');
    const stylerScope: 'file' | 'text' =
      rawScope === 'file' || rawScope === 'text' ? rawScope : 'text';

    // timeoutMs — clamp to [1000, 300000] (Req 14.4)
    const rawTimeout = cfg.get<number>('timeoutMs', 30000);
    const timeoutMs = Math.min(300000, Math.max(1000, rawTimeout));

    return { rscriptPath, stylerScope, timeoutMs };
  }
}
