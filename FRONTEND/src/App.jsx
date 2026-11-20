import { useLayoutEffect, useState } from "react";
import "./App.css";
import {
  AuthScreen,
  seedUsers,
  seedActs,
  seedEnr,
  seedOrganizations,
  studentHasActiveCollegeAdmin,
  useStored,
} from "./shared/appCommon.jsx";
import SuperAdminPage from "./pages/super-admin/SuperAdminPage.jsx";
import AdminPage from "./pages/admin/AdminPage.jsx";
import StudentPage from "./pages/student/StudentPage.jsx";

export default function App() {
  const [users, setUsers] = useStored("campus_serve_users", seedUsers, "users");
  const [activities, setActivities] = useStored(
    "campus_serve_activities",
    seedActs,
    "activities",
  );
  const [enrollments, setEnrollments] = useStored(
    "campus_serve_enrollments",
    seedEnr,
    "enrollments",
  );
  const [organizations, setOrganizations] = useStored(
    "campus_serve_organizations",
    seedOrganizations,
    "organizations",
  );
  const [currentUserId, setCurrentUserId] = useStored(
    "campus_serve_current_user",
    null,
  );
  const [theme, setTheme] = useStored("campus_serve_theme", "light");
  const [notice, setNotice] = useState(null);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function showNotice(message, isError = false) {
    setNotice({ message, isError });
    window.setTimeout(() => setNotice(null), 3200);
  }

  const currentUser = users.find(
    (user) =>
      user.id === currentUserId &&
      user.status === "Active" &&
      (user.role !== "User" ||
        studentHasActiveCollegeAdmin(user, users, organizations)),
  );

  const appData = {
    users,
    setUsers,
    acts: activities,
    setActs: setActivities,
    enr: enrollments,
    setEnr: setEnrollments,
    organizations,
    setOrganizations,
    flash: showNotice,
    me: currentUser,
    setMeId: setCurrentUserId,
    theme,
    setTheme,
    logout: () => setCurrentUserId(null),
  };

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
      {!currentUser ? (
        <AuthScreen d={appData} />
      ) : currentUser.role === "Super Admin" ? (
        <SuperAdminPage d={appData} />
      ) : currentUser.role === "Admin" ? (
        <AdminPage d={appData} />
      ) : (
        <StudentPage d={appData} />
      )}
    </>
  );
}
