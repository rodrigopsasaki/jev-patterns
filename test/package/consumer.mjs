import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const npmCli = process.env.npm_execpath;
const full = process.env.JEV_PACKAGE_MODE !== 'smoke';
const readmeAssertions = {
  quickstart: [
    "assert.equal(distribution.first.option, 'password_reset');",
    'assert.equal(distribution.maximumProbability, 0.51);',
    'assert.equal(distribution.maxima.length, 1);',
    "assert.equal(distribution.maxima[0].option, 'password_reset');",
    "assert.equal(distribution.uniqueMaximum?.option, 'password_reset');",
    'assert.ok(Math.abs(distribution.gap - 0.06) < 1e-12);',
  ],
  support: [
    "assert.deepEqual(view, { kind: 'clarify', options: ['password_reset', 'account_locked'] });",
  ],
  retrieval: [
    "assert.deepEqual(pagesToFetch, ['reset_2fa', 'lost_phone', 'backup_codes']);",
    'assert.equal(shortlist.count, 3);',
    'assert.ok(Math.abs(shortlist.mass - 0.97) < 1e-12);',
  ],
  labels: [
    "assert.deepEqual(suggestedLabels, ['billing', 'refund']);",
    'assert.equal(response.answers.billing.distribution.maximumProbability, 0.94);',
    "assert.equal(response.answers.login.distribution.uniqueMaximum?.option, 'no');",
  ],
  ranking: ["assert.deepEqual(topCause, { option: 'password_reset', probability: 0.51 });"],
  predicates: ['assert.equal(meetsRoutingPolicy, true);'],
  inspection: [
    "assert.equal(inspected.kind, 'available');",
    'assert.equal(inspected.answer.maximumProbability, 0.51);',
    'assert.equal(inspected.answer.confidence, null);',
    "assert.deepEqual([inspected.answer.first.option, inspected.answer.second.option], ['S1', 'S2']);",
  ],
};
const readmeAssets = ['status', 'license', 'node', 'typescript', 'dependencies'].map(
  (badge) => `assets/badges/${badge}.svg`,
);

function extractReadmeExamples(readme) {
  const examples = new Map();
  for (const marker of readme.matchAll(/<!--[ \t]*example:([^\r\n]*?)[ \t]*-->/g)) {
    const name = marker[1].trim();
    assert.ok(
      Object.hasOwn(readmeAssertions, name),
      `Unknown README example ${JSON.stringify(name)}`,
    );
    assert.ok(!examples.has(name), `Duplicate README example ${JSON.stringify(name)}`);
    const following = readme.slice(marker.index + marker[0].length);
    const block = following.match(
      /^[ \t]*\n(?:[ \t]*\n)*[ \t]*```ts[ \t]*\n([\s\S]*?)\n[ \t]*```[ \t]*(?=\n|$)/,
    );
    assert.ok(block, `README example ${JSON.stringify(name)} must immediately precede a ts fence`);
    examples.set(name, block[1]);
  }
  assert.deepEqual(
    [...examples.keys()].sort(),
    Object.keys(readmeAssertions).sort(),
    'README must contain each named standalone example',
  );
  const tsFences = [...readme.matchAll(/^[ \t]*```ts\b[^\n]*$/gm)];
  assert.equal(
    tsFences.length,
    examples.size,
    'Every README ts fence needs a named example marker',
  );
  return examples;
}

function assertReadmeImages(readme, paths) {
  const references = new Map();
  const referenceKey = (value) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  for (const definition of readme.matchAll(/^[ \t]*\[([^\]]+)\]:[ \t]*(?:<([^>]+)>|([^\s]+))/gm)) {
    references.set(referenceKey(definition[1]), definition[2] ?? definition[3]);
  }
  const targets = [];
  for (const image of readme.matchAll(
    /!\[([^\]]*)\](?:\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|\[([^\]]*)\])?/g,
  )) {
    const target = image[2] ?? image[3] ?? references.get(referenceKey(image[4] || image[1]));
    assert.ok(target, `Unresolved README image reference ${JSON.stringify(image[0])}`);
    targets.push(target);
  }
  for (const image of readme.matchAll(/<img\b[^>]*>/gi)) {
    const source = image[0].match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    assert.ok(source, 'README HTML images must declare a src');
    targets.push(source[1] ?? source[2] ?? source[3]);
  }
  for (const target of targets) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
    const path = posix.normalize(decodeURIComponent(target.split(/[?#]/, 1)[0]));
    assert.ok(
      !posix.isAbsolute(path) && path !== '..' && !path.startsWith('../') && paths.includes(path),
      `README image ${JSON.stringify(target)} is missing from the package archive`,
    );
  }
}

test('README example markers reject omissions, duplicates, unknown names, and unmarked code', () => {
  const blocks = Object.keys(readmeAssertions).map(
    (name) => `<!-- example:${name} -->\n\`\`\`ts\nexport {};\n\`\`\``,
  );
  const valid = blocks.join('\n\n');
  assert.deepEqual([...extractReadmeExamples(valid).keys()], Object.keys(readmeAssertions));
  assert.throws(() => extractReadmeExamples(blocks.slice(1).join('\n\n')), /each named/);
  assert.throws(() => extractReadmeExamples(`${valid}\n\n${blocks[0]}`), /Duplicate/);
  assert.throws(
    () => extractReadmeExamples(valid.replace('example:support', 'example:unknown')),
    /Unknown/,
  );
  assert.throws(
    () => extractReadmeExamples(`${valid}\n\n\`\`\`ts\nexport {};\n\`\`\``),
    /Every README ts fence/,
  );
  assert.throws(
    () =>
      extractReadmeExamples(
        valid.replace('<!-- example:support -->', '<!-- example:support -->\nIntervening text'),
      ),
    /immediately precede/,
  );
});

test('README image validation covers inline, reference, and HTML images', () => {
  const paths = ['assets/distributions.svg', 'assets/badges/status.svg'];
  assert.doesNotThrow(() =>
    assertReadmeImages(
      [
        '![Distribution](./assets/distributions.svg?display=1#figure)',
        '[![Status][status]](https://example.invalid)',
        '[status]: assets/badges/status.svg',
        '<img src="assets/distributions.svg" alt="Distribution">',
        '![External](https://example.invalid/badge.svg)',
      ].join('\n'),
      paths,
    ),
  );
  assert.throws(
    () => assertReadmeImages('![Missing](assets/missing.svg)', paths),
    /missing from the package/,
  );
  assert.throws(
    () => assertReadmeImages('<img src="assets/missing.svg">', paths),
    /missing from the package/,
  );
  assert.throws(() => assertReadmeImages('![Missing][unknown]', paths), /Unresolved/);
});

function run(command, args, cwd) {
  const env = { ...process.env };
  // The consumer has its own test runner; it is not a child test in this runner.
  delete env.NODE_TEST_CONTEXT;
  return execFileSync(command, args, { cwd, env, encoding: 'utf8', timeout: 120_000 });
}

test(`the packed ESM package passes ${full ? 'full contracts' : 'smoke checks'}`, async (t) => {
  assert.ok(npmCli, 'Run this check with npm run test:package');
  const scratch = await mkdtemp(join(tmpdir(), 'jev-patterns-consumer-'));
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
  for (const asset of readmeAssets)
    assert.ok(paths.includes(asset), `Missing package asset ${asset}`);
  assert.ok(
    paths.every(
      (path) =>
        /^(dist\/[^/]+\.(?:js|d\.ts)|package\.json|README\.md|LICENSE)$/.test(path) ||
        readmeAssets.includes(path),
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
    await readFile(join(consumer, 'node_modules/jev-patterns/package.json'), 'utf8'),
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
      .replace(/\.\.\/src\/[^'"\s]+\.ts/g, 'jev-patterns')
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
      import * as api from 'jev-patterns';
      assert.deepEqual(Object.keys(api).sort(), [
        'allOf', 'analyze', 'anyOf', 'clustered', 'dominant', 'flat', 'gapAtLeast',
        'inspectAnswer', 'massSet', 'maximumProbabilityAtLeast', 'not', 'paired', 'parse', 'rank', 'split',
      ].sort());
      const parsed = api.parse({ model: 'synthetic', usage: { input_tokens: 0, output_tokens: 0 }, answers: {
        route: { type: 'choice', choice: 'a', confidence: 0.3, probabilities: { a: 0.64, b: 0.36 } },
        flag: { type: 'noul', noul: 0.9 },
        level: { type: 'score', score: 0.7, confidence: 0.2, legend: { 0: 'Low', 1: 'High' }, probabilities: { 0: 0.3, 1: 0.7 } },
      } });
      assert.equal(parsed.answers.route.maximumProbability, 0.64);
      assert.equal(parsed.answers.flag.yes, 0.9);
      assert.equal(parsed.answers.level.expectedLevel, 0.7);
      assert.equal(api.analyze({ a: 1 }).is(api.dominant()), true);
      assert.equal(api.massSet({ a: 0.9, b: 0.1 }, 0.8).count, 1);
      assert.deepEqual(api.rank({ a: 0.64, b: 0.36 }, { limit: 1 }), [{ option: 'a', probability: 0.64 }]);
      assert.equal(api.inspectAnswer({ ...parsed.answers.route.raw, confidence: null }).answer.maximumProbability, 0.64);
      assert.equal(api.inspectAnswer({ type: 'noul', noul: 0.2 }).answer.no, 0.8);
      assert.equal(api.inspectAnswer({ ...parsed.answers.level.raw, confidence: null }).answer.expectedLevel, 0.7);
      assert.equal(api.inspectAnswer(undefined).kind, 'missing');
      assert.equal(api.inspectAnswer({ type: 'choice', choice: 'a', probabilities: null }).kind, 'unavailable');
      assert.equal(api.inspectAnswer(null).issues[0].code, 'invalid-type');
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
      await assert.rejects(import('jev-patterns/dist/analysis.js'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    `,
      ],
      consumer,
    );
  });

  const readme = (
    await readFile(join(consumer, 'node_modules/jev-patterns/README.md'), 'utf8')
  ).replaceAll('\r\n', '\n');
  await t.test('relative README images are present in the installed archive', () => {
    assertReadmeImages(readme, paths);
  });
  const examples = extractReadmeExamples(readme);
  for (const [name, source] of examples) {
    // Keep assertions requiring Node types out of the declaration consumers.
    await writeFile(join(testRoot, `readme-${name}.ts`), source);
    await t.test(`standalone README ${name} executes against the installed package`, async () => {
      const runtime = `readme-${name}.runtime.ts`;
      await writeFile(
        join(consumer, runtime),
        ["import assert from 'node:assert/strict';", source, ...readmeAssertions[name]].join('\n'),
      );
      run(process.execPath, [runtime], consumer);
    });
  }

  // The declared support floor (docs/release-policy.md, README.md) is only
  // real if CI actually type-checks the shipped declarations with that
  // compiler, not just the one devDependency happens to install. Run every
  // combination against both the current `typescript` and the aliased
  // `typescript-floor` devDependency so a floor bump or a floor-incompatible
  // declaration change surfaces here instead of only being asserted in prose.
  const compilers = full
    ? [
        ['typescript', resolve(root, 'node_modules/typescript/bin/tsc')],
        ['typescript-floor', resolve(root, 'node_modules/typescript-floor/bin/tsc')],
      ]
    : [['typescript', resolve(root, 'node_modules/typescript/bin/tsc')]];
  for (const [compilerName, tscPath] of compilers) {
    for (const resolution of full ? ['NodeNext', 'Bundler'] : ['NodeNext']) {
      for (const checkedIndex of full ? [true, false] : [true]) {
        await t.test(
          `${resolution} declarations with noUncheckedIndexedAccess=${checkedIndex} under ${compilerName}`,
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
                include: ['test/*.test.ts', 'test/readme-*.ts'],
              }),
            );
            run(process.execPath, [tscPath, '--project', 'tsconfig.json'], consumer);
          },
        );
      }
    }
  }
});
