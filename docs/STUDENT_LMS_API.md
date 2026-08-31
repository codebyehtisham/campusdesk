# Student LMS API

Base URL: `/api`  
Student LMS base: `/api/student`  
Faculty LMS base: `/api/staff` (teacher token)

## Auth

Students use the existing applicant auth flow.

**Password transport:** Passwords must be RSA-OAEP encrypted before login/register/password APIs.

1. `GET /api/auth/password-key` → `{ version: 1, publicKey: "-----BEGIN PUBLIC KEY-----..." }`
2. Encrypt the plain password with **RSA-OAEP SHA-256** using that public key
3. Send ciphertext as `password` (or `currentPassword` / `newPassword`) prefixed: `enc:v1:<base64>`

The web portal encrypts automatically. Mobile apps must implement the same step.

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "student@school.edu",
  "password": "••••••",
  "client": "mobile"
}
```

Response includes `token`. Send on every request:

```http
Authorization: Bearer <token>
```

Requirements:
- Role must be `applicant`
- Org must have `faculty` module enabled
- Student must be enrolled in at least one class (matched by user email → `AttendancePerson` → `ClassEnrollment`)
- Mobile login uses `client: "mobile"`; web login is blocked after enrollment (`USE_MOBILE_APP`)

---

## Student endpoints (`/api/student`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Summary: classes, pending assignments/leaves, recent quiz marks, open sessions |
| GET | `/me` | Profile + enrolled classes |
| GET | `/classes` | List enrolled classes |
| GET | `/classes/:classId` | Class detail: teacher, course content, timetable, stats |
| GET | `/timetable` | Weekly timetable across all classes |
| GET | `/assignments` | List assignments (`?classId=` optional) |
| GET | `/assignments/:id` | Assignment detail + my submission |
| POST | `/assignments/:id/submit` | Submit assignment (PDF/Word file and/or notes) |
| GET | `/quizzes` | Quiz marks from in-class quizzes (`?classId=` optional) |
| GET | `/exams` | Formal exam marks for enrolled classes |
| GET | `/attendance` | Daily register + session attendance history |
| GET | `/leaves` | My class leave requests (`?classId=` optional) |
| POST | `/leaves` | Submit leave (per class) |
| GET | `/notifications` | In-app notifications (leave decisions, graded assignments) |

### Submit leave (student)

```http
POST /api/student/leaves
Authorization: Bearer <token>
Content-Type: application/json

{
  "classId": "uuid",
  "type": "sick",
  "startDate": "2026-09-01",
  "endDate": "2026-09-02",
  "reason": "Fever"
}
```

Types: `sick`, `casual`, `maternity`, `annual`  
Routed to the **class teacher** (`ClassSection.teacherId`) for approve/reject.

### Submit assignment (PDF / Word)

Students upload **PDF** (`.pdf`) or **Word** (`.doc`, `.docx`) files. Max size **10 MB**.

Send JSON with a base64 data URL **or** raw base64 + mime. Optional `body` for cover notes.

**Option A — data URL (recommended for React Native / Expo):**

```http
POST /api/student/assignments/{assignmentId}/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "body": "Please find my answers attached.",
  "file": "data:application/pdf;base64,JVBERi0xLjQK...",
  "fileName": "chapter-3-homework.pdf"
}
```

**Option B — raw base64:**

```json
{
  "fileName": "essay.docx",
  "fileMime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "fileBase64": "UEsDBBQAAAAI..."
}
```

Allowed `fileMime` values:
- `application/pdf`
- `application/msword` (`.doc`)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.docx`)

**Response (201):**

```json
{
  "id": "submission-uuid",
  "assignmentId": "assignment-uuid",
  "body": "Please find my answers attached.",
  "file": {
    "url": "/uploads/org-id/assignments/.../homework.pdf?v=...",
    "name": "chapter-3-homework.pdf",
    "mime": "application/pdf",
    "size": 245760
  },
  "submittedAt": "2026-08-31T06:00:00.000Z",
  "status": "submitted"
}
```

`GET /student/assignments/:id` includes the same `submission.file` object. Faculty see `file` on each row in `GET /staff/assignments/:id/submissions`.

Re-submitting replaces the file and resets grading. At least one of `file` / `fileBase64` or `body` is required.

---

## Faculty endpoints (`/api/staff` — teacher token)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/classes/:classId/assignments` | List assignments |
| POST | `/classes/:classId/assignments` | Create assignment |
| PUT | `/assignments/:id` | Update assignment |
| GET | `/assignments/:id/submissions` | All student submissions |
| PUT | `/assignments/:id/submissions/:personId/grade` | Grade `{ marksObtained, feedback }` |
| GET | `/classes/:classId/quizzes` | List in-class quizzes |
| POST | `/classes/:classId/quizzes` | Record a physical quiz |
| GET | `/quizzes/:id/marks` | Mark sheet for roster |
| PUT | `/quizzes/:id/marks` | Save marks `{ marks: [{ personId, marksObtained, notes }] }` |
| GET | `/student-leaves` | Pending/approved student leaves (`?status=pending&classId=`) |
| GET | `/student-leaves/:id` | Leave detail + student history for that class |
| PUT | `/student-leaves/:id/decision` | `{ "decision": "approved", "reviewNotes": "" }` |

### Create assignment

```json
{
  "title": "Chapter 3 exercises",
  "description": "Submit written answers",
  "dueAt": "2026-09-15T23:59:00.000Z",
  "maxMarks": 20,
  "published": true
}
```

### Create quiz (physical class — marks entered later)

```json
{
  "title": "Weekly quiz 4",
  "quizDate": "2026-09-10",
  "maxMarks": 10,
  "notes": "Conducted in room 12"
}
```

---

## Deploy

```bash
cd backend && npx prisma db push
```

New tables: `Assignment`, `AssignmentSubmission`, `ClassQuiz`, `ClassQuizMark`, `StudentLeaveRequest`.

`AssignmentSubmission` file columns: `fileUrl`, `fileName`, `fileMime`, `fileSize` (run `db push` after pull).

---

## Mobile app integration prompt

Copy everything inside the block below into your student app / UI agent:

```
Build a student LMS mobile app for Campus Desk using these APIs.

BASE: {API_URL}/api
AUTH: POST /auth/login with { email, password, client: "mobile" } → store token.
HEADER: Authorization: Bearer {token} on all /student/* calls.

DESIGN SYSTEM:
- Teal primary (#1a4fd6 cardinal / campus teal rail), soft glass cards, rounded 1.4rem corners
- Eyebrow labels uppercase, serif headlines, muted secondary text
- Bottom nav: Home | Classes | Assignments | Attendance | Profile
- Status pills: approved=teal, pending=gray, rejected=red, graded=teal

SCREENS:

1. HOME (/student/dashboard + /student/notifications)
   - Greeting with student name from GET /student/me
   - Stat row: pending assignments, pending leaves, class count
   - Recent quiz marks list (from dashboard.recentQuizMarks)
   - Open attendance sessions banner if dashboard.openSessions.length > 0
   - Notification bell → list GET /student/notifications

2. CLASSES (/student/classes, /student/classes/:id)
   - Card per class: name, code, teacher name
   - Class detail tabs: Content | Timetable | Assignments | Quizzes | Leave
   - Content: list from class detail `contents` (week, title, body)
   - Timetable: day grid from class `timetable` or GET /student/timetable

3. ASSIGNMENTS (/student/assignments)
   - Filter by class
   - Card: title, class, due date, submission status (submitted/graded/missing)
   - Detail: description, dueAt, maxMarks
   - File picker: PDF or Word (.pdf, .doc, .docx), max 10 MB
   - Optional notes textarea (`body`)
   - POST /student/assignments/:id/submit with base64 file (see ASSIGNMENT FILE UPLOAD below)
   - Show uploaded file name + download/open link from submission.file.url
   - Show marksObtained + feedback when graded

ASSIGNMENT FILE UPLOAD (mobile):

1. Let user pick a document (DocumentPicker / file input).
2. Read bytes, base64-encode, build data URL:
   mime = file.mimeType ?? guess from extension
   dataUrl = `data:${mime};base64,${base64}`
3. POST /student/assignments/:id/submit
   Headers: Authorization: Bearer {token}, Content-Type: application/json
   Body: { "body": "optional notes", "file": dataUrl, "fileName": originalName }
4. Prefix file.url with API origin if it starts with /uploads/
5. On re-submit, same endpoint replaces file and clears grade.

Example (TypeScript / React Native):

```ts
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const ALLOWED = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

async function submitAssignment(apiUrl: string, token: string, assignmentId: string) {
  const pick = await DocumentPicker.getDocumentAsync({
    type: ALLOWED,
    copyToCacheDirectory: true,
  });
  if (pick.canceled || !pick.assets?.[0]) return;

  const asset = pick.assets[0];
  const mime = asset.mimeType || 'application/pdf';
  if (!ALLOWED.includes(mime)) throw new Error('PDF or Word only');

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const res = await fetch(`${apiUrl}/api/student/assignments/${assignmentId}/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      body: 'Submitted from mobile app',
      file: `data:${mime};base64,${base64}`,
      fileName: asset.name,
    }),
  });

  if (!res.ok) throw new Error((await res.json()).message || 'Submit failed');
  return res.json(); // { file: { url, name, mime, size }, submittedAt, status }
}
```

Password encryption applies only to login/register — not to assignment file uploads.

4. QUIZZES & EXAMS
   - Quizzes tab: GET /student/quizzes — in-class quiz marks, grade badge
   - Exams screen: GET /student/exams — formal exam marks with grade

5. ATTENDANCE (/student/attendance)
   - Two sections: daily register + session attendance
   - Status chips: present, absent, late, leave
   - QR scan: POST /auth/attendance/scan (existing flow)

6. LEAVE (/student/leaves)
   - Balance-style summary per class (count pending/approved)
   - Form: pick class (from /student/classes), type (sick/casual/maternity/annual), dates, reason
   - POST /student/leaves
   - History list with status pills and teacher review notes

ERROR HANDLING:
- 401 → login screen
- 403 code CLASS_NOT_ASSIGNED → "Not enrolled yet" empty state
- 403 code USE_MOBILE_APP → show download message (web only)

FACULTY PORTAL (separate teacher app section):
- Assignments CRUD + grade submissions via /staff/classes/:id/assignments
- Quiz mark entry via /staff/quizzes/:id/marks
- Student leave inbox via /staff/student-leaves with approve/reject on detail screen
```
