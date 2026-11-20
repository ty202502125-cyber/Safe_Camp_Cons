import { Panel } from "../../components/common/SharedUi.jsx";
import { IMG } from "../../data/appData.js";
import { fullName, initials } from "../../utils/appUtils.jsx";

export function Profile({ d }) {
  const { me, users, setUsers, flash } = d;
  function changePw(e) {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.target));
    if (p.cur !== me.pw) return flash("Current password is incorrect.", true);
    if (p.next.length < 8)
      return flash("New password must be at least 8 characters.", true);
    if (p.next !== p.next2) return flash("New passwords do not match.", true);
    setUsers(users.map((u) => (u.id === me.id ? { ...u, pw: p.next } : u)));
    e.target.reset();
    flash("Password changed.");
  }
  return (
    <>
      <section className="card pcard">
        <div
          className="pbanner"
          style={{
            backgroundImage: `linear-gradient(120deg,rgba(77,6,18,.85),rgba(181,18,43,.45)),url(${IMG.campus})`,
          }}
        />
        <div className="pbody">
          <div className="av lg">{initials(me)}</div>
          <div className="pname">
            <h2>{fullName(me)}</h2>
            <span className={`bd ${me.role === "Super Admin" ? "gold" : "ok"}`}>
              {me.role}
            </span>
          </div>
          <div className="pinfo">
            <span>{me.college}</span>
            <span>{me.email}</span>
            <span>{me.idno}</span>
            {me.phone && <span>{me.phone}</span>}
          </div>
        </div>
      </section>
      <div className="two eq">
        <Panel
          eyebrow="MY PROFILE"
          title="Personal details"
          sub="Your account details are read-only. Contact your administrator if something needs to be corrected."
        >
          <dl className="profile-details">
            <div>
              <dt>Full name</dt>
              <dd>{fullName(me)}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{me.role}</dd>
            </div>
            <div>
              <dt>ID number</dt>
              <dd>{me.idno}</dd>
            </div>
            <div>
              <dt>WMSU email</dt>
              <dd>{me.email}</dd>
            </div>
            <div className="w">
              <dt>{me.role === "User" ? "College" : "Office / department"}</dt>
              <dd>{me.college}</dd>
            </div>
            {me.phone && (
              <div className="w">
                <dt>Contact number</dt>
                <dd>{me.phone}</dd>
              </div>
            )}
          </dl>
        </Panel>
        <Panel eyebrow="SECURITY" title="Change password">
          <form className="form" onSubmit={changePw}>
            <label className="w">
              Current password
              <input
                name="cur"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              New password
              <input
                name="next"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm new password
              <input
                name="next2"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>
            <button className="btn sm" type="submit">
              Update password
            </button>
          </form>
        </Panel>
      </div>
    </>
  );
}
