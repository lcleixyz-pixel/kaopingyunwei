import { canReadAcrossTenants } from './accessScope.js';

export function shouldScopeRemindersToCurrentUser(role?: string | null): boolean {
  return !canReadAcrossTenants(role || undefined);
}
