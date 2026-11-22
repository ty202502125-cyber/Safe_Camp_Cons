import nodemailer from "nodemailer";

export function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_APP_PASSWORD,
  );
}

// SMTP_FROM is often written as `Name<address>` by hand. Normalize it to a
// properly quoted address so mail providers do not reject the envelope sender.
function senderAddress() {
  const configured = (process.env.SMTP_FROM || process.env.SMTP_USER).trim();
  const match = configured.match(/^(.*?)<([^>]+)>$/);
  const email = (match ? match[2] : configured).trim();
  const name =
    (match ? match[1] : "Campus Serve")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/"/g, "") || "Campus Serve";
  return `"${name}" <${email}>`;
}

export async function sendEmail({ to, subject, text }) {
  if (!isSmtpConfigured())
    throw new Error("SMTP email settings are missing.");

  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE.toLowerCase() === "true"
      : port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_APP_PASSWORD.replace(/\s+/g, ""),
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await transporter.sendMail({
      from: senderAddress(),
      to,
      subject,
      text,
    });
  } finally {
    transporter.close();
  }
}
