import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as XLSX from 'xlsx';
import {
  APPLICATION_CONDITIONS_BY_LEVEL,
  CANDIDATE_TEMPLATE_HEADERS,
  CANDIDATE_SOURCE_OPTIONS,
  DEFAULT_MATERIALS,
  EDUCATION_OPTIONS,
  ETHNICITY_OPTIONS,
  EXAM_TYPE_OPTIONS,
  defaultRegistrationFieldsFromCandidate,
  filterRegistrationProfileForRole,
  PROVINCE_OPTIONS,
  RECOGNITION_CATEGORY_OPTIONS,
  REGISTRATION_ORGANIZATION_OPTIONS,
  getApplicationConditionsForLevel,
  renderCandidateInfoXls,
  validateRegistrationGate,
} from './candidateRegistration.js';

const templatePath = new URL('../../../../../模版/考生信息模板.xls', import.meta.url);

describe('Phase 1.1 candidate registration template', () => {
  it('keeps the 33 export headers exactly aligned with the local authority template', () => {
    const workbook = XLSX.read(readFileSync(templatePath), { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false });

    assert.deepEqual(rows[0], CANDIDATE_TEMPLATE_HEADERS);
    assert.equal(CANDIDATE_TEMPLATE_HEADERS.length, 33);
  });

  it('exports only the original header row and candidate data rows as .xls content', () => {
    const buffer = renderCandidateInfoXls([
      {
        registrationFields: {
          ...completeFields(),
          序号: '1',
          姓名: '张三',
          证件号码: '110101199001011234',
        },
      },
    ]);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false });

    assert.deepEqual(rows[0], CANDIDATE_TEMPLATE_HEADERS);
    assert.equal(rows.length, 2);
    assert.equal(rows[1][0], '1');
    assert.equal(rows[1][6], '张三');
  });

  it('requires template fields, approval and reduced universal materials before approval/export', () => {
    assert.deepEqual(DEFAULT_MATERIALS.map((item) => item.label), ['身份证', '证件照', '申报表/承诺书']);

    const materials = Object.fromEntries(DEFAULT_MATERIALS.map((item) => [item.key, true]));
    const complete = validateRegistrationGate({
      registrationFields: completeFields(),
      materials,
      candidateStatus: 'APPROVED',
    });

    assert.equal(complete.isEligible, true);

    const needsPriorCertificate = validateRegistrationGate({
      registrationFields: { ...completeFields(), 是否有职业资格证书: '是', 证书等级: '', 证书编号: '' },
      materials,
      candidateStatus: 'APPROVED',
    });

    assert.equal(needsPriorCertificate.isEligible, false);
    assert.deepEqual(needsPriorCertificate.missingFields, ['证书等级', '证书编号']);
    assert.deepEqual(needsPriorCertificate.missingMaterials, []);
  });

  it('exposes application conditions by level and treats the first level-five path as no extra material', () => {
    const levelFiveOptions = getApplicationConditionsForLevel('五级/初级工');

    assert.equal(APPLICATION_CONDITIONS_BY_LEVEL['五级/初级工'].length, 2);
    assert.equal(levelFiveOptions[0].label, '年满16周岁，拟从事本职业或相关职业工作。');
    assert.deepEqual(levelFiveOptions[0].materials, []);
  });

  it('requires the selected application-condition materials in addition to universal materials', () => {
    const condition = getApplicationConditionsForLevel('四级/中级工')[1];
    const fields = {
      ...completeFields(),
      认定等级: '四级/中级工',
      申报条件: condition.label,
    };
    const materials = Object.fromEntries(DEFAULT_MATERIALS.map((item) => [item.key, true]));

    const missingConditionMaterials = validateRegistrationGate({
      registrationFields: fields,
      materials,
      candidateStatus: 'APPROVED',
    });

    assert.equal(missingConditionMaterials.isEligible, false);
    assert.deepEqual(missingConditionMaterials.missingMaterials, condition.materials.map((item) => item.label));

    const complete = validateRegistrationGate({
      registrationFields: fields,
      materials: {
        ...materials,
        ...Object.fromEntries(condition.materials.map((item) => [item.key, true])),
      },
      candidateStatus: 'APPROVED',
    });

    assert.equal(complete.isEligible, true);
  });

  it('rejects an application condition that does not belong to the selected level', () => {
    const fields = {
      ...completeFields(),
      认定等级: '三级/高级工',
      申报条件: getApplicationConditionsForLevel('四级/中级工')[0].label,
    };
    const materials = Object.fromEntries(DEFAULT_MATERIALS.map((item) => [item.key, true]));

    const result = validateRegistrationGate({
      registrationFields: fields,
      materials,
      candidateStatus: 'APPROVED',
    });

    assert.equal(result.isEligible, false);
    assert.deepEqual(result.invalidFields, ['申报条件']);
  });

  it('keeps non-required contact and background fields out of the approval gate', () => {
    const materials = Object.fromEntries(DEFAULT_MATERIALS.map((item) => [item.key, true]));
    const fields = {
      ...completeFields(),
      参加工作时间: '',
      电子邮箱: '',
      户籍所在地: '',
      政治面貌: '',
      学历证书编号: '',
      简要经历: '',
      通讯地址: '',
      邮政编码: '',
      邮寄地址: '',
      证书领取方式: '快递到付',
    };

    const result = validateRegistrationGate({
      registrationFields: fields,
      materials,
      candidateStatus: 'APPROVED',
    });

    assert.equal(result.isEligible, true);
    assert.deepEqual(result.missingFields, []);
  });

  it('exposes fixed option dictionaries for registration fields', () => {
    assert.deepEqual(EDUCATION_OPTIONS, ['博士', '研究生', '大学本科', '大学专科和专科学校', '中等专业学校', '技校', '高级技校', '技师学院', '高中', '职高', '初中', '小学']);
    assert.equal(PROVINCE_OPTIONS.length, 34);
    assert.equal(PROVINCE_OPTIONS.includes('新疆维吾尔自治区'), true);
    assert.deepEqual(CANDIDATE_SOURCE_OPTIONS, ['国有企业', '集体企业', '私营企业', '个体企业', '外商投资', '港澳台商投资', '职业高中', '普通技工学校', '高级技工学校', '技师学院', '职业技术学院', '普通中专', '普通高中', '普通大专', '普通大学', '研究生院', '其它', '下岗失业人员', '现役军人', '农民工', '劳改劳教人员', '其他人员', '机关事业单位']);
    assert.deepEqual(REGISTRATION_ORGANIZATION_OPTIONS, ['国家珠宝玉石首饰检验集团有限公司', '国检教育科技（深圳）有限公司', '新疆中和鉴珠宝玉石质量检测研究所（有限公司）', '宝检教育科技（云南）有限公司']);
    assert.deepEqual(RECOGNITION_CATEGORY_OPTIONS, ['初次认定', '晋级认定']);
    assert.deepEqual(EXAM_TYPE_OPTIONS, ['正考', '补考']);
    assert.equal(ETHNICITY_OPTIONS.length, 56);
    assert.equal(ETHNICITY_OPTIONS[0], '汉族');
    assert.equal(ETHNICITY_OPTIONS.includes('维吾尔族'), true);
  });

  it('rejects invalid fixed option values before approval or export', () => {
    const materials = Object.fromEntries(DEFAULT_MATERIALS.map((item) => [item.key, true]));
    const result = validateRegistrationGate({
      registrationFields: {
        ...completeFields(),
        文化程度: '本科',
        民族: '外星族',
      },
      materials,
      candidateStatus: 'APPROVED',
    });

    assert.equal(result.isEligible, false);
    assert.deepEqual(result.invalidFields, ['文化程度', '民族']);
  });

  it('fills safe defaults from existing candidate and plan fields', () => {
    const fields = defaultRegistrationFieldsFromCandidate({
      name: '李四',
      idCard: '650100199505051111',
      phone: '13900000000',
      gender: 'F',
      education: '本科',
      workYears: 7,
      applyLevel: '3',
      plan: {
        profession: '贵金属首饰与宝玉石检测员',
        level: '3',
      },
    });

    assert.equal(fields.姓名, '李四');
    assert.equal(fields.证件号码, '650100199505051111');
    assert.equal(fields.性别, '女');
    assert.equal(fields.出生日期, '1995-05-05');
    assert.equal(fields.职业工种名称, '贵金属首饰与宝玉石检测员');
    assert.equal(fields.认定等级, '三级/高级工');
  });

  it('hides payment status from headquarters and system administrator roles', () => {
    const profile = {
      id: 'profile-1',
      paymentStatus: 'PAID' as const,
      registrationFields: completeFields(),
      materials: {},
      completeness: { isEligible: true, missingFields: [], missingMaterials: [], invalidFields: [], materialComplete: true, templateComplete: true, approvalComplete: true },
    };

    assert.equal(filterRegistrationProfileForRole(profile, 'BRANCH_ADMIN').paymentStatus, 'PAID');
    assert.equal('paymentStatus' in filterRegistrationProfileForRole(profile, 'HQ_ADMIN'), false);
    assert.equal('paymentStatus' in filterRegistrationProfileForRole(profile, 'SYS_ADMIN'), false);
  });
});

function completeFields(): Record<string, string> {
  const fields = Object.fromEntries(CANDIDATE_TEMPLATE_HEADERS.map((header, index) => [
    header,
    index === 0 ? '1' : `${header}测试值`,
  ]));
  return {
    ...fields,
    认定等级: '五级/初级工',
    申报条件: getApplicationConditionsForLevel('五级/初级工')[0].label,
    是否有职业资格证书: '否',
    证书等级: '',
    证书编号: '',
    文化程度: '大学本科',
    '所在省（市）区': '新疆维吾尔自治区',
    考生来源: '私营企业',
    报名单位: '新疆中和鉴珠宝玉石质量检测研究所（有限公司）',
    认定分类: '初次认定',
    考试类型: '正考',
    民族: '汉族',
  };
}
