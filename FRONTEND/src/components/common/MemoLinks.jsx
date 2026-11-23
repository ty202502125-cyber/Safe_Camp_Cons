export function MemoLinks({ memo }) {
  if (!memo?.data) return null;
  return (
    <div className="memo-box">
      <div className="memo-info">
        <strong>{memo.name || "Activity memo"}</strong>
        <small>
          {memo.uploadedAt
            ? `Uploaded ${new Date(memo.uploadedAt).toLocaleDateString("en-PH")}`
            : "Attached memo"}
        </small>
      </div>
      <a
        className="tb"
        href={memo.data}
        target="_blank"
        rel="noreferrer"
        title="Open the memo in a new tab"
      >
        View memo
      </a>
      <a className="tb" href={memo.data} download={memo.name || "memo"}>
        Download
      </a>
    </div>
  );
}
