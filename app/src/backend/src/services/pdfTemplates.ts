import { z } from 'zod';

export const PDF_TEMPLATE_KEYS = [
  'CERT_SUPPLY_REQUEST',
  'CERT_PRINT_SIGNATURE',
  'CERTIFICATE_PRINT',
  'CERT_DESTROY_BATCH',
  'ARCHIVE_TABLE5',
] as const;

export type PdfTemplateKey = typeof PDF_TEMPLATE_KEYS[number];

export interface PdfTemplateRecordLike {
  id?: string;
  key: string;
  name: string;
  version: number;
  definitionJson: string;
  isEnabled: boolean;
  updatedBy?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface PdfTemplateStore {
  findMany(args?: unknown): Promise<PdfTemplateRecordLike[]>;
  findUnique(args: { where: { key: string } }): Promise<PdfTemplateRecordLike | null>;
}

export class PdfTemplateValidationError extends Error {
  code = 'PDF_TEMPLATE_VALIDATION_ERROR';
  statusCode = 400;
}

const pageSchema = z.object({
  size: z.literal('A4').default('A4'),
  layout: z.enum(['portrait', 'landscape']).default('portrait'),
  margin: z.number().min(0).max(120).default(42),
});

const typographySchema = z.object({
  titleSize: z.number().min(10).max(36).default(18),
  rowSize: z.number().min(8).max(18).default(11),
  tableHeaderSize: z.number().min(8).max(16).default(10),
  tableBodySize: z.number().min(7).max(14).default(9),
});

const rowSchema = z.object({
  label: z.string().trim().min(1),
  source: z.string().trim().min(1),
});

const tableColumnSchema = z.object({
  label: z.string().trim().min(1),
  source: z.string().trim().min(1),
  width: z.number().min(24).max(220).optional(),
});

const standardDefinitionSchema = z.object({
  kind: z.literal('standard'),
  layout: z.enum(['field-list', 'supply-request-form']).default('field-list'),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  page: pageSchema,
  typography: typographySchema,
  rows: z.array(rowSchema).default([]),
  table: z.object({
    rowsSource: z.string().trim().min(1),
    columns: z.array(tableColumnSchema),
  }).optional(),
  signatures: z.array(z.string()).default([]),
  footerNote: z.string().optional(),
});

const certificateFieldSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  source: z.string().trim().min(1),
  xMm: z.number(),
  yMm: z.number(),
  widthMm: z.number().min(1),
  heightMm: z.number().min(1),
  fontSize: z.number().min(6).max(28),
  align: z.enum(['left', 'center', 'right']).default('center'),
});

const certificateDefinitionSchema = z.object({
  kind: z.literal('certificate-print'),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  page: pageSchema.extend({ layout: z.literal('landscape') }),
  fields: z.array(certificateFieldSchema).min(1),
});

const table5DefinitionSchema = z.object({
  kind: z.literal('table5'),
  title: z.string().trim().min(1),
  codeLabel: z.string().trim().optional().default('表5'),
  page: pageSchema,
  typography: typographySchema,
  labels: z.object({
    basicInfo: z.string().trim().min(1),
    tenantName: z.string().trim().min(1),
    unitLeader: z.string().trim().min(1),
    informationManager: z.string().trim().min(1),
    batchTitle: z.string().trim().min(1),
    uploadDate: z.string().trim().min(1),
    dataInfo: z.string().trim().min(1),
    dataType: z.string().trim().min(1),
    occupation: z.string().trim().min(1),
    profession: z.string().trim().min(1),
    level: z.string().trim().min(1),
    quantity: z.string().trim().min(1),
    total: z.string().trim().min(1),
    informationManagerOpinion: z.string().trim().min(1),
    unitOpinion: z.string().trim().min(1),
  }),
  signatures: z.object({
    informationManagerOpinion: z.string().trim().min(1),
    unitOpinion: z.string().trim().min(1),
  }),
  overflowNote: z.string().trim().optional(),
});

export type StandardPdfTemplateDefinition = z.infer<typeof standardDefinitionSchema>;
export type CertificatePrintTemplateDefinition = z.infer<typeof certificateDefinitionSchema>;
export type Table5PdfTemplateDefinition = z.infer<typeof table5DefinitionSchema>;
export type PdfTemplateDefinition =
  | StandardPdfTemplateDefinition
  | CertificatePrintTemplateDefinition
  | Table5PdfTemplateDefinition;

const pdfTemplateDefinitionSchema = z.discriminatedUnion('kind', [
  standardDefinitionSchema,
  certificateDefinitionSchema,
  table5DefinitionSchema,
]);

export const DEFAULT_PDF_TEMPLATES: Record<PdfTemplateKey, { name: string; version: number; definition: PdfTemplateDefinition }> = {
  CERT_SUPPLY_REQUEST: {
    name: '空白证书/证书壳申请表',
    version: 1,
    definition: {
      kind: 'standard',
      layout: 'supply-request-form',
      title: '空白职业技能等级证书、证书壳申请表',
      page: { size: 'A4', layout: 'portrait', margin: 18 },
      typography: { titleSize: 20, rowSize: 13, tableHeaderSize: 10, tableBodySize: 12 },
      rows: [
        { label: '申请单位', source: 'tenant.name' },
        { label: '申请时间', source: 'requestedAt' },
        { label: '申请空白证书数量', source: 'blankCertQuantity' },
        { label: '申请证书壳数量', source: 'shellQuantity' },
        { label: '联系人', source: 'contactName' },
        { label: '联系电话', source: 'contactPhone' },
        { label: '邮寄地址', source: 'mailingAddress' },
      ],
      signatures: [
        '分支机构\n确认',
        '负责人签字：',
        '单位盖章：',
      ],
    },
  },
  CERT_PRINT_SIGNATURE: {
    name: '证书领取签字记录',
    version: 1,
    definition: {
      kind: 'standard',
      layout: 'field-list',
      title: '职业技能等级证书领取签字记录',
      page: { size: 'A4', layout: 'portrait', margin: 42 },
      typography: { titleSize: 18, rowSize: 11, tableHeaderSize: 10, tableBodySize: 9 },
      rows: [
        { label: '考评计划', source: 'plan.title' },
        { label: '职业/工种/等级', source: 'plan.displayName' },
        { label: '打印责任人', source: 'record.responsiblePerson' },
        { label: '实际打印数量', source: 'record.actualPrintedCount' },
        { label: '日期', source: 'record.createdAt' },
      ],
      table: {
        rowsSource: 'certificates',
        columns: [
          { label: '姓名', source: 'candidate.name', width: 95 },
          { label: '证件号码', source: 'candidate.idCard', width: 120 },
          { label: '证书编号', source: 'certNo', width: 115 },
          { label: '版面发证日期', source: 'certDisplayIssueDate', width: 90 },
          { label: '领取签字', source: 'signatureBlank', width: 90 },
        ],
      },
      signatures: [],
    },
  },
  CERTIFICATE_PRINT: {
    name: '证书套打',
    version: 1,
    definition: {
      kind: 'certificate-print',
      title: '证书套打',
      description: '仅输出字段，请使用总部空白证书纸，A4 横向，打印比例选择 100% 或实际尺寸。',
      page: { size: 'A4', layout: 'landscape', margin: 0 },
      fields: [
        { id: 'name', label: '姓名', source: 'candidate.name', xMm: 192, yMm: 67.6, widthMm: 70, heightMm: 12, fontSize: 14, align: 'center' },
        { id: 'idType', label: '证件类型', source: 'idTypeLabel', xMm: 192, yMm: 80.4, widthMm: 70, heightMm: 12, fontSize: 14, align: 'center' },
        { id: 'idCard', label: '证件号码', source: 'candidate.idCard', xMm: 192, yMm: 94, widthMm: 70, heightMm: 12, fontSize: 14, align: 'center' },
        { id: 'occupation', label: '职业', source: 'candidate.plan.occupation', xMm: 192, yMm: 106.6, widthMm: 70, heightMm: 12, fontSize: 14, align: 'center' },
        { id: 'profession', label: '工种', source: 'candidate.plan.profession', xMm: 192, yMm: 119.6, widthMm: 70, heightMm: 12, fontSize: 14, align: 'center' },
        { id: 'level', label: '等级', source: 'candidate.plan.level', xMm: 192, yMm: 133, widthMm: 70, heightMm: 12, fontSize: 14, align: 'center' },
        { id: 'certNo', label: '证书编号', source: 'certNo', xMm: 192, yMm: 146.4, widthMm: 70, heightMm: 12, fontSize: 14, align: 'center' },
        { id: 'date', label: '发证日期', source: 'certDisplayIssueDate', xMm: 206.3, yMm: 171.5, widthMm: 40.4, heightMm: 8.1, fontSize: 12, align: 'center' },
      ],
    },
  },
  CERT_DESTROY_BATCH: {
    name: '证书销毁登记表',
    version: 1,
    definition: {
      kind: 'standard',
      layout: 'field-list',
      title: '职业技能等级证书作废销毁登记表',
      page: { size: 'A4', layout: 'portrait', margin: 42 },
      typography: { titleSize: 18, rowSize: 11, tableHeaderSize: 10, tableBodySize: 9 },
      rows: [
        { label: '销毁批次', source: 'batch.title' },
        { label: '责任人', source: 'batch.responsiblePerson' },
        { label: '创建时间', source: 'batch.createdAt' },
        { label: '备注', source: 'batch.notes' },
      ],
      table: {
        rowsSource: 'voidRecords',
        columns: [
          { label: '机构', source: 'tenant.name', width: 95 },
          { label: '计划', source: 'plan.title', width: 95 },
          { label: '物品', source: 'itemTypeLabel', width: 95 },
          { label: '数量', source: 'quantity', width: 70 },
          { label: '作废原因', source: 'reason', width: 135 },
        ],
      },
      signatures: ['销毁负责人签字：____________________        监督人签字：____________________'],
    },
  },
  ARCHIVE_TABLE5: {
    name: '表5-职业技能等级证书数据审核确认表',
    version: 1,
    definition: {
      kind: 'table5',
      title: '职业技能等级证书数据审核确认表',
      codeLabel: '表5',
      page: { size: 'A4', layout: 'portrait', margin: 32 },
      typography: { titleSize: 18, rowSize: 10, tableHeaderSize: 10, tableBodySize: 10 },
      labels: {
        basicInfo: '基本信息',
        tenantName: '单位名称',
        unitLeader: '单位负责人',
        informationManager: '信息管理员',
        batchTitle: '标题名称',
        uploadDate: '上传日期',
        dataInfo: '数据信息',
        dataType: '数据类型',
        occupation: '职业名称',
        profession: '工种名称',
        level: '级别',
        quantity: '数量',
        total: '合计',
        informationManagerOpinion: '信息管理员意见',
        unitOpinion: '单位意见',
      },
      signatures: {
        informationManagerOpinion: '签字：                           年      月      日',
        unitOpinion: '中心领导签字：                    单位盖章：                    年      月      日',
      },
    },
  },
};

const ALLOWED_SOURCES: Record<PdfTemplateKey, Set<string>> = {
  CERT_SUPPLY_REQUEST: new Set([
    'tenant.name',
    'requestedAt',
    'blankCertQuantity',
    'shellQuantity',
    'responsiblePerson',
    'contactName',
    'contactPhone',
    'mailingAddress',
    'notes',
  ]),
  CERT_PRINT_SIGNATURE: new Set([
    'plan.title',
    'plan.displayName',
    'record.responsiblePerson',
    'record.actualPrintedCount',
    'record.createdAt',
    'candidate.name',
    'candidate.idCard',
    'certNo',
    'certDisplayIssueDate',
    'signatureBlank',
  ]),
  CERTIFICATE_PRINT: new Set([
    'candidate.name',
    'idTypeLabel',
    'candidate.idCard',
    'candidate.plan.occupation',
    'candidate.plan.profession',
    'candidate.plan.level',
    'certNo',
    'certDisplayIssueDate',
  ]),
  CERT_DESTROY_BATCH: new Set([
    'batch.title',
    'batch.responsiblePerson',
    'batch.createdAt',
    'batch.notes',
    'tenant.name',
    'plan.title',
    'itemTypeLabel',
    'quantity',
    'reason',
  ]),
  ARCHIVE_TABLE5: new Set(),
};

const ALLOWED_ROW_SOURCES: Record<PdfTemplateKey, Set<string>> = {
  CERT_SUPPLY_REQUEST: new Set(),
  CERT_PRINT_SIGNATURE: new Set(['certificates']),
  CERTIFICATE_PRINT: new Set(),
  CERT_DESTROY_BATCH: new Set(['voidRecords']),
  ARCHIVE_TABLE5: new Set(),
};

export function isPdfTemplateKey(value: unknown): value is PdfTemplateKey {
  return typeof value === 'string' && (PDF_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function canWritePdfTemplates(role?: string | null): boolean {
  return role === 'SYS_ADMIN' || role === 'HQ_ADMIN';
}

export function getDefaultPdfTemplateDefinition(key: PdfTemplateKey): PdfTemplateDefinition {
  return deepClone(DEFAULT_PDF_TEMPLATES[key].definition);
}

export function validatePdfTemplateDefinition(key: PdfTemplateKey, definition: unknown): PdfTemplateDefinition {
  const parsed = pdfTemplateDefinitionSchema.safeParse(definition);
  if (!parsed.success) {
    throw new PdfTemplateValidationError(`模板定义格式错误：${parsed.error.issues.map((issue) => issue.message).join('；')}`);
  }

  const result = parsed.data;
  validateTemplateKindMatchesKey(key, result);
  validateFieldSources(key, result);
  validateTemplateTables(result);
  validateCertificateCoordinates(result);
  return result;
}

export function formatPdfTemplateRecord(key: PdfTemplateKey, record?: PdfTemplateRecordLike | null) {
  const fallback = DEFAULT_PDF_TEMPLATES[key];
  if (!record || !record.isEnabled) {
    return {
      id: record?.id,
      key,
      name: fallback.name,
      version: fallback.version,
      definition: getDefaultPdfTemplateDefinition(key),
      isEnabled: true,
      isDefault: true,
      updatedBy: record?.updatedBy ?? null,
      createdAt: record?.createdAt,
      updatedAt: record?.updatedAt,
    };
  }

  try {
    const definition = validatePdfTemplateDefinition(key, JSON.parse(record.definitionJson));
    return {
      id: record.id,
      key,
      name: record.name || fallback.name,
      version: record.version || fallback.version,
      definition,
      isEnabled: record.isEnabled,
      isDefault: false,
      updatedBy: record.updatedBy ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  } catch {
    return {
      id: record.id,
      key,
      name: fallback.name,
      version: fallback.version,
      definition: getDefaultPdfTemplateDefinition(key),
      isEnabled: true,
      isDefault: true,
      updatedBy: record.updatedBy ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export function formatPdfTemplateRecords(records: PdfTemplateRecordLike[]): ReturnType<typeof formatPdfTemplateRecord>[] {
  const byKey = new Map(records.map((record) => [record.key, record]));
  return PDF_TEMPLATE_KEYS.map((key) => formatPdfTemplateRecord(key, byKey.get(key) ?? null));
}

export async function resolvePdfTemplateDefinition(store: Pick<PdfTemplateStore, 'findUnique'>, key: PdfTemplateKey): Promise<PdfTemplateDefinition> {
  const record = await store.findUnique({ where: { key } });
  return formatPdfTemplateRecord(key, record).definition;
}

function validateTemplateKindMatchesKey(key: PdfTemplateKey, definition: PdfTemplateDefinition): void {
  if (key === 'CERTIFICATE_PRINT' && definition.kind !== 'certificate-print') {
    throw new PdfTemplateValidationError('证书套打模板必须使用 certificate-print 类型');
  }
  if (key === 'ARCHIVE_TABLE5' && definition.kind !== 'table5') {
    throw new PdfTemplateValidationError('表5模板必须使用 table5 类型');
  }
  if (!['CERTIFICATE_PRINT', 'ARCHIVE_TABLE5'].includes(key) && definition.kind !== 'standard') {
    throw new PdfTemplateValidationError('该模板必须使用 standard 类型');
  }
}

function validateFieldSources(key: PdfTemplateKey, definition: PdfTemplateDefinition): void {
  const allowedSources = ALLOWED_SOURCES[key];
  const sources = collectFieldSources(definition);
  const illegal = sources.find((source) => !allowedSources.has(source));
  if (illegal) {
    throw new PdfTemplateValidationError(`字段来源不允许：${illegal}`);
  }

  if (definition.kind === 'standard' && definition.table) {
    const allowedRowSources = ALLOWED_ROW_SOURCES[key];
    if (!allowedRowSources.has(definition.table.rowsSource)) {
      throw new PdfTemplateValidationError(`表格数据来源不允许：${definition.table.rowsSource}`);
    }
  }
}

function validateTemplateTables(definition: PdfTemplateDefinition): void {
  if (definition.kind === 'standard' && definition.table && definition.table.columns.length === 0) {
    throw new PdfTemplateValidationError('表格至少需要一列');
  }
}

function validateCertificateCoordinates(definition: PdfTemplateDefinition): void {
  if (definition.kind !== 'certificate-print') return;
  const maxX = 297;
  const maxY = 210;
  for (const field of definition.fields) {
    const insidePage = field.xMm >= 0
      && field.yMm >= 0
      && field.xMm + field.widthMm <= maxX
      && field.yMm + field.heightMm <= maxY;
    if (!insidePage) {
      throw new PdfTemplateValidationError(`字段 ${field.label} 坐标必须在 A4 页面范围内`);
    }
  }
}

function collectFieldSources(definition: PdfTemplateDefinition): string[] {
  if (definition.kind === 'standard') {
    return [
      ...definition.rows.map((row) => row.source),
      ...(definition.table?.columns.map((column) => column.source) ?? []),
    ];
  }
  if (definition.kind === 'certificate-print') {
    return definition.fields.map((field) => field.source);
  }
  return [];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
