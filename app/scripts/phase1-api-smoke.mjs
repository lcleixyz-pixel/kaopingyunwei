import sharp from 'sharp';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const HQ_TENANT_CODE = process.env.HQ_TENANT_CODE || 'NGTCS0013';
const BRANCH_TENANT_CODE = process.env.BRANCH_TENANT_CODE || 'BJ001';
const LEVEL3_WORK_YEARS_CONDITION = '累计从事本职业或相关职业工作满10年。';
const LEVEL3_WORK_YEARS_MATERIAL_KEY = 'condition_level3_1_work_years_10_commitment_social_security';

async function main() {
  const unique = Date.now();
  const sys = await login({ username: 'admin', password: 'admin123', tenantCode: HQ_TENANT_CODE });
  const branch = await login({ username: 'bjadmin', password: 'bjadmin123', tenantCode: BRANCH_TENANT_CODE });
  const branchStaff = await login({ username: 'bjstaff', password: 'bjstaff123', tenantCode: BRANCH_TENANT_CODE });
  const hq = await login({ username: 'hqadmin', password: 'hqadmin123', tenantCode: HQ_TENANT_CODE });

  const examDate = new Date();
  examDate.setDate(examDate.getDate() + 45);
  const registrationDeadline = new Date();
  registrationDeadline.setDate(registrationDeadline.getDate() + 30);

  const plan = await api('/exam-plans', {
    method: 'POST',
    token: branch.token,
    body: {
      title: `Phase1 Smoke ${unique}`,
      occupation: '贵金属首饰与宝玉石检测员',
      examDate: examDate.toISOString(),
      registrationDeadline: registrationDeadline.toISOString(),
      profession: '贵金属首饰检验员',
      level: '三级/高级工',
      location: '北京分部考场',
      maxCandidates: 30,
      notes: 'API smoke test',
    },
  });
  assertEqual(plan.status, 'DRAFT', 'plan should be created as draft');

  const draftPlan = await api(`/exam-plans/${plan.id}`, { token: branch.token });
  assertEqual(draftPlan.nodes.length, 9, 'draft plan should pre-generate 9 nodes');

  await expectApiFailure('/candidates', {
    method: 'POST',
    token: branch.token,
    body: {
      planId: plan.id,
      name: `草稿阻断${unique}`,
      idCard: `110101199000${String(unique).slice(-6)}`,
      gender: 'M',
      applyLevel: '三级/高级工',
    },
  }, 400, 'draft plan should not accept formal candidates');

  const published = await api(`/exam-plans/${plan.id}/publish`, {
    method: 'PATCH',
    token: branch.token,
  });
  assertEqual(published.status, 'PUBLISHED', 'draft plan should publish');
  const publishedPlanCreateNode = published.nodes.find((node) => node.nodeType === 'PLAN_CREATE');
  const publishedRegistrationNode = published.nodes.find((node) => node.nodeType === 'REGISTRATION');
  assertEqual(publishedPlanCreateNode.status, 'COMPLETED', 'publishing should automatically complete the plan creation node');
  assertEqual(publishedRegistrationNode.status, 'IN_PROGRESS', 'publishing should open the registration node');

  const candidate = await api('/candidates', {
    method: 'POST',
    token: branch.token,
    body: {
      planId: plan.id,
      name: `测试考生${unique}`,
      idCard: `110101199001${String(unique).slice(-6)}`,
      phone: '13800000000',
      gender: 'M',
      education: '大学专科和专科学校',
      workYears: 5,
      applyLevel: '3',
      registrationFields: registrationFields({
        idCard: `110101199001${String(unique).slice(-6)}`,
        name: `测试考生${unique}`,
        profession: '贵金属首饰检验员',
        level: '三级/高级工',
      }),
      materials: {
        idCard: true,
        photo: true,
        educationProof: true,
        workYearsProof: true,
        applicationCommitment: true,
        priorCertificate: false,
        [LEVEL3_WORK_YEARS_MATERIAL_KEY]: true,
      },
      paymentStatus: 'PAID',
    },
  });
  assertEqual(candidate.status, 'PENDING', 'candidate should wait for branch approval');
  assertEqual(candidate.registrationProfile.paymentStatus, 'PAID', 'branch should see payment status');

  const hqCandidates = await api(`/candidates?planId=${plan.id}`, { token: hq.token });
  if ('paymentStatus' in hqCandidates[0].registrationProfile) {
    throw new Error('HQ candidate API must not expose payment status');
  }

  const sysProfile = await api(`/candidates/${candidate.id}/registration-profile`, { token: sys.token });
  if ('paymentStatus' in sysProfile) {
    throw new Error('SYS_ADMIN registration profile API must not expose payment status');
  }
  const sysUpdatedProfile = await api(`/candidates/${candidate.id}/registration-profile`, {
    method: 'PUT',
    token: sys.token,
    body: {
      registrationFields: {
        ...sysProfile.registrationFields,
        简要经历: '系统管理员补录资料',
      },
      materials: sysProfile.materials,
      paymentStatus: 'UNPAID',
    },
  });
  assertEqual(sysUpdatedProfile.registrationFields.简要经历, '系统管理员补录资料', 'SYS_ADMIN should save registration fields');
  if ('paymentStatus' in sysUpdatedProfile) {
    throw new Error('SYS_ADMIN update response must not expose payment status');
  }

  const sysCandidate = await api('/candidates', {
    method: 'POST',
    token: sys.token,
    body: {
      planId: plan.id,
      registrationFields: registrationFields({
        idCard: `110101199002${String(unique).slice(-6)}`,
        name: `系统补录考生${unique}`,
        profession: '贵金属首饰检验员',
        level: '三级/高级工',
      }),
      materials: {
        idCard: true,
        photo: true,
        educationProof: true,
        workYearsProof: true,
        applicationCommitment: true,
        priorCertificate: false,
        [LEVEL3_WORK_YEARS_MATERIAL_KEY]: true,
      },
      paymentStatus: 'PAID',
    },
  });
  assertEqual(sysCandidate.status, 'PENDING', 'SYS_ADMIN should create registration records for a branch plan');
  if ('paymentStatus' in sysCandidate.registrationProfile) {
    throw new Error('SYS_ADMIN create response must not expose payment status');
  }

  await expectApiFailure('/prospective-candidates', { token: hq.token }, 403, 'HQ should not access prospective candidates');
  await expectApiFailure('/prospective-candidates', { token: sys.token }, 403, 'SYS_ADMIN should not access prospective candidates');

  const prospect = await api('/prospective-candidates', {
    method: 'POST',
    token: branchStaff.token,
    body: {
      name: `意向考生${unique}`,
      phone: '13900000000',
      intendedOccupation: '贵金属首饰与宝玉石检测员',
      intendedProfession: '贵金属首饰检验员',
      intendedLevel: '三级/高级工',
      source: '电话咨询',
      notes: 'API smoke prospect',
    },
  });
  assertEqual(prospect.status, 'FOLLOWING', 'prospective candidate should default to following');

  const duplicateProspect = await api('/prospective-candidates', {
    method: 'POST',
    token: branchStaff.token,
    body: {
      name: `重复手机号${unique}`,
      phone: '13900000000',
      intendedOccupation: '贵金属首饰与宝玉石检测员',
      intendedProfession: '钻石检验员',
      intendedLevel: '四级/中级工',
    },
  });
  assertEqual(duplicateProspect.phone, prospect.phone, 'duplicate phone should be allowed');

  await expectApiFailure(`/prospective-candidates/${duplicateProspect.id}`, {
    method: 'DELETE',
    token: branchStaff.token,
  }, 403, 'branch staff should not delete prospective candidates');

  await api(`/prospective-candidates/${duplicateProspect.id}`, {
    method: 'DELETE',
    token: branch.token,
  });

  const converted = await api(`/prospective-candidates/${prospect.id}/convert`, {
    method: 'POST',
    token: branchStaff.token,
    body: {
      planId: plan.id,
      idCard: `110101199003${String(unique).slice(-6)}`,
      gender: 'F',
      education: '大学本科',
      workYears: 4,
    },
  });
  assertEqual(converted.prospectiveCandidate.status, 'CONVERTED', 'prospective candidate should be marked converted');
  assertEqual(converted.candidate.name, prospect.name, 'converted candidate should keep prospect name');
  assertEqual(converted.candidate.registrationProfile.registrationFields.职业工种名称, '贵金属首饰检验员', 'converted candidate should inherit plan profession');

  const rejectProspect = await api('/prospective-candidates', {
    method: 'POST',
    token: branchStaff.token,
    body: {
      name: `驳回回转${unique}`,
      phone: '13900000001',
      intendedOccupation: '贵金属首饰与宝玉石检测员',
      intendedProfession: '宝石检验员',
      intendedLevel: '三级/高级工',
    },
  });
  const rejectConverted = await api(`/prospective-candidates/${rejectProspect.id}/convert`, {
    method: 'POST',
    token: branchStaff.token,
    body: {
      planId: plan.id,
      idCard: `110101199004${String(unique).slice(-6)}`,
      gender: 'M',
      education: '大学本科',
      workYears: 3,
    },
  });
  await api(`/candidates/${rejectConverted.candidate.id}/approve`, {
    method: 'POST',
    token: branch.token,
    body: { status: 'REJECTED' },
  });
  const followingAfterReject = await api('/prospective-candidates?status=FOLLOWING', { token: branch.token });
  const revertedAfterReject = followingAfterReject.find((item) => item.id === rejectProspect.id);
  if (!revertedAfterReject) {
    throw new Error('rejected converted candidate should return its prospect to following');
  }
  assertEqual(revertedAfterReject.convertedCandidateId ?? null, null, 'rejected prospect should no longer link to the formal candidate');
  const candidatesAfterReject = await api(`/candidates?planId=${plan.id}`, { token: branch.token });
  if (candidatesAfterReject.some((item) => item.id === rejectConverted.candidate.id || item.status === 'REJECTED')) {
    throw new Error('rejected formal candidate should be removed from candidate management');
  }

  const activeNodes = await api(`/exam-nodes?planId=${plan.id}`, { token: branch.token });
  const registrationNode = activeNodes.find((node) => node.nodeType === 'REGISTRATION');
  if (!registrationNode || registrationNode.status !== 'IN_PROGRESS') {
    throw new Error('expected registration node to be in progress after publish');
  }
  const secondNode = activeNodes.find((node) => node.status === 'PENDING');
  if (!secondNode) throw new Error('expected later nodes to remain pending');

  await expectApiFailure(`/exam-nodes/${secondNode.id}/complete`, {
    method: 'POST',
    token: branch.token,
    body: { notes: 'should fail because sequence is enforced' },
  }, 400, 'completing a later node should fail');

  await expectApiFailure(`/exam-nodes/${registrationNode.id}/complete`, {
    method: 'POST',
    token: hq.token,
    body: { notes: 'HQ should not complete nodes' },
  }, 403, 'HQ should be read only for node completion');

  await uploadCandidatePhoto(candidate.id, branch.token);

  await api(`/candidates/${candidate.id}/approve`, {
    method: 'POST',
    token: branch.token,
    body: { status: 'APPROVED' },
  });

  const exportResponse = await raw(`/candidates/export-package?planId=${plan.id}`, {
    token: branch.token,
  });
  if (!exportResponse.ok) {
    throw new Error(`candidate export package failed: ${exportResponse.status} ${await exportResponse.text()}`);
  }
  const exportBytes = await exportResponse.arrayBuffer();
  if (exportBytes.byteLength < 1000) {
    throw new Error(`candidate export package should be a non-empty zip, got ${exportBytes.byteLength} bytes`);
  }

  const uploadBatch = await api(`/exam-plans/${plan.id}/local-upload-batches`, {
    method: 'POST',
    token: branch.token,
    body: {
      status: 'UPLOADED',
      uploadedAt: new Date().toISOString(),
      notes: '已上传当地上级部门业务系统',
      completeRegistrationNode: true,
    },
  });
  assertEqual(uploadBatch.status, 'UPLOADED', 'local upload batch should be recorded');

  const nodesAfterUpload = await api(`/exam-nodes?planId=${plan.id}`, { token: branch.token });
  const registrationAfterUpload = nodesAfterUpload.find((node) => node.nodeType === 'REGISTRATION');
  const roomArrangeAfterUpload = nodesAfterUpload.find((node) => node.nodeType === 'ROOM_ARRANGE');
  assertEqual(registrationAfterUpload.status, 'COMPLETED', 'local upload backfill should close the registration node');
  assertEqual(roomArrangeAfterUpload.status, 'IN_PROGRESS', 'closing registration should activate the next node');

  await expectApiFailure('/candidates', {
    method: 'POST',
    token: branch.token,
    body: {
      planId: plan.id,
      name: `报名关闭阻断${unique}`,
      idCard: `110101199005${String(unique).slice(-6)}`,
      gender: 'M',
      applyLevel: '三级/高级工',
    },
  }, 400, 'closed registration should not accept new formal candidates');

  const closedProspect = await api('/prospective-candidates', {
    method: 'POST',
    token: branchStaff.token,
    body: {
      name: `关闭后意向${unique}`,
      phone: '13900000002',
      intendedOccupation: '贵金属首饰与宝玉石检测员',
      intendedProfession: '贵金属首饰检验员',
      intendedLevel: '三级/高级工',
    },
  });
  await expectApiFailure(`/prospective-candidates/${closedProspect.id}/convert`, {
    method: 'POST',
    token: branchStaff.token,
    body: {
      planId: plan.id,
      idCard: `110101199006${String(unique).slice(-6)}`,
      gender: 'F',
      education: '大学本科',
      workYears: 4,
    },
  }, 400, 'closed registration should not accept prospective conversion');

  const hqProgress = await api('/hq/reports/registration-progress', { token: hq.token });
  const progressRow = hqProgress.find((row) => row.planId === plan.id);
  if (!progressRow || progressRow.candidates.exportEligibleCandidates < 1) {
    throw new Error('HQ registration progress report should include export eligible candidate counts');
  }
  if (JSON.stringify(progressRow).includes('paymentStatus')) {
    throw new Error('HQ registration progress report must not include payment status');
  }

  await expectApiFailure(`/exam-plans/${plan.id}/cancel`, {
    method: 'PATCH',
    token: branch.token,
    body: { reason: 'API smoke cancellation revert' },
  }, 400, 'published plan should not cancel directly');

  const rolledBackPlan = await api(`/exam-plans/${plan.id}/rollback`, {
    method: 'PATCH',
    token: branch.token,
    body: { reason: 'API smoke rollback' },
  });
  assertEqual(rolledBackPlan.status, 'DRAFT', 'published plan should roll back to draft');
  assertEqual(rolledBackPlan._count.candidates, 0, 'rollback should remove formal candidates from the plan');

  const candidatesAfterRollback = await api(`/candidates?planId=${plan.id}`, { token: branch.token });
  assertEqual(candidatesAfterRollback.length, 0, 'rollback should delete formal candidate records for the plan');

  const followingProspects = await api('/prospective-candidates?status=FOLLOWING', { token: branch.token });
  const revertedProspect = followingProspects.find((item) => item.id === prospect.id);
  if (!revertedProspect) {
    throw new Error('converted prospect should return to following after its plan is rolled back');
  }
  assertEqual(revertedProspect.convertedCandidateId ?? null, null, 'reverted prospect should no longer link to the rolled back plan candidate');

  const generatedProspect = followingProspects.find((item) => item.name === candidate.name && item.source === '计划回退');
  if (!generatedProspect) {
    throw new Error('direct formal candidates should be recreated as following prospective candidates after rollback');
  }

  await expectApiFailure(`/exam-plans/${plan.id}/cancel`, {
    method: 'PATCH',
    token: branch.token,
    body: { reason: '' },
  }, 400, 'draft plan cancellation should require a reason');

  const cancelledPlan = await api(`/exam-plans/${plan.id}/cancel`, {
    method: 'PATCH',
    token: branch.token,
    body: { reason: 'API smoke cancellation after rollback' },
  });
  assertEqual(cancelledPlan.status, 'CANCELLED', 'plan should be cancelled');

  console.log(JSON.stringify({
    ok: true,
    planId: plan.id,
    candidateId: candidate.id,
    prospectiveCandidateId: prospect.id,
    convertedCandidateId: converted.candidate.id,
    generatedProspectiveCandidateId: generatedProspect.id,
    exportedBytes: exportBytes.byteLength,
  }, null, 2));
}

function registrationFields({ idCard, name, profession, level }) {
  return {
    序号: '1',
    职业工种名称: profession,
    认定等级: level,
    申报条件: LEVEL3_WORK_YEARS_CONDITION,
    证件类型: '居民身份证',
    证件号码: idCard,
    姓名: name,
    性别: '男',
    出生日期: '1990-01-01',
    手机号码: '13800000000',
    是否有职业资格证书: '否',
    证书等级: '',
    证书编号: '',
    文化程度: '大学专科和专科学校',
    '所在省（市）区': '北京市',
    考生来源: '私营企业',
    所在单位: '测试单位',
    报名单位: '新疆中和鉴珠宝玉石质量检测研究所（有限公司）',
    认定分类: '初次认定',
    专业: profession,
    考试类型: '正考',
    民族: '汉族',
    参加工作时间: '2018-01-01',
    电子邮箱: 'smoke@example.com',
    专业年限: '5',
    户籍所在地: '北京市',
    政治面貌: '群众',
    学历证书编号: '',
    简要经历: '测试经历',
    通讯地址: '北京市测试地址',
    证书领取方式: '自取',
    邮政编码: '',
    邮寄地址: '',
  };
}

async function login(body) {
  const data = await api('/auth/login', { method: 'POST', body });
  if (!data.token) throw new Error(`login failed for ${body.username}`);
  return data;
}

async function uploadCandidatePhoto(candidateId, token) {
  const photo = await sharp({
    create: {
      width: 600,
      height: 800,
      channels: 3,
      background: '#ffffff',
    },
  })
    .png()
    .toBuffer();
  const formData = new FormData();
  formData.append('photo', new Blob([photo], { type: 'image/png' }), 'smoke-photo.png');
  await api(`/candidates/${candidateId}/photo`, { method: 'POST', token, formData });
}

async function api(path, options = {}) {
  const response = await raw(path, options);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload.data;
}

async function expectApiFailure(path, options, status, message) {
  const response = await raw(path, options);
  if (response.status !== status) {
    throw new Error(`${message}; expected ${status}, got ${response.status}: ${await response.text()}`);
  }
}

function raw(path, options = {}) {
  const headers = {
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.formData || (options.body ? JSON.stringify(options.body) : undefined),
  });
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}; expected ${expected}, got ${actual}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
