import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedHosts, isRequestAllowed } from '../server/originGuard.js';

const allowed = allowedHosts('127.0.0.1', 4242);

test('accepts loopback hosts with no Origin (hook, curl)', () => {
  assert.ok(isRequestAllowed({ host: 'localhost:4242' }, allowed));
  assert.ok(isRequestAllowed({ host: '127.0.0.1:4242' }, allowed));
});

test('accepts the dashboard own Origin', () => {
  assert.ok(isRequestAllowed({ host: 'localhost:4242', origin: 'http://localhost:4242' }, allowed));
});

test('rejects a foreign web page Origin', () => {
  assert.equal(isRequestAllowed({ host: 'localhost:4242', origin: 'https://evil.example' }, allowed), false);
  assert.equal(isRequestAllowed({ host: 'localhost:4242', origin: 'http://localhost:9999' }, allowed), false);
  assert.equal(isRequestAllowed({ host: 'localhost:4242', origin: 'null' }, allowed), false);
});

test('rejects DNS-rebinding Host headers', () => {
  assert.equal(isRequestAllowed({ host: 'attacker.example:4242' }, allowed), false);
  assert.equal(isRequestAllowed({}, allowed), false);
});

test('a custom bind host is allowed, wildcard binds add nothing', () => {
  assert.ok(allowedHosts('192.168.1.5', 4242).has('192.168.1.5:4242'));
  assert.equal(allowedHosts('0.0.0.0', 4242).has('0.0.0.0:4242'), false);
});
