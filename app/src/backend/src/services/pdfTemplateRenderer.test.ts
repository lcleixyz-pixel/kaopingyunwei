import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDefaultPdfTemplateDefinition } from './pdfTemplates.js';
import { renderStandardPdfTemplate, renderTable5PdfTemplate } from './pdfTemplateRenderer.js';

class RecordingPdfDocument {
  x = 42;
  y = 42;
  page = { width: 595.28, height: 841.89 };
  calls: Array<{ type: string; text?: string; x?: number; y?: number; width?: number; height?: number }> = [];

  fontSize(): this {
    return this;
  }

  fillColor(): this {
    return this;
  }

  text(text: string, x?: number | object, y?: number, options?: { width?: number; height?: number }): this {
    this.calls.push({
      type: 'text',
      text,
      x: typeof x === 'number' ? x : undefined,
      y,
      width: options?.width,
      height: options?.height,
    });
    return this;
  }

  rect(x: number, y: number, width: number, height: number): this {
    this.calls.push({ type: 'rect', x, y, width, height });
    return this;
  }

  stroke(): this {
    return this;
  }

  addPage(): this {
    this.calls.push({ type: 'addPage' });
    this.y = 42;
    return this;
  }

  moveDown(amount = 1): this {
    this.y += amount * 12;
    return this;
  }
}

describe('PDF template renderer', () => {
  it('renders the supply request default as a bordered form table', () => {
    const definition = getDefaultPdfTemplateDefinition('CERT_SUPPLY_REQUEST');
    if (definition.kind !== 'standard') throw new Error('expected standard template');

    assert.equal((definition as { layout?: string }).layout, 'supply-request-form');

    const doc = new RecordingPdfDocument();
    renderStandardPdfTemplate(doc as unknown as PDFKit.PDFDocument, definition, {
      tenant: { name: '北京分部' },
      requestedAt: '2026-05-13',
      blankCertQuantity: 20,
      shellQuantity: 20,
      contactName: '李老师',
      contactPhone: '13800000000',
      mailingAddress: '北京市朝阳区示例路 1 号',
    });

    const rects = doc.calls.filter((call) => call.type === 'rect');
    const text = doc.calls.filter((call) => call.type === 'text').map((call) => call.text).join('\n');

    assert.ok(rects.length >= 14, 'expected bordered table cells to be drawn');
    assert.match(text, /申请单位/);
    assert.match(text, /申请空白证书\n数量/);
    assert.match(text, /申请证书壳\n数量/);
    assert.match(text, /分支机构\n确认/);
    assert.match(text, /负责人签字：/);
    assert.match(text, /单位盖章：/);
  });

  it('renders every Table 5 summary row without an overflow note', () => {
    const definition = getDefaultPdfTemplateDefinition('ARCHIVE_TABLE5');
    if (definition.kind !== 'table5') throw new Error('expected table5 template');

    const doc = new RecordingPdfDocument();
    renderTable5PdfTemplate(
      doc as unknown as PDFKit.PDFDocument,
      definition,
      {
        tenant: { name: '北京分部' },
        unitLeader: '赵老师',
        informationManager: '钱老师',
        title: '2026年5月职业技能等级证书上报批次',
        uploadDateText: '2026年5月13日',
        dataType: '新增',
      },
      [
        { occupation: '职业一', profession: '工种一', level: '三级/高级工', quantity: 12 },
        { occupation: '职业二', profession: '工种二', level: '四级/中级工', quantity: 8 },
        { occupation: '职业三', profession: '工种三', level: '五级/初级工', quantity: 6 },
      ],
      26,
    );

    const text = doc.calls.filter((call) => call.type === 'text').map((call) => call.text).join('\n');
    const unitLeaderLabel = doc.calls.find((call) => call.type === 'text' && call.text === definition.labels.unitLeader);
    const informationManagerLabel = doc.calls.find((call) => call.type === 'text' && call.text === definition.labels.informationManager);

    assert.match(text, /职业一/);
    assert.match(text, /职业二/);
    assert.match(text, /职业三/);
    assert.match(text, /^表5\n/);
    assert.match(text, /新增/);
    assert.doesNotMatch(text, /仅显示前 2 项/);
    assert.doesNotMatch(text, /完整明细以数据表为准/);
    assert.notEqual(unitLeaderLabel?.y, informationManagerLabel?.y);
  });
});
