const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function getKeyBytes(key) {
  if (!key) {
    throw new Error('IPTV_XOR_KEY is required');
  }

  return utf8Encoder.encode(key);
}

export function xorBytes(input, key) {
  const keyBytes = getKeyBytes(key);
  const output = new Uint8Array(input.length);

  for (let index = 0; index < input.length; index += 1) {
    output[index] = input[index] ^ keyBytes[index % keyBytes.length];
  }

  return output;
}

export function encodeJsonPayload(payload, key) {
  const jsonBytes = utf8Encoder.encode(JSON.stringify(payload));
  return Buffer.from(xorBytes(jsonBytes, key)).toString('base64');
}

export function decodeJsonResponse(responseBytes, key) {
  const json = utf8Decoder.decode(xorBytes(responseBytes, key));
  return JSON.parse(json);
}