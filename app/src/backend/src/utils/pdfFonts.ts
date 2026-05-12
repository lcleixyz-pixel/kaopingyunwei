import { existsSync } from 'node:fs';

export const PDF_CHINESE_FONT_ENV = 'PDF_CHINESE_FONT_PATH';
export const PDF_CHINESE_FONT_FACE_ENV = 'PDF_CHINESE_FONT_FACE';
export const PDF_CHINESE_FONT_MISSING_MESSAGE =
  '未找到可用中文楷体字体，无法生成中文 PDF。请通过 PDF_CHINESE_FONT_PATH 指定可用的中文楷体 .ttf/.otf/.ttc 字体文件；若为 .ttc 字体集合，请同时指定 PDF_CHINESE_FONT_FACE。';

export class PdfFontMissingError extends Error {
  code = 'PDF_FONT_MISSING';
  statusCode = 500;

  constructor() {
    super(PDF_CHINESE_FONT_MISSING_MESSAGE);
  }
}

export interface PdfFontSelection {
  path: string;
  postscriptName?: string;
}

interface PdfFontDocument {
  font(path: string, size?: number): unknown;
  font(path: string, postscriptName: string, size?: number): unknown;
}

export const DEFAULT_CHINESE_FONT_CANDIDATES = [
  { path: '/usr/share/fonts/truetype/arphic/ukai.ttc', postscriptName: 'AR PL UKai CN' },
  { path: '/usr/share/fonts/truetype/arphic-bkai00mp/bkai00mp.ttf' },
  { path: '/System/Library/Fonts/Supplemental/Kaiti.ttc', postscriptName: 'STKaitiSC-Regular' },
  { path: '/System/Library/Fonts/Supplemental/STKaiti.ttf' },
  { path: '/Library/Fonts/Kaiti.ttc', postscriptName: 'STKaitiSC-Regular' },
] as const satisfies readonly PdfFontSelection[];

export const DEFAULT_CERTIFICATE_PRINT_FONT_CANDIDATES = [
  ...DEFAULT_CHINESE_FONT_CANDIDATES,
] as const satisfies readonly PdfFontSelection[];

export interface PdfFontResolveOptions {
  env?: Record<string, string | undefined>;
  exists?: (candidate: string) => boolean;
  candidates?: readonly PdfFontSelection[];
  printCandidates?: readonly PdfFontSelection[];
}

export function resolveChineseFontPath(options: PdfFontResolveOptions = {}): string | null {
  return resolveChinesePdfFont(options)?.path ?? null;
}

export function resolveChinesePdfFont(options: PdfFontResolveOptions = {}): PdfFontSelection | null {
  const env = options.env ?? process.env;
  const exists = options.exists ?? existsSync;
  const envFontPath = env[PDF_CHINESE_FONT_ENV]?.trim();
  const envFontFace = env[PDF_CHINESE_FONT_FACE_ENV]?.trim();
  const candidates = options.candidates ?? DEFAULT_CHINESE_FONT_CANDIDATES;

  return firstExistingFont([envFontPath ? { path: envFontPath, postscriptName: envFontFace || undefined } : undefined, ...candidates], exists);
}

export function requireChineseFontPath(options: PdfFontResolveOptions = {}): string {
  return requireChinesePdfFont(options).path;
}

export function requireChinesePdfFont(options: PdfFontResolveOptions = {}): PdfFontSelection {
  const font = resolveChinesePdfFont(options);
  if (!font) throw new PdfFontMissingError();
  return font;
}

export function resolveCertificatePrintFontPath(options: PdfFontResolveOptions = {}): string | null {
  return resolveCertificatePrintFont(options)?.path ?? null;
}

export function resolveCertificatePrintFont(options: PdfFontResolveOptions = {}): PdfFontSelection | null {
  const env = options.env ?? process.env;
  const exists = options.exists ?? existsSync;
  const envFontPath = env[PDF_CHINESE_FONT_ENV]?.trim();
  const envFontFace = env[PDF_CHINESE_FONT_FACE_ENV]?.trim();
  const printCandidates = options.printCandidates ?? DEFAULT_CERTIFICATE_PRINT_FONT_CANDIDATES;
  const candidates = options.candidates ?? DEFAULT_CHINESE_FONT_CANDIDATES;

  return firstExistingFont([envFontPath ? { path: envFontPath, postscriptName: envFontFace || undefined } : undefined, ...printCandidates, ...candidates], exists);
}

export function requireCertificatePrintFontPath(options: PdfFontResolveOptions = {}): string {
  return requireCertificatePrintFont(options).path;
}

export function requireCertificatePrintFont(options: PdfFontResolveOptions = {}): PdfFontSelection {
  const font = resolveCertificatePrintFont(options);
  if (!font) throw new PdfFontMissingError();
  return font;
}

export function getPdfKitFontArgs(font: PdfFontSelection): [string] | [string, string] {
  if (font.postscriptName) return [font.path, font.postscriptName];
  if (font.path.toLowerCase().endsWith('.ttc')) throw new PdfFontMissingError();
  return [font.path];
}

export function applyPdfFont(doc: PdfFontDocument, font: PdfFontSelection): void {
  const args = getPdfKitFontArgs(font);
  if (args.length === 2) {
    doc.font(args[0], args[1]);
    return;
  }
  doc.font(args[0]);
}

function firstExistingFont(candidates: Array<PdfFontSelection | undefined>, exists: (candidate: string) => boolean): PdfFontSelection | null {
  for (const candidate of candidates) {
    if (candidate && exists(candidate.path)) return candidate;
  }
  return null;
}
