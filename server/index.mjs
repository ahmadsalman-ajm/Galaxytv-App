import { createServer } from 'node:http';
import { decodeJsonResponse, encodeJsonPayload } from './protocol.mjs';

const port = Number(process.env.PORT || 3030);
const upstreamUrl = process.env.IPTV_API_URL;
const xorKey = process.env.IPTV_XOR_KEY;
const requiredFields = ['mode', 'code', 'mac', 'sn', 'model', 'firmware_ver'];
const supportedModes = new Set(['active', 'sat2iptv', 'lite_packages', 'lite_channels', 'movies_cat', 'movies_list', 'movies_info', 'series_cat', 'series_list', 'series_info']);

function sendJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) {
      throw new Error('Request body is too large');
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function proxyRequest(request, response) {
  if (!upstreamUrl || !xorKey) {
    sendJson(response, 503, { error: 'Server API is not configured' });
    return;
  }

  let payload;
  try {
    payload = await readJson(request);
  } catch {
    sendJson(response, 400, { error: 'Expected a JSON request body' });
    return;
  }

  if (!payload || requiredFields.some((field) => typeof payload[field] !== 'string' || !payload[field]) ||
    typeof payload.chipid !== 'string') {
    sendJson(response, 400, { error: 'Missing activation fields' });
    return;
  }

  if (!supportedModes.has(payload.mode)) {
    sendJson(response, 400, { error: 'Unsupported IPTV mode' });
    return;
  }

  if (payload.mode === 'lite_channels' && !payload.pkg_id) {
    sendJson(response, 400, { error: 'Package ID is required for lite_channels' });
    return;
  }

  if (payload.mode === 'movies_list' && !payload.catid) {
    sendJson(response, 400, { error: 'Category ID is required for movies_list' });
    return;
  }

  if (payload.mode === 'movies_info' && !payload.movie_id) {
    sendJson(response, 400, { error: 'Movie ID is required for movies_info' });
    return;
  }

  if (payload.mode === 'series_list' && !payload.catid) {
    sendJson(response, 400, { error: 'Category ID is required for series_list' });
    return;
  }

  if (payload.mode === 'series_info' && !payload.series_id) {
    sendJson(response, 400, { error: 'Series ID is required for series_info' });
    return;
  }

  let target;
  try {
    target = new URL(upstreamUrl);
  } catch {
    sendJson(response, 503, { error: 'Server API URL is invalid' });
    return;
  }

  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    sendJson(response, 503, { error: 'Server API URL must use HTTP or HTTPS' });
    return;
  }

  try {
    const form = new FormData();
    form.append('json', encodeJsonPayload(payload, xorKey));

    const upstreamResponse = await fetch(target, {
      method: 'POST',
      headers: {
        'user-agent': `REV ${payload.model} ${payload.firmware_ver}`.replace(/[\r\n]/g, ''),
      },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstreamResponse.ok) {
      sendJson(response, 502, { error: 'IPTV server rejected the request' });
      return;
    }

    const encryptedReply = new Uint8Array(await upstreamResponse.arrayBuffer());
    sendJson(response, 200, decodeJsonResponse(encryptedReply, xorKey));
  } catch {
    sendJson(response, 502, { error: 'Server is down, please try again later.' });
  }
}

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'POST' && ['/api/activate', '/api/request'].includes(request.url)) {
    void proxyRequest(request, response);
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`GalaxyTV API proxy listening on port ${port}`);
});