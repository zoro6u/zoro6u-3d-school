# Deployment

Two pieces: a **static frontend** (Vercel or Netlify) and a **small API** (Render or Fly). You can also run both with one
`docker compose up`. Without an API key everything except live chat still works, so a deploy is never "broken".

> **Verification status.** I built both Docker images and ran them together in the build sandbox (non-root user, health check,
> nginx SPA fallback + SSE proxy + security headers, strict CSP with the full app, offline service worker). I could **not** deploy to
> Vercel/Netlify/Render/Fly from the sandbox, so those four configs are syntactically validated but untested against the platforms.

## Option A: everything in Docker (local or any VPS)

```bash
cp .env.example .env          # add ANTHROPIC_API_KEY (optional)
docker compose up --build     # http://localhost:8080
```
nginx serves the app, proxies `/api` to the API (unbuffered, so the teacher's words stream), and sets a strict CSP.

## Option B: Vercel/Netlify (frontend) + Render/Fly (API)

### 1. API → Render (free tier) or Fly
**Render:** *New → Blueprint* → pick the repo (`render.yaml` is picked up). In the dashboard set the secrets
`ANTHROPIC_API_KEY` and `CORS_ORIGINS=https://<your-frontend-domain>`.

**Fly:**
```bash
fly launch --no-deploy --copy-config      # edit app name in fly.toml first (names are global)
fly secrets set ANTHROPIC_API_KEY=sk-ant-... CORS_ORIGINS=https://<your-frontend-domain>
fly deploy
```
Both build the root `Dockerfile` (context = repo root, because the API reads `content/`). Health check: `GET /api/health`.
Set `TRUST_PROXY=true` (already in both configs) so the rate limiter sees real client IPs.

### 2. Frontend → Vercel or Netlify
Import the repo. **Do not set a root directory**: the app imports `content/`, which lives outside `web/`. `vercel.json` /
`netlify.toml` at the repo root already set the install/build commands, the SPA rewrite, security headers and caching.
Add one environment variable:

```
VITE_API_BASE=https://<your-api-host>        # e.g. https://3d-school-api.onrender.com
```
(Build-time: redeploy after changing it.) Then put the frontend's URL into the API's `CORS_ORIGINS`.

### Free-tier realities
- Render's free web service **sleeps after ~15 min idle**; the first chat after a nap takes ~30–50 s. The app checks `/api/health`
  with a 5 s timeout, shows the teacher as offline meanwhile, and the guided tours/quizzes work regardless. Fly can scale to zero
  similarly (`auto_stop_machines`).
- The in-memory rate limiter is per-process. Fine for a demo; use Redis if you scale out.
- Cost control: `RATE_LIMIT_PER_MINUTE`, `MAX_OUTPUT_TOKENS` and `ANTHROPIC_MODEL=claude-haiku-5-5` (the cheaper option) are the knobs.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | server only; never sent to the browser. Empty → chat offline, tours still work |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | `claude-haiku-5-5` is cheaper for public demos |
| `ANTHROPIC_EFFORT` | `low` | thinking depth; `low` keeps spoken replies snappy |
| `ANTHROPIC_FALLBACKS` | `false` | enable Anthropic's server-side refusal fallback (Claude API only) |
| `MAX_OUTPUT_TOKENS` | `700` | per reply |
| `CORS_ORIGINS` | `http://localhost:5173` | comma-separated frontend origins |
| `RATE_LIMIT_PER_MINUTE` | `20` | per client IP |
| `TRUST_PROXY` | `false` | `true` behind a load balancer |
| `MOCK_LLM` | `false` | **dev/CI only**: scripted fake teacher, no key needed |
| `VITE_API_BASE` (web) | empty | API origin when not same-origin |

## Security notes
- Strict CSP (no inline scripts), `nosniff`, `Referrer-Policy`, and `Permissions-Policy` (microphone only for the optional voice input).
- API container runs as a non-root user; the key is read from the environment and never logged or returned (tested).
- The teacher is hardened against misuse: input length/history/scene-size caps, a rate limit, prompt-injection-aware prompt, and
  every tool call validated server- and client-side.
