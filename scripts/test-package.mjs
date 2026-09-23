import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { smoke: { type: 'boolean' } } });
const root = fileURLToPath(new URL('../', import.meta.url));
for (const args of [
  ['scripts/clean.mjs'],
  ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'],
  ['--test', 'test/package/consumer.mjs'],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, JEV_PACKAGE_MODE: values.smoke ? 'smoke' : 'full' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
