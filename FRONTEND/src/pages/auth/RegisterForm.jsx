import { useState } from "react";
import { nid } from "../../utils/appUtils.jsx";

export default function RegisterForm({ d, studentColleges }) {
  const [error, setError] = useState("");

  function register(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.target));
    const email = form.email.trim().toLowerCase();
    const idNumber = form.idno.trim();

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
    if (d.users.some((user) => user.email.toLowerCase() === email)) {
      setError("An account with this email already exists.");
      return;
    }
    if (
      d.users.some((user) => user.idno.toLowerCase() === idNumber.toLowerCase())
    ) {
      setError("An account with this ID number already exists.");
      return;
    }

    const newUser = {
      id: nid(d.users),
      role: "User",
      last: form.last.trim(),
      first: form.first.trim(),
      mi: form.mi.trim().replace(/\./g, ""),
      idno: idNumber,
      email,
      college: form.college,
      pw: form.pw,
      status: "Active",
    };

    d.setUsers([...d.users, newUser]);
    d.setMeId(newUser.id);
  }

  return (
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
          Middle initial <span className="opt">(optional)</span>
          <input name="mi" maxLength={2} />
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
          <input name="pw" type="password" minLength={8} required />
        </label>
        <label>
          Confirm password
          <input name="pw2" type="password" minLength={8} required />
        </label>
        {error && <div className="err">{error}</div>}
        <button className="btn full" style={{ gridColumn: "1 / -1" }}>
          Create account
        </button>
      </form>
    </>
  );
}
