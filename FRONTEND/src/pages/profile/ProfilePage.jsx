import { useEffect, useState } from "react";
import { Panel } from "../../components/common/SharedUi.jsx";
import {
  displayName,
  fullName,
  initials,
  compressActivityImage,
} from "../../utils/appUtils.jsx";

export function Profile({ d }) {
  const { me, flash } = d;
  const [menu, setMenu] = useState(null);
  const [avatarEditing, setAvatarEditing] = useState(false);
  const [coverEditing, setCoverEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nicknameMenu, setNicknameMenu] = useState(false);
  const [nicknameChanging, setNicknameChanging] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(me?.nickname || "");

  useEffect(() => {
    setNicknameDraft(me?.nickname || "");
  }, [me?.id, me?.nickname]);

  async function saveField(field, value, message) {
    setBusy(true);
    try {
      await d.updateProfile({ [field]: value });
      flash(message);
      return true;
    } catch (error) {
      flash(error.message, true);
      return false;
    } finally {
      setBusy(false);
    }
  }

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
      const saved = await saveField(
        field,
        data,
        field === "avatarData" ? "Profile picture updated." : "Cover photo updated.",
      );
      if (saved) setMenu(null);
    } catch (error) {
      flash(error.message, true);
    }
  }

  async function removeImage(field) {
    const saved = await saveField(
      field,
      "",
      field === "avatarData" ? "Profile picture removed." : "Cover photo removed.",
    );
    if (saved) setMenu(null);
  }

  async function saveNickname() {
    const value = nicknameDraft.trim();
    const saved = await saveField("nickname", value, "Nickname saved.");
    if (saved) {
      setNicknameChanging(false);
      setNicknameMenu(false);
    }
  }

  async function deleteNickname() {
    const saved = await saveField("nickname", "", "Nickname removed.");
    if (saved) {
      setNicknameChanging(false);
      setNicknameMenu(false);
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

  const coverStyle = me?.coverData
    ? { backgroundImage: `url(${me.coverData})` }
    : { backgroundColor: "#ffffff", backgroundImage: "none" };
  const menuField = menu === "cover" ? "coverData" : "avatarData";
  const menuData = menu ? me?.[menuField] || "" : "";

  return (
    <>
      <section className="card pcard">
        <button
          type="button"
          className="pbanner profile-banner-button"
          style={coverStyle}
          title="View cover photo"
          aria-label="View cover photo"
          onClick={() => {
            setCoverEditing(false);
            setMenu("cover");
          }}
        >
          <span className="profile-photo-hint">Click to view cover</span>
        </button>
        <div className="pbody">
          <button
            type="button"
            className="av lg profile-avatar-button"
            title="View profile picture"
            aria-label="View profile picture"
            onClick={() => {
              setAvatarEditing(false);
              setMenu("avatar");
            }}
          >
            {me?.avatarData ? (
              <img src={me.avatarData} alt="" className="av-photo" />
            ) : (
              initials(me)
            )}
          </button>
          <div className="pname">
            <h2>{displayName(me)}</h2>
            <button
              className="tb nickname-button"
              type="button"
              title="Edit nickname"
              aria-label="Edit nickname"
              aria-expanded={nicknameMenu}
              onClick={() => {
                setNicknameDraft(me?.nickname || "");
                setNicknameChanging(false);
                setNicknameMenu(true);
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
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

      {menu === "avatar" && (
        <div
          className="modal-backdrop photo-zoom-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setAvatarEditing(false);
              setMenu(null);
            }
          }}
        >
          <div
            className="profile-photo-view"
            role="dialog"
            aria-modal="true"
            aria-label="Profile picture"
          >
            <div className="profile-photo-view-image">
              {menuData ? (
                <img src={menuData} alt="Your profile picture" />
              ) : (
                <div className="av lg">{initials(me)}</div>
              )}
            </div>
            <div className="profile-photo-view-actions">
              <button
                className="tb primary"
                type="button"
                aria-expanded={avatarEditing}
                onClick={() => setAvatarEditing((open) => !open)}
              >
                Edit
              </button>
              <button
                className="tb"
                type="button"
                onClick={() => {
                  setAvatarEditing(false);
                  setMenu(null);
                }}
              >
                Close
              </button>
            </div>
            {avatarEditing && (
              <div className="profile-photo-edit-options">
                <label className="tb profile-file-label">
                  {busy ? "Saving…" : menuData ? "Change picture" : "Add picture"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={busy}
                    onChange={(event) => chooseImage(event, "avatarData")}
                  />
                </label>
                {menuData && (
                  <button
                    className="tb bad"
                    type="button"
                    disabled={busy}
                    onClick={() => removeImage("avatarData")}
                  >
                    Remove picture
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {menu === "cover" && (
        <div
          className="modal-backdrop photo-zoom-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setCoverEditing(false);
              setMenu(null);
            }
          }}
        >
          <div
            className="profile-photo-view"
            role="dialog"
            aria-modal="true"
            aria-label="Cover photo"
          >
            <div className="profile-photo-view-image cover">
              {menuData ? (
                <img
                  src={menuData}
                  alt="Your cover photo"
                  className="profile-cover-preview"
                />
              ) : (
                <div className="profile-cover-empty">No cover photo yet.</div>
              )}
            </div>
            <div className="profile-photo-view-actions">
              <button
                className="tb primary"
                type="button"
                aria-expanded={coverEditing}
                onClick={() => setCoverEditing((open) => !open)}
              >
                Edit
              </button>
              <button
                className="tb"
                type="button"
                onClick={() => {
                  setCoverEditing(false);
                  setMenu(null);
                }}
              >
                Close
              </button>
            </div>
            {coverEditing && (
              <div className="profile-photo-edit-options">
                <label className="tb profile-file-label">
                  {busy
                    ? "Saving…"
                    : menuData
                      ? "Change cover photo"
                      : "Add cover photo"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={busy}
                    onChange={(event) => chooseImage(event, "coverData")}
                  />
                </label>
                {menuData && (
                  <button
                    className="tb bad"
                    type="button"
                    disabled={busy}
                    onClick={() => removeImage("coverData")}
                  >
                    Remove cover
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {nicknameMenu && (
        <div
          className="modal-backdrop photo-zoom-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setNicknameChanging(false);
              setNicknameMenu(false);
            }
          }}
        >
          <div
            className="profile-nickname-view"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nickname-view-title"
          >
            <div className="ph">
              <div>
                <span className="eb">NICKNAME</span>
                <h2 id="nickname-view-title">Edit nickname</h2>
              </div>
              <button
                className="tb"
                type="button"
                onClick={() => {
                  setNicknameChanging(false);
                  setNicknameMenu(false);
                }}
              >
                Close
              </button>
            </div>
            <div className="profile-nickname-current">
              {nicknameChanging ? (
                <div className="nickname-editor">
                  <input
                    value={nicknameDraft}
                    maxLength={30}
                    placeholder="Nickname"
                    autoFocus
                    onChange={(event) => setNicknameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") saveNickname();
                      if (event.key === "Escape") setNicknameChanging(false);
                    }}
                  />
                  <button
                    className="tb primary"
                    type="button"
                    disabled={busy}
                    onClick={saveNickname}
                  >
                    Save
                  </button>
                  <button
                    className="tb"
                    type="button"
                    disabled={busy}
                    onClick={() => setNicknameChanging(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <p>
                  {me.nickname ? `“${me.nickname}”` : "No nickname yet."}
                </p>
              )}
            </div>
            {!nicknameChanging && (
              <div className="profile-nickname-actions">
                <button
                  className="tb primary"
                  type="button"
                  onClick={() => {
                    setNicknameDraft(me?.nickname || "");
                    setNicknameChanging(true);
                  }}
                >
                  {me.nickname ? "Change nickname" : "Add nickname"}
                </button>
                {me.nickname && (
                  <button
                    className="tb bad"
                    type="button"
                    disabled={busy}
                    onClick={deleteNickname}
                  >
                    Delete nickname
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
