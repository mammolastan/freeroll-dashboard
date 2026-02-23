// lib/email.ts

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.error("Email credentials not configured");
    throw new Error("Email service not configured");
  }

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  const subject = "Reset Your Password - Freeroll Atlanta";

  const text = `
You requested a password reset for your Freeroll Atlanta account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request this reset, you can safely ignore this email.
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Freeroll Atlanta</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>

    <p>You requested a password reset for your account. Click the button below to create a new password:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Reset Password
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour.</p>

    <p style="color: #6b7280; font-size: 14px;">If you didn't request this reset, you can safely ignore this email. Your password won't be changed.</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>
</body>
</html>
`;

  await sendEmail({ to: email, subject, text, html });
}
