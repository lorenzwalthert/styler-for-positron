# {styler} for Positron

> This is experimental, written mostly by AI ([Kiro](https://kiro.dev)), and long-term support is not guaranteed, breaking API changes can occur.

A Code OSS extension that formats R code using the [{styler}](https://styler.r-lib.org/) package, primarily targetting Positron, since other Code OSS derivatives are compatible [vscode-r](https://github.com/REditorSupport/vscode-R) extension (and Positron is [not](https://positron.posit.co/extensions.html)). It registers a document formatting provider for R, so "Format Document" and "Format on Save" work automatically for `.r`, `.R`, `.qmd`, and `.Rmd` files.


## Requirements

- **R ≥ 4.0** installed and `Rscript` available on your PATH (or configured via `rFormatter.rscriptPath`)
- **styler ≥ 1.9.0** installed in your global R environment:
  ```r
  install.packages("styler")
  ```

## Installation

Search for **"{styler}: Non-Invasive Pretty Printing of R Code"** in the Extensions panel, or install from [Open VSX](https://open-vsx.org/).

In Positron, you need to set the Gallery Source to `"open-vsx"` instead of `"posit-p3m"` (just search for *Gallery Source* in settings) for the package to show up.

Once installed, the extension activates automatically when you open an R file. Trigger formatting with:
- **Format Document**: `Shift+Alt+F` (Windows/Linux) or `Shift+Option+F` (macOS)
- **Format on Save**: enable `"editor.formatOnSave": true` in your VS Code settings


## Positron Compatibility

This extension is fully compatible with [Positron](https://github.com/posit-dev/positron) — no code changes are required. Positron is built on Code OSS and supports all standard VS Code extension APIs used here.

Positron activates `posit.air-vscode` by default, which also registers an R formatter. When multiple formatters are active, VS Code and Positron will prompt you to choose the default formatter upon styling. To always use {styler}, add this to your `settings.json`:

```json
{
  "[r]": {
    "editor.defaultFormatter": "lorenzwalthert.styler"
  }
}
```

## Troubleshooting

**"Rscript not found"** — R is not installed or not on your PATH. Install R from [r-project.org](https://www.r-project.org/) or set `rFormatter.rscriptPath` to the full path of your `Rscript` binary.

**"Package 'styler' is not installed"** — Run `install.packages("styler")` in R, then try formatting again.

**"Formatting timed out"** — The formatter took longer than `rFormatter.timeoutMs`. Increase the timeout in settings.

**Formatting failed with a syntax error** — {styler} may not be able to format files with R syntax errors. Fix the error first, then format.

## Configuration

All settings live under the `rFormatter` namespace in VS Code settings.

| Setting | Type | Default | Description |
|---|---|---|---|
| `rFormatter.rscriptPath` | string | `"Rscript"` | Path to the `Rscript` binary. Defaults to `"Rscript"`, resolved via PATH. Set to an absolute path if R is not on your PATH (e.g. `"/usr/local/bin/Rscript"`). |
| `rFormatter.timeoutMs` | number | `30000` | Subprocess timeout in milliseconds. Clamped to the range `[1000, 300000]`. Increase this for very large files or slow machines. |
| `rFormatter.stylerScope` | `"text"` \| `"file"` | `"text"` | Formatting scope: `"text"` passes code via stdin/stdout; `"file"` uses a temporary file. |

Example `settings.json`:
```json
{
  "rFormatter.rscriptPath": "/usr/local/bin/Rscript",
  "rFormatter.timeoutMs": 60000,
  "rFormatter.stylerScope": "text"
}
```

## License

MIT
