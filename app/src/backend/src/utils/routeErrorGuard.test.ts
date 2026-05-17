import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const routesDir = path.resolve(process.cwd(), 'src/backend/src/routes');

describe('route error handling guardrails', () => {
  it('keeps route modules away from ad-hoc console error logging', () => {
    const offenders = routeFiles()
      .filter((file) => readFileSync(file, 'utf8').includes('console.error('))
      .map((file) => path.relative(process.cwd(), file));

    assert.deepEqual(offenders, []);
  });

  it('does not expose raw Zod error messages from route modules', () => {
    const offenders = routeFiles()
      .filter((file) => /\b(result|parsed)\.error\.message/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(process.cwd(), file));

    assert.deepEqual(offenders, []);
  });

  it('keeps high-risk status and note inputs behind route schemas', () => {
    const forbiddenPatterns = [
      /const\s+\{\s*status\s*\}\s*=\s*req\.body/,
      /normalizeText\(req\.body\?\.notes\)/,
    ];
    const offenders = routeFiles()
      .filter((file) => {
        const text = readFileSync(file, 'utf8');
        return forbiddenPatterns.some((pattern) => pattern.test(text));
      })
      .map((file) => path.relative(process.cwd(), file));

    assert.deepEqual(offenders, []);
  });
});

function routeFiles(dir = routesDir): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return routeFiles(fullPath);
    return entry.endsWith('.ts') ? [fullPath] : [];
  });
}
