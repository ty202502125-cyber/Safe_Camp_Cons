import { useState } from "react";
import { authApi } from "../../services/api.js";

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
            <label className="w">New password
              <input name="password" type="password" minLength={8} autoComplete="new-password" required />
            </label>
            <label className="w">Confirm new password
              <input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required />
            </label>
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
        <label className="w">Password
          <input name="pw" type="password" autoComplete="current-password" required />
        </label>
        {error && <div className="err" role="alert">{error}</div>}
        {message && <p className="sub w" role="status">{message}</p>}
        <button className="btn full" style={{ gridColumn: "1 / -1" }} disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
      <button type="button" className="tb" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Forgot password?</button>
    </>
  );
}
