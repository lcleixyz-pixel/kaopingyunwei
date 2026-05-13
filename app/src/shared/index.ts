// ═══════════════════════════════════════════════════
// 共享类型定义 — 前后端通用
// ═══════════════════════════════════════════════════

// ─── 通用响应格式 ───
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

// ─── 租户 ───
export type TenantType = 'HQ' | 'BRANCH';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface Tenant {
  id: string;
  code: string;
  name: string;
  type: TenantType;
  status: TenantStatus;
  contactName?: string;
  contactPhone?: string;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── 用户 ───
export type UserRole = 'SYS_ADMIN' | 'HQ_ADMIN' | 'HQ_STAFF' | 'BRANCH_ADMIN' | 'BRANCH_STAFF' | 'EXAMINER' | 'INSPECTOR';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export interface User {
  id: string;
  tenantId?: string;
  tenant?: Tenant;
  username: string;
  realName: string;
  role: UserRole;
  phone?: string;
  email?: string;
  status: UserStatus;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserManagementOptions {
  tenants: Pick<Tenant, 'id' | 'code' | 'name' | 'type' | 'status'>[];
  roles: UserRole[];
}

export interface CreateUserInput {
  tenantId: string;
  username: string;
  realName: string;
  role: UserRole;
  phone?: string | null;
  email?: string | null;
  password: string;
  status?: UserStatus;
}

export interface UpdateUserInput {
  realName?: string;
  role?: UserRole;
  phone?: string | null;
  email?: string | null;
  status?: UserStatus;
}

// ─── 考评计划 ───
export type PlanStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'CANCELLED';

const PRECIOUS_METAL_AND_GEMSTONE_OCCUPATION = '贵金属首饰与宝玉石检测员';
const ENTRY_LEVEL_WORK_TYPE = '贵金属首饰与宝玉石检测员';
const ADVANCED_WORK_TYPES = ['贵金属首饰检验员', '钻石检验员', '宝石检验员', '玉石检验员', '有机宝石检验员'] as const;

export const LEVEL_OPTIONS = ['一级/高级技师', '二级/技师', '三级/高级工', '四级/中级工', '五级/初级工'] as const;
export type LevelOption = typeof LEVEL_OPTIONS[number];
export const OCCUPATION_OPTIONS = [
  {
    occupation: PRECIOUS_METAL_AND_GEMSTONE_OCCUPATION,
    workTypes: [
      ENTRY_LEVEL_WORK_TYPE,
      ...ADVANCED_WORK_TYPES,
    ],
  },
  {
    occupation: '首饰设计师',
    workTypes: ['首饰设计师'],
  },
] as const;

export const EDUCATION_OPTIONS = ['博士', '研究生', '大学本科', '大学专科和专科学校', '中等专业学校', '技校', '高级技校', '技师学院', '高中', '职高', '初中', '小学'] as const;
export const PROVINCE_OPTIONS = ['北京市', '天津市', '河北省', '山西省', '内蒙古自治区', '辽宁省', '吉林省', '黑龙江省', '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区', '海南省', '重庆市', '四川省', '贵州省', '云南省', '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区', '台湾省', '香港特别行政区', '澳门特别行政区'] as const;
export const CANDIDATE_SOURCE_OPTIONS = ['国有企业', '集体企业', '私营企业', '个体企业', '外商投资', '港澳台商投资', '职业高中', '普通技工学校', '高级技工学校', '技师学院', '职业技术学院', '普通中专', '普通高中', '普通大专', '普通大学', '研究生院', '其它', '下岗失业人员', '现役军人', '农民工', '劳改劳教人员', '其他人员', '机关事业单位'] as const;
export const REGISTRATION_ORGANIZATION_OPTIONS = ['国家珠宝玉石首饰检验集团有限公司', '国检教育科技（深圳）有限公司', '新疆中和鉴珠宝玉石质量检测研究所（有限公司）', '宝检教育科技（云南）有限公司'] as const;
export const RECOGNITION_CATEGORY_OPTIONS = ['初次认定', '晋级认定'] as const;
export const EXAM_TYPE_OPTIONS = ['正考', '补考'] as const;
export const ETHNICITY_OPTIONS = ['汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '布依族', '朝鲜族', '满族', '侗族', '瑶族', '白族', '土家族', '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族', '佤族', '畲族', '高山族', '拉祜族', '水族', '东乡族', '纳西族', '景颇族', '柯尔克孜族', '土族', '达斡尔族', '仫佬族', '羌族', '布朗族', '撒拉族', '毛南族', '仡佬族', '锡伯族', '阿昌族', '普米族', '塔吉克族', '怒族', '乌孜别克族', '俄罗斯族', '鄂温克族', '德昂族', '保安族', '裕固族', '京族', '塔塔尔族', '独龙族', '鄂伦春族', '赫哲族', '门巴族', '珞巴族', '基诺族'] as const;

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

export function normalizeLevelLabel(value?: string | null): string {
  if (!value) return '';
  const text = String(value).trim();
  if (LEVEL_OPTIONS.includes(text as typeof LEVEL_OPTIONS[number])) return text;
  const clean = text.replace(/级/g, '').trim();
  const labels: Record<string, string> = {
    '1': '一级/高级技师',
    '2': '二级/技师',
    '3': '三级/高级工',
    '4': '四级/中级工',
    '5': '五级/初级工',
  };
  return labels[clean] || text;
}

export function getApplicationConditionsForLevel(level?: string | null): readonly ApplicationConditionOption[] {
  const normalizedLevel = normalizeLevelLabel(level);
  if (!LEVEL_OPTIONS.includes(normalizedLevel as LevelOption)) return [];
  return APPLICATION_CONDITIONS_BY_LEVEL[normalizedLevel as LevelOption];
}

export function getWorkTypesForOccupation(occupation: string, level?: string): string[] {
  if (occupation === PRECIOUS_METAL_AND_GEMSTONE_OCCUPATION) {
    const normalizedLevel = normalizeLevelLabel(level || '');
    if (normalizedLevel === '五级/初级工') return [ENTRY_LEVEL_WORK_TYPE];
    if (normalizedLevel) return [...ADVANCED_WORK_TYPES];
  }
  return OCCUPATION_OPTIONS.find((item) => item.occupation === occupation)?.workTypes.slice() || [];
}

export interface ExamPlan {
  id: string;
  tenantId: string;
  tenant?: Tenant;
  title: string;
  occupation: string;
  examDate: string;
  registrationDeadline: string;
  profession: string;
  level: string;
  location: string;
  maxCandidates: number;
  status: PlanStatus;
  notes?: string;
  createdBy: string;
  nodes?: ExamNode[];
  registrationClosed?: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    candidates?: number;
    nodes?: number;
  };
}

// ─── 考评节点（核心业务） ───
export type NodeType =
  | 'PLAN_CREATE'
  | 'REGISTRATION'
  | 'ROOM_ARRANGE'
  | 'EXAM_PREPARE'
  | 'EXAM_DAY'
  | 'SCORE_RECORD'
  | 'SCORE_PUBLISH'
  | 'CERT_MANAGE'
  | 'COMPLETE';

export type NodeStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';

export interface ExamNode {
  id: string;
  planId: string;
  plan?: ExamPlan;
  nodeType: NodeType;
  deadline: string;
  completedAt?: string;
  status: NodeStatus;
  assignedTo?: string;
  notes?: string;
  attachments?: string[];
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
}

// 节点元数据（前端展示用）
export interface NodeMeta {
  type: NodeType;
  label: string;
  description: string;
  deadlineDays: number;  // 相对考试日期的天数（考前为负，考后为正）
  isMandatory: boolean;  // 是否强制执行
}

// ─── 考生 ───
export type CandidateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXAMINED' | 'PASSED' | 'FAILED';
export type PaymentStatus = 'UNPAID' | 'PAID';
export type ProspectiveCandidateStatus = 'FOLLOWING' | 'CONVERTED' | 'NOT_INTERESTED';

export interface RegistrationGateResult {
  isEligible: boolean;
  templateComplete: boolean;
  materialComplete: boolean;
  approvalComplete: boolean;
  missingFields: string[];
  missingMaterials: string[];
  invalidFields: string[];
}

export interface CandidateRegistrationProfile {
  id?: string;
  registrationFields: Record<string, string>;
  materials: Record<string, boolean>;
  paymentStatus?: PaymentStatus;
  completeness: RegistrationGateResult;
}

export interface Candidate {
  id: string;
  tenantId: string;
  planId: string;
  name: string;
  idCard: string;
  phone?: string;
  gender: string;
  education?: string;
  workYears?: number;
  photo?: string;
  applyLevel: string;
  status: CandidateStatus;
  examRoom?: string;
  seatNo?: string;
  registrationProfile?: CandidateRegistrationProfile;
  plan?: ExamPlan;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectiveCandidate {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  intendedOccupation?: string;
  intendedProfession?: string;
  intendedLevel?: string;
  source?: string;
  status: ProspectiveCandidateStatus;
  notes?: string;
  convertedCandidateId?: string;
  convertedCandidate?: Pick<Candidate, 'id' | 'name' | 'planId'> & {
    plan?: Pick<ExamPlan, 'id' | 'title' | 'occupation' | 'profession' | 'level'>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ConvertProspectiveCandidateRequest {
  planId: string;
  idCard: string;
  gender: 'M' | 'F';
  education?: string;
  workYears?: number;
}

export interface ConvertProspectiveCandidateResponse {
  prospectiveCandidate: ProspectiveCandidate;
  candidate: Candidate;
}

export interface LocalUploadBatch {
  id: string;
  planId: string;
  status: 'UPLOADED';
  uploadedAt: string;
  uploadedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 成绩 ───
export interface Score {
  id: string;
  candidateId: string;
  candidate?: Candidate;
  theoryScore?: number;
  practiceScore?: number;
  comprehensiveScore?: number;
  workPerformanceScore?: number;
  totalScore?: number;
  theoryAbsent?: boolean;
  practiceAbsent?: boolean;
  comprehensiveAbsent?: boolean;
  workPerformanceAbsent?: boolean;
  isPass: boolean;
  resultStatus?: 'PASS' | 'FAIL' | 'INCOMPLETE';
  source?: 'MANUAL' | 'IMPORT';
  sourceFileName?: string;
  evaluatedBy?: string;
  verifiedBy?: string;
  evaluatedAt?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScoreCandidateRow {
  candidate: Candidate;
  score?: Score | null;
  requiredSubjects: Array<'theory' | 'practice' | 'comprehensive'>;
  isComplete: boolean;
  resultStatus: 'PASS' | 'FAIL' | 'INCOMPLETE';
}

export interface ScorePlanOption extends ExamPlan {
  scoreRecordNodeId?: string;
  scoreRecordNodeStatus?: NodeStatus;
}

export interface ImportedScoreRow {
  rowNumber: number;
  ticketNo: string;
  name: string;
  gender: string;
  idCard: string;
  organization: string;
  profession: string;
  level: string;
  theoryScore: number | null;
  practiceScore: number | null;
  comprehensiveScore: number | null;
  workPerformanceScore: number | null;
  theoryAbsent: boolean;
  practiceAbsent: boolean;
  comprehensiveAbsent: boolean;
  workPerformanceAbsent: boolean;
}

export interface ScoreImportPreviewRow {
  importRow: ImportedScoreRow;
  candidate?: Candidate;
  matched: boolean;
  nameMismatch: boolean;
  messages: string[];
  resultStatus: 'PASS' | 'FAIL' | 'INCOMPLETE';
  isPass: boolean;
}

export interface ScoreImportPreview {
  rows: ScoreImportPreviewRow[];
  summary: {
    total: number;
    matched: number;
    unmatched: number;
    nameMismatches: number;
    pass: number;
    fail: number;
    incomplete: number;
  };
}

// ─── 证书 ───
export type CertStatus = 'PENDING' | 'PRINTED' | 'ISSUED' | 'REISSUE_REQUESTED';
export type CertNoSource = 'LOCAL_IMPORT' | 'MANUAL' | 'LEGACY_AUTO';

export interface Certificate {
  id: string;
  candidateId: string;
  candidate?: Candidate;
  certNo: string;
  certNoSource: CertNoSource;
  issueDate?: string;
  certDisplayIssueDate?: string;
  status: CertStatus;
  issuedBy?: string;
  printedAt?: string;
  issuedAt?: string;
  deliveryMethod?: string;
  receiverName?: string;
  receiverPhone?: string;
  mailingAddress?: string;
  trackingNo?: string;
  printBatchNo?: string;
  verificationJson?: string;
  issueNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 档案 ───
export type ArchiveStatus = 'SEALED' | 'OPENED';

export interface Archive {
  id: string;
  planId: string;
  plan?: ExamPlan;
  filePath: string;
  fileSize: number;
  sealHash: string;
  status: ArchiveStatus;
  createdAt: string;
}

export type ArchiveReportBatchStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface ArchiveSummaryRow {
  occupation: string;
  profession: string;
  level: string;
  quantity: number;
}

export interface ArchiveReportPlan {
  id: string;
  title: string;
  tenant?: Pick<Tenant, 'id' | 'code' | 'name' | 'type'>;
  examDate: string;
  occupation: string;
  profession: string;
  level: string;
  certNode?: {
    id: string;
    status: string;
    completedAt?: string;
  } | null;
  completeRecordCount: number;
  reminder?: string | null;
  activeBatch?: Pick<ArchiveReportBatch, 'id' | 'batchNo' | 'title' | 'status'> | null;
}

export interface ArchiveReportBatch {
  id: string;
  tenantId: string;
  tenant?: Pick<Tenant, 'id' | 'code' | 'name' | 'type'>;
  batchNo: string;
  title: string;
  uploadDate: string;
  dataType: string;
  unitLeader: string;
  informationManager: string;
  status: ArchiveReportBatchStatus;
  recordCount: number;
  summaryRows?: ArchiveSummaryRow[];
  planIds?: string[];
  plans?: Array<Pick<ExamPlan, 'id' | 'title' | 'examDate' | 'occupation' | 'profession' | 'level'>>;
  signedFile?: {
    originalName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
  } | null;
  dataSnapshot?: {
    fileSize?: number | null;
    hash?: string | null;
  } | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 提醒 ───
export type ReminderType = 'NODE_START' | 'NODE_DEADLINE' | 'NODE_OVERDUE' | 'SYSTEM_NOTICE';
export type ReminderStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface Reminder {
  id: string;
  nodeId: string;
  userId: string;
  user?: User;
  type: ReminderType;
  content: string;
  scheduledAt: string;
  sentAt?: string;
  channel: string;
  status: ReminderStatus;
  createdAt: string;
}

// ─── 工作日历 ───
export interface WorkdayCalendar {
  id: string;
  tenantId: string;
  tenant?: Pick<Tenant, 'id' | 'code' | 'name' | 'type'>;
  holidays: string[];
  workdays: string[];
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 导出模板 ───
export interface ExportTemplateMapping {
  field: string;
  cell: string;
  label?: string;
}

export interface ExportTemplate {
  id: string;
  tenantId: string;
  tenant?: Pick<Tenant, 'id' | 'code' | 'name' | 'type'>;
  name: string;
  type: string;
  fileName?: string;
  mappings: ExportTemplateMapping[];
  isDefault: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── PDF 打印模板 ───
export type PdfTemplateKey =
  | 'CERT_SUPPLY_REQUEST'
  | 'CERT_PRINT_SIGNATURE'
  | 'CERTIFICATE_PRINT'
  | 'CERT_DESTROY_BATCH'
  | 'ARCHIVE_TABLE5';

export interface PdfTemplatePageDefinition {
  size: 'A4';
  layout: 'portrait' | 'landscape';
  margin: number;
}

export interface PdfTemplateTypographyDefinition {
  titleSize: number;
  rowSize: number;
  tableHeaderSize: number;
  tableBodySize: number;
}

export interface StandardPdfTemplateDefinition {
  kind: 'standard';
  layout?: 'field-list' | 'supply-request-form';
  title: string;
  description?: string;
  page: PdfTemplatePageDefinition;
  typography: PdfTemplateTypographyDefinition;
  rows: Array<{ label: string; source: string }>;
  table?: {
    rowsSource: string;
    columns: Array<{ label: string; source: string; width?: number }>;
  };
  signatures: string[];
  footerNote?: string;
}

export interface CertificatePrintTemplateDefinition {
  kind: 'certificate-print';
  title: string;
  description?: string;
  page: PdfTemplatePageDefinition & { layout: 'landscape' };
  fields: Array<{
    id: string;
    label: string;
    source: string;
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    fontSize: number;
    align: 'left' | 'center' | 'right';
  }>;
}

export interface Table5PdfTemplateDefinition {
  kind: 'table5';
  title: string;
  codeLabel?: string;
  page: PdfTemplatePageDefinition;
  typography: PdfTemplateTypographyDefinition;
  labels: Record<string, string>;
  signatures: {
    informationManagerOpinion: string;
    unitOpinion: string;
  };
  overflowNote?: string;
}

export type PdfTemplateDefinition =
  | StandardPdfTemplateDefinition
  | CertificatePrintTemplateDefinition
  | Table5PdfTemplateDefinition;

export interface PdfTemplate {
  id?: string;
  key: PdfTemplateKey;
  name: string;
  version: number;
  definition: PdfTemplateDefinition;
  isEnabled: boolean;
  isDefault: boolean;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ─── 审计日志 ───
export interface AuditLog {
  id: string;
  tenantId: string;
  userId?: string;
  user?: User;
  action: string;
  target: string;
  targetId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  createdAt: string;
}

// ─── 仪表盘数据 ───
export interface DashboardStats {
  totalPlans: number;
  activePlans: number;
  completedPlans: number;
  overdueNodes: number;
  pendingNodes: number;
  draftPlans?: number;
  publishedPlans?: number;
  preExamPlans?: number;
  postExamPlans?: number;
  riskPlans?: number;
  pendingReminders?: number;
  totalCandidates: number;
  totalBranches: number;
  recentActivities: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'NODE_COMPLETE' | 'NODE_OVERDUE' | 'PLAN_CREATE' | 'CANDIDATE_REGISTER' | 'SCORE_RECORD' | 'SYSTEM';
  title: string;
  description: string;
  timestamp: string;
  userName?: string;
}

// ─── AI运维 ───
export interface HealthStatus {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  database: { status: string; latency: number; size?: number };
  disk: { used: number; total: number; percent: number };
  memory: { used: number; total: number; percent: number };
  uptime: number;
  version: string;
  lastBackup?: { fileName: string; createdAt: string; size: number } | null;
}

export interface BackupInfo {
  id: string;
  fileName?: string;
  size: number;
  createdAt: string;
  status?: 'SUCCESS' | 'FAILED';
}

export interface ExportPackageInfo {
  packageName: string;
  files: Array<{ name: string; description: string }>;
  fileSize: number;
  downloadUrl: string;
  expiresAt: string;
}

// ─── 认证 ───
export interface LoginRequest {
  username: string;
  password: string;
  tenantCode?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  tenant: Tenant;
}
