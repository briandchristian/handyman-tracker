#!/usr/bin/env node
/**
 * Smoke-test a Vercel (or any) deployment: GET /api/health and POST /api/login.
 * Use to confirm the API is reachable (not 405/HTML) and login accepts JSON.
 *
 * Usage:
 *   BASE_URL=https://your-preview.vercel.app node scripts/test-vercel-deployment.js
 *   node scripts/test-vercel-deployment.js https://your-preview.vercel.app
 *
 * Exit: 0 if health is OK and login is not 405; 1 otherwise.
 */

const baseUrl = process.env.BASE_URL || process.argv[2]?.replace(/\/$/, '') || '';

if (!baseUrl) {
  console.error('Usage: BASE_URL=<url> node scripts/test-vercel-deployment.js');
  console.error('   or: node scripts/test-vercel-deployment.js <url>');
  process.exit(1);
}

async function run() {
  let failed = false;

  // 1. GET /api/health — if we get HTML or 405, API routing is wrong
  try {
    const healthRes = await fetch(`${baseUrl}/api/health`, { method: 'GET' });
    const contentType = healthRes.headers.get('content-type') || '';
    const text = await healthRes.text();

    if (healthRes.status !== 200) {
      console.error(`GET /api/health: expected 200, got ${healthRes.status}`);
      failed = true;
    } else if (contentType.includes('text/html')) {
      console.error('GET /api/health: got HTML (SPA fallback) — API route not hit');
      failed = true;
    } else {
      const data = (() => { try { return JSON.parse(text); } catch { return null; } })();
      if (data?.ok !== true) {
        console.error('GET /api/health: response not { ok: true }', data || text.slice(0, 80));
        failed = true;
      } else {
        console.log('GET /api/health: OK (API reachable)');
      }
    }
  } catch (e) {
    console.error('GET /api/health: fetch failed', e.message);
    failed = true;
  }

  // 2. POST /api/login — must not be 405 (method not allowed)
  try {
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'deployment-test-user', password: 'test' }),
    });
    const contentType = loginRes.headers.get('content-type') || '';
    const text = await loginRes.text();

    if (loginRes.status === 405) {
      console.error('POST /api/login: 405 Method Not Allowed — API route not receiving POST');
      failed = true;
    } else if (contentType.includes('text/html')) {
      console.error('POST /api/login: got HTML (SPA fallback) — API route not hit');
      failed = true;
    } else {
      // 400/401 with JSON is expected for bad credentials
      console.log(`POST /api/login: ${loginRes.status} (expected 400/401 for bad creds; not 405)`);
    }
  } catch (e) {
    console.error('POST /api/login: fetch failed', e.message);
    failed = true;
  }

  if (failed) {
    console.error('\nDeployment check failed. See Vercel routing (vercel.json rewrites/functions).');
    process.exit(1);
  }
  console.log('\nDeployment check passed.');
  process.exit(0);
}

run();
