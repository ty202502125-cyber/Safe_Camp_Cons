import { useState } from "react";

export default function InitialPasswordForm({ d }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    if (form.password !== form.confirmPassword) {
      setBusy(false);
      setError("The passwords do not match.");
      return;
    }
    try {
      await d.changePassword(form.currentPassword, form.password);
      d.flash("Temporary password changed. Your account is ready.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-side" style={{ gridColumn: "1 / -1" }}>
        <div className="card auth-box">
          <h2>Set your new password</h2>
          <p className="sub">
            Your account was created with a temporary password. Change it to
            continue to Campus Serve.
          </p>
          <form className="f" onSubmit={submit}>
            <label className="w">
              Temporary password
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label className="w">
              New password
              <input
                name="password"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="w">
              Confirm new password
              <input
                name="confirmPassword"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>
            {error && <div className="err" role="alert">{error}</div>}
            <button className="btn full" disabled={busy}>
              {busy ? "Updating…" : "Change password"}
            </button>
          </form>
          <button type="button" className="tb" onClick={d.logout}>
            Log out
          </button>
        </div>
      </section>
    </div>
  );
}
