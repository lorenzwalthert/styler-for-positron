/**
 * Unit tests for ConfigurationReader.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.5, 14.3, 14.4
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ConfigurationReader } from '../../configurationReader';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Builds a lightweight workspace-configuration stub that mirrors VS Code's API. */
function makeConfig(values: Record<string, unknown>) {
  return {
    get<T>(key: string, defaultValue: T): T {
      return key in values ? (values[key] as T) : defaultValue;
    },
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('ConfigurationReader', () => {
  let reader: ConfigurationReader;
  let getConfigStub: sinon.SinonStub;

  beforeEach(() => {
    reader = new ConfigurationReader();
    getConfigStub = sinon.stub(vscode.workspace, 'getConfiguration');
  });

  afterEach(() => {
    sinon.restore();
  });

  // ── defaults ──────────────────────────────────────────────────────────────

  it('returns default rscriptPath when not configured', () => {
    getConfigStub.returns(makeConfig({}));
    const cfg = reader.getConfig();
    assert.strictEqual(cfg.rscriptPath, 'Rscript');
  });

  it('returns default timeoutMs when not configured', () => {
    getConfigStub.returns(makeConfig({}));
    const cfg = reader.getConfig();
    assert.strictEqual(cfg.timeoutMs, 30000);
  });

  // ── rscriptPath fallback ──────────────────────────────────────────────────

  it('substitutes Rscript when rscriptPath is empty string (Req 14.3)', () => {
    getConfigStub.returns(makeConfig({ rscriptPath: '' }));
    const cfg = reader.getConfig();
    assert.strictEqual(cfg.rscriptPath, 'Rscript');
  });

  it('substitutes Rscript when rscriptPath is whitespace-only (Req 14.3)', () => {
    getConfigStub.returns(makeConfig({ rscriptPath: '   ' }));
    const cfg = reader.getConfig();
    assert.strictEqual(cfg.rscriptPath, 'Rscript');
  });

  it('uses configured rscriptPath when set to a non-empty value', () => {
    getConfigStub.returns(makeConfig({ rscriptPath: '/usr/local/bin/Rscript' }));
    const cfg = reader.getConfig();
    assert.strictEqual(cfg.rscriptPath, '/usr/local/bin/Rscript');
  });

  // ── timeoutMs clamping ────────────────────────────────────────────────────

  it('clamps timeoutMs to minimum 1000 when value is below lower bound (Req 14.4)', () => {
    getConfigStub.returns(makeConfig({ timeoutMs: 0 }));
    const cfg = reader.getConfig();
    assert.strictEqual(cfg.timeoutMs, 1000);
  });

  it('clamps timeoutMs to minimum 1000 when value is negative', () => {
    getConfigStub.returns(makeConfig({ timeoutMs: -500 }));
    const cfg = reader.getConfig();
    assert.strictEqual(cfg.timeoutMs, 1000);
  });

  it('clamps timeoutMs to maximum 300000 when value exceeds upper bound (Req 14.4)', () => {
    getConfigStub.returns(makeConfig({ timeoutMs: 999999 }));
    const cfg = reader.getConfig();
    assert.strictEqual(cfg.timeoutMs, 300000);
  });

  it('preserves timeoutMs when value is exactly 1000 (lower bound)', () => {
    getConfigStub.returns(makeConfig({ timeoutMs: 1000 }));
    const cfg = reader.getConfig();
    assert.strictEqual(cfg.timeoutMs, 1000);
  });

  it('preserves timeoutMs when value is exactly 300000 (upper bound)', () => {
    getConfigStub.returns(makeConfig({ timeoutMs: 300000 }));
    const cfg = reader.getConfig();
    assert.strictEqual(cfg.timeoutMs, 300000);
  });

  it('preserves timeoutMs when value is within bounds', () => {
    getConfigStub.returns(makeConfig({ timeoutMs: 15000 }));
    const cfg = reader.getConfig();
    assert.strictEqual(cfg.timeoutMs, 15000);
  });

  // ── live-read behaviour (Req 4.5) ─────────────────────────────────────────

  it('re-reads configuration on every call so live changes are picked up (Req 4.5)', () => {
    getConfigStub
      .onFirstCall()
      .returns(makeConfig({ rscriptPath: '/first/Rscript' }));
    getConfigStub
      .onSecondCall()
      .returns(makeConfig({ rscriptPath: '/second/Rscript' }));

    const first = reader.getConfig();
    const second = reader.getConfig();

    assert.strictEqual(first.rscriptPath, '/first/Rscript');
    assert.strictEqual(second.rscriptPath, '/second/Rscript');
    assert.strictEqual(getConfigStub.callCount, 2);
  });
});
