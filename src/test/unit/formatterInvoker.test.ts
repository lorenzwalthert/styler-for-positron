/**
 * Unit tests for FormatterInvoker.buildInvokeSpec.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 13.3
 */

import * as assert from 'assert';
import { buildInvokeSpec } from '../../formatterInvoker';
import { ExtensionConfig } from '../../types';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ExtensionConfig> = {}): ExtensionConfig {
  return {
    rscriptPath: 'Rscript',
    timeoutMs: 30000,
    cacheRoot: 'styler-perm',
    ...overrides,
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('FormatterInvoker.buildInvokeSpec', () => {
  // ── args shape (Req 5.1, 5.2) ─────────────────────────────────────────────

  it('returns args array with exactly 3 elements', () => {
    const spec = buildInvokeSpec(makeConfig(), 'x <- 1\n');
    assert.strictEqual(spec.args.length, 3);
  });

  it('sets args[0] to --vanilla (Req 5.1)', () => {
    const spec = buildInvokeSpec(makeConfig(), 'x <- 1\n');
    assert.strictEqual(spec.args[0], '--vanilla');
  });

  it('sets args[1] to -e (Req 5.2)', () => {
    const spec = buildInvokeSpec(makeConfig(), 'x <- 1\n');
    assert.strictEqual(spec.args[1], '-e');
  });

  it('sets args[2] to a non-empty R expression', () => {
    const spec = buildInvokeSpec(makeConfig(), 'x <- 1\n');
    assert.ok(typeof spec.args[2] === 'string' && spec.args[2].length > 0);
  });

  // ── R expression content ──────────────────────────────────────────────────

  it('R expression calls styler::style_text', () => {
    const spec = buildInvokeSpec(makeConfig(), '');
    assert.ok(
      spec.args[2].includes('styler::style_text'),
      'R expression should call styler::style_text',
    );
  });

  it('R expression reads from stdin', () => {
    const spec = buildInvokeSpec(makeConfig(), '');
    assert.ok(
      spec.args[2].includes('stdin'),
      'R expression should reference stdin',
    );
  });

  // ── stdin pass-through (Req 5.3) ──────────────────────────────────────────

  it('sets stdin to the document text (Req 5.3)', () => {
    const text = 'x<-1+2\n';
    const spec = buildInvokeSpec(makeConfig(), text);
    assert.strictEqual(spec.stdin, text);
  });

  it('passes empty string as stdin when document text is empty', () => {
    const spec = buildInvokeSpec(makeConfig(), '');
    assert.strictEqual(spec.stdin, '');
  });

  it('preserves multi-line document text verbatim as stdin', () => {
    const text = 'f <- function(x) {\n  x + 1\n}\n';
    const spec = buildInvokeSpec(makeConfig(), text);
    assert.strictEqual(spec.stdin, text);
  });

  // ── rscriptPath sourced from config (Req 5.4) ────────────────────────────

  it('uses config.rscriptPath as the rscriptPath field (Req 5.4)', () => {
    const spec = buildInvokeSpec(makeConfig({ rscriptPath: '/usr/bin/Rscript' }), '');
    assert.strictEqual(spec.rscriptPath, '/usr/bin/Rscript');
  });

  it('reflects the default rscriptPath when not overridden', () => {
    const spec = buildInvokeSpec(makeConfig(), '');
    assert.strictEqual(spec.rscriptPath, 'Rscript');
  });

  // ── no shell injection (Req 13.3) ────────────────────────────────────────
  // Document text goes into stdin, NOT embedded in args — verify args do not
  // vary based on document content.

  it('args array is independent of document text (Req 13.3)', () => {
    const baseArgs = buildInvokeSpec(makeConfig(), 'clean text').args;
    const riskyArgs = buildInvokeSpec(makeConfig(), '$(rm -rf /)').args;
    assert.deepStrictEqual(baseArgs, riskyArgs);
  });

  it('document text with shell metacharacters does not appear in args', () => {
    const malicious = '`evil`; rm -rf /; $(inject)';
    const spec = buildInvokeSpec(makeConfig(), malicious);
    for (const arg of spec.args) {
      assert.ok(
        !arg.includes(malicious),
        `arg "${arg}" must not contain raw document text`,
      );
    }
  });

  it('document text with single-quotes does not appear in args', () => {
    const text = "f <- function(x) cat('hello')\n";
    const spec = buildInvokeSpec(makeConfig(), text);
    for (const arg of spec.args) {
      assert.ok(
        !arg.includes(text),
        `arg "${arg}" must not embed document text`,
      );
    }
  });
});
