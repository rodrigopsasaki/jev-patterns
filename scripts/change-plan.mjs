import { execFileSync } from 'node:child_process';

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' },
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function nulFields(output) {
  if (output === '') return [];
  if (!output.endsWith('\0'))
    throw new Error('Git returned an unterminated NUL-delimited change list');
  return output.slice(0, -1).split('\0');
}

/** Read repository-relative changes without interpreting references or paths as shell text. */
export function readChanges({ cwd = process.cwd(), since = 'HEAD' } = {}) {
  if (typeof since !== 'string' || since.length === 0) {
    throw new TypeError('since must be a nonempty Git reference');
  }
  const root = git(cwd, ['rev-parse', '--show-toplevel']).replace(/\n$/, '');
  // A missing ref is an error: running a smaller check against an invented base
  // would make an affected check silently incomplete.
  const resolved = git(root, [
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${since}^{commit}`,
  ]).trim();
  const base = git(root, ['merge-base', 'HEAD', resolved]).trim();
  const changes = new Map();
  const add = (path, status) => {
    // Retain a deletion seen in any view so a restored or renamed dependency
    // cannot bypass the conservative deletion policy.
    const previous = changes.get(path);
    if (!previous || !/^[AMD]$/.test(status) || (status === 'D' && /^[AMD]$/.test(previous))) {
      changes.set(path, status);
    }
  };
  const diffOptions = [
    '--name-status',
    '-z',
    '--no-renames',
    '--no-relative',
    '--no-ext-diff',
    '--no-color',
  ];
  for (const revision of [[base], ['--cached'], []]) {
    const fields = nulFields(git(root, ['diff', ...diffOptions, ...revision, '--']));
    if (fields.length % 2 !== 0) throw new Error('Git returned an invalid name/status change list');
    for (let index = 0; index < fields.length; index += 2) {
      add(fields[index + 1], fields[index]);
    }
  }
  // The extra index/worktree views also retain changes that cancel each other
  // in the final tree (for example, a staged edit restored only in the worktree).
  for (const path of nulFields(
    git(root, ['ls-files', '--others', '--exclude-standard', '--full-name', '-z']),
  )) {
    add(path, 'A');
  }
  return {
    base,
    files: [...changes]
      .map(([path, status]) => ({ path, status }))
      .sort((left, right) => compare(left.path, right.path)),
  };
}

const lintable = /\.(?:[cm]?[jt]sx?|jsonc?)$/;
const runtimeTest = /^test\/[^/]+\.test\.mjs$/;
const typeTest = /^test\/[^/]+\.test\.ts$/;
const configuration =
  /^(?:package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|biome\.jsonc?|vitest\.config\.[^/]+|tsconfig[^/]*)$/;
const publicSource = new Set(['src/index.ts', 'src/model.ts', 'src/jev.ts']);

/** Build a conservative, deterministic check plan; reasons are safe to print as lines. */
export function planChanges(files) {
  const plan = {
    full: false,
    lint: false,
    typecheck: false,
    unit: false,
    package: false,
    reasons: [],
  };
  const reasons = new Set();
  const ordered = [...files].sort(
    (left, right) => compare(left.path, right.path) || compare(left.status, right.status),
  );
  for (const { path, status } of ordered) {
    if (
      typeof path !== 'string' ||
      path.length === 0 ||
      typeof status !== 'string' ||
      status.length === 0
    ) {
      throw new TypeError('Each change must have a nonempty path and status');
    }
    const explain = (message) => reasons.add(`${JSON.stringify(path)}: ${message}`);
    const source = path.startsWith('src/');
    const helper = path.startsWith('test/helpers/');
    const runtime = runtimeTest.test(path);
    if (lintable.test(path)) plan.lint = true;

    if (path.startsWith('test/package/')) {
      plan.full = true;
      explain('package contract changed; smoke can skip replay blocks, so run the full check');
    } else if (
      configuration.test(path) ||
      path.startsWith('scripts/') ||
      path.startsWith('.github/workflows/')
    ) {
      plan.full = true;
      explain('build, tooling, dependency, or CI configuration changed; run the full check');
    } else if (/^(?:D|R\d*)$/.test(status) && (source || helper || runtime)) {
      plan.full = true;
      explain('source or runtime test dependency was deleted or renamed; run the full check');
    } else if (!/^(?:A|M|D|R\d*|C\d*)$/.test(status)) {
      plan.full = true;
      explain(`unusual Git status ${JSON.stringify(status)}; run the full check`);
    } else if (source) {
      plan.unit = true;
      plan.typecheck = true;
      plan.package = true;
      if (publicSource.has(path)) {
        explain('public API or Jev integration changed; run unit tests, types, and package smoke');
      } else {
        explain('source changed; run unit tests, types, and package smoke');
      }
    } else if (runtime || helper) {
      plan.unit = true;
      const typedHelper = /\.[cm]?tsx?$/.test(path);
      if (typedHelper) plan.typecheck = true;
      explain(
        typedHelper
          ? 'typed test helper changed; run unit tests and types'
          : 'runtime test or shared helper changed; run unit tests',
      );
    } else if (typeTest.test(path) || path.startsWith('examples/')) {
      plan.typecheck = true;
      explain('type contract or example changed; run types');
    } else if (path === 'README.md' || path === 'LICENSE') {
      plan.package = true;
      explain('published content changed; run package smoke');
    } else if (path.startsWith('docs/') || /\.mdx?$/.test(path)) {
      explain('documentation-only change; no runtime check required');
    } else {
      plan.full = true;
      explain('unclassified file changed; run the full check');
    }
  }
  if (plan.full) {
    plan.lint = true;
    plan.typecheck = true;
    plan.unit = true;
    plan.package = true;
  }
  plan.reasons = [...reasons];
  return plan;
}
