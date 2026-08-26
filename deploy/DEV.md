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

Production keeps deploying from `main`; dev auto-deploys when you push to `develop`.

## 2. Dev environment variables

In the **dev service only**, set:

```env
APP_ENV=development
JWT_SECRET=<long random string, different from production>
PUBLIC_APP_URL=https://<your-dev-service>.up.railway.app
REDIS_DISABLED=1
```

Optional Postgres (recommended so dev data stays separate from prod):

```env
DATABASE_URL=<Railway Postgres plugin URL for dev service>
```

If `DATABASE_URL` is unset, boot uses SQLite on the dev container (fine for smoke tests; data resets on redeploy).

Demo logins are seeded on every boot (same as production):

- Student: `student@explorecollege.org` / `student123`
- Org admin: `admin@explorecollege.org` / `CampusDesk2026!`

## 3. Verify

```bash
curl -s https://<your-dev-service>.up.railway.app/api/health
```

Expect `"environment":"development"` in the JSON.

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

## Health check fields

`GET /api/health` returns:

```json
{
  "status": "ok",
  "environment": "development",
  "url": "https://your-dev-service.up.railway.app",
  "db": "connected",
  "cache": "disconnected"
}
```

Use `environment` in the mobile app or Postman to confirm you are not hitting production.
