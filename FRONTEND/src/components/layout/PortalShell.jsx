import { IMG } from "../../data/appData.js";
import { Logo, ThemeToggle } from "../common/SharedUi.jsx";
import { fullName, initials } from "../../utils/appUtils.jsx";

export function Shell({ d, nav, page, setPage, children }) {
  const u = d.me,
    sa = u.role === "Super Admin";
  return (
    <div className="app">
      <aside className={`side ${sa ? "sa" : ""}`}>
        <button
          type="button"
          className="brand brand-link"
          aria-label="Go to dashboard"
          onClick={() => setPage(sa ? "Overview" : "Dashboard")}
        >
          <Logo />
          <span>
            <b>Campus Serve</b>
            <small>{u.role} Portal</small>
          </span>
        </button>
        <button
          type="button"
          className="prof profile-link"
          title="Open my profile"
          onClick={() => setPage("My Profile")}
        >
          <span className="av">{initials(u)}</span>
          <span>
            <b>{fullName(u)}</b>
            <small>{u.college}</small>
          </span>
        </button>
        <nav className="nav">
          <span className="nh">WORKSPACE</span>
          {nav.map(([label, count]) => (
            <button
              key={label}
              type="button"
              className={`ni ${page === label ? "on" : ""}`}
              onClick={() => setPage(label)}
            >
              {label}
              {count > 0 && <em>{count}</em>}
            </button>
          ))}
        </nav>
        <div className="sb">
          <div
            className="sidepic"
            style={{ backgroundImage: `url(${IMG.campus})` }}
          >
            <b>Make an impact</b>
            <small>Every activity is a step toward a stronger community.</small>
          </div>
          <button
            type="button"
            className="btn out sm full"
            style={{ marginTop: 12 }}
            onClick={d.logout}
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="top">
          <div>
            <div className="bc">
              Campus Serve / {u.role} / {page}
            </div>
            <h1>{page}</h1>
          </div>
          <div className="tr">
            <ThemeToggle theme={d.theme} setTheme={d.setTheme} />
            <button
              type="button"
              className="av avbtn"
              title="Open my profile"
              aria-label="Open my profile"
              onClick={() => setPage("My Profile")}
            >
              {initials(u)}
            </button>
          </div>
        </header>
        {children}
        <footer className="foot">
          <span>Campus Serve</span>
          <span>
            Western Mindanao State University · {new Date().getFullYear()}
          </span>
        </footer>
      </main>
    </div>
  );
}

/* ---------- profile (all roles) ---------- */
