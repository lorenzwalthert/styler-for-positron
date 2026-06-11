# Implementation Plan: R Formatter VS Code Extension

## Overview

Implements the `r-formatter-vscode` VS Code extension in TypeScript. The plan follows the component dependency order: shared types → individual components (ConfigurationReader, FormatterInvoker, ProcessRunner, ErrorReporter) → FormattingProvider → extension activation wiring → tests. Property-based tests using fast-check are added close to the components they validate.

## Tasks

- [x] 1. Scaffold the extension project
  - Create `package.json` with VS Code engine `^1.85.0`, activation event `onLanguage:r`, `contributes.configuration` block for `rFormatter.rscriptPath`, `rFormatter.timeoutMs`, and `rFormatter.stylerScope`, and dev-dependencies (`mocha ^10`, `sinon ^17`, `fast-check ^3`, `@vscode/test-electron ^2`, `typescript`, `@types/vscode`, `@types/node`, `@types/mocha`, `@types/sinon`)
  - Add an Open VSX-compatible `publisher` field in `package.json` (required for `ovsx publish`) and include a `categories` field with `["Formatters"]`
  - Create `tsconfig.json` targeting ES2020, module CommonJS, `strict: true`, `outDir: out`, `rootDir: src`
  - Create directory structure: `src/`, `src/test/unit/`, `src/test/property/`, `src/test/integration/`, `src/test/fixtures/`
  - Create `.vscodeignore` and `.gitignore` stubs
  - Create `README.md` noting: (a) Positron is fully supported, (b) if `posit.air-vscode` is also active in Positron, VS Code/Positron will prompt to choose the default formatter — users should select this extension or set `"editor.defaultFormatter": "<publisher>.r-formatter-vscode"` in their settings for R files
  - _Requirements: 1.1, 1.3, 4.1_

- [x] 2. Implement shared types and interfaces
  - [x] 2.1 Create `src/types.ts` exporting `ExtensionConfig`, `InvokeSpec`, `ProcessResult`, and `const enum ErrorKind`
    - `ExtensionConfig`: `rscriptPath: string`, `stylerScope: 'file' | 'text'`, `timeoutMs: number`
    - `InvokeSpec`: `rscriptPath: string`, `args: string[]`, `stdin: string | null`
    - `ProcessResult`: `stdout: string`, `stderr: string`, `exitCode: number`
    - `ErrorKind`: `RscriptNotFound`, `PackageNotFound`, `FormattingFailed`, `Timeout`, `Cancelled`
    - _Requirements: 14.1, 14.2_

- [x] 3. Implement `ConfigurationReader`
  - [x] 3.1 Create `src/configurationReader.ts` with `getConfig(): ExtensionConfig`
    - Call `vscode.workspace.getConfiguration('rFormatter')` on every invocation (no caching)
    - Defaults: `rscriptPath` → `'Rscript'`, `stylerScope` → `'text'`, `timeoutMs` → `30000`
    - Clamp `timeoutMs` to `[1000, 300000]`; substitute `'Rscript'` when `rscriptPath` is empty or undefined
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 14.3, 14.4_

  - [ ]* 3.2 Write unit tests for `ConfigurationReader`
    - Create `src/test/unit/configurationReader.test.ts`
    - Mock `vscode.workspace.getConfiguration`; assert all defaults; assert `timeoutMs` clamping at both bounds; assert empty `rscriptPath` fallback; assert live-read behaviour (stub returns updated value on second call)
    - _Requirements: 4.1–4.5, 14.3, 14.4_

- [ ] 4. Implement `FormatterInvoker`
  - [ ] 4.1 Create `src/formatterInvoker.ts` with `buildInvokeSpec(config: ExtensionConfig, documentText: string): InvokeSpec`
    - Set `args` to `['--vanilla', '-e', rExpr]` where `rExpr` is `"con<-file('stdin');out<-styler::style_text(readLines(con));cat(paste(out,collapse='\n'),'\n',sep='')"`
    - Set `stdin` to `documentText`; set `rscriptPath` from `config.rscriptPath`
    - Pass the R expression as a single array element — never embed in a shell string
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 13.3, 14.1_

  - [ ]* 4.2 Write property test for `buildInvokeSpec` — no shell injection
    - Create `src/test/property/formatterInvoker.property.test.ts`
    - **Property 3: No shell injection** — for arbitrary `documentText` (any Unicode string), `buildInvokeSpec` returns an `InvokeSpec` where `stdin === documentText`, `args[0] === '--vanilla'`, `args[1] === '-e'`, `args` has exactly 3 elements, and no element of `args` contains unescaped shell metacharacters derived from `documentText`
    - **Validates: Requirements 5.1, 5.2, 5.3, 13.3**

  - [ ]* 4.3 Write unit tests for `FormatterInvoker`
    - Create `src/test/unit/formatterInvoker.test.ts`
    - Assert invoke spec shape: `--vanilla` first, single `-e` flag, correct R expression, `stdin === documentText`, `rscriptPath` sourced from config
    - _Requirements: 5.1–5.4, 13.3_

- [ ] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement `ProcessRunner`
  - [ ] 6.1 Create `src/processRunner.ts` with `run(command, args, stdin, timeoutMs, token): Promise<ProcessResult>`
    - Use `child_process.spawn(command, args, { stdio: ['pipe','pipe','pipe'] })` — never `exec` or shell interpolation
    - When `stdin` is non-null, write to `proc.stdin` as UTF-8 then call `proc.stdin.end()`
    - Accumulate all `stdout` and `stderr` data events into separate `Buffer[]`; decode to UTF-8 on exit
    - Set a `setTimeout` watchdog for `timeoutMs`; on expiry call `proc.kill('SIGKILL')` and set a `timedOut` flag
    - Register `token.onCancellationRequested` listener; on fire call `proc.kill('SIGKILL')`
    - On exit: clear timeout, dispose cancellation listener; if `timedOut` or `token.isCancellationRequested` return `{ stdout: '', stderr: '', exitCode: -1 }`; otherwise return actual buffers and exit code
    - Handle `spawn` `ENOENT` error event: resolve with `{ stdout: '', stderr: 'Rscript not found', exitCode: 1 }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 7.1, 7.2, 8.1, 13.1, 13.2_

  - [ ]* 6.2 Write unit tests for `ProcessRunner`
    - Create `src/test/unit/processRunner.test.ts`
    - Mock `child_process.spawn` with sinon; assert stdout/stderr buffers are concatenated correctly; assert `exitCode: -1` when timeout fires; assert `exitCode: -1` when cancellation token fires; assert `ENOENT` resolves with non-zero exit
    - _Requirements: 3.1–3.5, 6.1, 6.2, 7.1, 7.2, 8.1_

- [ ] 7. Implement `ErrorReporter` and `classifyError`
  - [ ] 7.1 Create `src/errorReporter.ts` with `report(kind: ErrorKind, detail?: string): void` and exported `classifyError(stderr: string): ErrorKind`
    - `RscriptNotFound`: `showErrorMessage` with guidance to install R or set `rFormatter.rscriptPath`
    - `PackageNotFound`: `showErrorMessage` with package name and `install.packages('styler')` command
    - `FormattingFailed`: `showErrorMessage` with first 200 characters of `detail`
    - `Timeout`: `showWarningMessage` with configured timeout duration
    - `Cancelled`: no message (silent)
    - `classifyError`: return `PackageNotFound` when stderr contains `'could not find function'`, `'there is no package called'`, or `'Error in library'`; return `RscriptNotFound` when stderr contains both `'cannot open'` and `'Rscript'`; otherwise return `FormattingFailed`
    - _Requirements: 6.4, 8.1, 8.2, 9.1, 9.2, 11.1, 11.2_

  - [ ]* 7.2 Write unit tests for `ErrorReporter`
    - Create `src/test/unit/errorReporter.test.ts`
    - Stub `vscode.window.showErrorMessage` and `showWarningMessage`; assert correct message content for each `ErrorKind`; assert `Cancelled` produces no call; assert `classifyError` returns correct kind for representative stderr strings
    - _Requirements: 6.4, 8.1, 8.2, 9.1, 9.2, 11.1, 11.2_

- [ ] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement `FormattingProvider`
  - [ ] 9.1 Create `src/formattingProvider.ts` implementing `vscode.DocumentFormattingEditProvider`
    - Constructor accepts `ConfigurationReader`, `FormatterInvoker`, `ProcessRunner`, `ErrorReporter` via dependency injection
    - In `provideDocumentFormattingEdits`: call `configReader.getConfig()`, then `invoker.buildInvokeSpec(config, document.getText())`, then `runner.run(...)` with the cancellation token
    - `exitCode === -1`: return `[]`; additionally call `reporter.report(ErrorKind.Timeout, ...)` when timeout (not cancellation)
    - `exitCode !== 0`: call `classifyError(result.stderr)`, call `reporter.report(kind, result.stderr)`, return `[]`
    - `exitCode === 0`, stdout empty/whitespace-only and document non-empty: call `reporter.report(ErrorKind.FormattingFailed, ...)` with empty-output message, return `[]`
    - `exitCode === 0`, stdout equals original text: return `[]`
    - `exitCode === 0`, stdout differs from original: compute full document range and return `[vscode.TextEdit.replace(fullRange, result.stdout)]`
    - Wrap all logic in try/catch; on any thrown error call `reporter.report(ErrorKind.FormattingFailed, error.message)` and return `[]` — promise must never reject
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.3, 7.3, 8.3, 9.3, 11.3, 12.1, 12.2_

  - [ ]* 9.2 Write property tests for `FormattingProvider`
    - Create `src/test/property/formattingProvider.property.test.ts`
    - **Property 4: Graceful degradation** — for arbitrary `ProcessResult` values (any stdout/stderr/exitCode combination), stub the runner to return that result; assert `provideDocumentFormattingEdits` always resolves and never rejects
    - **Validates: Requirements 2.4**
    - **Property 2: No data loss** — for any `ProcessResult` with `exitCode === 0`, non-empty non-whitespace stdout that differs from original, assert exactly one `TextEdit` is returned and its `newText` equals `result.stdout` exactly
    - **Validates: Requirements 2.2**
    - **Property 5: Cancellation safety** — for any `ProcessResult` with `exitCode === -1`, assert the provider returns `[]`
    - **Validates: Requirements 7.3**

  - [ ]* 9.3 Write unit tests for `FormattingProvider`
    - Create `src/test/unit/formattingProvider.test.ts`
    - Stub all four collaborators; assert `[]` for non-zero exit; assert single `TextEdit` when stdout differs; assert `[]` when stdout equals original; assert `[]` for empty stdout with error reported; assert promise never rejects when runner throws
    - Also assert that when `exitCode === 0` and `stdout === originalText`, the result is `[]` (no spurious edit)
    - _Requirements: 2.1–2.5, 6.3, 7.3, 8.3, 9.3, 11.3, 12.1, 12.2_

- [ ] 10. Wire up extension activation
  - [ ] 10.1 Create `src/extension.ts` with exported `activate(context: vscode.ExtensionContext): void`
    - Instantiate `ConfigurationReader`, `FormatterInvoker`, `ProcessRunner`, `ErrorReporter`, and `FormattingProvider`
    - Call `vscode.languages.registerDocumentFormattingEditProvider({ language: 'r' }, provider)` and push disposable to `context.subscriptions`
    - Export a no-op `deactivate(): void`
    - _Requirements: 1.1, 1.2, 1.3_

- [ ] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Integration tests
  - [ ] 12.1 Create `src/test/fixtures/unformatted.r` with a small R snippet that `styler` will reformat (e.g., inconsistent spacing around operators)
  - [ ] 12.2 Create `src/test/fixtures/formatted.r` with the expected `styler`-formatted output of the same snippet

  - [ ]* 12.3 Write integration tests with `@vscode/test-electron`
    - Create `src/test/integration/extension.integration.test.ts` and `src/test/runTests.ts` as the runner entry point
    - Open `unformatted.r` in the test VS Code instance; execute `editor.action.formatDocument`; assert the document text equals `formatted.r` content
    - Add test: set `rFormatter.rscriptPath` to a non-existent path; execute format; assert error notification is shown
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 5.1, 8.1, 8.2_

- [ ] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The design uses TypeScript throughout — all code examples and implementation should use TypeScript
- `const enum ErrorKind` is used as specified in the design; ensure `isolatedModules` compatibility if needed (use `enum` instead if the TypeScript config requires it)
- The R expression in `buildInvokeSpec` is passed as a single element of `args` — it is never shell-interpolated
- Property tests validate universal correctness properties from the design's "Correctness Properties" section
- Unit tests validate specific examples and edge cases per component
- Integration tests require `styler` and `Rscript` to be installed on the test machine
- **Positron compatibility**: Positron is built on Code OSS and supports all standard VS Code extension APIs used by this extension — no code changes are required for Positron support. Distribute via [Open VSX](https://open-vsx.org/) (using `ovsx publish`) so Positron users can find the extension; the VS Code Marketplace is separate and optional. Positron bootstraps `posit.air-vscode` by default, which also registers an R formatter; when multiple formatters are active VS Code/Positron will prompt the user to pick a default — document this in the README and suggest setting `"[r]": { "editor.defaultFormatter": "<publisher>.r-formatter-vscode" }` for users who want styler.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["3.1", "4.1", "6.1", "7.1"] },
    { "id": 2, "tasks": ["3.2", "4.2", "4.3", "6.2", "7.2"] },
    { "id": 3, "tasks": ["9.1"] },
    { "id": 4, "tasks": ["9.2", "9.3"] },
    { "id": 5, "tasks": ["10.1"] },
    { "id": 6, "tasks": ["12.1", "12.2"] },
    { "id": 7, "tasks": ["12.3"] }
  ]
}
```
