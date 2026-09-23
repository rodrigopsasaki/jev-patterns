import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const npmCli = process.env.npm_execpath;
const full = process.env.JEV_PACKAGE_MODE !== 'smoke';

function run(command, args, cwd) {
  const env = { ...process.env };
  // The consumer has its own test runner; it is not a child test in this runner.
  delete env.NODE_TEST_CONTEXT;
  return execFileSync(command, args, { cwd, env, encoding: 'utf8', timeout: 120_000 });
}

test(`the packed ESM package passes ${full ? 'full contracts' : 'smoke checks'}`, async (t) => {
  assert.ok(npmCli, 'Run this check with npm run test:package');
  const scratch = await mkdtemp(join(tmpdir(), 'jev-lens-consumer-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const cache = join(scratch, 'cache');
  const npm = (args, cwd) => run(process.execPath, [npmCli, ...args, '--cache', cache], cwd);

  const [packed] = JSON.parse(
    npm(['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], root),
  );
  const paths = packed.files.map((file) => file.path).sort();
  assert.ok(paths.includes('dist/index.js'));
  assert.ok(paths.includes('dist/index.d.ts'));
  assert.ok(paths.includes('LICENSE'));
  assert.ok(paths.includes('README.md'));
  assert.ok(
    paths.every((path) =>
      /^(dist\/[^/]+\.(?:js|d\.ts)|package\.json|README\.md|LICENSE)$/.test(path),
    ),
    `Unexpected package contents: ${paths.join(', ')}`,
  );

  const consumer = join(scratch, 'consumer');
  await mkdir(consumer);
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'fixture-consumer', private: true, type: 'module' }),
  );
  npm(
    [
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      join(scratch, packed.filename),
    ],
    consumer,
  );
  const installed = JSON.parse(
    await readFile(join(consumer, 'node_modules/jev-lens/package.json'), 'utf8'),
  );
  assert.deepEqual(installed.dependencies ?? {}, {});
  assert.deepEqual(Object.keys(installed.exports), ['.']);

  const testRoot = join(consumer, 'test');
  await mkdir(testRoot);
  const files = await readdir(join(root, 'test'));
  if (files.includes('helpers'))
    await cp(join(root, 'test/helpers'), join(testRoot, 'helpers'), { recursive: true });
  const contracts = files.filter((file) => /\.test\.(mjs|ts)$/.test(file)).sort();
  for (const file of contracts) {
    const source = await readFile(join(root, 'test', file), 'utf8');
    // Reuse behavioral contracts against the installed public export, never its repository source.
    const vitestImports = [
      ...source.matchAll(/import\s+(\{[^}]*\}|[^;\n]+)\s+from\s+['"]vitest['"]/g),
    ];
    for (const match of vitestImports)
      assert.match(
        match[1].trim(),
        /^\{\s*test\s*,?\s*\}$/,
        `${file}: shared artifact contracts only support Vitest's test function`,
      );
    const rewritten = source
      .replace(/\.\.\/src\/[^'"\s]+\.ts/g, 'jev-lens')
      .replace(/from\s+(['"])vitest\1/g, "from 'node:test'");
    assert.ok(
      !rewritten.includes('../src/'),
      `Package contract ${file} imports an internal module`,
    );
    await writeFile(join(testRoot, file), rewritten);
  }

  if (full) {
    await t.test('all public runtime tests pass using only installed JavaScript', () => {
      const output = run(
        process.execPath,
        [
          '--test',
          '--test-reporter=tap',
          ...contracts.filter((file) => file.endsWith('.mjs')).map((file) => join('test', file)),
        ],
        consumer,
      );
      assert.match(output, /# tests [1-9]\d*/);
      for (const outcome of ['fail', 'cancelled', 'skipped', 'todo'])
        assert.match(output, new RegExp(`# ${outcome} 0\\b`));
    });
  }

  await t.test('public exports and all three Jev answer kinds work in native Node', () => {
    run(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
      import assert from 'node:assert/strict';
      import * as api from 'jev-lens';
      assert.deepEqual(Object.keys(api).sort(), [
        'allOf', 'analyze', 'anyOf', 'clustered', 'dominant', 'flat', 'gapAtLeast',
        'massSet', 'maximumProbabilityAtLeast', 'not', 'paired', 'parse', 'split',
      ].sort());
      const parsed = api.parse({ model: 'synthetic', usage: { input_tokens: 0, output_tokens: 0 }, answers: {
        route: { type: 'choice', choice: 'a', confidence: 0.3, probabilities: { a: 0.64, b: 0.36 } },
        flag: { type: 'noul', noul: 0.9 },
        level: { type: 'score', score: 0.7, confidence: 0.2, legend: { 0: 'Low', 1: 'High' }, probabilities: { 0: 0.3, 1: 0.7 } },
      } });
      assert.equal(parsed.answers.route.shape, 'paired');
      assert.equal(parsed.answers.flag.yes, 0.9);
      assert.equal(parsed.answers.level.expectedLevel, 0.7);
      assert.equal(api.analyze({ a: 1 }).is(api.dominant()), true);
      assert.equal(api.massSet({ a: 0.9, b: 0.1 }, 0.8).count, 1);
    `,
      ],
      consumer,
    );
  });

  await t.test('implementation subpaths are not public entry points', () => {
    run(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
      import assert from 'node:assert/strict';
      await assert.rejects(import('jev-lens/dist/analysis.js'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    `,
      ],
      consumer,
    );
  });

  await t.test('the shipped README examples execute against the installed package', async () => {
    const readme = (
      await readFile(join(consumer, 'node_modules/jev-lens/README.md'), 'utf8')
    ).replaceAll('\r\n', '\n');
    // These three sections form one runnable example. The later integration
    // snippet needs an application-supplied Jev client.
    const introductory = readme.slice(0, readme.indexOf('## Jev integration'));
    const blocks = [...introductory.matchAll(/```ts\n([\s\S]*?)```/g)].map((match) => match[1]);
    assert.equal(
      blocks.length,
      3,
      'Keep the introductory README examples under this executable check',
    );
    await writeFile(
      join(consumer, 'readme-example.mjs'),
      [
        "import assert from 'node:assert/strict';",
        ...blocks,
        "assert.equal(distribution.shape, 'paired');",
        "assert.equal(description, 'a and b have substantial, unequal shares.');",
        'assert.equal(distribution.is(concentrated), false);',
      ].join('\n'),
    );
    run(process.execPath, ['readme-example.mjs'], consumer);
  });

  for (const resolution of full ? ['NodeNext', 'Bundler'] : ['NodeNext']) {
    for (const checkedIndex of full ? [true, false] : [true]) {
      await t.test(
        `${resolution} declarations with noUncheckedIndexedAccess=${checkedIndex}`,
        async () => {
          await writeFile(
            join(consumer, 'tsconfig.json'),
            JSON.stringify({
              compilerOptions: {
                target: 'ES2022',
                module: resolution === 'NodeNext' ? 'NodeNext' : 'ESNext',
                moduleResolution: resolution,
                strict: true,
                exactOptionalPropertyTypes: true,
                noUncheckedIndexedAccess: checkedIndex,
                noEmit: true,
                skipLibCheck: false,
              },
              include: ['test/*.test.ts'],
            }),
          );
          run(
            process.execPath,
            [resolve(root, 'node_modules/typescript/bin/tsc'), '--project', 'tsconfig.json'],
            consumer,
          );
        },
      );
    }
  }
});
