import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { decideRelease, readPackageVersion } from '../../scripts/stage-release.mjs';

describe('readPackageVersion', () => {
  test('returns the version field', () => {
    assert.equal(readPackageVersion(JSON.stringify({ version: '1.2.3' })), '1.2.3');
  });

  test('rejects a missing version field', () => {
    assert.throws(() => readPackageVersion(JSON.stringify({})), TypeError);
  });

  test('rejects a non-string version field', () => {
    assert.throws(() => readPackageVersion(JSON.stringify({ version: 3 })), TypeError);
  });
});

describe('decideRelease', () => {
  test('skips an already-published version regardless of trigger or version diff', () => {
    assert.deepEqual(
      decideRelease({
        eventName: 'workflow_dispatch',
        headVersion: '0.3.0',
        parentVersion: '0.2.0',
        published: true,
      }),
      {
        action: 'skip',
        reason: 'jev-patterns@0.3.0 is already published on the registry',
      },
    );
  });

  test('stages a manual dispatch even when the version did not change', () => {
    assert.deepEqual(
      decideRelease({
        eventName: 'workflow_dispatch',
        headVersion: '0.3.0',
        parentVersion: '0.3.0',
        published: false,
      }),
      { action: 'stage', reason: 'manual workflow_dispatch run' },
    );
  });

  test('stages a push whose commit bumped package.json version', () => {
    assert.deepEqual(
      decideRelease({
        eventName: 'push',
        headVersion: '0.3.0',
        parentVersion: '0.2.0',
        published: false,
      }),
      { action: 'stage', reason: 'package.json version changed (0.2.0 -> 0.3.0)' },
    );
  });

  test('stages a push with no parent version (first commit) as a version change', () => {
    assert.deepEqual(
      decideRelease({
        eventName: 'push',
        headVersion: '0.3.0',
        parentVersion: null,
        published: false,
      }),
      { action: 'stage', reason: 'package.json version changed ((no parent) -> 0.3.0)' },
    );
  });

  test('skips an ordinary push that neither dispatched nor bumped the version', () => {
    assert.deepEqual(
      decideRelease({
        eventName: 'push',
        headVersion: '0.3.0',
        parentVersion: '0.3.0',
        published: false,
      }),
      {
        action: 'skip',
        reason: 'package.json version unchanged (0.3.0) and not a manual dispatch',
      },
    );
  });
});
