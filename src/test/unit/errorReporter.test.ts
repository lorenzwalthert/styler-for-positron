/**
 * Unit tests for ErrorReporter and classifyError.
 *
 * Requirements: 6.4, 8.1, 8.2, 9.1, 9.2, 11.1, 11.2
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ErrorReporter, classifyError } from '../../errorReporter';

// Because ErrorKind is a `const enum` its values are inlined at compile time.
// We redeclare the numeric constants here so the tests don't need a const-enum
// import (which would require `isolatedModules` awareness).
const ErrorKind = {
  RscriptNotFound: 0,
  PackageNotFound: 1,
  FormattingFailed: 2,
  Timeout: 3,
  Cancelled: 4,
} as const;
type ErrorKindValue = (typeof ErrorKind)[keyof typeof ErrorKind];

// ── tests ────────────────────────────────────────────────────────────────────

describe('classifyError', () => {
  it('returns PackageNotFound for "could not find function" (Req 8.1)', () => {
    assert.strictEqual(classifyError('Error: could not find function "style_text"'), ErrorKind.PackageNotFound);
  });

  it('returns PackageNotFound for "there is no package called" (Req 8.1)', () => {
    assert.strictEqual(classifyError("Error in library(styler) : there is no package called 'styler'"), ErrorKind.PackageNotFound);
  });

  it('returns PackageNotFound for "Error in library" (Req 8.1)', () => {
    assert.strictEqual(classifyError('Error in library(styler) : no such package'), ErrorKind.PackageNotFound);
  });

  it('returns RscriptNotFound when stderr has "cannot open" and "Rscript" (Req 9.1)', () => {
    assert.strictEqual(classifyError('cannot open the connection to Rscript'), ErrorKind.RscriptNotFound);
  });

  it('returns FormattingFailed for generic stderr (Req 6.4)', () => {
    assert.strictEqual(classifyError('Unexpected token on line 3'), ErrorKind.FormattingFailed);
  });

  it('returns FormattingFailed for empty stderr', () => {
    assert.strictEqual(classifyError(''), ErrorKind.FormattingFailed);
  });

  it('does NOT return RscriptNotFound for "cannot open" alone (no "Rscript")', () => {
    const result = classifyError('cannot open the file');
    assert.notStrictEqual(result, ErrorKind.RscriptNotFound);
  });
});

describe('ErrorReporter.report', () => {
  let reporter: ErrorReporter;
  let showErrorStub: sinon.SinonStub;
  let showWarningStub: sinon.SinonStub;

  beforeEach(() => {
    reporter = new ErrorReporter(30000);
    showErrorStub = sinon.stub(vscode.window, 'showErrorMessage');
    showWarningStub = sinon.stub(vscode.window, 'showWarningMessage');
  });

  afterEach(() => {
    sinon.restore();
  });

  // ── RscriptNotFound (Req 9.2) ─────────────────────────────────────────────

  it('calls showErrorMessage for RscriptNotFound (Req 9.2)', () => {
    reporter.report(ErrorKind.RscriptNotFound as ErrorKindValue);
    sinon.assert.calledOnce(showErrorStub);
  });

  it('RscriptNotFound message mentions rscriptPath setting', () => {
    reporter.report(ErrorKind.RscriptNotFound as ErrorKindValue);
    const msg: string = showErrorStub.firstCall.args[0];
    assert.ok(
      msg.includes('rFormatter.rscriptPath') || msg.includes('Rscript'),
      'Message should reference the Rscript path',
    );
  });

  // ── PackageNotFound (Req 8.2) ─────────────────────────────────────────────

  it('calls showErrorMessage for PackageNotFound (Req 8.2)', () => {
    reporter.report(ErrorKind.PackageNotFound as ErrorKindValue);
    sinon.assert.calledOnce(showErrorStub);
  });

  it('PackageNotFound message includes install.packages hint (Req 8.2)', () => {
    reporter.report(ErrorKind.PackageNotFound as ErrorKindValue);
    const msg: string = showErrorStub.firstCall.args[0];
    assert.ok(
      msg.includes('install.packages') || msg.includes('styler'),
      'Message should hint at installing styler',
    );
  });

  // ── FormattingFailed (Req 6.4) ───────────────────────────────────────────

  it('calls showErrorMessage for FormattingFailed (Req 6.4)', () => {
    reporter.report(ErrorKind.FormattingFailed as ErrorKindValue, 'some error detail');
    sinon.assert.calledOnce(showErrorStub);
  });

  it('FormattingFailed message includes first 200 chars of detail (Req 6.4)', () => {
    const detail = 'A'.repeat(300);
    reporter.report(ErrorKind.FormattingFailed as ErrorKindValue, detail);
    const msg: string = showErrorStub.firstCall.args[0];
    assert.ok(msg.includes('A'.repeat(200)), 'Message should include 200-char excerpt');
    assert.ok(!msg.includes('A'.repeat(201)), 'Message should not include more than 200 chars of detail');
  });

  it('FormattingFailed without detail still calls showErrorMessage', () => {
    reporter.report(ErrorKind.FormattingFailed as ErrorKindValue);
    sinon.assert.calledOnce(showErrorStub);
  });

  // ── Timeout (Req 11.1) ────────────────────────────────────────────────────

  it('calls showWarningMessage for Timeout (Req 11.1)', () => {
    reporter.report(ErrorKind.Timeout as ErrorKindValue);
    sinon.assert.calledOnce(showWarningStub);
    sinon.assert.notCalled(showErrorStub);
  });

  it('Timeout message includes configured timeout (Req 11.1)', () => {
    const reporterWith5s = new ErrorReporter(5000);
    reporterWith5s.report(ErrorKind.Timeout as ErrorKindValue);
    const msg: string = showWarningStub.firstCall.args[0];
    assert.ok(msg.includes('5000'), 'Message should include the timeout value');
  });

  // ── Cancelled (Req 11.2) ─────────────────────────────────────────────────

  it('shows no message for Cancelled (Req 11.2)', () => {
    reporter.report(ErrorKind.Cancelled as ErrorKindValue);
    sinon.assert.notCalled(showErrorStub);
    sinon.assert.notCalled(showWarningStub);
  });
});
