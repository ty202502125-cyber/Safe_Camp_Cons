import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import "./App.css";
import {
  AuthScreen,
  seedActs,
  seedEnr,
  seedOrganizations,
  useStored,
} from "./shared/appCommon.jsx";
import SuperAdminPage from "./pages/super-admin/SuperAdminPage.jsx";
import AdminPage from "./pages/admin/AdminPage.jsx";
import StudentPage from "./pages/student/StudentPage.jsx";
import InitialPasswordForm from "./pages/auth/InitialPasswordForm.jsx";
import { authApi, userApi } from "./services/api.js";

export default function App() {
  const [users, setUsers] = useState([]);
  const [me, setMe] = useState(null);
  const [activities, setActivities] = useStored(
    "campus_serve_activities",
    seedActs,
    "activities",
    Boolean(me && !me.mustChangePassword),
  );
  const [enrollments, setEnrollments] = useStored(
    "campus_serve_enrollments",
    seedEnr,
    "enrollments",
    Boolean(me && !me.mustChangePassword),
  );
  const [organizations, setOrganizations] = useStored(
    "campus_serve_organizations",
    seedOrganizations,
    "organizations",
    Boolean(me && !me.mustChangePassword),
  );
  const [academicYears, setAcademicYears] = useStored(
    "campus_serve_academic_years",
    [],
    "academicYears",
    Boolean(me && !me.mustChangePassword),
  );
  const [eligibleColleges, setEligibleColleges] = useState([]);
  const [booting, setBooting] = useState(true);
  const [theme, setTheme] = useStored("campus_serve_theme", "light");
  const [notice, setNotice] = useState(null);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const refreshUsers = useCallback(async () => {
    try {
      setUsers(await userApi.list());
    } catch (error) {
      console.error("Could not load accounts:", error.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await authApi.me();
        if (active) {
          setMe(session.user);
          if (!session.user.mustChangePassword) await refreshUsers();
        }
      } catch {
        // No active session; the sign-in screen will be shown.
      }
      if (!active) return;
      try {
        setEligibleColleges(await userApi.eligibleColleges());
      } catch (error) {
        console.error("Could not load eligible colleges:", error.message);
      }
      if (active) setBooting(false);
    })();
    return () => {
      active = false;
    };
  }, [refreshUsers]);

  function showNotice(message, isError = false) {
    setNotice({ message, isError });
    window.setTimeout(() => setNotice(null), 3200);
  }

  async function signIn(email, password) {
    const session = await authApi.login(email, password);
    setMe(session.user);
    if (!session.user.mustChangePassword) await refreshUsers();
    return session.user;
  }

  async function requestSignupCode(email) {
    return authApi.requestSignupCode(email);
  }

  async function register(details) {
    const session = await authApi.register(details);
    setMe(session.user);
    await refreshUsers();
    return session.user;
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Sign out failed:", error.message);
    }
    setMe(null);
    setUsers([]);
  }

  async function createUser(details) {
    const result = await userApi.create(details);
    await refreshUsers();
    return result;
  }

  async function resendAdminPassword(email, password) {
    return userApi.resendPassword(email, password);
  }

  async function setUserStatus(id, status) {
    await userApi.updateStatus(id, status);
    await refreshUsers();
  }

  async function removeUser(id) {
    await userApi.remove(id);
    await refreshUsers();
  }

  const appData = {
    users,
    me,
    login: signIn,
    register,
    requestSignupCode,
    logout,
    changePassword: async (currentPassword, newPassword) => {
      const session = await authApi.changePassword(
        currentPassword,
        newPassword,
      );
      setMe(session.user);
      return session;
    },
    createUser,
    resendAdminPassword,
    setUserStatus,
    removeUser,
    eligibleColleges,
    acts: activities,
    setActs: setActivities,
    enr: enrollments,
    setEnr: setEnrollments,
    organizations,
    setOrganizations,
    academicYears,
    setAcademicYears,
    flash: showNotice,
    theme,
    setTheme,
  };

  if (booting)
    return (
      <div className="auth">
        <p className="sub">Loading Campus Serve…</p>
      </div>
    );

  return (
    <>
      {notice && (
        <div
          className={`toast fx ${notice.isError ? "bad" : ""}`}
          role="status"
        >
          {notice.message}
        </div>
      )}
      {!me ? (
        <AuthScreen d={appData} />
      ) : me.mustChangePassword ? (
        <InitialPasswordForm d={appData} />
      ) : me.role === "Super Admin" ? (
        <SuperAdminPage d={appData} />
      ) : me.role === "Admin" ? (
        <AdminPage d={appData} />
      ) : (
        <StudentPage d={appData} />
      )}
    </>
  );
}
