import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const sidebarSource = await readFile(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8');
const certificatesSource = await readFile(new URL('../src/pages/Certificates.tsx', import.meta.url), 'utf8');

function roleListForPath(source, path) {
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`path: ['"]${escapedPath}['"][\\s\\S]*?roles: \\[([^\\]]+)\\]`));
  assert.ok(match, `Expected ${path} to have a role list`);
  return match[1].match(/'([^']+)'/g)?.map((role) => role.replaceAll("'", '')) ?? [];
}

test('archives route allows every role that can see the sidebar entry', () => {
  const routeRoles = roleListForPath(appSource, '/archives');
  const sidebarRoles = roleListForPath(sidebarSource, '/archives');

  assert.deepEqual(routeRoles, sidebarRoles);
  assert.ok(routeRoles.includes('HQ_STAFF'));
  assert.ok(routeRoles.includes('BRANCH_STAFF'));
});

test('certificate supply request defaults to zero quantities', () => {
  assert.match(certificatesSource, /blankCertQuantity:\s*0,/);
  assert.match(certificatesSource, /shellQuantity:\s*0,/);
});
