import { useState } from "react";
import { MemoPreview } from "./MemoPreview.jsx";

export function MemoLinks({ memo }) {
  const [open, setOpen] = useState(false);
  if (!memo?.data) return null;
  return (
    <>
      <div className="memo-box">
        <div className="memo-info">
          <strong>{memo.name || "Activity memo"}</strong>
          <small>
            {memo.uploadedAt
              ? `Uploaded ${new Date(memo.uploadedAt).toLocaleDateString("en-PH")}`
              : "Attached memo"}
          </small>
        </div>
        <button
          className="tb"
          type="button"
          onClick={() => setOpen(true)}
          title="Preview the memo here"
        >
          Preview
        </button>
        <a
          className="tb"
          href={memo.data}
          target="_blank"
          rel="noreferrer"
          title="Open the memo in a new tab"
        >
          Open
        </a>
        <a className="tb" href={memo.data} download={memo.name || "memo"}>
          Download
        </a>
      </div>
      {open && (
        <div
          className="modal-backdrop photo-zoom-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setOpen(false)
          }
        >
          <div
            className="card memo-preview-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="ph">
              <div>
                <span className="eb">MEMO PREVIEW</span>
                <h2>{memo.name || "Activity memo"}</h2>
              </div>
              <button
                className="tb"
                type="button"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <MemoPreview memo={memo} />
            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <a className="tb" href={memo.data} download={memo.name || "memo"}>
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
