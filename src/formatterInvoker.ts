/**
 * Builds the invocation spec for the styler subprocess.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 13.3, 14.1
 */

import { ExtensionConfig, InvokeSpec } from './types';

/**
 * Builds an `InvokeSpec` describing how to spawn the Rscript subprocess.
 *
 * Sets `options("styler.cache_root")` before invoking `styler::style_text`
 * so styler uses the configured cache directory.
 *
 * @param config       Extension configuration (provides `rscriptPath` and `cacheRoot`).
 * @param documentText The R source text to format; written to subprocess stdin.
 * @returns            An `InvokeSpec` ready to be passed to `ProcessRunner`.
 */
export function buildInvokeSpec(
  config: ExtensionConfig,
  documentText: string,
): InvokeSpec {
  const rExpr =
    `options("styler.cache_root"="${config.cacheRoot}");` +
    `con<-file('stdin');out<-styler::style_text(readLines(con));cat(paste(out,collapse='\\n'),'\\n',sep='')`;

  return {
    rscriptPath: config.rscriptPath,
    args: ['--vanilla', '-e', rExpr],
    stdin: documentText,
  };
}
