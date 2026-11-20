import { useState } from "react";
import { IMG } from "../../data/appData.js";
import { Logo, ThemeToggle } from "../../components/common/SharedUi.jsx";
import { collegeHasActiveAdmin } from "../../utils/appUtils.jsx";
import LoginForm from "./LoginForm.jsx";
import RegisterForm from "./RegisterForm.jsx";

export function AuthScreen({ d }) {
  const [view, setView] = useState("login");
  const studentColleges = d.organizations
    .filter((org) => collegeHasActiveAdmin(org.name, d.users, d.organizations))
    .map((org) => org.name);

  return (
    <div className="auth">
      <section className="auth-art photo">
        <div className="brand">
          <Logo />
          <div>
            <b>Campus Serve</b>
            <small>Western Mindanao State University · Zamboanga City</small>
          </div>
        </div>
        <ThemeToggle theme={d.theme} setTheme={d.setTheme} />
        <div>
          <h1>
            Serve. Log hours.
            <br />
            Make an impact.
          </h1>
          <p>
            Campus Serve connects students with meaningful campus and community
            service. Discover opportunities, coordinate with activity
            organizers, and build a verified record of service.
          </p>
          <div className="landing-points">
            <span>Discover approved opportunities</span>
            <span>Track service hours and attendance</span>
            <span>Earn certificates after verified completion</span>
          </div>
        </div>
        <div className="landing-gallery" aria-label="Campus and service photos">
          {[
            [IMG.campus, "Campus life"],
            [IMG.volunteer, "Community outreach"],
            [IMG.environment, "Green initiatives"],
          ].map(([image, label]) => (
            <div
              key={label}
              style={{ backgroundImage: `url(${image})` }}
              aria-label={label}
            />
          ))}
        </div>
        <small className="auth-tagline">
          A Smart Research University by 2040
        </small>
      </section>

      <section className="auth-side">
        <div className="card auth-box">
          <div className="tabs">
            <button
              type="button"
              className={view === "login" ? "on" : ""}
              onClick={() => setView("login")}
            >
              Log in
            </button>
            <button
              type="button"
              className={view === "register" ? "on" : ""}
              onClick={() => setView("register")}
            >
              Student sign-up
            </button>
          </div>
          {view === "login" ? (
            <LoginForm d={d} />
          ) : (
            <RegisterForm d={d} studentColleges={studentColleges} />
          )}
        </div>
      </section>
    </div>
  );
}

export default AuthScreen;
