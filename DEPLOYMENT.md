# Luveedu cPanel Production Deployment Guide

Target: **Luveedu Cloud-3 shared cPanel hosting** · Repo: `hsscoders/nikecode`
Stack detected: **Next.js 15.5 (Client + Admin, SSR — needs Node, NOT static export)** · **Express + Socket.IO backend** · **MongoDB Atlas (Mongoose)**

---

## 1. Architecture on cPanel

The project is a **single-domain design**: the browser only talks to the main website. The Next.js Client proxies everything through server-side rewrites:

| Public URL | Served by | cPanel Node.js App |
|---|---|---|
| `https://yourdomain.com/` | Client (Next.js) | `client` — startup file `passenger.js` |
| `https://yourdomain.com/api/*` | Client rewrite → backend | (no separate URL needed) |
| `https://yourdomain.com/admin/*` | Client rewrite → Admin | (no separate URL needed) |

Three Passenger processes run behind the scenes:

| App root (example) | Contents | Startup file | Listens on |
|---|---|---|---|
| `~/apps/backend` | Express API + Socket.IO + static banners/uploads | `server.js` | Passenger-injected PORT |
| `~/apps/client` | Next.js Client build (`.next/`) | `passenger.js` | Passenger-injected PORT |
| `~/apps/admin` | Next.js Admin build (`.next/`) | `passenger.js` | Passenger-injected PORT |

The Client's rewrite targets (`API_ORIGIN`, `ADMIN_ORIGIN`) point at the **internal Passenger URLs** of the other two apps. Passenger binds each app to an internal loopback port it assigns itself — in cPanel → Setup Node.js App you'll see each app's internal address once running (format `http://127.0.0.1:PORT`). Put that address into the Client app's `API_ORIGIN` / `ADMIN_ORIGIN` env vars.

> **Why not static export?** The Client uses server components, ISR (`revalidate`) and SSR-seeded settings — it must run a Node server. Admin likewise.

> **Why not one app?** One Passenger app runs one startup file; the two Next apps cannot share a process. Express could be merged, but that would rewrite working code — not worth the risk.

---

## 2. Verify with Luveedu support (before committing to this host)

- [ ] Node.js apps allowed per account ≥ 3 (Cloud plans usually allow several)
- [ ] Memory limit per Node.js app ≥ 512 MB (Next.js SSR + Passenger overhead)
- [ ] WebSocket upgrade (wss://) through Passenger — **Socket.IO works regardless** (it falls back to HTTP long-polling automatically; WS is only a latency optimization)
- [ ] Outbound HTTPS to `mongodb.net`, `wpay.one`, `qwackpay.com` (payment webhooks are **inbound**; Atlas and gateway status-polls are outbound)
- [ ] SSH + `tar` available (the deploy workflow uses tar-over-ssh; no rsync needed)
- [ ] App restart via `tmp/restart.txt` (standard Passenger behavior on cPanel — confirmed by the Node.js Selector docs)

---

## 3. One-time cPanel setup (step by step)

### 3.1 MongoDB Atlas

1. Atlas → Network Access → add the cPanel server IP (or `0.0.0.0/0` if the IP is dynamic — shared hosting IPs change).
2. Database Access → create/confirm a user for the `zapto` DB.
3. Copy the SRV connection string.

### 3.2 Create the three Node.js apps

cPanel → **Setup Node.js App** → *Create Application*, three times:

| Setting | backend | client | admin |
|---|---|---|---|
| Node.js version | **20.x** | 20.x | 20.x |
| Application mode | Production | Production | Production |
| Application root | `apps/backend` | `apps/client` | `apps/admin` |
| Application URL | any spare subdomain, e.g. `api.yourdomain.com` | `yourdomain.com` | any spare, e.g. `admin.yourdomain.com` |
| Application startup file | `server.js` | `passenger.js` | `passenger.js` |

> The backend/admin URLs are **internal-only** (the browser never visits them directly). They exist so Passenger has something to bind; you can keep them off DNS entirely — internal loopback still works. If you do point DNS at them, keep `CORS_ORIGINS` strict (see 3.3).

### 3.3 Backend environment

Create `~/apps/backend/.env` (File Manager or terminal) — copy from `backend/.env.example`:

```env
PORT=
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/zapto?retryWrites=true&w=majority
JWT_SECRET=<openssl rand -hex 32 — ROTATE: the old one leaked in git history>
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

- `CORS_ORIGINS` empty = allow all — **do not leave it empty in production**.
- Do **not** set `PORT` — Passenger injects it.
- User uploads persist in `~/apps/backend/public/uploads/` — the deploy never touches this folder.

Client/Admin env vars are set in cPanel → Setup Node.js App → **Environment Variables** of the **client** app:

| Name | Value |
|---|---|
| `API_ORIGIN` | internal URL of the backend app, e.g. `http://127.0.0.1:41001` |
| `ADMIN_ORIGIN` | internal URL of the admin app, e.g. `http://127.0.0.1:41002` |

(and on the **admin** app: `API_ORIGIN` = backend internal URL.)

### 3.4 First code drop (before first Actions deploy)

Upload the repo once via cPanel **Git Version Control** (clone `https://github.com/hsscoders/nikecode.git` into `~/repositories/nikecode`), then copy each folder's contents into the matching app root, or let the first GitHub Actions run do the initial sync (it creates the dirs). First run needs `API_ORIGIN`/`ADMIN_ORIGIN` set afterwards → press **Restart** on the client app.

### 3.5 HTTPS

Enable **AutoSSL / Let's Encrypt** (cPanel → SSL/TLS Status) for the main domain. HTTPS is mandatory — payment return URLs and Socket.IO on modern browsers assume it.

---

## 4. GitHub Secrets (Settings → Secrets and variables → Actions)

| Secret | Example / notes |
|---|---|
| `SSH_HOST` | `yourdomain.com` (or Luveedu's server hostname) |
| `SSH_PORT` | usually `22`; set only if different |
| `SSH_USER` | cPanel username |
| `SSH_PRIVATE_KEY` | `ssh-keygen -t ed25519 -f deploy_key` **private** key, public key added in cPanel → SSH Access → Manage Keys |
| `SSH_KNOWN_HOSTS` | optional — output of `ssh-keyscan -p 22 yourdomain.com` |
| `CPANEL_PATH` | `/home/CPANELUSER/apps` (the parent of `backend/`, `client/`, `admin/`) |
| `PROD_URL` | `https://yourdomain.com` (health-check target) |

No MongoDB/JWT secrets live in GitHub — those exist only in `~/apps/backend/.env` on the server.

---

## 5. Automatic deployment (how it works)

`/.github/workflows/deploy.yml` runs on every push to `main`:

1. Builds Client + Admin **on GitHub's runner** (shared cPanel CPUs can't run `next build` reliably) and installs backend prod deps — all three via `npm ci` + lockfiles.
2. Streams each app folder **tar-over-ssh** into its cPanel app root. Excludes: `.git`, real `.env` files, `public/uploads/*`, `.next/cache` → **server .env and user uploads are never overwritten**.
3. Touches `tmp/restart.txt` in all three app roots → Passenger respawns the apps (official cPanel restart mechanism).
4. Health-checks `PROD_URL/api/health` + `PROD_URL/` up to 12 × 15 s; the job **fails** (and emails you) if either isn't 200.
5. `concurrency: deploy-production` queues overlapping pushes — two deploys can never interleave.

**Rollback:** run the workflow manually on an older commit (*Actions → Deploy to cPanel → Run workflow*), or `git revert <commit> && git push`. To roll back code only on the server: `cd ~/repositories/nikecode && git checkout <previous-tag>` then copy + restart (manual path, §7).

---

## 6. Logs & diagnostics

| What | Where |
|---|---|
| Backend stdout/stderr | Setup Node.js App → backend → **Log** (cPanel shows `stderr.log` / `stdout.log` links; also `~/logs/` or `~/apps/backend/stderr.log` depending on theme) |
| Client/Admin stderr | same, per app |
| Passenger spawn errors | cPanel Node.js app log + `/home/USER/logs/<domain>.error.log` |
| Quick live check | `curl -s https://yourdomain.com/api/health` → `{"ok":true,...}` |

Common errors:

| Symptom | Cause / fix |
|---|---|
| `MONGODB_URI missing` / `JWT_SECRET missing` in stderr | `.env` not created in `~/apps/backend/` (§3.3) |
| 503 / Passenger error page | startup file crashed → read stderr; ensure `npm run build` output `.next/` exists (Actions deploy ships it) |
| API 200 but site shows old data | rewrites point at wrong internal port → re-check `API_ORIGIN`/`ADMIN_ORIGIN`, restart client |
| Socket.IO keeps polling, no WS | normal on Passenger — polling is fully functional |
| `ECONNREFUSED 127.0.0.1:3030` in client stderr | defaults used because env vars not set on the cPanel app |

---

## 7. Manual deployment fallback (no Actions)

```bash
# from your machine / any terminal with the repo
git pull origin main
cd frontend/Client  && npm ci && npm run build && cd ../..
cd frontend/Admin   && npm ci && npm run build && cd ../..
cd backend          && npm ci --omit=dev && cd ..

tar -czf - --exclude='.git' --exclude='.env' --exclude='backend/public/uploads/*' -C backend . \
  | ssh USER@HOST "tar -xzf - -C ~/apps/backend"
tar -czf - --exclude='.git' --exclude='.env' --exclude='.next/cache' -C frontend/Client . \
  | ssh USER@HOST "tar -xzf - -C ~/apps/client"
tar -czf - --exclude='.git' --exclude='.env' --exclude='.next/cache' -C frontend/Admin . \
  | ssh USER@HOST "tar -xzf - -C ~/apps/admin"

ssh USER@HOST "for a in backend client admin; do mkdir -p ~/apps/\$a/tmp; touch ~/apps/\$a/tmp/restart.txt; done"
curl -s https://yourdomain.com/api/health
```

(cPanel Git alternative: *Git Version Control → Manage → Update from Remote* on the server, then copy the changed folders into the app roots and restart.)

---

## 8. Security notes (already applied in this repo)

- `backend/.env` was previously **committed** — it is now untracked + `.gitignore`d, but **git history still contains the old MongoDB password and JWT secret → rotate both**.
- CORS is env-restricted (`CORS_ORIGINS`); Socket.IO uses the same list.
- Global Express error handler hides stack traces in production responses.
- Graceful shutdown on Passenger's SIGTERM; `unhandledRejection` logging.
- Seed defaults: first boot creates admin `admin/admin123` — **change it immediately** in the admin panel.
