import { useState } from "react";
import { authApi } from "../../services/api.js";

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

export default function LoginForm({ d }) {
  const [error, setError] = useState("");
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await d.login(form.email.trim().toLowerCase(), form.pw);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function requestCode(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const result = await authApi.requestReset(normalizedEmail);
      setEmail(normalizedEmail);
      setCodeSent(true);
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    if (form.password !== form.confirmPassword) {
      setBusy(false);
      setError("The passwords do not match.");
      return;
    }
    try {
      const result = await authApi.confirmReset(
        email,
        form.code.trim(),
        form.password,
      );
      setMode("login");
      setCodeSent(false);
      setMessage(result.message);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "forgot") {
    return (
      <>
        <h2>Reset your password</h2>
        <p className="sub">We’ll send a six-digit code to the email linked to your account.</p>
        {!codeSent ? (
          <form className="f" onSubmit={requestCode}>
            <label className="w">WMSU email
              <input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@wmsu.edu.ph" autoComplete="username" required />
            </label>
            {error && <div className="err" role="alert">{error}</div>}
            <button className="btn full" disabled={busy}>{busy ? "Sending…" : "Send reset code"}</button>
          </form>
        ) : (
          <form className="f" onSubmit={resetPassword}>
            <p className="w sub">Code sent to <strong>{email}</strong>. It expires in 10 minutes.</p>
            <label className="w">Six-digit code
              <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required />
            </label>
            <PasswordField label="New password" name="password" minLength={8} autoComplete="new-password" required />
            <PasswordField label="Confirm new password" name="confirmPassword" minLength={8} autoComplete="new-password" required />
            {error && <div className="err" role="alert">{error}</div>}
            <button className="btn full" disabled={busy}>{busy ? "Updating…" : "Reset password"}</button>
            <button type="button" className="tb w" disabled={busy} onClick={() => { setCodeSent(false); setError(""); setMessage(""); }}>Send a new code</button>
          </form>
        )}
        {message && <p className="sub" role="status">{message}</p>}
        <button type="button" className="tb" onClick={() => { setMode("login"); setError(""); setCodeSent(false); }}>Back to log in</button>
      </>
    );
  }

  return (
    <>
      <h2>Welcome back</h2>
      <p className="sub">Log in with your WMSU email. Your portal opens automatically.</p>
      <form className="f" onSubmit={login}>
        <label className="w">WMSU email
          <input name="email" type="email" placeholder="name@wmsu.edu.ph" autoComplete="username" required />
        </label>
        <PasswordField label="Password" name="pw" autoComplete="current-password" required />
        {error && <div className="err" role="alert">{error}</div>}
        {message && <p className="sub w" role="status">{message}</p>}
        <button className="btn full" style={{ gridColumn: "1 / -1" }} disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
      <button type="button" className="tb" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Forgot password?</button>
    </>
  );
}
