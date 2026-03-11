require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const FRONTEND_HTML = path.join(__dirname, 'public', 'index.html');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PORT = process.env.PORT || 3000;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res, data, status = 200) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

async function proxyToEdgeFunction(functionName, path, method, body) {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}${path}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
  };
  if (body && method !== 'GET') {
    options.body = body;
  }
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: response.status, data };
}

// ── Route Table ──────────────────────────────────────────────────────────────

const routes = [
  // Subjects
  { method: 'GET',    pattern: /^\/api\/subjects$/,          fn: 'subjects', path: '' },
  { method: 'GET',    pattern: /^\/api\/subjects\/(.+)$/,    fn: 'subjects', path: null },
  { method: 'POST',   pattern: /^\/api\/subjects$/,          fn: 'subjects', path: '' },
  { method: 'PUT',    pattern: /^\/api\/subjects\/(.+)$/,    fn: 'subjects', path: null },
  { method: 'DELETE', pattern: /^\/api\/subjects\/(.+)$/,    fn: 'subjects', path: null },

  // Sessions
  { method: 'POST',   pattern: /^\/api\/sessions\/start$/,   fn: 'sessions', path: '/start' },
  { method: 'POST',   pattern: /^\/api\/sessions\/stop$/,    fn: 'sessions', path: '/stop' },
  { method: 'GET',    pattern: /^\/api\/sessions\/active$/,  fn: 'sessions', path: '/active' },
  { method: 'GET',    pattern: /^\/api\/sessions$/,          fn: 'sessions', path: '' },
  { method: 'DELETE', pattern: /^\/api\/sessions\/(.+)$/,    fn: 'sessions', path: null },

  // Stats
  { method: 'GET',    pattern: /^\/api\/stats\/leaderboard$/,fn: 'stats',    path: '/leaderboard' },
  { method: 'GET',    pattern: /^\/api\/stats(\/overview)?$/, fn: 'stats',   path: '/overview' },

  // Goals
  { method: 'GET',    pattern: /^\/api\/goals$/,             fn: 'goals',   path: '' },
  { method: 'POST',   pattern: /^\/api\/goals$/,             fn: 'goals',   path: '' },
  { method: 'PUT',    pattern: /^\/api\/goals\/(.+)$/,       fn: 'goals',   path: null },
  { method: 'DELETE', pattern: /^\/api\/goals\/(.+)$/,       fn: 'goals',   path: null },
];

function matchRoute(method, url) {
  const [pathname, query] = url.split('?');
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = pathname.match(route.pattern);
    if (match) {
      let edgePath = route.path;
      if (edgePath === null) {
        edgePath = '/' + match[1];
      }
      return { fn: route.fn, path: edgePath, query: query || '' };
    }
  }
  return null;
}

// ── Request Metrics ──────────────────────────────────────────────────────────

const metrics = {
  total_requests: 0,
  by_endpoint: {},
  errors: 0,
  started_at: new Date().toISOString(),
};

function trackRequest(method, url, status) {
  metrics.total_requests++;
  const key = `${method} ${url.split('?')[0]}`;
  metrics.by_endpoint[key] = (metrics.by_endpoint[key] || 0) + 1;
  if (status >= 400) metrics.errors++;
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const start = Date.now();

  // CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    json(res, {
      status: 'ok',
      service: 'assiduous-api-gateway',
      version: '2.0.0',
      uptime: process.uptime(),
      supabase_url: SUPABASE_URL.replace(/https?:\/\//, '').split('.')[0] + '.supabase.co',
    });
    return;
  }

  // Metrics endpoint
  if (req.url === '/api/metrics' && req.method === 'GET') {
    json(res, {
      ...metrics,
      uptime_seconds: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 10) / 10,
    });
    return;
  }

  // Root: serve HTML for browsers, JSON for API clients
  if (req.url === '/' && req.method === 'GET') {
    const accept = req.headers['accept'] || '';
    if (accept.includes('text/html')) {
      try {
        const html = fs.readFileSync(FRONTEND_HTML, 'utf8');
        cors(res);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch {
        json(res, { error: 'Frontend not found' }, 404);
      }
      return;
    }
    json(res, {
      name: 'Assiduous Study Tracker',
      version: '2.0.0',
      description: 'Cloud-native study session tracker with serverless edge functions',
      endpoints: {
        'GET  /':                         'Dashboard (browser) or this JSON (API)',
        'GET  /health':                   'Health check',
        'GET  /api/metrics':              'Request metrics',
        'GET  /api/subjects':             'List subjects',
        'POST /api/sessions/start':       '{ subject_id, notes? }',
        'POST /api/sessions/stop':        'Stop active session',
        'GET  /api/sessions/active':      'Current active session',
        'GET  /api/sessions':             'List sessions ?subject_id=&limit=',
        'GET  /api/stats':                'Dashboard stats',
        'GET  /api/stats/leaderboard':    'Subject leaderboard',
        'GET  /api/goals':                'List weekly goals',
        'POST /api/goals':                '{ subject_id, target_minutes_per_week }',
        'PUT  /api/goals/:id':            '{ target_minutes_per_week }',
        'DELETE /api/goals/:id':          'Delete a goal',
      },
    });
    return;
  }

  // Route matching -> proxy to edge function
  const route = matchRoute(req.method, req.url);
  if (!route) {
    trackRequest(req.method, req.url, 404);
    json(res, { error: 'Not Found', hint: 'GET / for API docs' }, 404);
    return;
  }

  try {
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method)
      ? await readBody(req)
      : null;

    const edgePath = route.query
      ? `${route.path}?${route.query}`
      : route.path;

    const result = await proxyToEdgeFunction(route.fn, edgePath, req.method, body);
    const elapsed = Date.now() - start;

    trackRequest(req.method, req.url, result.status);
    console.log(`${req.method} ${req.url} -> ${route.fn}${route.path} [${result.status}] ${elapsed}ms`);

    json(res, result.data, result.status);
  } catch (error) {
    const elapsed = Date.now() - start;
    trackRequest(req.method, req.url, 502);
    console.error(`${req.method} ${req.url} -> ${route.fn} [ERROR] ${elapsed}ms:`, error.message);
    json(res, {
      error: 'Edge function unavailable',
      detail: error.message,
    }, 502);
  }
});

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   Assiduous Study Tracker - API Gateway      ║
  ║   Port: ${String(PORT).padEnd(36)}║
  ║   Supabase: connected                        ║
  ║   GET / for API docs                         ║
  ╚══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);



