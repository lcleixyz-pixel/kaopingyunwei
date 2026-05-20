export interface ManagedUserPasswordInput {
  username: string;
  password: string;
}

export interface ManagedUserPasswordResult {
  valid: boolean;
  message?: string;
}

export function validateManagedUserPassword(input: ManagedUserPasswordInput): ManagedUserPasswordResult {
  const password = input.password;
  const username = input.username.trim().toLowerCase();

  if (password.length < 12) {
    return { valid: false, message: '临时密码至少需要 12 位' };
  }
  if (password.length > 72) {
    return { valid: false, message: '临时密码不能超过 72 位' };
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: '临时密码必须同时包含大写字母、小写字母、数字和特殊字符' };
  }
  if (username && password.toLowerCase().includes(username)) {
    return { valid: false, message: '临时密码不能包含用户名' };
  }

  return { valid: true };
}
