# Campus Desk dev environment

Use a **separate Railway service** for development so you can test the mobile app and web UI without pushing to production.

| Environment | Branch   | Typical URL                                              | Mobile build |
|-------------|----------|----------------------------------------------------------|--------------|
| Production  | `main`   | `https://campusdesk-production-9ab3.up.railway.app`      | Release      |
| Development | `develop`| `https://<your-dev-service>.up.railway.app` (see below)  | Debug        |

## 1. Create the dev service (one-time)

1. Open [Railway](https://railway.app) → your Campus Desk project.
2. **New service** → **GitHub repo** → `codebyehtisham/campusdesk`.
3. **Settings → Source → Branch** → set to `develop` (create this branch if needed).
4. **Settings → Networking → Generate domain** — copy the HTTPS URL (e.g. `campusdesk-dev-xxxx.up.railway.app`).
5. **Add plugins to this service:**
   - **PostgreSQL** → Variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - **Redis** → Variables: `REDIS_URL=${{Redis.REDIS_URL}}`

Production keeps deploying from `main`; dev auto-deploys when you push to `develop`. Use **separate** Postgres/Redis plugins for prod and dev so data never mixes.

## 2. Dev environment variables

In the **dev service only**, set:

```env
APP_ENV=development
JWT_SECRET=<long random string, different from production>
PUBLIC_APP_URL=https://<your-dev-service>.up.railway.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

Do **not** set `REDIS_DISABLED`. SQLite is not supported — boot will refuse to start without PostgreSQL and Redis.

Demo logins are seeded on every boot (same as production):

- Student: `student@explorecollege.org` / `student123`
- Org admin: `admin@explorecollege.org` / `CampusDesk2026!`

## 3. Verify

```bash
curl -s https://<your-dev-service>.up.railway.app/api/health
```

Expect:

```json
{
  "status": "ok",
  "environment": "development",
  "db": "connected",
  "cache": "connected"
}
```

## 4. Point the iOS app at dev

Debug builds read `CAMPUSDESK_API_BASE_URL` from Xcode build settings.

After you have the dev Railway URL, update **Debug** in `CampusDesk.xcodeproj`:

- `CAMPUSDESK_API_BASE_URL` → `https://<your-dev-service>.up.railway.app`
- `CAMPUSDESK_APP_ENV` → `development`

Release builds keep using production automatically.

## 5. Day-to-day workflow

```bash
git checkout develop
# … make changes …
git push origin develop
# Railway dev service redeploys; test on phone with Debug build
```

When ready for production:

```bash
git checkout main
git merge develop
git push origin main
```

## Flush dev database (Railway dashboard)

Railway has no “run script” button. Use **environment variables + redeploy** on the **dev service only**:

1. **Variables** → add:
   - `CONFIRM_DB_FLUSH=1` (optional — wipes tenant data on deploy; **remove after one deploy**)
   - `SKIP_SEED=1` (optional — only if you flushed and want **only** superadmin, no demo org)
2. Confirm `APP_ENV=development` is set on this service (required — flush is blocked on production).
3. **Deploy** → **Redeploy** (or push any commit to `develop`).
4. Watch deploy logs for `Database flush complete` and `Users remaining: 1`.
5. **Remove `CONFIRM_DB_FLUSH`** from variables and redeploy again (so the next deploy does not flush again).
6. When you want demo org/users back, remove `SKIP_SEED` and redeploy once.

### Run flush from your Mac (alternative)

1. Railway → **dev service** → **Postgres** plugin → **Connect** → copy `DATABASE_URL`.
2. Railway → **Redis** plugin → copy `REDIS_URL`.
3. Locally:

```bash
cd backend
DATABASE_URL='postgresql://...' REDIS_URL='redis://...' CONFIRM_DB_FLUSH=1 npm run db:flush
```

Install the [Railway CLI](https://docs.railway.com/guides/cli) for a third option:

```bash
railway link   # pick dev service
CONFIRM_DB_FLUSH=1 SKIP_SEED=1 railway run npm run db:flush --prefix backend
```

## Production checklist

On the **production** Railway service:

1. PostgreSQL plugin attached → `DATABASE_URL=${{Postgres.DATABASE_URL}}`
2. Redis plugin attached → `REDIS_URL=${{Redis.REDIS_URL}}`
3. Remove any SQLite `file:` `DATABASE_URL` and any `REDIS_DISABLED=1`
4. Redeploy after variables are set

Without Postgres + Redis, `npm start` exits immediately (by design).

### Recover from 502 (dev service)

If the dev URL shows **502 Bad Gateway**, open **Deployments → latest deploy → View logs** and look for `FATAL:` or `exited with`.

1. **Variables** — confirm these exist (and remove flush vars):
   - `APP_ENV` = `development`
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `REDIS_URL` = `${{Redis.REDIS_URL}}`
   - Delete `CONFIRM_DB_FLUSH` and `SKIP_SEED` if present
2. **Plugins** — dev service must have its **own** Postgres + Redis plugins attached.
3. **Emergency start** — add `BOOT_MINIMAL=1`, redeploy once (skips seed/push), confirm `/api/health` returns ok, then **remove `BOOT_MINIMAL`** and redeploy again.

`SKIP_SEED` is **optional**. You do **not** need to add it unless you intentionally flushed and want only the superadmin account.

## Platform catalog (modules & departments)

The **Catalog** in super admin (`/x7k2m9q4p8n3/modules`) reads from `Department`, `Module`, and `Plan` tables. These are **platform-wide** — not tenant data — and are **not** deleted by `db:flush`.

Every deploy runs `ensure-catalog` on boot so an empty catalog is repopulated automatically.

### Restore catalog immediately

**Option A — redeploy** (after this fix is on `develop`): push and let Railway boot run `ensure-catalog`.

**Option B — local / Railway CLI:**

```bash
cd backend
DATABASE_URL='postgresql://...' npm run db:catalog
```

### Enable modules for an organisation

1. Super admin → **Catalog** — confirm departments and modules are listed (published / active).
2. Super admin → **Organisations** → open the tenant → **Entitlements**:
   - Toggle a **department** on.
   - Click individual **modules** to enable them for that campus.

Org `modules` and `departments` are JSON arrays on the organisation record; the org admin portal only shows modules you enable here.

### Programmes (courses)

Programmes are stored in the `Course` table per education organisation (used in Classes, admissions dropdown, and the public site). Every deploy runs `ensure-programmes` in background init. New education tenants also get default programmes on create.

Manual restore:

```bash
cd backend
DATABASE_URL='postgresql://...' npm run db:programmes
```
