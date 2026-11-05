import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { audit } from './docs-audit.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'scriptoscope-doc-audit-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init', '--quiet');
  write('docs/documentation-map.json', JSON.stringify({ schema: 1, rules: [
    { match: '^guides/', kind: 'guide', audience: 'users', reviewWords: 10 },
    { match: '^records/', kind: 'record', audience: 'reviewers', preserveBody: true },
  ] }));
  write('guides/start.md', '# Start\n\nRun the example.\n');
  write('records/trial.md', '# Trial\n\nThree observations; scope remains limited.\n');
  git('add', '.');
  git('-c', 'user.name=Doc audit fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null',
    'commit', '--quiet', '-m', 'fixture');
  return { root, write };
}

test('untracked pages count toward coverage and total documentation size', t => {
  const { root, write } = fixture(t);
  write('unclassified/new.md', '# Missing route\n');
  const report = audit(root, 'HEAD');
  assert.equal(report.documents, 3);
  assert.equal(report.deltaWords, 3);
  assert.match(report.errors.join('\n'), /unclassified\/new.md: no documentation-map rule/);
});

test('record navigation may be added, but alteration or deletion is detected', t => {
  const { root, write } = fixture(t);
  const body = '# Trial\n\nThree observations; scope remains limited.\n';
  write('records/trial.md', '> Historical record; see current guide.\n\n' + body);
  assert.deepEqual(audit(root, 'HEAD').errors, []);
  write('records/trial.md', '# Trial\n\nFull fidelity proved.\n');
  assert.match(audit(root, 'HEAD').errors.join('\n'), /existing record body changed/);
  rmSync(join(root, 'records/trial.md'));
  assert.match(audit(root, 'HEAD').errors.join('\n'), /existing record body changed or removed/);
});

test('long active guides prompt review without pretending length proves quality', t => {
  const { root, write } = fixture(t);
  write('guides/start.md', 'word '.repeat(20));
  const report = audit(root, 'HEAD');
  assert.equal(report.warnings.length, 1);
  assert.equal(report.errors.length, 0);
  assert.match(report.warnings[0], /20 words exceeds 10 review budget/);
});

test('an invalid comparison base fails instead of treating old pages as new', t => {
  const { root } = fixture(t);
  assert.throws(() => audit(root, 'missing-baseline'));
});
