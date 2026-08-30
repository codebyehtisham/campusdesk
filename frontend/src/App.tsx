import { Navigate, Routes, Route } from 'react-router-dom';
import {
  ADMISSIONS_PORTAL_BASE,
  ADMIN_BASE,
  EXAMS_PORTAL_BASE,
  FACULTY_BASE,
  FINANCE_PORTAL_BASE,
  HR_PORTAL_BASE,
  LIBRARY_PORTAL_BASE,
  SUPER_BASE,
} from './admin/paths';
import { orgHasModule } from './auth/adminSession';
import { getStaff } from './auth/staffSession';
import { staffHome } from './data/roles';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout, { RequireAdmin } from './pages/admin/AdminLayout';
import { RequireActiveAdmin, RequireActiveStaff } from './auth/RequireActiveServices';
import ServiceSuspended from './pages/ServiceSuspended';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAdmissions from './pages/admin/AdminAdmissions';
import AdminAdmissionForm from './pages/admin/AdminAdmissionForm';
import AdminCareers from './pages/admin/AdminCareers';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminAttendanceLocation from './pages/admin/AdminAttendanceLocation';
import AdminAttendanceSession from './pages/admin/AdminAttendanceSession';
import AdminAttendanceInsights from './pages/admin/AdminAttendanceInsights';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAccess from './pages/admin/AdminAccess';
import AdminClasses from './pages/admin/AdminClasses';
import AdminTimetable from './pages/admin/AdminTimetable';
import AdminBrand from './pages/admin/AdminBrand';
import AdminUnits from './pages/admin/AdminUnits';
import AdminSettings from './pages/admin/AdminSettings';
import FacultyLayout from './pages/faculty/FacultyLayout';
import FacultyAdmissions from './pages/faculty/FacultyAdmissions';
import ApplicationReview from './pages/admissions/ApplicationReview';
import FacultyTimetable from './pages/faculty/FacultyTimetable';
import FacultyCourses from './pages/faculty/FacultyCourses';
import FacultyAttendance from './pages/faculty/FacultyAttendance';
import FacultyPassword from './pages/faculty/FacultyPassword';
import StaffLoginPage from './pages/staff/StaffLoginPage';
import { StaffPortalGate } from './pages/staff/StaffPortalGate';
import AdmissionsPortalLayout from './pages/admissions/AdmissionsPortalLayout';
import HrPortalLayout from './pages/hr/HrPortalLayout';
import FinancePortalLayout from './pages/finance/FinancePortalLayout';
import FinanceHome from './pages/finance/FinanceHome';
import ExamsPortalLayout from './pages/exams/ExamsPortalLayout';
import ExamsHome from './pages/exams/ExamsHome';
import LibraryPortalLayout from './pages/library/LibraryPortalLayout';
import LibraryCatalog from './pages/library/LibraryCatalog';
import LibraryIssue from './pages/library/LibraryIssue';
import LibraryLoans from './pages/library/LibraryLoans';
import StaffLeavePage from './pages/staff/StaffLeavePage';
import HrLeaves from './pages/hr/HrLeaves';
import HrLeaveReview from './pages/hr/HrLeaveReview';
import HrLeaveQuotas from './pages/hr/HrLeaveQuotas';
import HrAttendanceCalendar from './pages/hr/HrAttendanceCalendar';
import PlatformLogin from './pages/platform/PlatformLogin';
import PlatformLayout, { RequirePlatform } from './pages/platform/PlatformLayout';
import PlatformDashboard from './pages/platform/PlatformDashboard';
import PlatformOrganizations from './pages/platform/PlatformOrganizations';
import PlatformOrgDetail from './pages/platform/PlatformOrgDetail';
import PlatformModules from './pages/platform/PlatformModules';
import PlatformBilling from './pages/platform/PlatformBilling';
import PlatformPassword from './pages/platform/PlatformPassword';
import PlatformAudit from './pages/platform/PlatformAudit';
import PlatformFeatureFlags from './pages/platform/PlatformFeatureFlags';
import PlatformUsage from './pages/platform/PlatformUsage';
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

function HrHomeRedirect() {
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
            <Route path="usage" element={<PlatformUsage />} />
            <Route path="feature-flags" element={<PlatformFeatureFlags />} />
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
            <Route path="admissions/review/:id" element={<ApplicationReview portal="admin" />} />
            <Route element={<AdminLayout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="admissions" element={<RequireModule slug="admissions"><AdminAdmissions /></RequireModule>} />
              <Route path="admissions/form" element={<RequireModule slug="admissions"><AdminAdmissionForm /></RequireModule>} />
              <Route path="careers" element={<RequireModule slug="careers"><AdminCareers /></RequireModule>} />
              <Route path="attendance/students" element={<RequireModule slug="student-attendance"><AdminAttendance kind="student" /></RequireModule>} />
              <Route path="attendance/insights" element={<RequireModule slug="student-attendance"><AdminAttendanceInsights /></RequireModule>} />
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
        <Route index element={<StaffLoginPage portal="faculty" />} />
        <Route element={<StaffPortalGate portal="faculty" />}>
          <Route path="suspended" element={<ServiceSuspended portal="faculty" />} />
          <Route element={<RequireActiveStaff />}>
            <Route element={<FacultyLayout />}>
              <Route path="timetable" element={<FacultyTimetable />} />
              <Route path="courses" element={<FacultyCourses />} />
              <Route path="attendance" element={<FacultyAttendance />} />
              <Route path="leave" element={<StaffLeavePage portalBase={FACULTY_BASE} />} />
              <Route path="password" element={<FacultyPassword />} />
              <Route path="*" element={<FacultyHomeRedirect />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path={ADMISSIONS_PORTAL_BASE}>
        <Route index element={<StaffLoginPage portal="admissions" />} />
        <Route element={<StaffPortalGate portal="admissions" />}>
          <Route path="suspended" element={<ServiceSuspended portal="faculty" />} />
          <Route element={<RequireActiveStaff />}>
            <Route path="admissions/review/:id" element={<ApplicationReview portal="staff" />} />
            <Route element={<AdmissionsPortalLayout />}>
              <Route path="admissions" element={<FacultyAdmissions />} />
              <Route path="leave" element={<StaffLeavePage portalBase={ADMISSIONS_PORTAL_BASE} />} />
              <Route path="password" element={<FacultyPassword />} />
              <Route path="*" element={<Navigate to={`${ADMISSIONS_PORTAL_BASE}/admissions`} replace />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path={HR_PORTAL_BASE}>
        <Route index element={<StaffLoginPage portal="hr" />} />
        <Route element={<StaffPortalGate portal="hr" />}>
          <Route path="suspended" element={<ServiceSuspended portal="faculty" />} />
          <Route element={<RequireActiveStaff />}>
            <Route element={<HrPortalLayout />}>
              <Route path="careers" element={<AdminCareers authScope="staff" />} />
              <Route
                path="attendance"
                element={<AdminAttendance kind="staff" authScope="staff" apiBase="/staff/hr" />}
              />
              <Route path="leave-quotas" element={<HrLeaveQuotas />} />
              <Route path="leaves" element={<HrLeaves />} />
              <Route path="leaves/:id" element={<HrLeaveReview />} />
              <Route path="calendar" element={<HrAttendanceCalendar />} />
              <Route path="leave" element={<StaffLeavePage portalBase={HR_PORTAL_BASE} />} />
              <Route path="password" element={<FacultyPassword />} />
              <Route path="*" element={<HrHomeRedirect />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path={FINANCE_PORTAL_BASE}>
        <Route index element={<StaffLoginPage portal="finance" />} />
        <Route element={<StaffPortalGate portal="finance" />}>
          <Route path="suspended" element={<ServiceSuspended portal="faculty" />} />
          <Route element={<RequireActiveStaff />}>
            <Route element={<FinancePortalLayout />}>
              <Route path="home" element={<FinanceHome />} />
              <Route path="leave" element={<StaffLeavePage portalBase={FINANCE_PORTAL_BASE} />} />
              <Route path="password" element={<FacultyPassword />} />
              <Route path="*" element={<Navigate to={`${FINANCE_PORTAL_BASE}/home`} replace />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path={EXAMS_PORTAL_BASE}>
        <Route index element={<StaffLoginPage portal="exams" />} />
        <Route element={<StaffPortalGate portal="exams" />}>
          <Route path="suspended" element={<ServiceSuspended portal="faculty" />} />
          <Route element={<RequireActiveStaff />}>
            <Route element={<ExamsPortalLayout />}>
              <Route path="home" element={<ExamsHome />} />
              <Route path="leave" element={<StaffLeavePage portalBase={EXAMS_PORTAL_BASE} />} />
              <Route path="password" element={<FacultyPassword />} />
              <Route path="*" element={<Navigate to={`${EXAMS_PORTAL_BASE}/home`} replace />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path={LIBRARY_PORTAL_BASE}>
        <Route index element={<StaffLoginPage portal="library" />} />
        <Route element={<StaffPortalGate portal="library" />}>
          <Route path="suspended" element={<ServiceSuspended portal="faculty" />} />
          <Route element={<RequireActiveStaff />}>
            <Route element={<LibraryPortalLayout />}>
              <Route path="catalog" element={<LibraryCatalog />} />
              <Route path="issue" element={<LibraryIssue />} />
              <Route path="loans" element={<LibraryLoans />} />
              <Route path="home" element={<Navigate to={`${LIBRARY_PORTAL_BASE}/catalog`} replace />} />
              <Route path="leave" element={<StaffLeavePage portalBase={LIBRARY_PORTAL_BASE} />} />
              <Route path="password" element={<FacultyPassword />} />
              <Route path="*" element={<Navigate to={`${LIBRARY_PORTAL_BASE}/catalog`} replace />} />
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
