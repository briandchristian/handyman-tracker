# Vercel deployment debugging and agent-assisted testing

Quick reference for debugging API routing (405/400) on Vercel and for dividing work between you, the main agent, and an optional testing agent.

---

## 1. Quick checks on a deployment

### Manual (browser)

- **GET** `https://YOUR-PREVIEW.vercel.app/api/health`  
  - **Expected:** JSON `{ "ok": true, "message": "API is reachable" }`  
  - **If you see:** HTML or 405 → API route is not being hit (SPA or wrong method).

### Script (recommended)

From the project root:

```bash
# Use your preview or production URL
BASE_URL=https://your-preview.vercel.app npm run test:deployment
# or
npm run test:deployment -- https://your-preview.vercel.app
```

- **Exit 0:** GET /api/health returns JSON; POST /api/login is not 405 (API is reachable).
- **Exit 1:** One of the checks failed; script prints which one.

Use this after every deploy to confirm routing before testing login in the UI.

---

## 2. Who does what (you, main agent, optional agent)

| Role | Responsibilities |
|------|------------------|
| **You** | Deploy on Vercel (or trigger deploy), provide the **exact deployment URL** (preview or production). Run `npm run test:deployment` locally with that URL and paste the output. Report what you see in the UI (e.g. “login still 405” or “login works”). |
| **Main agent** | Code and config: `vercel.json`, `api/index.js`, body parsing, rewrites. Run unit tests (`npm test`). Propose fixes. **Cannot** open your live Vercel URL in a browser; relies on your (or the test agent’s) script output and description. |
| **Optional test agent** | Run the deployment test script against a **given URL** (you or main agent provides it). Optionally use browser automation (e.g. MCP browser) to open the deployment, attempt login, and report: “GET /api/health: 200 JSON” / “POST /api/login: 405” / “Login form submitted, result: …”. No code changes; only run script and/or UI flow and report. |

### What works best

1. **Single source of truth for URL**  
   Always use one explicit URL per test (e.g. `BASE_URL=https://handyman-tracker-xxx.vercel.app`). Avoid “the preview link” without the exact URL.

2. **Script first, UI second**  
   Run `npm run test:deployment` first. If it fails, the main agent can focus on routing/body parsing. If it passes but login still fails in the UI, the issue is likely frontend or cookies/CORS.

3. **Optional agent: script + optional browser**  
   - **Minimum:** Run `BASE_URL=<url> npm run test:deployment` and report exit code and console output.  
   - **Optional:** Open the deployment in the browser, go to login, submit credentials, and report the result (e.g. “redirected to dashboard” or “still on login with error X”).  
   The main agent should ask for the **exact URL** and, if possible, the **script output** so fixes are based on reproducible results.

4. **You don’t need to debug config**  
   You only need to: deploy, run the test script with the deployment URL, and share the output (and any UI behavior). The main agent interprets and suggests code/config changes.

---

## 3. Optional: agent task for “test Vercel output”

If you add an agent (or a second Cursor agent) to test the site from Vercel:

**Inputs to give the agent**

- The deployment URL to test, e.g. `https://handyman-tracker-git-feat-xxx.vercel.app`
- Optional: “Also do a quick browser check: open URL, go to login, submit test credentials, report what happens.”

**Instructions for the agent**

1. Run:  
   `BASE_URL=<DEPLOYMENT_URL> npm run test:deployment`  
   in the project root.
2. Report: exit code (0 or 1) and full script output.
3. If asked for browser check: open the deployment URL, navigate to login, submit credentials (or “Request Access”), and report: success, error message, or “still 405 / wrong page”.

**What the main agent needs back**

- Exact deployment URL used.
- Script output (so we know if GET /api/health and POST /api/login hit the API).
- If browser was used: one-line result (e.g. “Login succeeded” / “405 on submit” / “400 Bad Request”).

No code or config changes from the test agent; it only runs the script and optionally the browser flow and reports.

---

## 4. Common fixes (for main agent)

- **405 on POST /api/login**  
  Rewrites or function config: `/api/*` must be handled by a serverless function, not the SPA. In `vercel.json`, the rewrite for `/api/:path*` should come **before** the catch-all to `index.html`. Ensure the function that handles `/api` is the one that exports the Express app (e.g. `api/[...path].js` or the configured entry).

- **400 with valid JSON body**  
  On Vercel, `req.body` can be empty for same-origin POSTs. The app already has a Vercel-specific body parser in `api/index.js` that reads the raw stream when `VERCEL === '1'`. If 400 persists, confirm the request is `Content-Type: application/json` and that the body is sent (e.g. with the deployment script).

- **GET /api/health returns HTML**  
  The request is hitting the SPA. Adjust rewrites so `/api/*` is not caught by the `/(.*)` → `/index.html` rule; ensure a function is bound to `/api/...`.

---

## 5. Files that matter

- `vercel.json` — rewrites, functions (which files handle `/api`).
- `api/index.js` — Express app, Vercel body parser, routes (e.g. `/api/health`, `/api/login`).
- `api/[...path].js` (or configured API handler) — must export the handler from `api/index.js`.
- `scripts/test-vercel-deployment.js` — script used by `npm run test:deployment`.

---

## 6. Toggleable API debug logging

When routing or path issues are hard to reproduce, you can turn on **API debug logging** so each request and response is logged with path and status. This helps see exactly what path Express receives on Vercel and whether it was normalized.

### Enabling

Set the environment variable **`DEBUG_API`** to a truthy value:

- **Vercel:** Project → **Settings** → **Environment Variables** → Add:
  - **Name:** `DEBUG_API`
  - **Value:** `1`
  - **Environment:** Preview and/or Production (use Preview first when troubleshooting).
- **Local:** In `.env` add `DEBUG_API=1`, or run: `DEBUG_API=1 npm start`.

Redeploy (or restart locally) after changing the variable.

### What gets logged

**These logs are server-side only** — they appear in **Vercel Logs** (or your terminal when running locally), **not** in the browser F12 console.

For every request when `DEBUG_API=1`:

1. **Request line** (after path normalization):  
   `[DEBUG_API] <timestamp> <method> url=<url> path=<path> query.path=<value> VERCEL=1|0 [ (normalized from <raw>) ]`
   - Use this to see whether the path was rewritten (e.g. from `/admin/users` to `/api/admin/users`) and what `query.path` Vercel sent.

2. **Response line** (when the response finishes):  
   `[DEBUG_API] <timestamp> <method> <url> -> <statusCode> [info|warn|error]`
   - Use this to see which requests return 404, 405, 500, etc.

3. **404 response body (visible in F12):** When no route matches, the API returns 404 with a JSON body. If `DEBUG_API=1` is set, that body includes a `debug` object with `path`, `url`, `originalUrl`, `queryPath`, and `method`. Open F12 → **Network** → click the failed request (e.g. `admin/users`) → **Response** tab to see exactly what path the server received. No need to open Vercel Logs for this.

### Where to see logs

- **Vercel:** **Project** → **Logs** (or **Deployments** → select a deployment → **Functions** / **Runtime Logs**). Filter by your function or search for `[DEBUG_API]`.
- **Vercel Toolbar:** If you use the Vercel toolbar on the site, you can open the deployment and check **Logs** from there; the same `[DEBUG_API]` lines will appear when the API runs.
- **Local:** In the terminal where `npm start` is running.

### Turning it off

- **Vercel:** Remove `DEBUG_API` or set it to `0` in Environment Variables, then redeploy.
- **Local:** Remove `DEBUG_API` from `.env` or stop passing it when starting the server.

Leave debug off in production when you are not troubleshooting to avoid extra log volume and to reduce the risk of logging sensitive paths.
