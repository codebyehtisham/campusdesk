# Campus Desk — Attendance APIs (mobile + admin)

**Production base URL:** `https://campusdesk-production-9ab3.up.railway.app`  
**Dev base URL:** your Railway `develop` service (see `deploy/DEV.md`)

All protected routes use `Authorization: Bearer <token>`.

---

## Mobile flow (student)

1. **Login** → read `attendanceLocationEnabled` from the response.
2. If `attendanceLocationEnabled === true`, request device GPS **before** scanning.
3. Scan QR → payload is `explore-attend:{hexToken}`.
4. **POST scan** with `qrToken` (+ coordinates only when location is enabled).

---

## 1. Student login

`POST /api/auth/login`

```json
// Request
{
  "email": "student@explorecollege.org",
  "password": "student123",
  "institute": "explore"
}

// Response 200
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "Ayesha Khan",
    "email": "student@explorecollege.org",
    "role": "applicant",
    "blocked": false,
    "organization": "org-uuid"
  },
  "organization": {
    "id": "org-uuid",
    "name": "Explore College",
    "slug": "explore",
    "modules": ["admissions", "faculty", "student-attendance", "..."],
    "status": "active"
  },
  "attendanceLocationEnabled": true,
  "campusLocation": {
    "latitude": 31.5497,
    "longitude": 74.3436,
    "radiusMeters": 250
  }
}
```

**Mobile rule:** fetch GPS on scan **only when** `attendanceLocationEnabled` is `true`.  
When `false`, omit `latitude` / `longitude` / `accuracy` from the scan body.

Same fields are returned from `GET /api/auth/me`, `POST /api/admin/login`, and `POST /api/staff/login` when the org has the student-attendance module.

---

## 2. Public settings (optional, no auth)

`GET /api/settings?institute=explore`

```json
{
  "admissionsOpen": true,
  "attendanceLocationEnabled": true,
  "latitude": 31.5497,
  "longitude": 74.3436,
  "radiusMeters": 250,
  "location": {
    "latitude": 31.5497,
    "longitude": 74.3436,
    "radiusMeters": 250
  },
  "organization": {
    "name": "Explore College",
    "slug": "explore",
    "modules": ["admissions", "faculty", "student-attendance"]
  }
}
```

---

## 3. Scan QR attendance (student)

`POST /api/auth/attendance/scan`  
Auth: student/applicant Bearer token. Requires `student-attendance` module.

**When `attendanceLocationEnabled` is true** (location required):

```json
// Request
{
  "qrToken": "a1b2c3d4e5f6...",
  "latitude": 31.5498,
  "longitude": 74.3435,
  "accuracy": 12.5
}

// Response 200
{
  "message": "You are marked present.",
  "status": "present",
  "onCampus": true,
  "distanceMeters": 42,
  "session": {
    "id": "session-uuid",
    "className": "Anatomy I",
    "classCode": "BSN-Y1",
    "room": "Lab 2",
    "date": "2026-08-26",
    "status": "open",
    "qrPayload": "explore-attend:a1b2c3d4...",
    "qrExpiresAt": "2026-08-26T12:30:00.000Z",
    "roster": []
  }
}
```

**When location is disabled** — send only the token:

```json
{ "qrToken": "a1b2c3d4e5f6..." }
```

**QR string format:** `explore-attend:{hexToken}` (strip prefix before sending, or send full string — both work).

**Errors:**

| Status | When |
|--------|------|
| 400 | Missing/invalid QR, expired QR, or location required but not sent |
| 403 | Not on roster or not enrolled |
| 404 | Session not open |

Off-campus scans are **accepted** (HTTP 200). Attendance is marked present with `onCampus: false` so the portal can show **Not onsite**. Final present still requires onsite when location is enabled.

```json
{
  "message": "You are marked present.",
  "status": "present",
  "onCampus": false,
  "distanceMeters": 842,
  "session": { }
}
```

---

## 4. Session refresh (student)

`GET /api/auth/me` — same auth extras as login (`attendanceLocationEnabled`, `campusLocation`).

---

## 5. Faculty — open session & QR

`POST /api/staff/classes/:classId/sessions`  
Auth: faculty Bearer token.

```json
// Request (optional body)
{ "date": "2026-08-26", "slotId": "slot-uuid" }

// Response 201
{
  "id": "session-uuid",
  "className": "Anatomy I",
  "classCode": "BSN-Y1",
  "room": "Lab 2",
  "date": "2026-08-26",
  "status": "open",
  "qrToken": "hex-token",
  "qrPayload": "explore-attend:hex-token",
  "qrImage": "data:image/png;base64,...",
  "qrExpiresAt": "2026-08-26T12:30:00.000Z",
  "roster": [
    {
      "id": "person-uuid",
      "name": "Ayesha Khan",
      "email": "student@explorecollege.org",
      "status": null,
      "location": null
    }
  ]
}
```

`PUT /api/staff/sessions/:id/qr` — refresh QR before expiry.  
`GET /api/staff/sessions/:id` — roster with `location.onCampus` when GPS was captured.  
`PUT /api/staff/sessions/:id/close` — close session.

---

## 6. Org admin — campus geofence

`GET /api/admin/attendance/location`  
`PUT /api/admin/attendance/location`

```json
// PUT body
{
  "attendanceLocationEnabled": true,
  "latitude": 31.5497,
  "longitude": 74.3436,
  "radiusMeters": 250
}

// Response
{
  "attendanceLocationEnabled": true,
  "latitude": 31.5497,
  "longitude": 74.3436,
  "radiusMeters": 250,
  "location": {
    "latitude": 31.5497,
    "longitude": 74.3436,
    "radiusMeters": 250
  }
}
```

---

## 7. Org admin — session list & detail

`GET /api/admin/attendance/sessions?date=2026-08-26`

```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "className": "Anatomy I",
      "classCode": "BSN-Y1",
      "room": "Lab 2",
      "date": "2026-08-26",
      "status": "open",
      "teacherName": "Dr. Ali",
      "markCount": 18
    }
  ]
}
```

`GET /api/admin/attendance/sessions/:id` — full roster with per-student `location` (same shape as faculty session).

---

## Test accounts

| Role | Email | Password | Login path |
|------|-------|----------|------------|
| Student | `student@explorecollege.org` | `student123` | `POST /api/auth/login` |
| Org admin | `admin@explorecollege.org` | `CampusDesk2026!` | `POST /api/admin/login` |
| Faculty | `faculty@explorecollege.org` | `CampusDesk2026!` | `POST /api/staff/login` |
