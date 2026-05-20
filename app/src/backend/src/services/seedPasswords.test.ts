import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSeedUserPasswords,
  readSmokeUserPasswords,
  requiredSeedUsernames,
} from './seedPasswords.js';

describe('seed password configuration', () => {
  it('generates strong one-time passwords outside production when no config is provided', () => {
    const result = buildSeedUserPasswords({
      nodeEnv: 'development',
      passwordJson: undefined,
      randomPassword: (username) => `Safe#2026-${username}-临时`,
    });

    assert.equal(result.generated, true);
    assert.equal(result.passwords.admin, 'Safe#2026-admin-临时');
    assert.equal(Object.keys(result.passwords).length, requiredSeedUsernames.length);
  });

  it('requires explicit seed passwords in production', () => {
    assert.throws(
      () =>
        buildSeedUserPasswords({
          nodeEnv: 'production',
          passwordJson: undefined,
          randomPassword: () => 'Safe#2026-Generated',
        }),
      /生产环境初始化账号密码必须通过 SEED_USER_PASSWORDS_JSON 提供/
    );
  });

  it('rejects weak or demo-style production passwords', () => {
    assert.throws(
      () =>
        buildSeedUserPasswords({
          nodeEnv: 'production',
          passwordJson: JSON.stringify({
            admin: ['admin', '123'].join(''),
            hqadmin: 'Safe#2026-HQAdmin',
            hqstaff: 'Safe#2026-HQStaff',
            bjadmin: 'Safe#2026-BJAdmin',
            bjstaff: 'Safe#2026-BJStaff',
            szadmin: 'Safe#2026-SZAdmin',
            szstaff: 'Safe#2026-SZStaff',
            xjadmin: 'Safe#2026-XJAdmin',
            xjstaff: 'Safe#2026-XJStaff',
            ynadmin: 'Safe#2026-YNAdmin',
            ynstaff: 'Safe#2026-YNStaff',
          }),
          randomPassword: () => 'Safe#2026-Generated',
        }),
      /admin 的初始化密码不安全/
    );
  });

  it('reads smoke credentials from the smoke-specific config before seed config', () => {
    const result = readSmokeUserPasswords({
      smokePasswordJson: JSON.stringify({
        admin: 'Smoke#2026-Sys',
        bjadmin: 'Smoke#2026-Branch',
        bjstaff: 'Smoke#2026-Staff',
        hqadmin: 'Smoke#2026-HQ',
      }),
      seedPasswordJson: JSON.stringify({
        admin: 'Seed#2026-Sys',
        bjadmin: 'Seed#2026-Branch',
        bjstaff: 'Seed#2026-Staff',
        hqadmin: 'Seed#2026-HQ',
      }),
    });

    assert.equal(result.admin, 'Smoke#2026-Sys');
    assert.equal(result.bjadmin, 'Smoke#2026-Branch');
  });

  it('prints a friendly Chinese setup hint when smoke credentials are missing', () => {
    assert.throws(
      () => readSmokeUserPasswords({ smokePasswordJson: undefined, seedPasswordJson: undefined }),
      /请设置 SMOKE_USER_PASSWORDS_JSON/
    );
  });
});
