import * as XLSX from 'xlsx';
import type { Candidate, ExamPlan, Tenant } from '@prisma/client';
import { formatDate } from '../utils/dateUtils.js';
import { normalizeLevelLabel } from './phase1Rules.js';
import { formatTenantOfficialName } from './tenantOfficialNames.js';

export interface ExportTemplateMapping {
  field: string;
  cell: string;
  label?: string;
}

export interface CandidateExportTemplate {
  fileBase64?: string | null;
  mappingJson: string;
}

export type CandidateForExport = Candidate & {
  plan: ExamPlan & { tenant: Tenant };
};

export const DEFAULT_CANDIDATE_TEMPLATE_MAPPINGS: ExportTemplateMapping[] = [
  { field: 'plan.title', cell: 'B2', label: '计划名称' },
  { field: 'plan.occupation', cell: 'B3', label: '职业' },
  { field: 'plan.profession', cell: 'B4', label: '工种' },
  { field: 'plan.level', cell: 'D3', label: '等级' },
  { field: 'plan.examDate', cell: 'B5', label: '考试日期' },
  { field: 'candidate.name', cell: 'B6', label: '姓名' },
  { field: 'candidate.genderLabel', cell: 'D6', label: '性别' },
  { field: 'candidate.idCard', cell: 'B7', label: '身份证号' },
  { field: 'candidate.phone', cell: 'B8', label: '手机号' },
  { field: 'candidate.education', cell: 'B9', label: '学历' },
  { field: 'candidate.workYears', cell: 'D9', label: '工龄' },
  { field: 'candidate.applyLevel', cell: 'B10', label: '申报等级' },
  { field: 'plan.location', cell: 'B11', label: '考试地点' },
];

export function parseTemplateMappings(value?: string | null): ExportTemplateMapping[] {
  if (!value) return DEFAULT_CANDIDATE_TEMPLATE_MAPPINGS;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return DEFAULT_CANDIDATE_TEMPLATE_MAPPINGS;

    const mappings = parsed.filter((item): item is ExportTemplateMapping => (
      item
      && typeof item.field === 'string'
      && typeof item.cell === 'string'
      && /^[A-Z]{1,3}[1-9]\d*$/i.test(item.cell)
    ));

    return mappings.length > 0 ? mappings : DEFAULT_CANDIDATE_TEMPLATE_MAPPINGS;
  } catch {
    return DEFAULT_CANDIDATE_TEMPLATE_MAPPINGS;
  }
}

export function renderCandidateRegistrationWorkbook(
  candidates: CandidateForExport[],
  template?: CandidateExportTemplate | null
): Buffer {
  const mappings = parseTemplateMappings(template?.mappingJson);
  const baseWorkbook = template?.fileBase64
    ? XLSX.read(Buffer.from(template.fileBase64, 'base64'), { type: 'buffer' })
    : createDefaultCandidateTemplateWorkbook();

  const firstSheetName = baseWorkbook.SheetNames[0];
  const firstSheet = firstSheetName ? baseWorkbook.Sheets[firstSheetName] : createDefaultCandidateTemplateWorkbook().Sheets['报名表'];

  const output = XLSX.utils.book_new();

  candidates.forEach((candidate, index) => {
    const sheet = cloneWorksheet(firstSheet);
    for (const mapping of mappings) {
      writeCell(sheet, mapping.cell, resolveCandidateField(candidate, mapping.field));
    }

    XLSX.utils.book_append_sheet(output, sheet, uniqueSheetName(candidate.name, index));
  });

  if (candidates.length === 0) {
    XLSX.utils.book_append_sheet(output, cloneWorksheet(firstSheet), '无审核通过考生');
  }

  return XLSX.write(output, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function createDefaultCandidateTemplateWorkbook(): XLSX.WorkBook {
  const rows = [
    ['考生报名表'],
    [],
    ['计划名称', ''],
    ['职业', '', '等级', ''],
    ['工种', ''],
    ['考试日期', '', '考试地点', ''],
    [],
    ['姓名', '', '性别', ''],
    ['身份证号', ''],
    ['手机号', ''],
    ['学历', '', '工龄', ''],
    ['申报等级', ''],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '报名表');
  return workbook;
}

function cloneWorksheet(sheet: XLSX.WorkSheet): XLSX.WorkSheet {
  return JSON.parse(JSON.stringify(sheet)) as XLSX.WorkSheet;
}

function writeCell(sheet: XLSX.WorkSheet, cell: string, value: string | number): void {
  const ref = cell.toUpperCase();
  sheet[ref] = typeof value === 'number'
    ? { t: 'n', v: value }
    : { t: 's', v: value };

  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const address = XLSX.utils.decode_cell(ref);
  range.s.r = Math.min(range.s.r, address.r);
  range.s.c = Math.min(range.s.c, address.c);
  range.e.r = Math.max(range.e.r, address.r);
  range.e.c = Math.max(range.e.c, address.c);
  sheet['!ref'] = XLSX.utils.encode_range(range);
}

function resolveCandidateField(candidate: CandidateForExport, field: string): string | number {
  const values: Record<string, string | number> = {
    'tenant.name': formatTenantOfficialName(candidate.plan.tenant),
    'plan.title': candidate.plan.title,
    'plan.occupation': candidate.plan.occupation,
    'plan.profession': candidate.plan.profession,
    'plan.level': normalizeLevelLabel(candidate.plan.level),
    'plan.examDate': formatDate(candidate.plan.examDate),
    'plan.location': candidate.plan.location,
    'candidate.name': candidate.name,
    'candidate.idCard': candidate.idCard,
    'candidate.phone': candidate.phone || '',
    'candidate.gender': candidate.gender,
    'candidate.genderLabel': candidate.gender === 'F' ? '女' : '男',
    'candidate.education': candidate.education || '',
    'candidate.workYears': candidate.workYears ?? '',
    'candidate.applyLevel': normalizeLevelLabel(candidate.applyLevel),
    'candidate.examRoom': candidate.examRoom || '',
    'candidate.seatNo': candidate.seatNo || '',
  };

  return values[field] ?? '';
}

function uniqueSheetName(name: string, index: number): string {
  const cleanName = (name || `考生${index + 1}`).replace(/[\\/?*[\]:]/g, '').trim() || `考生${index + 1}`;
  const suffix = `-${index + 1}`;
  return `${cleanName.slice(0, 31 - suffix.length)}${suffix}`;
}
