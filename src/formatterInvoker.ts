/**
 * Builds the invocation spec for the styler subprocess.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 13.3, 14.1
 */

import { ExtensionConfig, InvokeSpec } from './types';

/**
 * The R expression passed to `Rscript -e`:
 * - Reads all lines from stdin
 * - Formats them with `styler::style_text`
 * - Writes the result to stdout with a trailing newline
 *
 * Passed as a single array element so it is never shell-interpolated (Req 13.3).
 */
const R_EXPR =
  "con<-file('stdin');out<-styler::style_text(readLines(con));cat(paste(out,collapse='\\n'),'\\n',sep='')";

/**
 * Builds an `InvokeSpec` describing how to spawn the Rscript subprocess.
 *
 * @param config       Extension configuration (provides `rscriptPath`).
 * @param documentText The R source text to format; written to subprocess stdin.
 * @returns            An `InvokeSpec` ready to be passed to `ProcessRunner`.
 */
export function buildInvokeSpec(
  config: ExtensionConfig,
  documentText: string,
): InvokeSpec {
  return {
    rscriptPath: config.rscriptPath,
    args: ['--vanilla', '-e', R_EXPR],
    stdin: documentText,
  };
}
