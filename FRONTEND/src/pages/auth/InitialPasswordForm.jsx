import { useState } from "react";

function PasswordField({ label, name, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="w">
      {label}
      <div style={{ position: "relative" }}>
        <input
          name={name}
          type={visible ? "text" : "password"}
          style={{ paddingRight: "44px" }}
          {...inputProps}
        />
        <button
          type="button"
          className="tb"
          onClick={() => setVisible((value) => !value)}
          style={{
            position: "absolute",
            right: "6px",
            top: "50%",
            transform: "translateY(-50%)",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94" />
              <path d="M1 1l22 22" />
              <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a21.8 21.8 0 0 1-4.17 5.19" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s3-8 11-8 11 8 11 8-3 8-11 8S1 12 1 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}

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
            <PasswordField
              label="Temporary password"
              name="currentPassword"
              autoComplete="current-password"
              required
            />
            <PasswordField
              label="New password"
              name="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
            <PasswordField
              label="Confirm new password"
              name="confirmPassword"
              minLength={8}
              autoComplete="new-password"
              required
            />
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
