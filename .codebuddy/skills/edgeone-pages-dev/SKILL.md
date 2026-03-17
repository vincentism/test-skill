---
name: edgeone-pages-dev
description: Guide development on EdgeOne Pages — Edge Functions, Node Functions, Middleware, and local dev workflows. Use when the user wants to create APIs, serverless functions, middleware, WebSocket endpoints, or full-stack features on EdgeOne Pages — e.g. "create an API", "add a serverless function", "write middleware", "build a full-stack app", "add WebSocket support", or "set up edge functions".
metadata:
  author: edgeone
  version: "1.0.0"
---

# EdgeOne Pages Development Guide

Develop full-stack applications on **EdgeOne Pages** — Edge Functions, Node Functions, and Middleware.

## ⛔ Critical Rules (MUST follow)

1. **Choose the right runtime for the task.** Follow the Decision Tree below — never guess.
2. **Edge Functions run on V8, NOT Node.js.** Do NOT use Node.js built-in modules (`fs`, `path`, `crypto` from Node) or npm packages in Edge Functions.
3. **Node Functions MUST return a standard Web `Response` object**, not `res.send()` — unless using Express/Koa via the `[[default]].js` pattern.
4. **Middleware is for lightweight request interception ONLY.** Never put heavy computation or database calls in middleware.
5. **Always use `edgeone pages dev` for local development.** Do NOT run a separate dev server for functions — the CLI handles everything on port 8088.
6. **Never configure `edgeone pages dev` as the `devCommand` in `edgeone.json` or as the `dev` script in `package.json`** — this causes infinite recursion.
7. **For framework projects (Next.js, Nuxt, etc.), use the framework's own middleware — NOT the platform `middleware.js`.** For example, in Next.js projects use `middleware.ts` at the project root with Next.js middleware API (`NextRequest`, `NextResponse`), NOT the EdgeOne Pages `middleware.js` format. The platform middleware file is only for non-framework or pure static projects.

---

## Technology Decision Tree

Use this to pick the correct approach for each user request:

```
User needs request interception / redirect / rewrite / auth guard / A/B test?
  → Middleware

User needs a lightweight API with ultra-low latency (simple logic, no npm)?
  → Edge Functions

User needs KV persistent storage?
  → Edge Functions + KV Storage (KV is only available in Edge Functions)

User needs complex backend logic / npm packages / database / WebSocket?
  → Node Functions

User needs Express or Koa framework?
  → Node Functions with [[default]].js entry

User has a pure static site with no server-side logic?
  → No functions needed — just deploy static files
```

### Runtime Comparison

| Feature | Edge Functions | Node Functions | Middleware |
|---------|--------------|----------------|------------|
| **Runtime** | V8 (like Cloudflare Workers) | Node.js v20.x | V8 (edge) |
| **npm packages** | ❌ Not supported | ✅ Full npm ecosystem | ❌ Not supported |
| **Max code size** | 5 MB | 128 MB | Part of edge bundle |
| **Max request body** | 1 MB | 6 MB | N/A (passes through) |
| **Max CPU / wall time** | 200 ms CPU | 120 s wall clock | Lightweight only |
| **KV Storage** | ✅ Yes | ❌ No | ❌ No |
| **WebSocket** | ❌ No | ✅ Yes | ❌ No |
| **Use case** | Lightweight APIs, edge compute | Complex APIs, full-stack | Request preprocessing |

---

## Project Setup

### 1. Initialize the project

```bash
edgeone pages init
```

The CLI will guide you to create `edge-functions/` and/or `node-functions/` directories with sample functions.

### 2. Standard project structure

```
my-project/
├── edge-functions/          # Edge Functions (V8 runtime)
│   └── api/
│       ├── hello.js         # → /api/hello
│       ├── users/
│       │   ├── list.js      # → /api/users/list
│       │   ├── [id].js      # → /api/users/:id (dynamic)
│       │   └── index.js     # → /api/users
│       └── [[default]].js   # → /api/* (catch-all)
├── node-functions/          # Node Functions (Node.js runtime)
│   └── api/
│       ├── data.js          # → /api/data
│       ├── ws.js            # → /api/ws (WebSocket)
│       └── [[default]].js   # → /api/* (Express/Koa entry)
├── middleware.js             # Middleware (runs before all requests)
├── edgeone.json              # Project config (auto-generated)
├── package.json
├── index.html                # Static frontend
└── ...
```

### 3. Local development

```bash
edgeone pages dev
```

- Serves everything on `http://localhost:8088/` — frontend and functions unified, no proxy needed.
- Hot reload is supported; avoid restarting the CLI frequently (Edge Functions has startup count limits).
- Use `console.log()` in functions for debugging — logs appear in the terminal.

### 4. Link project (for KV & env vars)

```bash
edgeone pages link
```

Required if you need KV Storage access or want to sync environment variables from the console.

### 5. Environment variables

```bash
edgeone pages env ls            # List all
edgeone pages env pull          # Pull to local .env
edgeone pages env pull -f .env.prod  # Pull to specific file
edgeone pages env add KEY value # Add
edgeone pages env rm KEY        # Remove
```

Access in functions via `context.env.KEY`.

---

## Edge Functions

### Basic function

File: `edge-functions/api/hello.js`

```javascript
export default function onRequest(context) {
  return new Response('Hello from Edge Functions!');
}
```

Access: `GET /api/hello`

### HTTP method handlers

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

### EventContext object

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

### Dynamic routes

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

### KV Storage (Edge Functions only)

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

### Supported Runtime APIs

Edge Functions run on V8 and support these Web Standard APIs:
- **Fetch API** — `fetch()` for outbound HTTP requests
- **Cache API** — `caches.open()`, `cache.match()`, `cache.put()`
- **Headers / Request / Response** — standard Web API objects
- **Streams** — `ReadableStream`, `WritableStream`, `TransformStream`
- **Web Crypto** — `crypto.subtle` for encryption/signing
- **Encoding** — `TextEncoder`, `TextDecoder`
- **URL / URLSearchParams** — URL parsing

⚠️ **NOT available**: Node.js built-ins (`fs`, `path`, `http`, `crypto` from Node), `require()`, npm packages.

### Edge Functions Limits

| Resource | Limit |
|----------|-------|
| Code package size | 5 MB |
| Request body | 1 MB |
| CPU time per invocation | 200 ms |
| Language | JavaScript (ES2023+) only |

---

## Node Functions

### Basic function

File: `node-functions/api/data.js`

```javascript
export function onRequestGet(context) {
  return Response.json({
    message: 'Hello from Node Functions!',
    region: context.server.region,
  });
}

export async function onRequestPost(context) {
  const body = await context.request.json();
  // Process body...
  return Response.json({ received: body }, { status: 201 });
}
```

### EventContext object

```javascript
export function onRequest(context) {
  const {
    uuid,       // Unique request ID
    request,    // Standard Request object
    params,     // Dynamic route params
    env,        // Environment variables
    clientIp,   // Client IP address
    server,     // { region: string, requestId: string }
    geo,        // Client geolocation info
  } = context;

  return new Response('OK');
}
```

### Using npm packages

```javascript
// node-functions/api/data.js
import mysql from 'mysql2/promise';

export async function onRequestGet(context) {
  const connection = await mysql.createConnection({
    host: context.env.DB_HOST,
    user: context.env.DB_USER,
    password: context.env.DB_PASSWORD,
    database: context.env.DB_NAME,
  });

  const [rows] = await connection.execute('SELECT * FROM users LIMIT 10');
  await connection.end();

  return Response.json({ users: rows });
}
```

⚠️ Install dependencies in project root `package.json` — the platform builds them automatically.

### Express integration

File: `node-functions/api/[[default]].js`

```javascript
import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

app.post('/api/users', (req, res) => {
  res.status(201).json({ user: req.body });
});

app.get('/api/users/:id', (req, res) => {
  res.json({ userId: req.params.id });
});

// MUST export the app — do NOT call app.listen()
export default app;
```

**Key rules for Express/Koa:**
- Entry file MUST use `[[...]]` naming pattern (e.g. `[[default]].js`)
- MUST `export default app` — do NOT call `app.listen()`
- All routes should include the full path prefix matching the file location

### Koa integration

File: `node-functions/api/[[default]].js`

```javascript
import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';

const app = new Koa();
const router = new Router();

app.use(bodyParser());

router.get('/api/hello', (ctx) => {
  ctx.body = { message: 'Hello from Koa!' };
});

router.post('/api/data', (ctx) => {
  ctx.body = { received: ctx.request.body };
});

app.use(router.routes());
app.use(router.allowedMethods());

// MUST export — do NOT call app.listen()
export default app;
```

### WebSocket

File: `node-functions/api/ws.js`

```javascript
export function onRequestGet(context) {
  const { request } = context;

  // Check for WebSocket upgrade
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  // Create WebSocket pair
  const { socket, response } = new WebSocketPair();

  socket.addEventListener('message', (event) => {
    // Echo back
    socket.send(`Echo: ${event.data}`);
  });

  socket.addEventListener('close', () => {
    console.log('WebSocket closed');
  });

  return response;
}
```

### Node Functions Limits

| Resource | Limit |
|----------|-------|
| Code package size | 128 MB |
| Request body | 6 MB |
| Wall clock time | 120 seconds |
| Language | Node.js only |

⚠️ Do NOT store persistent files locally — use external storage (e.g. Tencent Cloud COS) for persistent data.

---

## Middleware

> ⚠️ **Framework projects (Next.js, Nuxt, etc.)**: Do NOT use this platform middleware format. Use the framework's built-in middleware instead (e.g. Next.js `middleware.ts` with `NextRequest`/`NextResponse`). The patterns below are for non-framework or pure static projects only.

### Basic middleware

File: `middleware.js` (project root)

```javascript
export function middleware(context) {
  const { request, next, redirect, rewrite } = context;

  // Pass through — no modification
  return next();
}
```

### Context API

| Property | Type | Description |
|----------|------|-------------|
| `request` | `Request` | Current request object |
| `next(options?)` | `Function` | Continue to origin; optionally modify headers |
| `redirect(url, status?)` | `Function` | Redirect (default 307) |
| `rewrite(url)` | `Function` | Rewrite request path (transparent to client) |
| `geo` | `GeoProperties` | Client geolocation |
| `clientIp` | `string` | Client IP address |

### Route matching

By default middleware runs on ALL routes. Use `config.matcher` to limit scope:

```javascript
// Only run on /api/* routes
export const config = {
  matcher: ['/api/:path*'],
};

export function middleware(context) {
  // Auth check for API routes only
  const token = context.request.headers.get('Authorization');
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  return context.next();
}
```

**Matcher patterns:**

```javascript
// Single path
export const config = { matcher: '/about' };

// Multiple paths
export const config = { matcher: ['/api/:path*', '/admin/:path*'] };

// Regex
export const config = { matcher: ['/api/.*', '^/user/\\d+$'] };
```

### Common patterns

#### URL Redirect

```javascript
export function middleware(context) {
  const url = new URL(context.request.url);

  if (url.pathname === '/old-page') {
    return context.redirect('/new-page', 301);
  }
  return context.next();
}
```

#### URL Rewrite (transparent proxy)

```javascript
export function middleware(context) {
  const url = new URL(context.request.url);

  if (url.pathname.startsWith('/blog')) {
    return context.rewrite('/content' + url.pathname);
  }
  return context.next();
}
```

#### Add request headers

```javascript
export function middleware(context) {
  return context.next({
    headers: {
      'x-request-id': crypto.randomUUID(),
      'x-client-ip': context.clientIp,
      'x-country': context.geo.countryCodeAlpha2,
    },
  });
}
```

#### Auth guard

```javascript
export const config = {
  matcher: ['/api/:path*', '/admin/:path*'],
};

export function middleware(context) {
  const token = context.request.headers.get('Authorization');
  if (!token || !token.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return context.next();
}
```

#### Geo-based routing

```javascript
export function middleware(context) {
  const country = context.geo.countryCodeAlpha2;

  if (country === 'CN') {
    return context.rewrite('/zh' + new URL(context.request.url).pathname);
  }
  return context.next();
}
```

#### A/B Testing

```javascript
export function middleware(context) {
  const url = new URL(context.request.url);

  if (url.pathname === '/landing') {
    const variant = Math.random() < 0.5 ? '/landing-a' : '/landing-b';
    return context.rewrite(variant);
  }
  return context.next();
}
```

#### Direct JSON response

```javascript
export function middleware(context) {
  const url = new URL(context.request.url);

  if (url.pathname === '/api/health') {
    return Response.json({ status: 'ok', timestamp: Date.now() });
  }
  return context.next();
}
```

### GeoProperties

Available on `context.geo`:

| Property | Type | Example |
|----------|------|---------|
| `countryName` | string | Singapore |
| `countryCodeAlpha2` | string | SG |
| `countryCodeAlpha3` | string | SGP |
| `regionName` | string | — |
| `cityName` | string | Singapore |
| `latitude` | number | 1.29027 |
| `longitude` | number | 103.851959 |
| `asn` | number | 132203 |

---

## Common Recipes

### Full-stack app (static + API)

```
my-app/
├── index.html              # Frontend
├── style.css
├── script.js
├── node-functions/
│   └── api/
│       ├── users.js        # GET/POST /api/users
│       └── users/[id].js   # GET/PUT/DELETE /api/users/:id
└── package.json
```

Frontend calls API:
```javascript
const res = await fetch('/api/users');
const users = await res.json();
```

### Edge API + KV counter

```
my-app/
├── index.html
├── edge-functions/
│   └── api/
│       └── visit.js        # Edge function with KV
└── package.json
```

### Express full-stack

```
my-app/
├── index.html
├── node-functions/
│   └── api/
│       └── [[default]].js  # Express app handles all /api/*
└── package.json
```

### Middleware + API combo

```
my-app/
├── middleware.js            # Auth guard for /api/*
├── node-functions/
│   └── api/
│       ├── public.js       # No auth needed (matcher excludes it)
│       └── data.js         # Protected by middleware
└── package.json
```

---

## Debugging & Troubleshooting

| Issue | Solution |
|-------|----------|
| Function not found / 404 | Check file location matches expected route path |
| `require is not defined` in Edge Functions | Edge Functions use ES modules — use `import` instead |
| npm package fails in Edge Functions | Edge Functions don't support npm — move to Node Functions |
| Express `app.listen()` error | Remove `app.listen()` — export the app directly |
| KV returns `undefined` | Run `edgeone pages link` first to connect your project |
| Env vars not available | Run `edgeone pages env pull` and restart dev server |
| Hot reload not working | Check you're using `edgeone pages dev`, not a custom dev server |
| Edge Function exceeds CPU limit | Move heavy computation to Node Functions (120s limit vs 200ms) |
| WebSocket not connecting | Ensure you're using Node Functions, not Edge Functions |
| Middleware runs on static assets | Add `config.matcher` to limit middleware to specific paths |
