import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const npmCli = process.env.npm_execpath;

function run(command, args, cwd) {
  const env = { ...process.env };
  // The consumer has its own test runner; it is not a child test in this runner.
  delete env.NODE_TEST_CONTEXT;
  return execFileSync(command, args, { cwd, env, encoding: 'utf8', timeout: 120_000 });
}

test('the packed ESM package works without source files and preserves its public type contracts', async t => {
  assert.ok(npmCli, 'Run this check with npm run test:package');
  const scratch = await mkdtemp(join(tmpdir(), 'jev-lens-consumer-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const cache = join(scratch, 'cache');
  const npm = (args, cwd) => run(process.execPath, [npmCli, ...args, '--cache', cache], cwd);

  const [packed] = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], root));
  const paths = packed.files.map(file => file.path).sort();
  assert.ok(paths.includes('dist/index.js'));
  assert.ok(paths.includes('dist/index.d.ts'));
  assert.ok(paths.includes('LICENSE'));
  assert.ok(paths.includes('README.md'));
  assert.ok(paths.every(path => /^(dist\/[^/]+\.(?:js|d\.ts)|package\.json|README\.md|LICENSE)$/.test(path)),
    `Unexpected package contents: ${paths.join(', ')}`);

  const consumer = join(scratch, 'consumer');
  await mkdir(consumer);
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'fixture-consumer', private: true, type: 'module' }));
  npm(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', join(scratch, packed.filename)], consumer);
  const installed = JSON.parse(await readFile(join(consumer, 'node_modules/jev-lens/package.json'), 'utf8'));
  assert.deepEqual(installed.dependencies ?? {}, {});
  assert.deepEqual(Object.keys(installed.exports), ['.']);

  const testRoot = join(consumer, 'test');
  await mkdir(testRoot);
  const files = await readdir(join(root, 'test'));
  if (files.includes('helpers')) await cp(join(root, 'test/helpers'), join(testRoot, 'helpers'), { recursive: true });
  const contracts = files.filter(file => /\.test\.(mjs|ts)$/.test(file)).sort();
  for (const file of contracts) {
    const source = await readFile(join(root, 'test', file), 'utf8');
    // Reuse behavioral contracts against the installed public export, never its repository source.
    const rewritten = source.replaceAll('../src/index.ts', 'jev-lens');
    assert.ok(!rewritten.includes('../src/'), `Package contract ${file} imports an internal module`);
    await writeFile(join(testRoot, file), rewritten);
  }

  await t.test('all public runtime tests pass using only installed JavaScript', () => {
    const output = run(process.execPath, ['--test', ...contracts.filter(file => file.endsWith('.mjs')).map(file => join('test', file))], consumer);
    assert.match(output, /(?:#|ℹ) fail 0/);
  });

  await t.test('implementation subpaths are not public entry points', () => {
    run(process.execPath, ['--input-type=module', '--eval', `
      import assert from 'node:assert/strict';
      await assert.rejects(import('jev-lens/dist/analysis.js'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    `], consumer);
  });

  await t.test('the shipped README examples execute against the installed package', async () => {
    const readme = await readFile(join(consumer, 'node_modules/jev-lens/README.md'), 'utf8');
    // These three sections form one runnable example. The later integration
    // snippet needs an application-supplied Jev client.
    const introductory = readme.slice(0, readme.indexOf('## Jev integration'));
    const blocks = [...introductory.matchAll(/```ts\n([\s\S]*?)```/g)].map(match => match[1]);
    assert.equal(blocks.length, 3, 'Keep the introductory README examples under this executable check');
    await writeFile(join(consumer, 'readme-example.mjs'), [
      "import assert from 'node:assert/strict';",
      ...blocks,
      "assert.equal(distribution.shape, 'paired');",
      "assert.equal(description, 'a and b have substantial, unequal shares.');",
      'assert.equal(distribution.is(concentrated), false);',
    ].join('\n'));
    run(process.execPath, ['readme-example.mjs'], consumer);
  });

  for (const resolution of ['NodeNext', 'Bundler']) {
    for (const checkedIndex of [true, false]) {
      await t.test(`${resolution} declarations with noUncheckedIndexedAccess=${checkedIndex}`, async () => {
        await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({
          compilerOptions: {
            target: 'ES2022', module: resolution === 'NodeNext' ? 'NodeNext' : 'ESNext',
            moduleResolution: resolution, strict: true, exactOptionalPropertyTypes: true,
            noUncheckedIndexedAccess: checkedIndex, noEmit: true, skipLibCheck: false,
          },
          include: ['test/*.test.ts'],
        }));
        run(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--project', 'tsconfig.json'], consumer);
      });
    }
  }
});
