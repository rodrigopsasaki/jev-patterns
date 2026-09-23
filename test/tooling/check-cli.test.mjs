import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, test } from 'vitest';

const checkScript = fileURLToPath(new URL('../../scripts/check.mjs', import.meta.url));
const scratch = new Set();
afterEach(() => {
  for (const cwd of scratch) rmSync(cwd, { recursive: true, force: true });
  scratch.clear();
});

function repository(files = {}) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'jev-patterns-check-cli-')));
  scratch.add(directory);
  const cwd = join(directory, 'repo');
  mkdirSync(cwd);
  // Use an actual empty file; Git for Windows rejects Node's os.devNull device path.
  const globalConfig = join(directory, 'global.gitconfig');
  writeFileSync(globalConfig, '');
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'CLI Contract',
    GIT_AUTHOR_EMAIL: 'contract@example.invalid',
    GIT_COMMITTER_NAME: 'CLI Contract',
    GIT_COMMITTER_EMAIL: 'contract@example.invalid',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: globalConfig,
  };
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
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
    '.gitignore': 'node_modules/\ndist/\n',
    'README.md': 'Fixture\n',
    ...files,
  }))
    write(path, content);
  const initial = commit('initial');
  const run = (...args) => {
    const before = git('status', '--porcelain=v1', '-z');
    const result = spawnSync(process.execPath, [checkScript, ...args, '--plan'], {
      cwd,
      env,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(git('status', '--porcelain=v1', '-z'), before, '--plan must be read-only');
    assert.equal(existsSync(join(cwd, 'node_modules')), false, '--plan must not install tools');
    assert.equal(existsSync(join(cwd, 'dist')), false, '--plan must not execute the build');
    return result;
  };
  const plan = (...args) => {
    const result = run(...args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    return JSON.parse(result.stdout);
  };
  return { cwd, git, write, commit, initial, run, plan };
}

function expectedCommand(repo, label, script, ...args) {
  return { label, executable: process.execPath, args: [join(repo.cwd, script), ...args] };
}

const typeCommands = (repo) => [
  expectedCommand(repo, 'Project types', 'node_modules/typescript/bin/tsc', '--noEmit'),
  expectedCommand(
    repo,
    'Consumer types',
    'node_modules/typescript/bin/tsc',
    '--noEmit',
    '-p',
    'tsconfig.consumer.json',
  ),
];

describe('check --plan CLI', () => {
  test('defaults to HEAD and schedules no commands for a clean repository', () => {
    const repo = repository();
    const plan = repo.plan();
    assert.equal(plan.mode, 'affected');
    assert.equal(plan.base, repo.initial);
    assert.deepEqual(plan.files, []);
    assert.deepEqual(plan.commands, []);
    assert.deepEqual(plan.gates, {
      full: false,
      lint: false,
      typecheck: false,
      unit: false,
      package: false,
      reasons: [],
    });
  });

  test('a Jev source change plans related tests, both type consumers, and installed-package smoke', () => {
    const repo = repository({ 'src/jev.ts': 'original\n' });
    repo.write('src/jev.ts', 'changed\n');
    const plan = repo.plan('--changed');
    assert.equal(plan.mode, 'affected');
    assert.deepEqual(plan.files, [{ path: 'src/jev.ts', status: 'M' }]);
    assert.deepEqual(plan.commands, [
      expectedCommand(
        repo,
        'Biome',
        'node_modules/@biomejs/biome/bin/biome',
        'ci',
        '--error-on-warnings',
        './src/jev.ts',
      ),
      ...typeCommands(repo),
      expectedCommand(
        repo,
        'Vitest',
        'node_modules/vitest/vitest.mjs',
        'related',
        '--run',
        './src/jev.ts',
      ),
      expectedCommand(repo, 'Installed-package smoke', 'scripts/test-package.mjs', '--smoke'),
    ]);
    assert.ok(plan.commands.every((command) => !command.args.includes('--passWithNoTests')));
  });

  test('documentation-only edits have no executable commands', () => {
    const repo = repository({ 'docs/testing.md': 'before\n' });
    repo.write('docs/testing.md', 'after\n');
    const plan = repo.plan('--affected');
    assert.equal(plan.mode, 'affected');
    assert.deepEqual(plan.commands, []);
    assert.match(plan.gates.reasons[0], /documentation-only/);
  });

  test('a type fixture runs lint and type checks without runtime or package commands', () => {
    const repo = repository({ 'test/types.test.ts': 'before\n' });
    repo.write('test/types.test.ts', 'after\n');
    const plan = repo.plan();
    assert.deepEqual(plan.commands, [
      expectedCommand(
        repo,
        'Biome',
        'node_modules/@biomejs/biome/bin/biome',
        'ci',
        '--error-on-warnings',
        './test/types.test.ts',
      ),
      ...typeCommands(repo),
    ]);
    assert.equal(plan.gates.unit, false);
    assert.equal(plan.gates.package, false);
  });

  test('configuration changes request full verification without a changed-file test filter', () => {
    const repo = repository({ 'vitest.config.mjs': 'before\n' });
    repo.write('vitest.config.mjs', 'after\n');
    const plan = repo.plan('--changed');
    assert.equal(plan.mode, 'full');
    assert.deepEqual(plan.commands, [
      expectedCommand(
        repo,
        'Biome',
        'node_modules/@biomejs/biome/bin/biome',
        'ci',
        '--error-on-warnings',
        '.',
      ),
      ...typeCommands(repo),
      expectedCommand(repo, 'Vitest', 'node_modules/vitest/vitest.mjs', 'run', '--coverage'),
      expectedCommand(repo, 'Full installed-package contracts', 'scripts/test-package.mjs'),
    ]);
    for (const command of plan.commands) {
      assert.ok(!command.args.includes('--changed'));
      assert.ok(!command.args.includes('related'));
      assert.ok(!command.args.includes('--passWithNoTests'));
      assert.ok(!command.args.includes('--smoke'));
    }
  });

  test('package-contract changes plan full installed-package replay rather than smoke', () => {
    const repo = repository({ 'test/package/consumer.mjs': 'before\n' });
    repo.write('test/package/consumer.mjs', 'after\n');
    const plan = repo.plan('--changed');
    assert.equal(plan.mode, 'full');
    assert.match(plan.gates.reasons[0], /smoke can skip replay blocks/);
    assert.deepEqual(
      plan.commands.at(-1),
      expectedCommand(repo, 'Full installed-package contracts', 'scripts/test-package.mjs'),
    );
    assert.ok(plan.commands.every((command) => !command.args.includes('--smoke')));
  });

  test('an unusual filename is retained as one argv item for both lint and related tests', () => {
    const path =
      process.platform === 'win32'
        ? 'src/-space Unicode é.ts'
        : 'src/-space tab\tline\nquote"$(touch forbidden).ts';
    const repo = repository({ [path]: 'before\n' });
    repo.write(path, 'after\n');
    const plan = repo.plan();
    assert.deepEqual(plan.files, [{ path, status: 'M' }]);
    const biome = plan.commands.find((command) => command.label === 'Biome');
    const vitest = plan.commands.find((command) => command.label === 'Vitest');
    assert.deepEqual(biome.args.slice(1), ['ci', '--error-on-warnings', `./${path}`]);
    assert.deepEqual(vitest.args.slice(1), ['related', '--run', `./${path}`]);
    assert.ok(!vitest.args.includes('--passWithNoTests'));
    assert.equal(existsSync(join(repo.cwd, 'forbidden')), false);
  });

  test('--since uses the branch merge base and excludes target-only changes', () => {
    const repo = repository();
    repo.git('switch', '-c', 'feature');
    repo.write('src/feature.ts', 'feature\n');
    repo.commit('feature');
    repo.git('switch', 'main');
    repo.write('src/target-only.ts', 'target\n');
    repo.commit('target advances');
    repo.git('switch', 'feature');
    const plan = repo.plan('--changed', '--since', 'main');
    assert.equal(plan.base, repo.initial);
    assert.deepEqual(plan.files, [{ path: 'src/feature.ts', status: 'A' }]);
    assert.deepEqual(plan.commands.find((command) => command.label === 'Vitest').args.slice(1), [
      'related',
      '--run',
      './src/feature.ts',
    ]);
  });

  test('an explicit full plan works on a clean repository and needs no Git change base', () => {
    const repo = repository();
    const plan = repo.plan('--full');
    assert.equal(plan.mode, 'full');
    assert.equal(plan.base, null);
    assert.deepEqual(plan.files, []);
    assert.deepEqual(plan.commands.find((command) => command.label === 'Vitest').args.slice(1), [
      'run',
      '--coverage',
    ]);
  });

  test('a missing --since reference exits nonzero and does not emit a misleading empty plan', () => {
    const repo = repository();
    const result = repo.run('--since', 'missing-reference');
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /missing-reference/);
  });

  test.each(['--changed', '--affected'])('--full combined with %s is rejected', (mode) => {
    const repo = repository();
    const result = repo.run('--full', mode);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Choose --full or --changed\/--affected/);
  });
});
