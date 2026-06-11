/**
 * Minimal vscode API stub for unit tests running outside the VS Code host.
 *
 * Only surfaces the APIs used by the extension source files.
 * Tests that need to control behaviour should replace individual stubs with sinon.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const workspace = {
  getConfiguration: (_section?: string) => ({
    get: <T>(_key: string, defaultValue: T): T => defaultValue,
  }),
};

export const window = {
  showErrorMessage: (_message: string, ..._items: any[]): Thenable<any> =>
    Promise.resolve(undefined),
  showWarningMessage: (_message: string, ..._items: any[]): Thenable<any> =>
    Promise.resolve(undefined),
  showInformationMessage: (_message: string, ..._items: any[]): Thenable<any> =>
    Promise.resolve(undefined),
};

export const languages = {
  registerDocumentFormattingEditProvider: (_selector: any, _provider: any) => ({
    dispose: () => undefined,
  }),
};

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position,
  ) {}
}

export class TextEdit {
  static replace(range: Range, newText: string): TextEdit {
    return new TextEdit(range, newText);
  }
  constructor(
    public readonly range: Range,
    public readonly newText: string,
  ) {}
}

export const Uri = {
  file: (path: string) => ({ fsPath: path }),
};
