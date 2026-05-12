import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PDF_CHINESE_FONT_MISSING_MESSAGE,
  getPdfKitFontArgs,
  requireChineseFontPath,
  requireChinesePdfFont,
  resolveChinesePdfFont,
  resolveCertificatePrintFontPath,
  resolveChineseFontPath,
} from './pdfFonts.js';

describe('PDF font resolution', () => {
  it('prefers PDF_CHINESE_FONT_PATH when it points to an existing font', () => {
    const fontPath = resolveChineseFontPath({
      env: { PDF_CHINESE_FONT_PATH: '/custom/fonts/Kaiti.ttf' },
      exists: (candidate) => candidate === '/custom/fonts/Kaiti.ttf',
    });

    assert.equal(fontPath, '/custom/fonts/Kaiti.ttf');
  });

  it('carries PDF_CHINESE_FONT_FACE for TTC font collections', () => {
    const font = requireChinesePdfFont({
      env: {
        PDF_CHINESE_FONT_PATH: '/custom/fonts/Kaiti.ttc',
        PDF_CHINESE_FONT_FACE: 'STKaitiSC-Regular',
      },
      exists: (candidate) => candidate === '/custom/fonts/Kaiti.ttc',
    });

    assert.deepEqual(getPdfKitFontArgs(font), ['/custom/fonts/Kaiti.ttc', 'STKaitiSC-Regular']);
  });

  it('recognizes a Linux Chinese Kaiti font collection path', () => {
    const linuxKaitiPath = '/usr/share/fonts/truetype/arphic/ukai.ttc';
    const fontPath = resolveChineseFontPath({
      env: {},
      exists: (candidate) => candidate === linuxKaitiPath,
    });

    assert.equal(fontPath, linuxKaitiPath);
  });

  it('uses Kaithi fonts for certificate template PDFs before generic CJK fonts', () => {
    const kaithiPath = '/usr/share/fonts/truetype/arphic/ukai.ttc';
    const fontPath = resolveCertificatePrintFontPath({
      env: {},
      exists: (candidate) => candidate === '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc' || candidate === kaithiPath,
    });

    assert.equal(fontPath, kaithiPath);
  });

  it('does not silently fall back to non-Kaithi CJK or Kaithi-script fonts', () => {
    const fontPath = resolveChinesePdfFont({
      env: {},
      exists: (candidate) => candidate === '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc' || candidate === '/usr/share/fonts/noto/NotoSansKaithi-Regular.ttf',
    });

    assert.equal(fontPath, null);
  });

  it('throws a clear error when no Chinese font is available', () => {
    assert.throws(
      () => requireChineseFontPath({ env: {}, exists: () => false }),
      (err) => err instanceof Error && err.message === PDF_CHINESE_FONT_MISSING_MESSAGE,
    );
  });
});
