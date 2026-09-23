import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { planChanges, readChanges } from './change-plan.mjs';

const { values } = parseArgs({
  options: {
    changed: { type: 'boolean' },
    affected: { type: 'boolean' },
    full: { type: 'boolean' },
    since: { type: 'string', default: 'HEAD' },
    plan: { type: 'boolean' },
  },
});
if (values.full && (values.changed || values.affected)) {
  throw new Error('Choose --full or --changed/--affected');
}
const root = process.cwd();
const changes = values.full
  ? { base: null, files: [] }
  : readChanges({ cwd: root, since: values.since });
const gates = values.full
  ? {
      full: true,
      lint: true,
      typecheck: true,
      unit: true,
      package: true,
      reasons: ['Explicit full verification'],
    }
  : planChanges(changes.files);
const commands = [];
const node = (label, path, args = []) =>
  commands.push({ label, executable: process.execPath, args: [resolve(root, path), ...args] });
const biome = (...args) => node('Biome', 'node_modules/@biomejs/biome/bin/biome', args);
const vitest = (...args) => node('Vitest', 'node_modules/vitest/vitest.mjs', args);
const types = () => {
  node('Project types', 'node_modules/typescript/bin/tsc', ['--noEmit']);
  node('Consumer types', 'node_modules/typescript/bin/tsc', [
    '--noEmit',
    '-p',
    'tsconfig.consumer.json',
  ]);
};
if (gates.full) {
  biome('ci', '--error-on-warnings', '.');
  types();
  vitest('run', '--coverage');
  node('Full installed-package contracts', 'scripts/test-package.mjs');
} else {
  if (gates.lint) {
    const files = changes.files
      .map((file) => file.path)
      .filter(
        (path) =>
          /\.(?:[cm]?[jt]sx?|jsonc?)$/.test(path) &&
          path !== 'package-lock.json' &&
          existsSync(resolve(root, path)),
      );
    if (files.length) biome('ci', '--error-on-warnings', ...files.map((path) => `./${path}`));
  }
  if (gates.typecheck) types();
  if (gates.unit) {
    // Share the NUL-safe Git manifest with Biome. Vitest's own --changed reader
    // currently splits newline-delimited Git output, which can lose quoted paths.
    vitest('related', '--run', ...changes.files.map((file) => `./${file.path}`));
  }
  if (gates.package) node('Installed-package smoke', 'scripts/test-package.mjs', ['--smoke']);
}
const plan = { mode: gates.full ? 'full' : 'affected', ...changes, gates, commands };
if (values.plan) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  console.log(`${plan.mode} checks; base=${plan.base ?? 'not needed'}`);
  for (const reason of gates.reasons) console.log(`  ${reason}`);
  if (!commands.length) console.log('No executable contracts affected.');
  for (const command of commands) {
    console.log(`\n${command.label}`);
    const result = spawnSync(command.executable, command.args, { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
