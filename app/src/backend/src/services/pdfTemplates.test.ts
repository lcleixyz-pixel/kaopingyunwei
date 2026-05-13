import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_PDF_TEMPLATES,
  PDF_TEMPLATE_KEYS,
  canWritePdfTemplates,
  formatPdfTemplateRecord,
  getDefaultPdfTemplateDefinition,
  validatePdfTemplateDefinition,
} from './pdfTemplates.js';

describe('PDF template configuration rules', () => {
  it('keeps every built-in PDF template valid', () => {
    assert.deepEqual(Object.keys(DEFAULT_PDF_TEMPLATES).sort(), [...PDF_TEMPLATE_KEYS].sort());

    for (const key of PDF_TEMPLATE_KEYS) {
      assert.doesNotThrow(() => validatePdfTemplateDefinition(key, getDefaultPdfTemplateDefinition(key)));
    }
  });

  it('rejects template definitions that reference non-whitelisted fields', () => {
    const definition = getDefaultPdfTemplateDefinition('CERT_SUPPLY_REQUEST');
    if (definition.kind !== 'standard') throw new Error('expected standard template');

    assert.throws(
      () => validatePdfTemplateDefinition('CERT_SUPPLY_REQUEST', {
        ...definition,
        rows: [
          ...definition.rows,
          { label: '危险字段', source: 'process.env.SECRET' },
        ],
      }),
      /字段来源不允许/,
    );
  });

  it('rejects certificate print fields outside the supported page coordinate range', () => {
    const definition = getDefaultPdfTemplateDefinition('CERTIFICATE_PRINT');
    if (definition.kind !== 'certificate-print') throw new Error('expected certificate print template');

    assert.throws(
      () => validatePdfTemplateDefinition('CERTIFICATE_PRINT', {
        ...definition,
        fields: [
          ...definition.fields,
          {
            id: 'bad-field',
            label: '越界字段',
            source: 'certNo',
            xMm: -1,
            yMm: 10,
            widthMm: 20,
            heightMm: 8,
            fontSize: 12,
            align: 'center',
          },
        ],
      }),
      /坐标必须在 A4 页面范围内/,
    );
  });

  it('rejects table templates without visible columns', () => {
    const definition = getDefaultPdfTemplateDefinition('CERT_PRINT_SIGNATURE');
    if (definition.kind !== 'standard' || !definition.table) throw new Error('expected table template');

    assert.throws(
      () => validatePdfTemplateDefinition('CERT_PRINT_SIGNATURE', {
        ...definition,
        table: {
          ...definition.table,
          columns: [],
        },
      }),
      /表格至少需要一列/,
    );
  });

  it('keeps PDF template writes limited to system and headquarters admins', () => {
    assert.equal(canWritePdfTemplates('SYS_ADMIN'), true);
    assert.equal(canWritePdfTemplates('HQ_ADMIN'), true);
    assert.equal(canWritePdfTemplates('BRANCH_ADMIN'), false);
    assert.equal(canWritePdfTemplates('BRANCH_STAFF'), false);
  });

  it('falls back to the built-in template when no database record is available', () => {
    const formatted = formatPdfTemplateRecord('CERT_DESTROY_BATCH', null);

    assert.equal(formatted.key, 'CERT_DESTROY_BATCH');
    assert.equal(formatted.isDefault, true);
    assert.equal(formatted.name, DEFAULT_PDF_TEMPLATES.CERT_DESTROY_BATCH.name);
    assert.deepEqual(formatted.definition, DEFAULT_PDF_TEMPLATES.CERT_DESTROY_BATCH.definition);
  });
});
