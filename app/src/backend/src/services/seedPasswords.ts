import { randomBytes } from 'node:crypto';

export const requiredSeedUsernames = [
  'admin',
  'hqadmin',
  'hqstaff',
  'bjadmin',
  'bjstaff',
  'szadmin',
  'szstaff',
  'xjadmin',
  'xjstaff',
  'ynadmin',
  'ynstaff',
] as const;

export type SeedUsername = (typeof requiredSeedUsernames)[number];
export type SeedUserPasswords = Record<SeedUsername, string>;

export type BuildSeedUserPasswordsInput = {
  nodeEnv: string;
  passwordJson?: string;
  randomPassword?: (username: SeedUsername) => string;
};

export type BuildSeedUserPasswordsResult = {
  passwords: SeedUserPasswords;
  generated: boolean;
  generatedUsernames: SeedUsername[];
};

export type SmokeUserPasswords = Pick<
  SeedUserPasswords,
  'admin' | 'bjadmin' | 'bjstaff' | 'hqadmin'
>;

export function buildSeedUserPasswords(input: BuildSeedUserPasswordsInput): BuildSeedUserPasswordsResult {
  const isProduction = input.nodeEnv === 'production';
  const generate = input.randomPassword || createOneTimePassword;

  if (!input.passwordJson?.trim()) {
    if (isProduction) {
      throw new Error('生产环境初始化账号密码必须通过 SEED_USER_PASSWORDS_JSON 提供，禁止自动生成或使用演示口令。');
    }

    return {
      generated: true,
      generatedUsernames: [...requiredSeedUsernames],
      passwords: Object.fromEntries(requiredSeedUsernames.map((username) => [username, generate(username)])) as SeedUserPasswords,
    };
  }

  const parsed = parsePasswordJson(input.passwordJson, 'SEED_USER_PASSWORDS_JSON');
  const missing = requiredSeedUsernames.filter((username) => !parsed[username]);
  if (missing.length > 0) {
    if (isProduction) {
      throw new Error(`SEED_USER_PASSWORDS_JSON 缺少以下初始化账号密码：${missing.join('、')}。`);
    }
    for (const username of missing) {
      parsed[username] = generate(username);
    }
  }

  const passwords = Object.fromEntries(requiredSeedUsernames.map((username) => [username, parsed[username]])) as SeedUserPasswords;
  for (const username of requiredSeedUsernames) {
    const problem = explainUnsafePassword(username, passwords[username]);
    if (problem) {
      throw new Error(`${username} 的初始化密码不安全：${problem}`);
    }
  }

  return {
    generated: missing.length > 0,
    generatedUsernames: missing,
    passwords,
  };
}

export function readSmokeUserPasswords(input: {
  smokePasswordJson?: string;
  seedPasswordJson?: string;
}): SmokeUserPasswords {
  const source = input.smokePasswordJson?.trim() ? input.smokePasswordJson : input.seedPasswordJson;
  if (!source?.trim()) {
    throw new Error(
      '请设置 SMOKE_USER_PASSWORDS_JSON 后再运行验收脚本，格式示例：{"admin":"强密码","bjadmin":"强密码","bjstaff":"强密码","hqadmin":"强密码"}。'
    );
  }

  const parsed = parsePasswordJson(source, input.smokePasswordJson?.trim() ? 'SMOKE_USER_PASSWORDS_JSON' : 'SEED_USER_PASSWORDS_JSON');
  const required: Array<keyof SmokeUserPasswords> = ['admin', 'bjadmin', 'bjstaff', 'hqadmin'];
  const missing = required.filter((username) => !parsed[username]);
  if (missing.length > 0) {
    throw new Error(`验收脚本缺少以下账号密码：${missing.join('、')}。请补充 SMOKE_USER_PASSWORDS_JSON。`);
  }

  return Object.fromEntries(required.map((username) => [username, parsed[username]])) as SmokeUserPasswords;
}

function parsePasswordJson(value: string, envName: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${envName} 不是有效 JSON，请使用 {"用户名":"密码"} 的对象格式。`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${envName} 必须是 {"用户名":"密码"} 的对象格式。`);
  }

  const result: Record<string, string> = {};
  for (const [username, password] of Object.entries(parsed)) {
    if (typeof password !== 'string' || password.trim().length === 0) {
      throw new Error(`${envName} 中 ${username} 的密码不能为空。`);
    }
    result[username] = password;
  }
  return result;
}

function explainUnsafePassword(username: string, password: string): string | null {
  const normalizedPassword = password.toLowerCase();
  const normalizedUsername = username.toLowerCase();
  const demoPatterns = new Set([
    `${normalizedUsername}123`,
    `${normalizedUsername}123456`,
    ['admin', '123'].join(''),
    'password',
    'password123',
    '123456',
    '12345678',
  ]);

  if (password.length < 12) return '长度至少需要 12 位';
  if (demoPatterns.has(normalizedPassword)) return '不能使用演示账号口令';
  if (normalizedPassword.includes(normalizedUsername)) return '不能包含用户名';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return '需同时包含大小写字母、数字和特殊字符';
  }
  return null;
}

function createOneTimePassword(): string {
  return `${randomBytes(18).toString('base64url')}Aa1!`;
}
