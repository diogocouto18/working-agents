import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveClientPath } from '../server/staticPath.js';

const ROOT = '/srv/app/client';

test('serves index.html for /', () => {
  assert.equal(resolveClientPath(ROOT, '/'), '/srv/app/client/index.html');
});

test('ignores the query string', () => {
  assert.equal(resolveClientPath(ROOT, '/app.js?v=1'), '/srv/app/client/app.js');
});

function assertConfined(url) {
  const out = resolveClientPath(ROOT, url);
  assert.ok(out === null || out.startsWith(ROOT + '/'), `${url} escaped to ${out}`);
}

test('never resolves outside the client root', () => {
  for (const url of [
    '/../server/index.js',
    '/../../../../etc/passwd',
    '/%2e%2e/package.json',
    '/..%2fpackage.json',
    '/%2e%2e%2f%2e%2e%2fetc/passwd',
    '/a/../../package.json',
  ]) assertConfined(url);
});

test('rejects an encoded slash used for traversal', () => {
  assert.equal(resolveClientPath(ROOT, '/..%2fpackage.json'), null);
});

test('rejects malformed encoding and NUL bytes', () => {
  assert.equal(resolveClientPath(ROOT, '/%E0%A4%A'), null);
  assert.equal(resolveClientPath(ROOT, '/a%00.js'), null);
});
