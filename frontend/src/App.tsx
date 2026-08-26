import { Navigate, Routes, Route } from 'react-router-dom';
import { ADMIN_BASE, FACULTY_BASE, SUPER_BASE } from './admin/paths';
import { orgHasModule } from './auth/adminSession';
import { getStaff } from './auth/staffSession';
import { staffHome } from './data/roles';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout, { RequireAdmin } from './pages/admin/AdminLayout';
import { RequireActiveAdmin, RequireActiveStaff } from './auth/RequireActiveServices';
import ServiceSuspended from './pages/ServiceSuspended';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAdmissions from './pages/admin/AdminAdmissions';
import AdminCareers from './pages/admin/AdminCareers';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminAttendanceLocation from './pages/admin/AdminAttendanceLocation';
import AdminAttendanceSession from './pages/admin/AdminAttendanceSession';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAccess from './pages/admin/AdminAccess';
import AdminClasses from './pages/admin/AdminClasses';
import AdminTimetable from './pages/admin/AdminTimetable';
import AdminBrand from './pages/admin/AdminBrand';
import AdminUnits from './pages/admin/AdminUnits';
import AdminSettings from './pages/admin/AdminSettings';
import FacultyLogin from './pages/faculty/FacultyLogin';
import FacultyLayout, { RequireStaff } from './pages/faculty/FacultyLayout';
import FacultyAdmissions from './pages/faculty/FacultyAdmissions';
import FacultyTimetable from './pages/faculty/FacultyTimetable';
import FacultyCourses from './pages/faculty/FacultyCourses';
import FacultyAttendance from './pages/faculty/FacultyAttendance';
import FacultyPassword from './pages/faculty/FacultyPassword';
import PlatformLogin from './pages/platform/PlatformLogin';
import PlatformLayout, { RequirePlatform } from './pages/platform/PlatformLayout';
import PlatformDashboard from './pages/platform/PlatformDashboard';
import PlatformOrganizations from './pages/platform/PlatformOrganizations';
import PlatformOrgDetail from './pages/platform/PlatformOrgDetail';
import PlatformModules from './pages/platform/PlatformModules';
import PlatformBilling from './pages/platform/PlatformBilling';
import PlatformPassword from './pages/platform/PlatformPassword';
import PlatformAudit from './pages/platform/PlatformAudit';
import ApplyHome from './pages/ApplyHome';
import Apply from './pages/Apply';
import StudentLogin from './pages/StudentLogin';
import StudentHome from './pages/StudentHome';
import StudentSection from './pages/StudentSection';

function RequireModule({ slug, children }) {
  if (!orgHasModule(slug)) return <Navigate to={`${ADMIN_BASE}/dashboard`} replace />;
  return children;
}

function FacultyHomeRedirect() {
  const staff = getStaff();
  return <Navigate to={staffHome(staff?.role, staff?.modules)} replace />;
}

function App() {
  return (
    <Routes>
      <Route path={SUPER_BASE}>
        <Route index element={<PlatformLogin />} />
        <Route element={<RequirePlatform />}>
          <Route element={<PlatformLayout />}>
            <Route path="dashboard" element={<PlatformDashboard />} />
            <Route path="organizations" element={<PlatformOrganizations />} />
            <Route path="organizations/:id" element={<PlatformOrgDetail />} />
            <Route path="modules" element={<PlatformModules />} />
            <Route path="billing" element={<PlatformBilling />} />
            <Route path="audit" element={<PlatformAudit />} />
            <Route path="settings" element={<PlatformPassword />} />
            <Route path="*" element={<Navigate to={`${SUPER_BASE}/dashboard`} replace />} />
          </Route>
        </Route>
      </Route>
      <Route path={ADMIN_BASE}>
        <Route index element={<AdminLogin />} />
        <Route element={<RequireAdmin />}>
          <Route path="suspended" element={<ServiceSuspended portal="admin" />} />
          <Route element={<RequireActiveAdmin />}>
            <Route element={<AdminLayout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="admissions" element={<RequireModule slug="admissions"><AdminAdmissions /></RequireModule>} />
              <Route path="careers" element={<RequireModule slug="careers"><AdminCareers /></RequireModule>} />
              <Route path="attendance/students" element={<RequireModule slug="student-attendance"><AdminAttendance kind="student" /></RequireModule>} />
              <Route path="attendance/location" element={<RequireModule slug="student-attendance"><AdminAttendanceLocation /></RequireModule>} />
              <Route path="attendance/sessions/:sessionId" element={<RequireModule slug="student-attendance"><AdminAttendanceSession /></RequireModule>} />
              <Route path="attendance/staff" element={<RequireModule slug="staff-attendance"><AdminAttendance kind="staff" /></RequireModule>} />
              <Route path="users" element={<RequireModule slug="faculty"><AdminUsers /></RequireModule>} />
              <Route path="access" element={<RequireModule slug="faculty"><AdminAccess /></RequireModule>} />
              <Route path="classes" element={<RequireModule slug="faculty"><AdminClasses /></RequireModule>} />
              <Route path="timetable" element={<RequireModule slug="faculty"><AdminTimetable /></RequireModule>} />
              <Route path="brand" element={<AdminBrand />} />
              <Route path="units" element={<AdminUnits />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="*" element={<Navigate to={`${ADMIN_BASE}/dashboard`} replace />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path={FACULTY_BASE}>
        <Route index element={<FacultyLogin />} />
        <Route element={<RequireStaff />}>
          <Route path="suspended" element={<ServiceSuspended portal="faculty" />} />
          <Route element={<RequireActiveStaff />}>
            <Route element={<FacultyLayout />}>
              <Route path="admissions" element={<FacultyAdmissions />} />
              <Route path="timetable" element={<FacultyTimetable />} />
              <Route path="courses" element={<FacultyCourses />} />
              <Route path="attendance" element={<FacultyAttendance />} />
              <Route path="password" element={<FacultyPassword />} />
              <Route path="*" element={<FacultyHomeRedirect />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="/apply" element={<ApplyHome />} />
      <Route path="/apply/form" element={<Apply />} />
      <Route path="/apply/suspended" element={<ServiceSuspended portal="applicant" />} />
      <Route path="/admissions" element={<Navigate to="/apply" replace />} />
      <Route path="/admissions/apply" element={<Navigate to="/apply/form" replace />} />
      <Route path="/admissions/suspended" element={<Navigate to="/apply/suspended" replace />} />
      <Route path="/student" element={<StudentHome />} />
      <Route path="/student/:section" element={<StudentSection />} />
      <Route path="/login" element={<StudentLogin />} />
      <Route path="/" element={<StudentLogin />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
