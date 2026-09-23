import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, test } from 'vitest';
import { planChanges, readChanges } from '../../scripts/change-plan.mjs';

const scratch = new Set();
afterEach(() => {
  for (const cwd of scratch) rmSync(cwd, { recursive: true, force: true });
  scratch.clear();
});

function repository(files = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'jev-patterns-changes-'));
  scratch.add(cwd);
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Change Contract',
        GIT_AUTHOR_EMAIL: 'contract@example.invalid',
        GIT_COMMITTER_NAME: 'Change Contract',
        GIT_COMMITTER_EMAIL: 'contract@example.invalid',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: devNull,
      },
    }).trimEnd();
  const write = (path, content) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  };
  const commit = (message) => {
    git('add', '--all');
    git('-c', 'commit.gpgsign=false', 'commit', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-b', 'main');
  for (const [path, content] of Object.entries({
    '.gitignore': 'work/\nnode_modules/\n',
    'README.md': 'Initial\n',
    ...files,
  })) {
    write(path, content);
  }
  const initial = commit('initial');
  return { cwd, git, write, commit, initial };
}

describe('readChanges', () => {
  test('a clean repository produces an empty plan against HEAD', () => {
    const repo = repository();
    assert.deepEqual(readChanges({ cwd: repo.cwd }), { base: repo.initial, files: [] });
  });

  test('combines staged, unstaged, and untracked paths while excluding ignored scratch files', () => {
    const repo = repository({ 'src/local.ts': 'old\n', 'src/staged.ts': 'old\n' });
    repo.write('src/local.ts', 'local\n');
    repo.write('src/staged.ts', 'staged\n');
    repo.git('add', '--', 'src/staged.ts');
    repo.write('test/new.test.mjs', 'new\n');
    repo.write('work/ignored.ts', 'ignored\n');
    repo.write('node_modules/ignored/index.js', 'ignored\n');
    assert.deepEqual(readChanges({ cwd: repo.cwd }), {
      base: repo.initial,
      files: [
        { path: 'src/local.ts', status: 'M' },
        { path: 'src/staged.ts', status: 'M' },
        { path: 'test/new.test.mjs', status: 'A' },
      ],
    });
  });

  test('retains staged changes even when unstaged edits restore the original file', () => {
    const repo = repository({ 'src/analysis.ts': 'original\n' });
    repo.write('src/analysis.ts', 'staged\n');
    repo.git('add', '--', 'src/analysis.ts');
    repo.write('src/analysis.ts', 'original\n');
    assert.deepEqual(readChanges({ cwd: repo.cwd }).files, [
      { path: 'src/analysis.ts', status: 'M' },
    ]);
  });

  test('includes committed branch changes relative to the requested base', () => {
    const repo = repository({ 'src/analysis.ts': 'initial\n' });
    repo.write('src/analysis.ts', 'committed\n');
    repo.write('test/new.test.mjs', 'committed test\n');
    repo.commit('feature');
    assert.deepEqual(readChanges({ cwd: repo.cwd, since: repo.initial }), {
      base: repo.initial,
      files: [
        { path: 'src/analysis.ts', status: 'M' },
        { path: 'test/new.test.mjs', status: 'A' },
      ],
    });
  });

  test('uses the merge base rather than attributing divergent target-branch changes to this branch', () => {
    const repo = repository();
    repo.git('switch', '-c', 'feature');
    repo.write('src/feature.ts', 'feature\n');
    repo.commit('feature');
    repo.git('switch', 'main');
    repo.write('src/main-only.ts', 'main\n');
    repo.commit('main advances');
    repo.git('switch', 'feature');
    assert.deepEqual(readChanges({ cwd: repo.cwd, since: 'main' }), {
      base: repo.initial,
      files: [{ path: 'src/feature.ts', status: 'A' }],
    });
  });

  test('represents renamed paths as deletion plus addition and retains unstaged deletions', () => {
    const repo = repository({ 'src/old.ts': 'source\n', 'test/removed.test.mjs': 'test\n' });
    repo.git('mv', '--', 'src/old.ts', 'src/new.ts');
    unlinkSync(join(repo.cwd, 'test/removed.test.mjs'));
    assert.deepEqual(readChanges({ cwd: repo.cwd }).files, [
      { path: 'src/new.ts', status: 'A' },
      { path: 'src/old.ts', status: 'D' },
      { path: 'test/removed.test.mjs', status: 'D' },
    ]);
  });

  test('preserves whitespace, Unicode, option-like names, and shell punctuation in paths', () => {
    const tracked =
      process.platform === 'win32' ? 'src/-space Unicode é.ts' : 'src/space tab\tline\nquote"é.ts';
    const untracked =
      process.platform === 'win32' ? '-untracked Unicode ü.mjs' : '-$(touch forbidden).mjs';
    const repo = repository({ [tracked]: 'before\n' });
    repo.write(tracked, 'after\n');
    repo.write(untracked, 'untracked\n');
    assert.deepEqual(readChanges({ cwd: repo.cwd }).files, [
      { path: untracked, status: 'A' },
      { path: tracked, status: 'M' },
    ]);
    assert.equal(existsSync(join(repo.cwd, 'forbidden')), false);
  });

  test('calling from a repository subdirectory still observes changes across the repository', () => {
    const repo = repository({ 'src/analysis.ts': 'source\n' });
    repo.write('README.md', 'updated\n');
    repo.write('other/untracked.ts', 'new\n');
    assert.deepEqual(readChanges({ cwd: join(repo.cwd, 'src') }).files, [
      { path: 'README.md', status: 'M' },
      { path: 'other/untracked.ts', status: 'A' },
    ]);
  });

  test('missing and option-like refs throw rather than silently falling back or evaluating shell text', () => {
    const repo = repository();
    for (const since of ['missing-branch', 'HEAD~999', '--help', 'HEAD; touch forbidden']) {
      assert.throws(() => readChanges({ cwd: repo.cwd, since }));
    }
    assert.equal(existsSync(join(repo.cwd, 'forbidden')), false);
    assert.throws(() => readChanges({ cwd: repo.cwd, since: '' }), TypeError);
  });
});

function flags(plan) {
  const { reasons: _reasons, ...result } = plan;
  return result;
}

const none = { full: false, lint: false, typecheck: false, unit: false, package: false };
const full = { full: true, lint: true, typecheck: true, unit: true, package: true };
const modified = (path) => ({ path, status: 'M' });

describe('planChanges', () => {
  test('clean changes schedule no work', () => {
    assert.deepEqual(planChanges([]), { ...none, reasons: [] });
  });

  test.each([
    ['src/analysis.ts', { ...none, lint: true, typecheck: true, unit: true, package: true }],
    ['test/analysis.test.mjs', { ...none, lint: true, unit: true }],
    ['test/helpers/fixtures.mjs', { ...none, lint: true, unit: true }],
    ['test/helpers/fixtures.ts', { ...none, lint: true, typecheck: true, unit: true }],
    ['test/types.test.ts', { ...none, lint: true, typecheck: true }],
    ['examples/demo.ts', { ...none, lint: true, typecheck: true }],
    ['README.md', { ...none, package: true }],
    ['LICENSE', { ...none, package: true }],
    ['assets/distributions.svg', { ...none, package: true }],
    ['assets/badges/status.svg', { ...none, package: true }],
    ['test/package/consumer.mjs', full],
    ['test/package/consumer.ts', full],
    ['src/index.ts', { ...none, lint: true, typecheck: true, unit: true, package: true }],
    ['src/model.ts', { ...none, lint: true, typecheck: true, unit: true, package: true }],
    ['src/jev.ts', { ...none, lint: true, typecheck: true, unit: true, package: true }],
    ['docs/testing.md', none],
    ['CONTRIBUTING.md', none],
    ['docs/diagram.png', none],
    ['docs/example.json', { ...none, lint: true }],
  ])('%s schedules the applicable checks', (path, expected) => {
    const plan = planChanges([modified(path)]);
    assert.deepEqual(flags(plan), expected);
    assert.equal(plan.reasons.length, 1);
    assert.ok(plan.reasons[0].includes(JSON.stringify(path)));
  });

  test.each([
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'biome.json',
    'biome.jsonc',
    'vitest.config.mjs',
    'vitest.config.ts',
    'tsconfig.json',
    'tsconfig.consumer.json',
    'scripts/change-plan.mjs',
    '.github/workflows/check.yml',
    '.editorconfig',
    '.github/dependabot.yml',
    'unclassified/file.txt',
    'test/tooling/change-plan.test.mjs',
  ])('%s takes the conservative full-check path', (path) => {
    assert.deepEqual(flags(planChanges([modified(path)])), full);
  });

  test('package contract edits run full replay because smoke can omit the edited assertions', () => {
    const plan = planChanges([modified('test/package/consumer.mjs')]);
    assert.deepEqual(flags(plan), full);
    assert.match(plan.reasons[0], /smoke can skip replay blocks/);
  });

  test.each([
    'src/analysis.ts',
    'src/model.ts',
    'test/helpers/input.json',
    'test/analysis.test.mjs',
  ])('deleting or renaming %s requests the full check', (path) => {
    for (const status of ['D', 'R100', 'R75']) {
      const plan = planChanges([{ path, status }]);
      assert.deepEqual(flags(plan), full);
      assert.match(plan.reasons[0], /deleted or renamed/);
    }
  });

  test('deleting docs remains docs-only while deleting type contracts still checks types', () => {
    assert.deepEqual(flags(planChanges([{ path: 'docs/old.md', status: 'D' }])), none);
    assert.deepEqual(flags(planChanges([{ path: 'test/old.test.ts', status: 'D' }])), {
      ...none,
      lint: true,
      typecheck: true,
    });
  });

  test('unknown and conflicted statuses request the full check even for familiar paths', () => {
    for (const status of ['U', 'T', 'X']) {
      assert.deepEqual(flags(planChanges([{ path: 'docs/testing.md', status }])), full);
    }
  });

  test('plans combine checks and have stable, deduplicated, single-line explanations', () => {
    const files = [
      modified('README.md'),
      modified('src/line\nbreak.ts'),
      modified('test/types.test.ts'),
    ];
    const plan = planChanges(files);
    assert.deepEqual(planChanges([...files].reverse()), plan);
    assert.deepEqual(planChanges([...files, files[0]]), plan);
    assert.deepEqual(flags(plan), {
      ...none,
      lint: true,
      typecheck: true,
      unit: true,
      package: true,
    });
    assert.equal(plan.reasons.length, 3);
    assert.ok(plan.reasons.every((reason) => !reason.includes('\n')));
    assert.ok(plan.reasons.some((reason) => reason.includes('line\\nbreak.ts')));
  });
});
