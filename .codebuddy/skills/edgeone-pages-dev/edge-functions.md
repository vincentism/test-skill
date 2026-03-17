# Edge Functions

V8-based lightweight functions running at the edge. Ideal for simple APIs, KV storage access, and ultra-low latency responses.

> **Runtime:** V8 (like Cloudflare Workers) — NOT Node.js. Do NOT use Node.js built-ins or npm packages.

## Basic function

File: `edge-functions/api/hello.js`

```javascript
export default function onRequest(context) {
  return new Response('Hello from Edge Functions!');
}
```

Access: `GET /api/hello`

## HTTP method handlers

```javascript
// edge-functions/api/users.js

// Handle all methods
export function onRequest(context) {
  return new Response('Any method');
}

// Or use specific method handlers:
export function onRequestGet(context) {
  return Response.json({ users: [] });
}

export function onRequestPost(context) {
  const body = await context.request.json();
  return Response.json({ created: true }, { status: 201 });
}
```

## EventContext object

```javascript
export function onRequest(context) {
  const {
    request,    // Standard Request object
    params,     // Dynamic route params, e.g. { id: "123" }
    env,        // Environment variables from Pages console
    waitUntil,  // Extend function lifetime for async tasks
  } = context;

  // GEO info available via:
  const geo = context.request.eo;
  // geo.geo.countryName, geo.geo.cityName, geo.geo.latitude, etc.

  return new Response('OK');
}
```

## Dynamic routes

```javascript
// edge-functions/api/users/[id].js
// Matches: /api/users/123, /api/users/abc

export function onRequestGet(context) {
  const userId = context.params.id;
  return Response.json({ userId });
}
```

```javascript
// edge-functions/api/[[default]].js
// Catches all unmatched routes under /api/

export function onRequest(context) {
  return new Response('Catch-all route', { status: 404 });
}
```

## KV Storage (Edge Functions only)

```javascript
// edge-functions/api/counter.js

export async function onRequest(context) {
  // Get KV namespace (must link project first via `edgeone pages link`)
  const KV = context.env.KV;

  // Read
  const count = await KV.get('page_views') || '0';
  const newCount = parseInt(count) + 1;

  // Write
  await KV.put('page_views', String(newCount));

  return Response.json({ views: newCount });
}
```

## Supported Runtime APIs

Edge Functions run on V8 and support these Web Standard APIs:
- **Fetch API** — `fetch()` for outbound HTTP requests
- **Cache API** — `caches.open()`, `cache.match()`, `cache.put()`
- **Headers / Request / Response** — standard Web API objects
- **Streams** — `ReadableStream`, `WritableStream`, `TransformStream`
- **Web Crypto** — `crypto.subtle` for encryption/signing
- **Encoding** — `TextEncoder`, `TextDecoder`
- **URL / URLSearchParams** — URL parsing

⚠️ **NOT available**: Node.js built-ins (`fs`, `path`, `http`, `crypto` from Node), `require()`, npm packages.

## Limits

| Resource | Limit |
|----------|-------|
| Code package size | 5 MB |
| Request body | 1 MB |
| CPU time per invocation | 200 ms |
| Language | JavaScript (ES2023+) only |
