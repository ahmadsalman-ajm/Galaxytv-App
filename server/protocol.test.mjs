import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeJsonResponse, encodeJsonPayload, xorBytes } from './protocol.mjs';

test('XOR is symmetric for UTF-8 JSON bytes', () => {
  const key = 'local-test-key';
  const payload = { mode: 'active', label: 'قناة الأخبار' };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = xorBytes(bytes, key);

  assert.notDeepEqual(encrypted, bytes);
  assert.deepEqual(decodeJsonResponse(encrypted, key), payload);
});

test('request payload is XOR encrypted and Base64 encoded', () => {
  const key = 'local-test-key';
  const payload = { mode: 'active', code: 'test-code' };
  const decodedBytes = Buffer.from(encodeJsonPayload(payload, key), 'base64');

  assert.deepEqual(decodeJsonResponse(decodedBytes, key), payload);
});

test('XOR response decoding supports package and channel arrays', () => {
  const key = 'local-test-key';
  const response = [
    { id: '169', pkg_name: 'SPORT WORLD' },
    { channel_name: 'beIN Sports 1 HD', stream_url: 'https://example.invalid/live/1' },
  ];
  const encrypted = xorBytes(new TextEncoder().encode(JSON.stringify(response)), key);

  assert.deepEqual(decodeJsonResponse(encrypted, key), response);
});

test('XOR requires a configured key', () => {
  assert.throws(() => xorBytes(new Uint8Array([1]), ''), /IPTV_XOR_KEY/);
});