import { useState } from "react";

export default function RegisterForm({ d, studentColleges }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [stage, setStage] = useState("details");
  const [pending, setPending] = useState(null);
  const [code, setCode] = useState("");

  async function register(event) {
    event.preventDefault();
    setError("");
    const form = Object.fromEntries(new FormData(event.target));
    const email = form.email.trim().toLowerCase();

    if (!/^[^\s@]+@wmsu\.edu\.ph$/.test(email)) {
      setError("Please use your WMSU email address.");
      return;
    }
    if (!studentColleges.includes(form.college)) {
      setError("Choose a college with an active Admin.");
      return;
    }
    if (form.pw !== form.pw2) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const result = await d.requestSignupCode(email);
      setPending({
        email,
        password: form.pw,
        last: form.last.trim(),
        first: form.first.trim(),
        mi: form.mi.trim(),
        idno: form.idno.trim(),
        college: form.college,
      });
      setCode("");
      setStage("verify");
      d.flash(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(event) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code sent to your email.");
      return;
    }
    setBusy(true);
    try {
      await d.register({ ...pending, code });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setError("");
    setBusy(true);
    try {
      const result = await d.requestSignupCode(pending.email);
      d.flash(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function backToDetails() {
    setStage("details");
    setPending(null);
    setCode("");
    setError("");
  }

  return (
    <>
      {stage === "details" ? (
        <>
          <h2>Create your student account</h2>
      <p className="sub">
        Choose your college to see its activities. Colleges appear after an
        Admin has been assigned by the Super Admin.
      </p>
      <form className="f" onSubmit={register}>
        <label>
          Last name
          <input name="last" required />
        </label>
        <label>
          First name
          <input name="first" required />
        </label>
        <label>
          Middle initial
          <input name="mi"  placeholder="Middle initial" />
        </label>
        <label>
          ID number
          <input name="idno" required placeholder="e.g. 2026-00123" />
        </label>
        <label className="w">
          WMSU email
          <input
            name="email"
            type="email"
            required
            placeholder="name@wmsu.edu.ph"
          />
        </label>
        <label className="w">
          College
          <select
            name="college"
            defaultValue=""
            required
            disabled={!studentColleges.length}
          >
            <option value="">
              {studentColleges.length
                ? "Select your college"
                : "No colleges have an active Admin yet"}
            </option>
            {studentColleges.map((college) => (
              <option key={college}>{college}</option>
            ))}
          </select>
        </label>
        <label>
          Password
          <div style={{ position: "relative" }}>
            <input
              name="pw"
              type={showPassword ? "text" : "password"}
              minLength={8}
              required
              style={{ paddingRight: "44px" }}
            />
            <button
              type="button"
              className="tb"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
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
        <label>
          Confirm password
          <div style={{ position: "relative" }}>
            <input
              name="pw2"
              type={showPassword ? "text" : "password"}
              minLength={8}
              required
              style={{ paddingRight: "44px" }}
            />
            <button
              type="button"
              className="tb"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
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
          {error && <div className="err">{error}</div>}
          <button className="btn full" style={{ gridColumn: "1 / -1" }} disabled={busy}>
            {busy ? "Sending code…" : "Send verification code"}
          </button>
        </form>
        </>
      ) : (
        <>
          <h2>Verify your WMSU email</h2>
          <p className="sub">
            We sent a six-digit code to <b>{pending.email}</b>. Enter it below to
            finish creating your student account. The code expires in 10 minutes.
            If it is not in your inbox, check Spam.
          </p>
          <form className="f" onSubmit={verify}>
            <label className="w">
              Verification code
              <input
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6-digit code"
                required
              />
            </label>
            {error && <div className="err">{error}</div>}
            <button className="btn full" style={{ gridColumn: "1 / -1" }} disabled={busy}>
              {busy ? "Verifying…" : "Verify & create account"}
            </button>
            <button type="button" className="tb" onClick={resendCode} disabled={busy}>
              Resend code
            </button>
            <button type="button" className="tb" onClick={backToDetails} disabled={busy}>
              Back to sign-up
            </button>
          </form>
        </>
      )}
    </>
  );
}
