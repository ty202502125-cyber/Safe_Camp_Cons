import { useEffect, useState } from "react";
import { Panel } from "../../components/common/SharedUi.jsx";
import { IMG } from "../../data/appData.js";
import {
  compressActivityImage,
  displayName,
  fullName,
  initials,
} from "../../utils/appUtils.jsx";

const emptyProfile = (me) => ({
  nickname: me?.nickname || "",
  avatarData: me?.avatarData || "",
  coverData: me?.coverData || "",
});

export function Profile({ d }) {
  const { me, flash } = d;
  const [form, setForm] = useState(() => emptyProfile(me));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(emptyProfile(me));
  }, [me?.id, me?.nickname, me?.avatarData, me?.coverData]);

  async function chooseImage(event, field) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return flash("Choose an image file (JPG, PNG or WebP).", true);
    if (file.size > 10 * 1024 * 1024)
      return flash("Image must be smaller than 10 MB.", true);
    try {
      const data = await compressActivityImage(file);
      setForm((current) => ({ ...current, [field]: data }));
    } catch (error) {
      flash(error.message, true);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await d.updateProfile(form);
      flash("Profile updated.");
    } catch (error) {
      flash(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function changePw(e) {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.target));
    if (p.next.length < 8)
      return flash("New password must be at least 8 characters.", true);
    if (p.next !== p.next2) return flash("New passwords do not match.", true);
    try {
      await d.changePassword(p.cur, p.next);
      e.target.reset();
      flash("Password changed.");
    } catch (error) {
      flash(error.message, true);
    }
  }

  const coverStyle = form.coverData
    ? { backgroundImage: `url(${form.coverData})` }
    : {
        backgroundImage: `linear-gradient(120deg,rgba(77,6,18,.85),rgba(181,18,43,.45)),url(${IMG.campus})`,
      };

  return (
    <>
      <section className="card pcard">
        <div className="pbanner" style={coverStyle} />
        <div className="pbody">
          <div className="av lg">
            {form.avatarData ? (
              <img src={form.avatarData} alt="" className="av-photo" />
            ) : (
              initials(me)
            )}
          </div>
          <div className="pname">
            <h2>{displayName({ ...me, nickname: form.nickname })}</h2>
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

      <Panel
        eyebrow="MY PROFILE"
        title="Edit your profile"
        sub="Choose a nickname and upload your own photos. Images are resized and saved with your account, so they appear across the portal."
      >
        <form className="form" onSubmit={saveProfile}>
          <label className="w">
            Nickname
            <input
              name="nickname"
              value={form.nickname}
              maxLength={30}
              placeholder="What should classmates and admins call you?"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  nickname: event.target.value,
                }))
              }
            />
          </label>

          <div className="profile-upload-row">
            <div>
              <span className="profile-upload-label">Profile picture</span>
              <div className="activity-upload-preview">
                <div className="av lg">
                  {form.avatarData ? (
                    <img src={form.avatarData} alt="" className="av-photo" />
                  ) : (
                    initials(me)
                  )}
                </div>
                <div className="profile-upload-actions">
                  <input
                    type="file"
                    accept="image/*"
                    id="avatar-input"
                    onChange={(event) => chooseImage(event, "avatarData")}
                  />
                  {form.avatarData && (
                    <button
                      className="tb"
                      type="button"
                      onClick={() =>
                        setForm((current) => ({ ...current, avatarData: "" }))
                      }
                    >
                      Remove picture
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <span className="profile-upload-label">Cover photo</span>
              <div className="activity-upload-preview">
                {form.coverData && (
                  <img src={form.coverData} alt="Cover preview" />
                )}
                <div className="profile-upload-actions">
                  <input
                    type="file"
                    accept="image/*"
                    id="cover-input"
                    onChange={(event) => chooseImage(event, "coverData")}
                  />
                  {form.coverData && (
                    <button
                      className="tb"
                      type="button"
                      onClick={() =>
                        setForm((current) => ({ ...current, coverData: "" }))
                      }
                    >
                      Remove cover
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button className="btn sm" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </button>
        </form>
      </Panel>

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
              <dt>Nickname</dt>
              <dd>{me.nickname || "—"}</dd>
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
