import * as XLSX from 'xlsx';

export const CANDIDATE_TEMPLATE_HEADERS = [
  '序号',
  '职业工种名称',
  '认定等级',
  '申报条件',
  '证件类型',
  '证件号码',
  '姓名',
  '性别',
  '出生日期',
  '手机号码',
  '是否有职业资格证书',
  '证书等级',
  '证书编号',
  '文化程度',
  '所在省（市）区',
  '考生来源',
  '所在单位',
  '报名单位',
  '认定分类',
  '专业',
  '考试类型',
  '民族',
  '参加工作时间',
  '电子邮箱',
  '专业年限',
  '户籍所在地',
  '政治面貌',
  '学历证书编号',
  '简要经历',
  '通讯地址',
  '证书领取方式',
  '邮政编码',
  '邮寄地址',
] as const;

export type CandidateTemplateHeader = typeof CANDIDATE_TEMPLATE_HEADERS[number];
export type RegistrationFields = Record<string, string>;
export type PaymentStatus = 'UNPAID' | 'PAID';

export const LEVEL_OPTIONS = ['一级/高级技师', '二级/技师', '三级/高级工', '四级/中级工', '五级/初级工'] as const;
export type LevelOption = typeof LEVEL_OPTIONS[number];
export const EDUCATION_OPTIONS = ['博士', '研究生', '大学本科', '大学专科和专科学校', '中等专业学校', '技校', '高级技校', '技师学院', '高中', '职高', '初中', '小学'] as const;
export const PROVINCE_OPTIONS = [
  '北京市',
  '天津市',
  '河北省',
  '山西省',
  '内蒙古自治区',
  '辽宁省',
  '吉林省',
  '黑龙江省',
  '上海市',
  '江苏省',
  '浙江省',
  '安徽省',
  '福建省',
  '江西省',
  '山东省',
  '河南省',
  '湖北省',
  '湖南省',
  '广东省',
  '广西壮族自治区',
  '海南省',
  '重庆市',
  '四川省',
  '贵州省',
  '云南省',
  '西藏自治区',
  '陕西省',
  '甘肃省',
  '青海省',
  '宁夏回族自治区',
  '新疆维吾尔自治区',
  '台湾省',
  '香港特别行政区',
  '澳门特别行政区',
] as const;
export const CANDIDATE_SOURCE_OPTIONS = ['国有企业', '集体企业', '私营企业', '个体企业', '外商投资', '港澳台商投资', '职业高中', '普通技工学校', '高级技工学校', '技师学院', '职业技术学院', '普通中专', '普通高中', '普通大专', '普通大学', '研究生院', '其它', '下岗失业人员', '现役军人', '农民工', '劳改劳教人员', '其他人员', '机关事业单位'] as const;
export const REGISTRATION_ORGANIZATION_OPTIONS = ['国家珠宝玉石首饰检验集团有限公司', '国检教育科技（深圳）有限公司', '新疆中和鉴珠宝玉石质量检测研究所（有限公司）', '宝检教育科技（云南）有限公司'] as const;
export const RECOGNITION_CATEGORY_OPTIONS = ['初次认定', '晋级认定'] as const;
export const EXAM_TYPE_OPTIONS = ['正考', '补考'] as const;
export const ETHNICITY_OPTIONS = [
  '汉族',
  '蒙古族',
  '回族',
  '藏族',
  '维吾尔族',
  '苗族',
  '彝族',
  '壮族',
  '布依族',
  '朝鲜族',
  '满族',
  '侗族',
  '瑶族',
  '白族',
  '土家族',
  '哈尼族',
  '哈萨克族',
  '傣族',
  '黎族',
  '傈僳族',
  '佤族',
  '畲族',
  '高山族',
  '拉祜族',
  '水族',
  '东乡族',
  '纳西族',
  '景颇族',
  '柯尔克孜族',
  '土族',
  '达斡尔族',
  '仫佬族',
  '羌族',
  '布朗族',
  '撒拉族',
  '毛南族',
  '仡佬族',
  '锡伯族',
  '阿昌族',
  '普米族',
  '塔吉克族',
  '怒族',
  '乌孜别克族',
  '俄罗斯族',
  '鄂温克族',
  '德昂族',
  '保安族',
  '裕固族',
  '京族',
  '塔塔尔族',
  '独龙族',
  '鄂伦春族',
  '赫哲族',
  '门巴族',
  '珞巴族',
  '基诺族',
] as const;

export const DEFAULT_MATERIALS = [
  { key: 'idCard', label: '身份证' },
  { key: 'photo', label: '证件照' },
  { key: 'applicationCommitment', label: '申报表/承诺书' },
] as const;

export interface ApplicationConditionMaterial {
  key: string;
  label: string;
}

export interface ApplicationConditionOption {
  id: string;
  level: LevelOption;
  label: string;
  materials: readonly ApplicationConditionMaterial[];
}

export const APPLICATION_CONDITIONS_BY_LEVEL = {
  '五级/初级工': [
    {
      id: 'level5-condition1',
      level: '五级/初级工',
      label: '年满16周岁，拟从事本职业或相关职业工作。',
      materials: [],
    },
    {
      id: 'level5-condition2',
      level: '五级/初级工',
      label: '年满16周岁，从事本职业或相关职业工作。',
      materials: [
        { key: 'condition_level5_2_work_years', label: '工作年限证明（最好提供相应的社保缴纳记录）' },
      ],
    },
  ],
  '四级/中级工': [
    {
      id: 'level4-condition1',
      level: '四级/中级工',
      label: '累计从事本职业或相关职业工作满5年。',
      materials: [
        { key: 'condition_level4_1_work_years_5', label: '不少于5年的工作年限证明（最好提供相应的社保缴纳记录）' },
      ],
    },
    {
      id: 'level4-condition2',
      level: '四级/中级工',
      label: '取得本职业或相关职业五级/初级工职业资格（职业技能等级）证书后，累计从事本职业或相关职业工作满3年。',
      materials: [
        { key: 'condition_level4_2_level5_certificate', label: '五级/初级工职业资格（职业技能等级）证书扫描件' },
        { key: 'condition_level4_2_work_years_3', label: '不少于3年的工作年限证明（最好提供相应的社保缴纳记录）' },
      ],
    },
    {
      id: 'level4-condition3',
      level: '四级/中级工',
      label: '取得本专业或相关专业的技工院校或中等及以上职业院校、专科及以上普通高等学校毕业证书（含在读应届毕业生）。',
      materials: [
        { key: 'condition_level4_3_education_certificate', label: '相应的毕业证书或学信网注册备案表或应届毕业生在校证明' },
      ],
    },
  ],
  '三级/高级工': [
    {
      id: 'level3-condition1',
      level: '三级/高级工',
      label: '累计从事本职业或相关职业工作满10年。',
      materials: [
        { key: 'condition_level3_1_work_years_10_commitment_social_security', label: '不少于10年的工作年限承诺书及对应的社保缴纳记录' },
      ],
    },
    {
      id: 'level3-condition2',
      level: '三级/高级工',
      label: '取得本职业或相关职业四级/中级工职业资格（职业技能等级）证书后，累计从事本职业或相关职业工作满4年。',
      materials: [
        { key: 'condition_level3_2_level4_certificate', label: '四级/中级工职业资格（职业技能等级）证书扫描件' },
        { key: 'condition_level3_2_work_years_4', label: '不少于4年的工作年限证明（最好提供相应的社保缴纳记录）' },
      ],
    },
    {
      id: 'level3-condition3',
      level: '三级/高级工',
      label: '取得符合专业对应关系的初级职称（专业技术人员职业资格）后，累计从事本职业或相关职业工作满1年。',
      materials: [
        { key: 'condition_level3_3_junior_title_certificate', label: '符合专业对应关系的初级职称证书' },
        { key: 'condition_level3_3_work_years_1', label: '不少于1年的工作年限证明（最好提供相应的社保缴纳记录）' },
      ],
    },
    {
      id: 'level3-condition4',
      level: '三级/高级工',
      label: '取得本专业或相关专业的技工院校高级工班及以上毕业证书（含在读应届毕业生）。',
      materials: [
        { key: 'condition_level3_4_advanced_technician_school_diploma', label: '相应的技工院校毕业证书或应届毕业生在校证明' },
      ],
    },
    {
      id: 'level3-condition5',
      level: '三级/高级工',
      label: '取得本职业或相关职业四级/中级工职业资格（职业技能等级）证书，并取得高等职业学校、专科及以上普通高等学校本专业或相关专业毕业证书（含在读应届毕业生）。',
      materials: [
        { key: 'condition_level3_5_level4_certificate', label: '四级/中级工职业资格（职业技能等级）证书扫描件' },
        { key: 'condition_level3_5_college_diploma', label: '相应的大专及以上的毕业证书或学信网注册备案表或应届毕业生在校证明' },
      ],
    },
    {
      id: 'level3-condition6',
      level: '三级/高级工',
      label: '取得经评估论证的高等职业学校、专科及以上普通高等学校本专业或相关专业的毕业证书（含在读应届毕业生）。',
      materials: [
        { key: 'condition_level3_6_evaluated_college_diploma', label: '相应的大专及以上毕业证书或学信网注册备案表或应届毕业生在校证明' },
      ],
    },
  ],
  '二级/技师': [
    {
      id: 'level2-condition1',
      level: '二级/技师',
      label: '取得本职业或相关职业三级/高级工职业资格（职业技能等级）证书后，累计从事本职业或相关职业工作满5年。',
      materials: [
        { key: 'condition_level2_1_level3_certificate', label: '三级/高级工职业资格（职业技能等级）证书扫描件' },
        { key: 'condition_level2_1_work_years_5_commitment_social_security', label: '不少于5年的工作年限承诺书及对应的社保缴纳记录' },
      ],
    },
    {
      id: 'level2-condition2',
      level: '二级/技师',
      label: '取得符合专业对应关系的初级职称（专业技术人员职业资格）后，累计从事本职业或相关职业工作满5年，并在取得本职业或相关职业三级/高级工职业资格（职业技能等级）证书后，从事本职业或相关职业工作满1年。',
      materials: [
        { key: 'condition_level2_2_junior_title_certificate', label: '符合专业对应关系的初级职称证书' },
        { key: 'condition_level2_2_level3_certificate', label: '三级/高级工职业资格（职业技能等级）证书扫描件' },
        { key: 'condition_level2_2_work_years_5', label: '不少于5年的工作年限证明（最好提供相应的社保缴纳记录）' },
      ],
    },
    {
      id: 'level2-condition3',
      level: '二级/技师',
      label: '取得符合专业对应关系的中级职称（专业技术人员职业资格）后，累计从事本职业或相关职业工作满1年。',
      materials: [
        { key: 'condition_level2_3_intermediate_title_certificate', label: '符合专业对应关系的中级职称证书' },
        { key: 'condition_level2_3_work_years_1_commitment_social_security', label: '不少于1年的工作年限承诺书及对应的社保缴纳记录' },
      ],
    },
    {
      id: 'level2-condition4',
      level: '二级/技师',
      label: '取得本职业或相关职业三级/高级工职业资格（职业技能等级）证书的高级技工学校、技师学院毕业生，累计从事本职业或相关职业工作满2年。',
      materials: [
        { key: 'condition_level2_4_level3_certificate', label: '三级/高级工职业资格（职业技能等级）证书扫描件' },
        { key: 'condition_level2_4_work_years_2', label: '不少于2年的工作年限证明（最好提供相应的社保缴纳记录）' },
        { key: 'condition_level2_4_advanced_school_diploma', label: '相应高级技工学校、技师学院的毕业证书' },
      ],
    },
    {
      id: 'level2-condition5',
      level: '二级/技师',
      label: '取得本职业或相关职业三级/高级工职业资格（职业技能等级）证书满2年的技师学院预备技师班、技师班学生。',
      materials: [
        { key: 'condition_level2_5_level3_certificate_2_years', label: '三级/高级工职业资格（职业技能等级）证书扫描件' },
        { key: 'condition_level2_5_technician_college_diploma', label: '相应技师学院的毕业证书' },
      ],
    },
  ],
  '一级/高级技师': [
    {
      id: 'level1-condition1',
      level: '一级/高级技师',
      label: '取得本职业或相关职业二级/技师职业资格（职业技能等级）证书后，累计从事本职业或相关职业工作满5年。',
      materials: [
        { key: 'condition_level1_1_level2_certificate', label: '二级/技师职业资格（职业技能等级）证书扫描件' },
        { key: 'condition_level1_1_work_years_5_commitment_social_security', label: '不少于5年的工作年限承诺书及对应的社保缴纳记录' },
      ],
    },
    {
      id: 'level1-condition2',
      level: '一级/高级技师',
      label: '取得符合专业对应关系的中级职称后，累计从事本职业或相关职业工作满5年，并在取得本职业或相关职业二级/技师职业资格（职业技能等级）证书后，从事本职业或相关职业工作满1年。',
      materials: [
        { key: 'condition_level1_2_intermediate_title_certificate', label: '符合专业对应关系的中级职称证书' },
        { key: 'condition_level1_2_work_years_5', label: '不少于5年的工作年限证明（最好提供相应的社保缴纳记录）' },
        { key: 'condition_level1_2_level2_certificate', label: '二级/技师职业资格（职业技能等级）证书扫描件' },
      ],
    },
    {
      id: 'level1-condition3',
      level: '一级/高级技师',
      label: '取得符合专业对应关系的高级职称（专业技术人员职业资格）后，累计从事本职业或相关职业工作满1年。',
      materials: [
        { key: 'condition_level1_3_senior_title_certificate', label: '符合专业对应关系的高级职称证书' },
        { key: 'condition_level1_3_work_years_1', label: '不少于1年的工作年限证明（最好提供相应的社保缴纳记录）' },
      ],
    },
  ],
} as const satisfies Record<LevelOption, readonly ApplicationConditionOption[]>;

export const APPLICATION_CONDITION_MATERIALS: readonly ApplicationConditionMaterial[] = Object.values(APPLICATION_CONDITIONS_BY_LEVEL)
  .flatMap((conditions: readonly ApplicationConditionOption[]) => conditions.flatMap((condition) => condition.materials));

export const ALL_MATERIALS: readonly ApplicationConditionMaterial[] = [...DEFAULT_MATERIALS, ...APPLICATION_CONDITION_MATERIALS];

export type MaterialKey = string;
export type MaterialChecklist = Partial<Record<string, boolean>>;

export interface RegistrationGateInput {
  registrationFields: RegistrationFields;
  materials?: MaterialChecklist | Record<string, boolean>;
  candidateStatus?: string;
  requireApproved?: boolean;
}

export interface RegistrationGateResult {
  isEligible: boolean;
  templateComplete: boolean;
  materialComplete: boolean;
  approvalComplete: boolean;
  missingFields: string[];
  missingMaterials: string[];
  invalidFields: string[];
}

export interface RegistrationProfileResponse {
  id?: string;
  registrationFields: RegistrationFields;
  materials: MaterialChecklist;
  paymentStatus?: PaymentStatus;
  completeness: RegistrationGateResult;
}

export interface CandidateDefaultsInput {
  name?: string | null;
  idCard?: string | null;
  phone?: string | null;
  gender?: string | null;
  education?: string | null;
  workYears?: number | null;
  applyLevel?: string | null;
  plan?: {
    profession?: string | null;
    level?: string | null;
    tenant?: { name?: string | null } | null;
  } | null;
}

export interface CandidateInfoExportInput {
  registrationFields: RegistrationFields;
}

const BASE_REQUIRED_FIELDS: CandidateTemplateHeader[] = [
  '职业工种名称',
  '认定等级',
  '申报条件',
  '证件类型',
  '证件号码',
  '姓名',
  '手机号码',
  '是否有职业资格证书',
  '文化程度',
  '所在省（市）区',
  '考生来源',
  '报名单位',
  '认定分类',
  '考试类型',
  '民族',
];

const BRANCH_PAYMENT_VISIBLE_ROLES = new Set(['BRANCH_ADMIN', 'BRANCH_STAFF']);

export function emptyRegistrationFields(): RegistrationFields {
  return Object.fromEntries(CANDIDATE_TEMPLATE_HEADERS.map((header) => [header, '']));
}

export function normalizeRegistrationFields(fields?: Record<string, unknown> | null): RegistrationFields {
  const values = emptyRegistrationFields();
  if (!fields || typeof fields !== 'object') return values;

  for (const header of CANDIDATE_TEMPLATE_HEADERS) {
    const value = fields[header];
    values[header] = value == null ? '' : String(value).trim();
  }

  return values;
}

export function normalizeMaterials(materials?: Record<string, unknown> | null): MaterialChecklist {
  const values = Object.fromEntries(ALL_MATERIALS.map((item) => [item.key, false])) as MaterialChecklist;
  if (!materials || typeof materials !== 'object') return values;

  for (const item of ALL_MATERIALS) {
    values[item.key] = materials[item.key] === true;
  }

  return values;
}

export function getApplicationConditionsForLevel(level?: string | null): readonly ApplicationConditionOption[] {
  const normalizedLevel = toLevelLabel(level);
  if (!isLevelOption(normalizedLevel)) return [];
  return APPLICATION_CONDITIONS_BY_LEVEL[normalizedLevel];
}

export function getSelectedApplicationCondition(fields: RegistrationFields): ApplicationConditionOption | undefined {
  const selectedLabel = fields.申报条件.trim();
  if (!selectedLabel) return undefined;
  return getApplicationConditionsForLevel(fields.认定等级).find((condition) => condition.label === selectedLabel);
}

export function defaultRegistrationFieldsFromCandidate(candidate: CandidateDefaultsInput): RegistrationFields {
  const fields = emptyRegistrationFields();
  const level = candidate.applyLevel || candidate.plan?.level || '';
  const profession = candidate.plan?.profession || '';

  fields.职业工种名称 = profession;
  fields.认定等级 = toLevelLabel(level);
  fields.申报条件 = '';
  fields.证件类型 = '居民身份证';
  fields.证件号码 = candidate.idCard || '';
  fields.姓名 = candidate.name || '';
  fields.性别 = toGenderLabel(candidate.gender);
  fields.出生日期 = getBirthdayFromIdCard(candidate.idCard || '');
  fields.手机号码 = candidate.phone || '';
  fields.是否有职业资格证书 = '否';
  fields.证书等级 = '';
  fields.证书编号 = '';
  fields.文化程度 = candidate.education || '';
  fields['所在省（市）区'] = '';
  fields.考生来源 = '';
  fields.所在单位 = '';
  fields.报名单位 = REGISTRATION_ORGANIZATION_OPTIONS.find((item) => item === candidate.plan?.tenant?.name) || '';
  fields.认定分类 = '初次认定';
  fields.专业 = profession;
  fields.考试类型 = '正考';
  fields.民族 = '';
  fields.参加工作时间 = '';
  fields.电子邮箱 = '';
  fields.专业年限 = candidate.workYears == null ? '' : String(candidate.workYears);
  fields.户籍所在地 = '';
  fields.政治面貌 = '';
  fields.学历证书编号 = '';
  fields.简要经历 = '';
  fields.通讯地址 = '';
  fields.证书领取方式 = '自取';
  fields.邮政编码 = '';
  fields.邮寄地址 = '';

  return fields;
}

export function mergeRegistrationDefaults(
  existing: Record<string, unknown> | RegistrationFields | undefined | null,
  defaults: RegistrationFields
): RegistrationFields {
  const normalized = normalizeRegistrationFields(existing);
  for (const header of CANDIDATE_TEMPLATE_HEADERS) {
    if (!normalized[header] && defaults[header]) {
      normalized[header] = defaults[header];
    }
  }
  return normalized;
}

export function isPriorCertificateRequired(fields: RegistrationFields): boolean {
  return normalizeYesNo(fields.是否有职业资格证书) === '是';
}

export function validateRegistrationGate(input: RegistrationGateInput): RegistrationGateResult {
  const fields = normalizeRegistrationFields(input.registrationFields);
  const materials = normalizeMaterials(input.materials);
  const missingFields = getRequiredFields(fields).filter((field) => !fields[field]);
  const invalidFields = getInvalidOptionFields(fields);
  const missingMaterials = getRequiredMaterials(fields)
    .filter((item) => materials[item.key] !== true)
    .map((item) => item.label);
  const requireApproved = input.requireApproved !== false;
  const approvalComplete = !requireApproved || input.candidateStatus === 'APPROVED';

  return {
    isEligible: missingFields.length === 0 && invalidFields.length === 0 && missingMaterials.length === 0 && approvalComplete,
    templateComplete: missingFields.length === 0 && invalidFields.length === 0,
    materialComplete: missingMaterials.length === 0,
    approvalComplete,
    missingFields,
    missingMaterials,
    invalidFields,
  };
}

export function getRequiredMaterials(fields: RegistrationFields): readonly ApplicationConditionMaterial[] {
  const universalMaterials = DEFAULT_MATERIALS;
  const conditionMaterials = getSelectedApplicationCondition(fields)?.materials || [];
  return [...universalMaterials, ...conditionMaterials];
}

export function formatGateFailure(result: RegistrationGateResult): string {
  const messages: string[] = [];
  if (result.missingFields.length > 0) {
    messages.push(`缺少模板必填项：${result.missingFields.join('、')}`);
  }
  if (result.invalidFields.length > 0) {
    messages.push(`字段选项不合法：${result.invalidFields.join('、')}`);
  }
  if (result.missingMaterials.length > 0) {
    messages.push(`缺少材料勾选：${result.missingMaterials.join('、')}`);
  }
  if (!result.approvalComplete) {
    messages.push('考生尚未审核通过');
  }
  return messages.join('；') || '报名资料未满足导出条件';
}

export function isPaymentVisibleRole(role?: string): boolean {
  return BRANCH_PAYMENT_VISIBLE_ROLES.has(role || '');
}

export function normalizePaymentStatus(value?: unknown): PaymentStatus {
  return value === 'PAID' || value === '已缴' ? 'PAID' : 'UNPAID';
}

export function filterRegistrationProfileForRole<T extends RegistrationProfileResponse>(
  profile: T,
  role?: string
): T | Omit<T, 'paymentStatus'> {
  if (isPaymentVisibleRole(role)) return profile;
  const { paymentStatus: _paymentStatus, ...rest } = profile;
  return rest;
}

export function renderCandidateInfoXls(candidates: CandidateInfoExportInput[]): Buffer {
  const rows = [
    [...CANDIDATE_TEMPLATE_HEADERS],
    ...candidates.map((candidate, index) => {
      const fields = normalizeRegistrationFields(candidate.registrationFields);
      return CANDIDATE_TEMPLATE_HEADERS.map((header) => (
        header === '序号'
          ? fields.序号 || String(index + 1)
          : fields[header]
      ));
    }),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = CANDIDATE_TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(12, header.length * 2 + 2) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'biff8' }) as Buffer;
}

function getRequiredFields(fields: RegistrationFields): CandidateTemplateHeader[] {
  const required = [...BASE_REQUIRED_FIELDS];
  if (fields.证件类型 && fields.证件类型 !== '居民身份证') {
    required.push('性别', '出生日期');
  }
  if (isPriorCertificateRequired(fields)) {
    required.push('证书等级', '证书编号');
  }
  return Array.from(new Set(required));
}

function getInvalidOptionFields(fields: RegistrationFields): CandidateTemplateHeader[] {
  const optionRules: Array<{ field: CandidateTemplateHeader; options: readonly string[] }> = [
    { field: '认定等级', options: LEVEL_OPTIONS },
    { field: '证书等级', options: LEVEL_OPTIONS },
    { field: '文化程度', options: EDUCATION_OPTIONS },
    { field: '所在省（市）区', options: PROVINCE_OPTIONS },
    { field: '考生来源', options: CANDIDATE_SOURCE_OPTIONS },
    { field: '报名单位', options: REGISTRATION_ORGANIZATION_OPTIONS },
    { field: '认定分类', options: RECOGNITION_CATEGORY_OPTIONS },
    { field: '考试类型', options: EXAM_TYPE_OPTIONS },
    { field: '民族', options: ETHNICITY_OPTIONS },
  ];

  const invalidFields = optionRules
    .filter(({ field, options }) => fields[field] && !options.includes(fields[field]))
    .map(({ field }) => field);

  if (fields.申报条件 && !getSelectedApplicationCondition(fields)) {
    invalidFields.push('申报条件');
  }

  return Array.from(new Set(invalidFields));
}

function toLevelLabel(value?: string | null): string {
  if (!value) return '';
  const clean = String(value).replace(/级/g, '').trim();
  const labels: Record<string, string> = {
    '1': '一级/高级技师',
    '2': '二级/技师',
    '3': '三级/高级工',
    '4': '四级/中级工',
    '5': '五级/初级工',
  };
  return labels[clean] || value;
}

function isLevelOption(value: string): value is LevelOption {
  return LEVEL_OPTIONS.includes(value as LevelOption);
}

function toGenderLabel(value?: string | null): string {
  if (value === 'F' || value === '女') return '女';
  if (value === 'M' || value === '男') return '男';
  return value || '';
}

function getBirthdayFromIdCard(value: string): string {
  const match = value.match(/^\d{6}(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function normalizeYesNo(value?: string): '是' | '否' | '' {
  const clean = String(value || '').trim();
  if (clean === '是' || clean.toLowerCase() === 'yes' || clean === '有') return '是';
  if (clean === '否' || clean.toLowerCase() === 'no' || clean === '无') return '否';
  return '';
}
