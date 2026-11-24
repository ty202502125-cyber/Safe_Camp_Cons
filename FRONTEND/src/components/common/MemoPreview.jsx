function dataUrlToText(dataUrl) {
  try {
    const base64 = String(dataUrl).split(",")[1] || "";
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function readableSize(bytes) {
  if (!Number(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MemoPreview({ memo, compact = false }) {
  if (!memo?.data) return null;
  const name = memo.name || "Activity memo";
  const type = String(memo.type || "").toLowerCase();
  const isImage = type.startsWith("image/");
  const isPdf = type === "application/pdf" || /\.pdf$/i.test(name);
  const isText = type.startsWith("text/") || /\.txt$/i.test(name);

  if (isImage)
    return (
      <div className={`memo-preview ${compact ? "compact" : ""}`}>
        <img src={memo.data} alt={name} />
      </div>
    );

  if (isPdf)
    return (
      <div className={`memo-preview ${compact ? "compact" : ""}`}>
        <iframe src={memo.data} title={name} />
        <a className="tb" href={memo.data} target="_blank" rel="noreferrer">
          Open PDF in a new tab
        </a>
      </div>
    );

  if (isText)
    return (
      <div className={`memo-preview ${compact ? "compact" : ""}`}>
        <pre>{dataUrlToText(memo.data)}</pre>
      </div>
    );

  return (
    <div className={`memo-preview ${compact ? "compact" : ""}`}>
      <div className="memo-file-card">
        <span className="memo-file-icon">FILE</span>
        <div>
          <strong>{name}</strong>
          <small>
            {readableSize(memo.size)}
            {readableSize(memo.size) ? " · " : ""}
            Browser preview is not available for this file type. Download it to
            view.
          </small>
        </div>
        <a className="tb" href={memo.data} download={name}>
          Download
        </a>
      </div>
    </div>
  );
}
