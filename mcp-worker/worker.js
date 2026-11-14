// mcp-worker/worker.js — 3C SOURCE Notes connector (Stage 1: connection test, ping only)
//
// A small remote MCP server (Streamable HTTP, JSON-RPC 2.0) so that Claude on claude.ai
// can be added as a custom connector.
//
// STAGE 1 ONLY PROVES THE CONNECTION. It has one tool, "ping".
// It has no storage bindings: no R2, no D1, no Notes Worker, no GitHub login, no PIN.
// It cannot read or write anything.
//
// ACCESS
//   The private key is part of the address:  https://<worker-address>/mcp/<CONNECTOR_KEY>
//   CONNECTOR_KEY is a Worker secret (set with Wrangler, never in the repo).
//   Wrong or missing key -> plain 404, so the address gives nothing away.
//   Claude's "Add custom connector" dialog has no header field on this plan, so the key
//   sits in the path. To change the key: set a new secret, then remove and re-add the connector.
//
// SUPPORTED MCP METHODS
//   initialize, notifications/*, ping, tools/list, tools/call (tool: ping)
//   POST only. GET / DELETE -> 405 (this server never opens a stream).

const SERVER_NAME = '3c-source-notes-connector';
const SERVER_VERSION = '0.1.0-stage1';

// Newest first. Claude asks for one of these; an unknown version gets the newest we speak.
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const MIN_KEY_LENGTH = 32;           // a shorter secret is refused as "not configured"
const MAX_REQUEST_BYTES = 1024 * 1024; // Stage 1 messages are tiny; save_file will raise this later

const TOOLS = [
  {
    name: 'ping',
    title: 'Ping',
    description:
      'Connection test for the 3C SOURCE Notes connector. Takes no input and returns a short ' +
      'confirmation message. Reads and writes nothing.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      // Never echo internals or the key. Log only the error name.
      console.error('connector error:', err && err.name);
      return rpcHttp(rpcError(null, -32603, 'Internal error'), 500);
    }
  },
};

async function handle(request, env) {
  const key = env.CONNECTOR_KEY;
  if (typeof key !== 'string' || key.length < MIN_KEY_LENGTH) {
    return plain('Connector is not configured', 500);
  }

  // Address check: /mcp/<key>  (one trailing slash tolerated)
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  const parts = path.split('/'); // ['', 'mcp', '<key>']
  const given = parts.length === 3 && parts[1] === 'mcp' ? parts[2] : '';
  if (!safeEqual(given, key)) return plain('Not found', 404);

  if (request.method !== 'POST') return plain('Method not allowed', 405, { Allow: 'POST' });

  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_REQUEST_BYTES) return plain('Request too large', 413);
  const raw = await request.text();
  if (raw.length > MAX_REQUEST_BYTES) return plain('Request too large', 413);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return rpcHttp(rpcError(null, -32700, 'Parse error'), 400);
  }

  // A batch is an array of messages; a single message is an object.
  if (Array.isArray(body)) {
    if (body.length === 0) return rpcHttp(rpcError(null, -32600, 'Invalid request'), 400);
    const replies = body.map(processMessage).filter((r) => r !== null);
    return replies.length ? rpcHttp(replies, 200) : accepted();
  }

  const reply = processMessage(body);
  return reply === null ? accepted() : rpcHttp(reply, 200);
}

// Returns a JSON-RPC response object, or null when no response is due (notifications).
function processMessage(msg) {
  if (msg === null || typeof msg !== 'object' || Array.isArray(msg)) {
    return rpcError(null, -32600, 'Invalid request');
  }
  const hasId = Object.prototype.hasOwnProperty.call(msg, 'id');
  const id = hasId ? msg.id : null;

  // A response from the client to us (we never send requests): nothing to do.
  if (typeof msg.method !== 'string') {
    return hasId && ('result' in msg || 'error' in msg) ? null : rpcError(id, -32600, 'Invalid request');
  }
  if (msg.jsonrpc !== '2.0') return rpcError(id, -32600, 'Invalid request');

  const isNotification = !hasId;
  const params = msg.params && typeof msg.params === 'object' ? msg.params : {};

  // Notifications never get a reply, whatever they are.
  if (isNotification) return null;

  switch (msg.method) {
    case 'initialize': {
      const asked = params.protocolVersion;
      const version = PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0];
      return rpcResult(id, {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions:
          'Stage 1 test connector for 3C SOURCE Notes. The only tool is "ping". ' +
          'It reads and writes nothing.',
      });
    }

    case 'ping':
      return rpcResult(id, {});

    case 'tools/list':
      return rpcResult(id, { tools: TOOLS });

    case 'tools/call': {
      if (params.name === 'ping') {
        return rpcResult(id, {
          content: [
            {
              type: 'text',
              text:
                'pong. Claude is connected to the 3C SOURCE Notes connector (Stage 1 test build). ' +
                'Server time: ' + new Date().toISOString() + '. No files were read or written.',
            },
          ],
          isError: false,
        });
      }
      return rpcError(id, -32602, 'Unknown tool');
    }

    default:
      return rpcError(id, -32601, 'Method not found');
  }
}

// ---------- helpers ----------

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function rpcHttp(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function accepted() {
  return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}

function plain(text, status, extra) {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...(extra || {}) },
  });
}

// Constant-time string compare (no early exit on the first wrong character).
function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
