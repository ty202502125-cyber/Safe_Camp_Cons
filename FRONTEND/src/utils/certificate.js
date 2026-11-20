import { LOGO } from "../data/appData.js";

export const loadImg = (src) =>
  new Promise((res) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
    setTimeout(() => res(null), 4000);
  });
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  text.split(" ").forEach((w) => {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = t;
  });
  if (line) lines.push(line);
  return lines;
}
export async function drawCertificate(name, college, heading, body) {
  const W = 1600,
    H = 1131,
    c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#fffdfd";
  x.fillRect(0, 0, W, H);
  x.strokeStyle = "#B5122B";
  x.lineWidth = 8;
  x.strokeRect(40, 40, W - 80, H - 80);
  x.strokeStyle = "#e9bdc6";
  x.lineWidth = 2;
  x.strokeRect(64, 64, W - 128, H - 128);
  x.save();
  x.translate(W / 2, H / 2);
  x.rotate(-Math.PI / 12);
  x.fillStyle = "rgba(121,9,27,.05)";
  x.font = "900 400px sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("WMSU", 0, 0);
  x.restore();
  x.textAlign = "center";
  x.textBaseline = "alphabetic";
  const logo = await loadImg(LOGO);
  if (logo) x.drawImage(logo, W / 2 - 62, 110, 124, 124);
  else {
    x.fillStyle = "#B5122B";
    x.beginPath();
    x.arc(W / 2, 172, 52, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#fff";
    x.font = "bold 50px Georgia";
    x.fillText("W", W / 2, 190);
  }
  x.fillStyle = "#B5122B";
  x.font = "800 24px sans-serif";
  x.letterSpacing = "5px";
  x.fillText("WESTERN MINDANAO STATE UNIVERSITY", W / 2, 300);
  x.letterSpacing = "0px";
  x.fillStyle = "#79091B";
  x.font = "bold 80px Georgia, serif";
  x.fillText(heading, W / 2, 408);
  x.fillStyle = "#776A6E";
  x.font = "28px sans-serif";
  x.fillText("Presented to", W / 2, 490);
  x.fillStyle = "#20151A";
  x.font = "italic 70px Georgia, serif";
  x.fillText(name, W / 2, 580);
  x.strokeStyle = "#bda6ab";
  x.lineWidth = 1.5;
  x.beginPath();
  x.moveTo(W / 2 - 380, 610);
  x.lineTo(W / 2 + 380, 610);
  x.stroke();
  x.fillStyle = "#776A6E";
  x.font = "28px sans-serif";
  x.fillText(college, W / 2, 665);
  wrapText(x, body, 900).forEach((l, i) => x.fillText(l, W / 2, 745 + i * 46));
  x.fillText(
    "Issued on " +
      new Date().toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    W / 2,
    890,
  );
  x.strokeStyle = "#bda6ab";
  x.beginPath();
  x.moveTo(W / 2 - 190, 975);
  x.lineTo(W / 2 + 190, 975);
  x.stroke();
  x.fillStyle = "#20151A";
  x.font = "22px sans-serif";
  x.fillText("Authorized Signature", W / 2, 1010);
  return c;
}
export function pdfFromCanvas(canvas) {
  const jpg = Uint8Array.from(
    atob(canvas.toDataURL("image/jpeg", 0.95).split(",")[1]),
    (ch) => ch.charCodeAt(0),
  );
  const enc = new TextEncoder(),
    parts = [],
    off = [];
  let len = 0;
  const push = (d) => {
    const b = typeof d === "string" ? enc.encode(d) : d;
    parts.push(b);
    len += b.length;
  };
  const obj = (n, body) => {
    off[n] = len;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
  );
  off[4] = len;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,
  );
  push(jpg);
  push("\nendstream\nendobj\n");
  const content = "q 842 0 0 595 0 0 cm /Im0 Do Q";
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len;
  push(
    "xref\n0 6\n0000000000 65535 f \n" +
      [1, 2, 3, 4, 5]
        .map((n) => String(off[n]).padStart(10, "0") + " 00000 n \n")
        .join("") +
      `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
  );
  return new Blob(parts, { type: "application/pdf" });
}
export function saveBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- sign in / create account ---------- */
