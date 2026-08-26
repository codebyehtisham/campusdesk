import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const id = () => randomUUID();

const loginTest = (tokenVar, extra = '') =>
  [
    'if (pm.response.code >= 200 && pm.response.code < 300) {',
    '  const json = pm.response.json();',
    `  if (json.token) pm.collectionVariables.set("${tokenVar}", json.token);`,
    '  if (json.user?.id) pm.collectionVariables.set("userId", json.user.id);',
    '  if (json.organization?.id) pm.collectionVariables.set("orgId", json.organization.id);',
    extra,
    '}',
  ]
    .filter(Boolean)
    .join('\n');

const captureFirstId = (variable) =>
  [
    'if (pm.response.code >= 200 && pm.response.code < 300) {',
    '  const json = pm.response.json();',
    '  const row = Array.isArray(json) ? json[0] : json?.people?.[0] || json?.classes?.[0] || json?.slots?.[0] || json;',
    `  if (row?.id) pm.collectionVariables.set("${variable}", row.id);`,
    '}',
  ].join('\n');

const captureOrgId = [
  'if (pm.response.code >= 200 && pm.response.code < 300) {',
  '  const json = pm.response.json();',
  '  const row = Array.isArray(json) ? json[0] : json;',
  '  if (row?.id) pm.collectionVariables.set("orgId", row.id);',
  '}',
].join('\n');

const bearer = (tokenVar) => ({
  type: 'bearer',
  bearer: [{ key: 'token', value: `{{${tokenVar}}}`, type: 'string' }],
});

const noauth = { type: 'noauth' };

const url = (path, query = []) => {
  const raw = `{{baseUrl}}${path}`;
  const pathParts = path.replace(/^\//, '').split('/').filter(Boolean);
  const item = {
    raw,
    host: ['{{baseUrl}}'],
    path: pathParts,
  };
  if (query.length) {
    item.query = query.map(([key, value, description]) => ({
      key,
      value,
      description,
    }));
  }
  return item;
};

const jsonBody = (obj) => ({
  mode: 'raw',
  raw: JSON.stringify(obj, null, 2),
  options: { raw: { language: 'json' } },
});

const request = ({ name, method, path, description, auth, body, query, test }) => {
  const item = {
    name,
    request: {
      method,
      header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      url: url(path, query),
      description: description || '',
    },
  };
  if (auth) item.request.auth = auth;
  if (body) item.request.body = jsonBody(body);
  if (test) {
    item.event = [
      {
        listen: 'test',
        script: { type: 'text/javascript', exec: test.split('\n') },
      },
    ];
  }
  return item;
};

const folder = (name, description, auth, items) => {
  const item = { name, description, item: items };
  if (auth) item.auth = auth;
  return item;
};

const collection = {
  info: {
    _postman_id: id(),
    name: 'Explore College API',
    description: [
      'All current Explore College APIs (public site, applicant, org admin, faculty/staff portal, and super admin).',
      '',
      '**Setup**',
      '1. Import this collection into Postman.',
      '2. Set `baseUrl` to `http://localhost:5050` (no trailing slash).',
      '3. Run the matching **Login** request in each folder first — tests save Bearer tokens into collection variables.',
      '',
      'Seeded local accounts (password comes from `ADMIN_PASSWORD` / `PLATFORM_PASSWORD` in `backend/.env`):',
      '- Super admin: `platform@explore.app` at `POST /api/platform/login`',
      '- Org admin: `admin@explorecollege.org` at `POST /api/admin/login`',
      '- Faculty: `faculty@explorecollege.org` at `POST /api/staff/login`',
      '',
      'Replace `:id` path variables (`orgId`, `classId`, and the rest) after list/create calls. Several list requests capture the first row id automatically.',
      '',
      'Auth is `Authorization: Bearer <token>` on every protected route.',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5050' },
    { key: 'platformToken', value: '' },
    { key: 'adminToken', value: '' },
    { key: 'staffToken', value: '' },
    { key: 'applicantToken', value: '' },
    { key: 'orgId', value: '' },
    { key: 'userId', value: '' },
    { key: 'adminId', value: '' },
    { key: 'facultyId', value: '' },
    { key: 'courseId', value: '' },
    { key: 'unitId', value: '' },
    { key: 'personId', value: '' },
    { key: 'classId', value: '' },
    { key: 'slotId', value: '' },
    { key: 'contentId', value: '' },
    { key: 'sessionId', value: '' },
    { key: 'applicationId', value: '' },
    { key: 'careerId', value: '' },
    { key: 'departmentId', value: '' },
    { key: 'moduleId', value: '' },
    { key: 'planId', value: '' },
    { key: 'invoiceId', value: '' },
    { key: 'auditId', value: '' },
    { key: 'platformEmail', value: 'platform@explore.app' },
    { key: 'platformPassword', value: 'change-this-platform-password' },
    { key: 'adminEmail', value: 'admin@explorecollege.org' },
    { key: 'adminPassword', value: 'change-this-admin-password' },
    { key: 'staffEmail', value: 'faculty@explorecollege.org' },
    { key: 'staffPassword', value: 'change-this-admin-password' },
    { key: 'applicantEmail', value: 'applicant@example.com' },
    { key: 'applicantPassword', value: 'password123' },
  ],
  item: [
    folder('Health', 'Process check. No auth.', noauth, [
      request({
        name: 'Health',
        method: 'GET',
        path: '/api/health',
        description: 'Postgres and Redis status.',
        auth: noauth,
      }),
    ]),

    folder('Public', 'Campus website. No auth. Uses the public organisation.', noauth, [
      request({ name: 'Public settings', method: 'GET', path: '/api/settings', auth: noauth }),
      request({
        name: 'List faculty',
        method: 'GET',
        path: '/api/faculty',
        auth: noauth,
        query: [['department', '', 'Optional department filter']],
        test: captureFirstId('facultyId'),
      }),
      request({ name: 'Get faculty member', method: 'GET', path: '/api/faculty/{{facultyId}}', auth: noauth }),
      request({
        name: 'List courses',
        method: 'GET',
        path: '/api/courses',
        auth: noauth,
        query: [['category', '', 'Optional category filter']],
        test: captureFirstId('courseId'),
      }),
      request({ name: 'Get course', method: 'GET', path: '/api/courses/{{courseId}}', auth: noauth }),
      request({ name: 'List news', method: 'GET', path: '/api/news', auth: noauth }),
      request({ name: 'List careers', method: 'GET', path: '/api/careers', auth: noauth, test: captureFirstId('careerId') }),
      request({
        name: 'Submit contact',
        method: 'POST',
        path: '/api/contact',
        auth: noauth,
        body: {
          name: 'Sara Ahmed',
          email: 'sara@example.com',
          phone: '03001234567',
          subject: 'General Inquiry',
          message: 'I would like information about admissions.',
        },
      }),
      request({
        name: 'List contacts',
        method: 'GET',
        path: '/api/contact',
        description: 'Currently unauthenticated. Returns every inquiry.',
        auth: noauth,
      }),
    ]),

    folder('Applicant', 'Student apply flow. Token from register or login.', bearer('applicantToken'), [
      request({
        name: 'Register',
        method: 'POST',
        path: '/api/auth/register',
        description: 'Creates an applicant on the public organisation. Admissions must be open.',
        auth: noauth,
        body: {
          name: 'New Applicant',
          email: '{{applicantEmail}}',
          password: '{{applicantPassword}}',
        },
        test: loginTest('applicantToken'),
      }),
      request({
        name: 'Login',
        method: 'POST',
        path: '/api/auth/login',
        auth: noauth,
        body: { email: '{{applicantEmail}}', password: '{{applicantPassword}}' },
        test: loginTest('applicantToken'),
      }),
      request({ name: 'Me', method: 'GET', path: '/api/auth/me' }),
      request({
        name: 'My application',
        method: 'GET',
        path: '/api/applications/me',
        description: 'Requires admissions module. Upserts a draft application.',
      }),
    ]),

    folder('Org admin', 'Organisation desk at /org-admin. Bearer adminToken.', bearer('adminToken'), [
      request({
        name: 'Login',
        method: 'POST',
        path: '/api/admin/login',
        auth: noauth,
        body: { email: '{{adminEmail}}', password: '{{adminPassword}}' },
        test: loginTest('adminToken'),
      }),
      request({ name: 'Me', method: 'GET', path: '/api/admin/me' }),
      request({
        name: 'Change password',
        method: 'PUT',
        path: '/api/admin/password',
        description: 'Fails if newPassword equals currentPassword. Change newPassword before sending.',
        body: { currentPassword: '{{adminPassword}}', newPassword: '{{adminPassword}}' },
      }),
      request({ name: 'Dashboard', method: 'GET', path: '/api/admin/dashboard' }),
      request({
        name: 'Update admissions setting',
        method: 'PUT',
        path: '/api/admin/settings',
        description: 'Requires admissions module.',
        body: { admissionsOpen: true },
      }),
      request({
        name: 'Update brand',
        method: 'PUT',
        path: '/api/admin/brand',
        body: { title: 'Explore', tagline: 'Nursing & Allied Health' },
      }),
      request({
        name: 'Upload logo',
        method: 'POST',
        path: '/api/admin/brand/logo',
        description: 'JSON body, not multipart. `logo` is a data URL (png/jpeg/webp/gif, max ~2mb request).',
        body: { logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
      }),
      request({ name: 'Organisation scheme', method: 'GET', path: '/api/admin/scheme' }),
      request({ name: 'List departments', method: 'GET', path: '/api/admin/units', test: captureFirstId('unitId') }),
      request({
        name: 'Create department',
        method: 'POST',
        path: '/api/admin/units',
        body: { name: 'Radiology', description: 'Imaging', sortOrder: 10, active: true },
        test: captureFirstId('unitId'),
      }),
      request({
        name: 'Update department',
        method: 'PUT',
        path: '/api/admin/units/{{unitId}}',
        body: { name: 'Radiology', description: 'X-ray, CT, MRI', active: true },
      }),
      request({ name: 'Delete department', method: 'DELETE', path: '/api/admin/units/{{unitId}}' }),
      request({
        name: 'List users',
        method: 'GET',
        path: '/api/admin/users',
        description: 'Requires faculty module.',
        test: captureFirstId('userId'),
      }),
      request({
        name: 'Create user',
        method: 'POST',
        path: '/api/admin/users',
        description: 'Roles: reader, officer, teacher (teacher is education only).',
        body: {
          name: 'Campus Officer',
          email: 'officer@explorecollege.org',
          password: 'password123',
          role: 'officer',
        },
        test: captureFirstId('userId'),
      }),
      request({
        name: 'Update user',
        method: 'PUT',
        path: '/api/admin/users/{{userId}}',
        body: { name: 'Campus Officer', email: 'officer@explorecollege.org', role: 'officer' },
      }),
      request({
        name: 'Block user',
        method: 'PUT',
        path: '/api/admin/users/{{userId}}/block',
        body: { blocked: true },
      }),
      request({
        name: 'Reset user password',
        method: 'PUT',
        path: '/api/admin/users/{{userId}}/password',
        body: { newPassword: 'password123' },
      }),
      request({ name: 'Delete user', method: 'DELETE', path: '/api/admin/users/{{userId}}' }),
      request({
        name: 'List student attendance',
        method: 'GET',
        path: '/api/admin/attendance',
        query: [
          ['kind', 'student', 'student or staff'],
          ['date', '2026-08-16', 'YYYY-MM-DD'],
        ],
        test: captureFirstId('personId'),
      }),
      request({
        name: 'List staff attendance',
        method: 'GET',
        path: '/api/admin/attendance',
        query: [
          ['kind', 'staff', 'student or staff'],
          ['date', '2026-08-16', 'YYYY-MM-DD'],
        ],
      }),
      request({
        name: 'Add attendance person',
        method: 'POST',
        path: '/api/admin/attendance/people',
        body: {
          kind: 'student',
          name: 'Ayesha Khan',
          title: 'Generic Nursing (BSN)',
          email: 'ayesha@example.com',
          unitId: '{{unitId}}',
          active: true,
        },
        test: captureFirstId('personId'),
      }),
      request({
        name: 'Update attendance person',
        method: 'PUT',
        path: '/api/admin/attendance/people/{{personId}}',
        body: { name: 'Ayesha Khan', title: 'Generic Nursing (BSN)', unitId: '{{unitId}}', active: true },
      }),
      request({
        name: 'Save attendance day',
        method: 'PUT',
        path: '/api/admin/attendance',
        body: {
          kind: 'student',
          date: '2026-08-16',
          marks: [{ personId: '{{personId}}', status: 'present' }],
        },
      }),
      request({ name: 'Delete attendance person', method: 'DELETE', path: '/api/admin/attendance/people/{{personId}}' }),
      request({
        name: 'Teaching desk',
        method: 'GET',
        path: '/api/admin/teaching',
        description: 'Classes, timetable, teachers, and students. Requires faculty module.',
        test: [
          'if (pm.response.code >= 200 && pm.response.code < 300) {',
          '  const json = pm.response.json();',
          '  if (json.classes?.[0]?.id) pm.collectionVariables.set("classId", json.classes[0].id);',
          '  if (json.slots?.[0]?.id) pm.collectionVariables.set("slotId", json.slots[0].id);',
          '  if (json.teachers?.[0]?.id) pm.collectionVariables.set("userId", json.teachers[0].id);',
          '  if (json.students?.[0]?.id) pm.collectionVariables.set("personId", json.students[0].id);',
          '}',
        ].join('\n'),
      }),
      request({
        name: 'Create class',
        method: 'POST',
        path: '/api/admin/classes',
        body: {
          name: 'BSN Year 1',
          code: 'BSN-Y1',
          room: 'Hall A',
          teacherId: '{{userId}}',
          courseId: '{{courseId}}',
          active: true,
        },
        test: captureFirstId('classId'),
      }),
      request({
        name: 'Update class',
        method: 'PUT',
        path: '/api/admin/classes/{{classId}}',
        body: { name: 'BSN Year 1', code: 'BSN-Y1', room: 'Hall A', active: true },
      }),
      request({
        name: 'Set class enrollments',
        method: 'PUT',
        path: '/api/admin/classes/{{classId}}/enrollments',
        body: { personIds: ['{{personId}}'] },
      }),
      request({ name: 'Delete class', method: 'DELETE', path: '/api/admin/classes/{{classId}}' }),
      request({
        name: 'Create timetable slot',
        method: 'POST',
        path: '/api/admin/timetable',
        description: 'dayOfWeek 1=Monday … 7=Sunday. Times are HH:MM 24h.',
        body: {
          classId: '{{classId}}',
          teacherId: '{{userId}}',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '10:30',
          room: 'Hall A',
        },
        test: captureFirstId('slotId'),
      }),
      request({
        name: 'Update timetable slot',
        method: 'PUT',
        path: '/api/admin/timetable/{{slotId}}',
        body: { dayOfWeek: 1, startTime: '09:00', endTime: '11:00', room: 'Hall A' },
      }),
      request({ name: 'Delete timetable slot', method: 'DELETE', path: '/api/admin/timetable/{{slotId}}' }),
      request({
        name: 'Create career opening',
        method: 'POST',
        path: '/api/careers',
        description: 'Admin + careers module. Public GET lives in the Public folder.',
        body: {
          title: 'Staff Nurse',
          desc: 'Full-time nursing post on the ward.',
          type: 'Full-Time',
        },
        test: captureFirstId('careerId'),
      }),
      request({
        name: 'Update career opening',
        method: 'PUT',
        path: '/api/careers/{{careerId}}',
        body: { title: 'Staff Nurse', desc: 'Updated description.', type: 'Full-Time' },
      }),
      request({ name: 'Delete career opening', method: 'DELETE', path: '/api/careers/{{careerId}}' }),
      request({
        name: 'List applications',
        method: 'GET',
        path: '/api/applications',
        description: 'Admin, officer, or reader with admissions module.',
        test: captureFirstId('applicationId'),
      }),
      request({
        name: 'Decide application',
        method: 'PATCH',
        path: '/api/applications/{{applicationId}}/decision',
        description: 'Admin or officer. decision: accepted | rejected.',
        body: { decision: 'accepted' },
      }),
    ]),

    folder('Faculty portal', 'Staff at /faculty-portal. Teacher routes need role teacher.', bearer('staffToken'), [
      request({
        name: 'Login',
        method: 'POST',
        path: '/api/staff/login',
        auth: noauth,
        body: { email: '{{staffEmail}}', password: '{{staffPassword}}' },
        test: loginTest('staffToken'),
      }),
      request({ name: 'Me', method: 'GET', path: '/api/staff/me' }),
      request({
        name: 'Change password',
        method: 'PUT',
        path: '/api/staff/password',
        body: { currentPassword: '{{staffPassword}}', newPassword: '{{staffPassword}}' },
      }),
      request({
        name: 'Teaching',
        method: 'GET',
        path: '/api/staff/teaching',
        description: 'Faculty member only.',
        test: [
          'if (pm.response.code >= 200 && pm.response.code < 300) {',
          '  const json = pm.response.json();',
          '  const cls = json.classes?.[0];',
          '  if (cls?.id) pm.collectionVariables.set("classId", cls.id);',
          '  if (cls?.contents?.[0]?.id) pm.collectionVariables.set("contentId", cls.contents[0].id);',
          '  if (cls?.slots?.[0]?.id) pm.collectionVariables.set("slotId", cls.slots[0].id);',
          '  if (json.slots?.[0]?.id) pm.collectionVariables.set("slotId", json.slots[0].id);',
          '}',
        ].join('\n'),
      }),
      request({
        name: 'Create course content',
        method: 'POST',
        path: '/api/staff/classes/{{classId}}/content',
        body: { title: 'Week 1 notes', body: 'Introduction to the unit.', week: 1 },
        test: captureFirstId('contentId'),
      }),
      request({
        name: 'Update course content',
        method: 'PUT',
        path: '/api/staff/content/{{contentId}}',
        body: { title: 'Week 1 notes', body: 'Updated notes.', week: 1 },
      }),
      request({ name: 'Delete course content', method: 'DELETE', path: '/api/staff/content/{{contentId}}' }),
      request({
        name: 'Open attendance session',
        method: 'POST',
        path: '/api/staff/classes/{{classId}}/sessions',
        body: { date: '2026-08-16', slotId: '{{slotId}}' },
        test: [
          'if (pm.response.code >= 200 && pm.response.code < 300) {',
          '  const json = pm.response.json();',
          '  if (json.id) pm.collectionVariables.set("sessionId", json.id);',
          '  if (json.session?.id) pm.collectionVariables.set("sessionId", json.session.id);',
          '}',
        ].join('\n'),
      }),
      request({ name: 'Get session', method: 'GET', path: '/api/staff/sessions/{{sessionId}}' }),
      request({ name: 'Refresh session QR', method: 'PUT', path: '/api/staff/sessions/{{sessionId}}/qr', body: {} }),
      request({
        name: 'Mark session attendance',
        method: 'PUT',
        path: '/api/staff/sessions/{{sessionId}}/marks',
        body: { personId: '{{personId}}', status: 'present' },
      }),
      request({ name: 'Close session', method: 'PUT', path: '/api/staff/sessions/{{sessionId}}/close', body: {} }),
    ]),

    folder('Super admin', 'Control plane at /x7k2m9q4p8n3. Bearer platformToken.', bearer('platformToken'), [
      request({
        name: 'Login',
        method: 'POST',
        path: '/api/platform/login',
        auth: noauth,
        body: { email: '{{platformEmail}}', password: '{{platformPassword}}' },
        test: loginTest('platformToken'),
      }),
      request({ name: 'Me', method: 'GET', path: '/api/platform/me' }),
      request({
        name: 'Change password',
        method: 'PUT',
        path: '/api/platform/password',
        body: { currentPassword: '{{platformPassword}}', newPassword: '{{platformPassword}}' },
      }),
      request({ name: 'Dashboard', method: 'GET', path: '/api/platform/dashboard' }),
      request({ name: 'Catalog (departments, modules, schemes)', method: 'GET', path: '/api/platform/catalog' }),
      request({
        name: 'List product departments',
        method: 'GET',
        path: '/api/platform/departments',
        test: captureFirstId('departmentId'),
      }),
      request({
        name: 'Create product department',
        method: 'POST',
        path: '/api/platform/departments',
        body: { name: 'Clinical services', slug: 'clinical-services', description: '', sortOrder: 10, active: true },
        test: captureFirstId('departmentId'),
      }),
      request({
        name: 'Update product department',
        method: 'PUT',
        path: '/api/platform/departments/{{departmentId}}',
        body: { name: 'Clinical services', description: 'Hospital product group', active: true },
      }),
      request({
        name: 'List product modules',
        method: 'GET',
        path: '/api/platform/modules',
        test: captureFirstId('moduleId'),
      }),
      request({
        name: 'Create product module',
        method: 'POST',
        path: '/api/platform/modules',
        body: {
          name: 'Ward roster',
          slug: 'ward-roster',
          description: '',
          departmentId: '{{departmentId}}',
          sortOrder: 10,
          active: true,
        },
        test: captureFirstId('moduleId'),
      }),
      request({
        name: 'Update product module',
        method: 'PUT',
        path: '/api/platform/modules/{{moduleId}}',
        body: { name: 'Ward roster', description: 'Duty roster', active: true, departmentId: '{{departmentId}}' },
      }),
      request({
        name: 'List organisations',
        method: 'GET',
        path: '/api/platform/organizations',
        test: captureOrgId,
      }),
      request({
        name: 'Create organisation',
        method: 'POST',
        path: '/api/platform/organizations',
        description: 'kind is required: education | hospital. Empty departments/modules load scheme defaults and seed org units.',
        body: {
          kind: 'hospital',
          name: 'City General Hospital',
          slug: 'city-general',
          email: 'hello@citygeneral.example',
          phone: '',
          status: 'active',
          isPublic: false,
          departments: [],
          modules: [],
        },
        test: captureFirstId('orgId'),
      }),
      request({ name: 'Get organisation', method: 'GET', path: '/api/platform/organizations/{{orgId}}' }),
      request({
        name: 'Update organisation',
        method: 'PUT',
        path: '/api/platform/organizations/{{orgId}}',
        body: {
          name: 'City General Hospital',
          slug: 'city-general',
          email: 'hello@citygeneral.example',
          kind: 'hospital',
          status: 'active',
          isPublic: false,
          suspendOnOverdue: false,
          notes: '',
        },
      }),
      request({
        name: 'Create org admin',
        method: 'POST',
        path: '/api/platform/organizations/{{orgId}}/admins',
        body: { name: 'Hospital Admin', email: 'admin@citygeneral.example', password: 'password123' },
        test: captureFirstId('adminId'),
      }),
      request({
        name: 'Block org admin',
        method: 'PUT',
        path: '/api/platform/organizations/{{orgId}}/admins/{{adminId}}/block',
        body: { blocked: false },
      }),
      request({
        name: 'Reset org admin password',
        method: 'PUT',
        path: '/api/platform/organizations/{{orgId}}/admins/{{adminId}}/password',
        body: { newPassword: 'password123' },
      }),
      request({ name: 'List plans', method: 'GET', path: '/api/platform/plans', test: captureFirstId('planId') }),
      request({ name: 'Billing overview', method: 'GET', path: '/api/platform/billing' }),
      request({ name: 'Organisation billing', method: 'GET', path: '/api/platform/organizations/{{orgId}}/billing' }),
      request({
        name: 'Upsert subscription',
        method: 'PUT',
        path: '/api/platform/organizations/{{orgId}}/subscription',
        body: {
          planId: '{{planId}}',
          status: 'active',
          amountCents: 34900,
          interval: 'month',
          notes: '',
        },
      }),
      request({
        name: 'Create invoice',
        method: 'POST',
        path: '/api/platform/organizations/{{orgId}}/invoices',
        body: { amountCents: 34900, status: 'paid', method: 'bank', notes: '' },
        test: captureFirstId('invoiceId'),
      }),
      request({
        name: 'Generate invoice from modules',
        method: 'POST',
        path: '/api/platform/organizations/{{orgId}}/invoices/generate',
        body: { status: 'open', method: 'invoice', notes: '' },
      }),
      request({
        name: 'Update invoice',
        method: 'PUT',
        path: '/api/platform/organizations/{{orgId}}/invoices/{{invoiceId}}',
        body: { status: 'paid', method: 'bank' },
      }),
      request({
        name: 'List audit',
        method: 'GET',
        path: '/api/platform/audit',
        query: [
          ['page', '1', ''],
          ['limit', '25', '10–100'],
          ['organization', '{{orgId}}', 'Optional org id'],
          ['method', '', 'GET, POST, PUT, PATCH, DELETE'],
          ['q', '', 'Search url or method'],
        ],
        test: [
          'if (pm.response.code >= 200 && pm.response.code < 300) {',
          '  const json = pm.response.json();',
          '  const row = json.items?.[0] || json.logs?.[0] || (Array.isArray(json) ? json[0] : null);',
          '  if (row?.id) pm.collectionVariables.set("auditId", row.id);',
          '}',
        ].join('\n'),
      }),
      request({ name: 'Get audit entry', method: 'GET', path: '/api/platform/audit/{{auditId}}' }),
    ]),
  ],
};

const out = join(dirname(fileURLToPath(import.meta.url)), 'Explore.postman_collection.json');
writeFileSync(out, `${JSON.stringify(collection, null, 2)}\n`);
console.log(`Wrote ${out}`);
