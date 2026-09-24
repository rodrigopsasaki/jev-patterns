import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Read the "version" field out of a package.json source string. Thrown errors
 * surface as hard failures — a package.json without a usable version is a
 * defect, not something to route around.
 */
export function readPackageVersion(source) {
  const parsed = JSON.parse(source);
  if (typeof parsed.version !== 'string' || parsed.version.length === 0) {
    throw new TypeError('package.json is missing a string "version" field');
  }
  return parsed.version;
}

/**
 * Decide whether the current run should stage a publish, and why. Pure: every
 * input the workflow can observe is a parameter, so the branches are testable
 * without touching npm or git.
 *
 * - `published` wins outright: a version already on the registry is never
 *   restaged (staged and published share one semver index).
 * - Otherwise stage only on a manual dispatch, or when `headVersion` differs
 *   from `parentVersion` (the version-packages commit bumped package.json).
 *   An ordinary push that neither dispatches nor bumps the version skips, so
 *   unrelated merges to `main` stay green instead of restaging nothing.
 */
export function decideRelease({ eventName, headVersion, parentVersion, published }) {
  if (published) {
    return {
      action: 'skip',
      reason: `jev-patterns@${headVersion} is already published on the registry`,
    };
  }
  if (eventName === 'workflow_dispatch') {
    return { action: 'stage', reason: 'manual workflow_dispatch run' };
  }
  if (headVersion !== parentVersion) {
    return {
      action: 'stage',
      reason: `package.json version changed (${parentVersion ?? '(no parent)'} -> ${headVersion})`,
    };
  }
  return {
    action: 'skip',
    reason: `package.json version unchanged (${headVersion}) and not a manual dispatch`,
  };
}

/** The package.json version HEAD^ shipped, or null when there is no parent commit. */
function readParentVersion(root) {
  let source;
  try {
    source = execFileSync('git', ['show', 'HEAD^:package.json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
  return readPackageVersion(source);
}

/**
 * Whether `name@version` already exists on the registry. `npm view` needs no
 * auth for a public package. An E404 means "not published"; any other
 * failure (network, registry outage, malformed spec) is a hard failure —
 * this function never guesses "not published" from an error it doesn't
 * recognize.
 */
function isPublished(spec) {
  const result = spawnSync('npm', ['view', spec, 'version', '--json'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status === 0) return true;
  let body;
  try {
    body = JSON.parse(result.stdout);
  } catch {
    body = null;
  }
  if (body?.error?.code === 'E404') return false;
  throw new Error(
    `npm view ${spec} failed unexpectedly (exit ${result.status}): ${result.stderr || result.stdout}`,
  );
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const pkgSource = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  const pkg = JSON.parse(pkgSource);
  const headVersion = readPackageVersion(pkgSource);
  const parentVersion = readParentVersion(root);
  const published = isPublished(`${pkg.name}@${headVersion}`);

  const decision = decideRelease({
    eventName: process.env.GITHUB_EVENT_NAME,
    headVersion,
    parentVersion,
    published,
  });

  if (decision.action === 'skip') {
    console.log(`Skipping stage publish: ${decision.reason}`);
    return;
  }

  console.log(`Staging ${pkg.name}@${headVersion}: ${decision.reason}`);
  // Staging never prompts for 2FA and never publishes on its own; a
  // maintainer approves with `npm stage approve <stage-id>` or the Staged
  // Packages tab on npmjs.com. Deliberately no "New tag:" line here — that
  // string is what changesets/action scans to create a GitHub release, and
  // a release before human approval would announce a version that isn't
  // actually installable yet.
  const result = spawnSync('npm', ['stage', 'publish', '--access', 'public', '--provenance'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
