# Campus Desk

Admissions portal, faculty LMS, attendance, organisation admin, and platform control plane.

## Run

```bash
# Postgres + Redis (or use local Homebrew services)
npm run db:up

cp backend/.env.example backend/.env
# set DATABASE_URL, REDIS_URL, JWT_SECRET, ADMIN_PASSWORD, PLATFORM_PASSWORD

npm run install:all
npm run db:generate --prefix backend
npm run db:push --prefix backend
npm run seed --prefix backend

# terminal 1
npm run dev:backend

# terminal 2
npm run dev:frontend
```

- API: http://localhost:5050
- Campus Desk UI: http://localhost:5174
  - Org admin: `/org-admin`
  - Faculty / LMS: `/faculty-portal`
  - Applicant apply: `/apply`
  - Super admin: `/x7k2m9q4p8n3`

## Seeded logins

Passwords come from `ADMIN_PASSWORD` / `PLATFORM_PASSWORD` in `backend/.env`.

- Super admin: `platform@explore.app`
- Org admin: `admin@explorecollege.org`
- Faculty: `faculty@explorecollege.org`
- Student: `student@explorecollege.org` / `student123`

## Deploy environments

| Env        | Branch    | URL |
|------------|-----------|-----|
| Production | `main`    | https://campusdesk-production-9ab3.up.railway.app |
| Development| `develop` | Separate Railway service — see [deploy/DEV.md](deploy/DEV.md) |

Push to `develop` to test on the dev URL without touching production. The iOS app Debug build targets dev; Release uses production.

The website reads: `GET /api/settings`, `/api/faculty`, `/api/courses`, `/api/news`, `/api/careers`, `POST /api/contact`.
