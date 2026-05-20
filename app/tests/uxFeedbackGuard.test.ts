import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const appSourceRoot = new URL('../src/', import.meta.url);

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.(tsx?|jsx?)$/.test(path) ? [path] : [];
  });
}

describe('UX feedback guardrails', () => {
  it('keeps business pages away from native browser confirm and prompt dialogs', () => {
    const files = listSourceFiles(new URL('pages', appSourceRoot).pathname);
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /window\.(confirm|prompt)\(|(?<!\w)(confirm|prompt)\(/.test(source)
        && !source.includes('useConfirmDialog');
    });

    assert.deepEqual(offenders, []);
  });

  it('does not read raw backend error payloads directly in pages', () => {
    const files = [
      ...listSourceFiles(new URL('pages', appSourceRoot).pathname),
      ...listSourceFiles(new URL('components/settings', appSourceRoot).pathname),
    ];
    const offenders = files.filter((file) => readFileSync(file, 'utf8').includes('response?.data?.error'));

    assert.deepEqual(offenders, []);
  });

  it('shows a visible permission message instead of silently redirecting forbidden pages home', () => {
    const source = readFileSync(new URL('App.tsx', appSourceRoot), 'utf8');

    assert.equal(/requiredRoles && !hasRole\(requiredRoles\)[\s\S]{0,120}<Navigate to="\/"/.test(source), false);
    assert.equal(source.includes('没有权限访问该页面'), true);
  });
});
