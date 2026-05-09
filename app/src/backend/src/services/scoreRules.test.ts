import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as XLSX from 'xlsx';
import {
  evaluateScoreRecord,
  isScoreCompleteForLevel,
  parseScoreRosterRows,
} from './scoreRules.js';

const sampleRosterPath = '/Users/lc.leixyz/Downloads/职业技能等级认定成绩花名册 (5).xlsx';

describe('score evaluation rules', () => {
  it('requires theory and skill for level five to three and uses 60 as the pass line', () => {
    assert.deepEqual(evaluateScoreRecord({ level: '五级/初级工', theoryScore: 60, practiceScore: 60 }), {
      resultStatus: 'PASS',
      isPass: true,
    });
    assert.deepEqual(evaluateScoreRecord({ level: '三级/高级工', theoryScore: 59.9, practiceScore: 100 }), {
      resultStatus: 'FAIL',
      isPass: false,
    });
    assert.deepEqual(evaluateScoreRecord({ level: '四级/中级工', theoryScore: 80, practiceScore: 80, comprehensiveScore: 0 }), {
      resultStatus: 'PASS',
      isPass: true,
    });
  });

  it('requires comprehensive review for level two and one', () => {
    assert.deepEqual(evaluateScoreRecord({ level: '二级/技师', theoryScore: 60, practiceScore: 60, comprehensiveScore: 60 }), {
      resultStatus: 'PASS',
      isPass: true,
    });
    assert.deepEqual(evaluateScoreRecord({ level: '一级/高级技师', theoryScore: 100, practiceScore: 100, comprehensiveScore: 59.9 }), {
      resultStatus: 'FAIL',
      isPass: false,
    });
    assert.deepEqual(evaluateScoreRecord({ level: '二级/技师', theoryScore: 90, practiceScore: 90 }), {
      resultStatus: 'INCOMPLETE',
      isPass: false,
    });
  });

  it('treats absence in any required subject as failed', () => {
    assert.deepEqual(evaluateScoreRecord({ level: '四级/中级工', theoryScore: 100, practiceAbsent: true }), {
      resultStatus: 'FAIL',
      isPass: false,
    });
    assert.deepEqual(evaluateScoreRecord({ level: '二级/技师', theoryScore: 90, practiceScore: 90, comprehensiveAbsent: true }), {
      resultStatus: 'FAIL',
      isPass: false,
    });
  });

  it('ignores work performance when deciding pass status but preserves completion checks for required subjects', () => {
    assert.equal(isScoreCompleteForLevel({ level: '四级/中级工', theoryScore: 60, practiceScore: 60, workPerformanceAbsent: true }), true);
    assert.deepEqual(evaluateScoreRecord({ level: '四级/中级工', theoryScore: 60, practiceScore: 60, workPerformanceAbsent: true }), {
      resultStatus: 'PASS',
      isPass: true,
    });
  });
});

describe('score roster import parsing', () => {
  it('parses the Urumqi exported roster rows from the fixed two-line header workbook', () => {
    const workbook = XLSX.read(readFileSync(sampleRosterPath), { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false });

    const records = parseScoreRosterRows(rows);

    assert.equal(records.length, 13);
    assert.deepEqual(records[0], {
      rowNumber: 6,
      ticketNo: '2604236512002900001',
      name: '陶爱娜',
      gender: '女',
      idCard: '331082199602151440',
      organization: '新疆中和鉴珠宝玉石质量检测研究所（有限公司）',
      profession: '玉石检验员',
      level: '四级/中级工',
      theoryScore: 80,
      practiceScore: 80.5,
      comprehensiveScore: null,
      workPerformanceScore: null,
      theoryAbsent: false,
      practiceAbsent: false,
      comprehensiveAbsent: false,
      workPerformanceAbsent: false,
    });
    assert.equal(evaluateScoreRecord(records[12]).resultStatus, 'FAIL');
  });
});
