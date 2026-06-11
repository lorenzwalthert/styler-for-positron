# Requirements Document

## Introduction

This document specifies the requirements for an R Formatter VS Code extension. The extension integrates the `styler` R formatter into VS Code by registering a `DocumentFormattingEditProvider` for R files. When a user triggers "Format Document" or Format on Save, the extension invokes `styler` via a subprocess call to `Rscript`, captures the formatted output, and returns the resulting edits to VS Code. All formatting logic is delegated to the user's globally installed R environment; the extension focuses on process management, configuration, and error surfacing.

---

## Glossary

- **Extension**: The R Formatter VS Code extension described in this document.
- **FormattingProvider**: The VS Code `DocumentFormattingEditProvider` registered for the `r` language.
- **ConfigurationReader**: The component that reads workspace/user settings from `vscode.workspace.getConfiguration`.
- **FormatterInvoker**: The component that builds the `InvokeSpec` (command, args, stdin) for the selected R formatter.
- **ProcessRunner**: The component that spawns the `Rscript` subprocess and manages stdin/stdout/stderr and timeouts.
- **ErrorReporter**: The component that maps error conditions to user-visible VS Code notifications.
- **InvokeSpec**: A data structure holding `rscriptPath`, `args[]`, and `stdin` used to launch the formatter process.
- **ProcessResult**: A data structure holding `stdout`, `stderr`, and `exitCode` returned by ProcessRunner.
- **styler**: An R package (`styler`) used as the code formatter.
- **Rscript**: The R command-line interpreter used to invoke the formatter package.
- **TextEdit**: A VS Code API object representing a document text replacement.
- **CancellationToken**: A VS Code API object that signals cancellation of a long-running operation.
- **Format_on_Save**: A VS Code feature that automatically formats a document when it is saved.

---

## Requirements

### Requirement 1: Provider Registration

**User Story:** As a VS Code user, I want the extension to register a document formatter for R files, so that "Format Document" and Format on Save work automatically for `.r` and `.R` files.

#### Acceptance Criteria

1. THE Extension SHALL register a `DocumentFormattingEditProvider` for the VS Code language identifier `'r'` on activation.
2. WHEN the VS Code language identifier of the active document is `'r'`, THE Extension SHALL activate and make the formatting command available.
3. THE Extension SHALL activate on the `onLanguage:r` activation event.

---

### Requirement 2: Format Document Invocation

**User Story:** As a developer working in R, I want to trigger "Format Document" (or Format on Save) and have my R code reformatted in place, so that my code consistently follows the selected style.

#### Acceptance Criteria

1. WHEN `provideDocumentFormattingEdits` is called, THE FormattingProvider SHALL read the full text of the document.
2. WHEN the formatter subprocess exits with code 0 and stdout is non-empty and differs from the original text, THE FormattingProvider SHALL return a single `TextEdit` that replaces the entire document content with the formatted text.
3. WHEN the formatted text equals the original document text, THE FormattingProvider SHALL return an empty `TextEdit` array.
4. THE FormattingProvider SHALL always resolve its promise and SHALL never reject, regardless of subprocess outcome.
5. THE FormattingProvider SHALL NOT mutate the `document` object passed to `provideDocumentFormattingEdits`.

---

### Requirement 3: Subprocess Invocation via Rscript

**User Story:** As a user, I want the extension to invoke my locally installed R formatter via `Rscript`, so that I don't need to install any additional runtime bundled with the extension.

#### Acceptance Criteria

1. THE ProcessRunner SHALL spawn the formatter subprocess using Node.js `child_process.spawn` with an explicit arguments array, never using `child_process.exec` or shell string interpolation.
2. WHEN `stdin` in the `InvokeSpec` is non-null, THE ProcessRunner SHALL write the document text to the subprocess stdin and then close the write stream before waiting for output.
3. THE ProcessRunner SHALL collect all stdout chunks and all stderr chunks into separate buffers and decode them as UTF-8 strings in the `ProcessResult`.
4. WHEN the subprocess exits normally, THE ProcessRunner SHALL set `ProcessResult.exitCode` to the actual exit code of the process.
5. THE ProcessRunner SHALL always resolve with a `ProcessResult` where `stdout` and `stderr` are strings (never `null`).

---

### Requirement 4: Configuration

**User Story:** As a developer, I want to configure how the formatter is invoked, so that I can tailor the formatting behaviour to my project's needs.

#### Acceptance Criteria

1. THE ConfigurationReader SHALL read settings from the `rFormatter` VS Code configuration namespace on every format invocation.
2. THE ConfigurationReader SHALL support a `rscriptPath` setting that specifies the path to the `Rscript` binary, defaulting to `'Rscript'` (resolved via PATH).
3. THE ConfigurationReader SHALL support a `timeoutMs` setting specifying the subprocess timeout in milliseconds, defaulting to `30000` and clamped to the range `[1000, 300000]`.
4. THE ConfigurationReader SHALL support a `stylerScope` setting with allowed values `'file'` and `'text'`, defaulting to `'text'`.
5. WHEN the user changes a setting, THE ConfigurationReader SHALL return the updated value on the next format invocation without requiring a window reload.

---

### Requirement 5: styler Formatter Integration

**User Story:** As a developer, I want the extension to invoke the `styler` R package to format my code, so that my R files conform to the tidyverse style guide.

#### Acceptance Criteria

1. THE FormatterInvoker SHALL produce an `InvokeSpec` with `stdin` set to the document text.
2. THE FormatterInvoker SHALL produce an `InvokeSpec` whose `args` array contains exactly one `-e` flag followed by a valid R expression that reads from `stdin` and writes the styled text to stdout.
3. THE FormatterInvoker SHALL include `--vanilla` as the first element of `args` to suppress loading user `.Rprofile` files.
4. THE FormatterInvoker SHALL set `InvokeSpec.rscriptPath` to the value of `config.rscriptPath`.

---

### Requirement 6: Timeout Handling

**User Story:** As a developer, I want the formatter subprocess to be terminated if it takes too long, so that my editor does not hang indefinitely waiting for a format result.

#### Acceptance Criteria

1. WHEN the subprocess does not exit within `config.timeoutMs` milliseconds, THE ProcessRunner SHALL send `SIGKILL` to the subprocess.
2. WHEN the subprocess is killed due to timeout, THE ProcessRunner SHALL return a `ProcessResult` with `exitCode` equal to `-1`.
3. WHEN `ProcessResult.exitCode` is `-1`, THE FormattingProvider SHALL return an empty `TextEdit` array without applying any edit.
4. WHEN a timeout occurs, THE ErrorReporter SHALL display a warning message to the user indicating that formatting timed out, including the configured timeout duration.

---

### Requirement 7: Cancellation Handling

**User Story:** As a developer, I want in-progress formatting to be cancelled when VS Code issues a cancellation (e.g. a new format request supersedes the previous one), so that the editor remains responsive.

#### Acceptance Criteria

1. WHEN `token.isCancellationRequested` becomes true before the subprocess exits, THE ProcessRunner SHALL send `SIGKILL` to the subprocess.
2. WHEN the subprocess is killed due to cancellation, THE ProcessRunner SHALL return a `ProcessResult` with `exitCode` equal to `-1`.
3. WHEN `ProcessResult.exitCode` is `-1` due to cancellation, THE FormattingProvider SHALL return an empty `TextEdit` array silently without showing an error message.

---

### Requirement 8: Error Handling — Rscript Not Found

**User Story:** As a developer who hasn't configured R on their PATH, I want a clear error message when Rscript cannot be found, so that I know how to fix the problem.

#### Acceptance Criteria

1. WHEN `spawn()` fails because the `Rscript` binary cannot be found (e.g. `ENOENT`), THE ErrorReporter SHALL display an error message informing the user that Rscript was not found.
2. WHEN the Rscript-not-found error is displayed, THE ErrorReporter SHALL include guidance directing the user to install R or set the `rFormatter.rscriptPath` configuration value.
3. WHEN the Rscript-not-found error occurs, THE FormattingProvider SHALL return an empty `TextEdit` array.

---

### Requirement 9: Error Handling — Formatter Package Not Installed

**User Story:** As a developer whose R environment is missing the selected formatter package, I want a clear error message with the install command, so that I can quickly resolve the issue.

#### Acceptance Criteria

1. WHEN the subprocess exits with a non-zero exit code and `stderr` contains patterns indicating a missing package (e.g. `'there is no package called'`, `'Error in library'`, or `'could not find function'`), THE ErrorReporter SHALL classify the error as `PackageNotFound`.
2. WHEN the error is classified as `PackageNotFound`, THE ErrorReporter SHALL display an error message that includes the name of the missing package and the corresponding `install.packages(...)` command.
3. WHEN the `PackageNotFound` error occurs, THE FormattingProvider SHALL return an empty `TextEdit` array.

---

### Requirement 11: Error Handling — Formatting Failure

**User Story:** As a developer whose R file contains a syntax error, I want to see a clear error message with details from the formatter output, so that I understand why formatting failed.

#### Acceptance Criteria

1. WHEN the subprocess exits with a non-zero exit code and the error is not classified as `RscriptNotFound` or `PackageNotFound`, THE ErrorReporter SHALL classify the error as `FormattingFailed`.
2. WHEN the error is classified as `FormattingFailed`, THE ErrorReporter SHALL display an error message that includes the first 200 characters of `stderr`.
3. WHEN a `FormattingFailed` error occurs, THE FormattingProvider SHALL return an empty `TextEdit` array.

---

### Requirement 12: Empty Output Guard

**User Story:** As a developer, I want to be protected from the formatter accidentally erasing my file if it returns empty output, so that I don't lose code due to a formatter bug.

#### Acceptance Criteria

1. WHEN the subprocess exits with code 0 but `stdout` is empty or contains only whitespace, THE FormattingProvider SHALL NOT apply any `TextEdit` to the document.
2. WHEN empty output is detected from a non-empty document, THE ErrorReporter SHALL display an error message informing the user that the formatter returned empty output and that no changes were applied.

---

### Requirement 13: No Shell Injection

**User Story:** As a security-conscious user, I want the extension to invoke `Rscript` without passing arguments through a shell, so that document content cannot be used for shell injection attacks.

#### Acceptance Criteria

1. THE ProcessRunner SHALL invoke `Rscript` exclusively using `child_process.spawn(command, argsArray)` where `argsArray` is an explicit JavaScript array.
2. THE ProcessRunner SHALL NOT use `child_process.exec` or any API that interprets arguments as a shell string.
3. THE FormatterInvoker SHALL pass the R expression as a single element of the `args` array, not embedded in a shell command string.

---

### Requirement 14: InvokeSpec and ProcessResult Data Integrity

**User Story:** As a developer of this extension, I want the data structures flowing between components to be well-defined and consistent, so that integration between components is reliable.

#### Acceptance Criteria

1. THE FormatterInvoker SHALL always return an `InvokeSpec` containing a non-empty `rscriptPath` string, a non-empty `args` array, and a `stdin` value that is either a string or `null`.
2. THE ProcessRunner SHALL always return a `ProcessResult` containing a `stdout` string, a `stderr` string, and an integer `exitCode`.
3. WHEN `config.rscriptPath` is empty or undefined, THE ConfigurationReader SHALL substitute the default value `'Rscript'`.
4. WHEN `config.timeoutMs` is outside the range `[1000, 300000]`, THE ConfigurationReader SHALL clamp the value to the nearest bound.
