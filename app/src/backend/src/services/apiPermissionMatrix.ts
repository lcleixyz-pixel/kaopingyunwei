export const API_PERMISSION_MATRIX = {
  settings: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'],
  prospectiveCandidates: ['BRANCH_ADMIN', 'BRANCH_STAFF'],
  examPlans: ['SYS_ADMIN', 'HQ_ADMIN', 'BRANCH_ADMIN'],
  candidates: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'],
  scores: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'],
  certificates: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'],
  pdfTemplates: ['SYS_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'BRANCH_ADMIN', 'BRANCH_STAFF'],
} as const;

export type ApiArea = keyof typeof API_PERMISSION_MATRIX;

export function canAccessApiArea(role: string | undefined, area: ApiArea): boolean {
  if (!role) return false;
  return (API_PERMISSION_MATRIX[area] as readonly string[]).includes(role);
}
