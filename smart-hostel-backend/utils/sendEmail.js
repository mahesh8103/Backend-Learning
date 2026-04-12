import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email
 * @param {string} to      - recipient email
 * @param {string} subject - email subject
 * @param {string} html    - HTML body
 */
export const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`❌ Email error: ${err.message}`);
    // Don't throw — email failure shouldn't break the main flow
  }
};

// ─── Email Templates ───────────────────────────────────────────────

export const complaintRaisedTemplate = (studentName, complaintId, title) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color: #2563eb;">Smart Hostel — Complaint Received</h2>
    <p>Hi <strong>${studentName}</strong>,</p>
    <p>Your complaint has been registered successfully.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Complaint ID</td><td style="padding:8px;">#${complaintId.toString().slice(-6).toUpperCase()}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Title</td><td style="padding:8px;">${title}</td></tr>
      <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Status</td><td style="padding:8px;color:#16a34a;">Open</td></tr>
    </table>
    <p>We'll notify you when a staff member is assigned.</p>
    <p style="color:#6b7280;font-size:13px;">— Smart Hostel Management</p>
  </div>
`;

export const complaintResolvedTemplate = (studentName, complaintId, title) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color: #16a34a;">Smart Hostel — Complaint Resolved ✅</h2>
    <p>Hi <strong>${studentName}</strong>,</p>
    <p>Your complaint <strong>#${complaintId.toString().slice(-6).toUpperCase()}</strong> — "${title}" has been marked as resolved.</p>
    <p>Please submit your feedback to help us improve.</p>
    <p style="color:#6b7280;font-size:13px;">— Smart Hostel Management</p>
  </div>
`;

export const staffAssignedTemplate = (staffName, complaintId, title, priority) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color: #d97706;">Smart Hostel — New Complaint Assigned</h2>
    <p>Hi <strong>${staffName}</strong>,</p>
    <p>A complaint has been assigned to you.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Complaint ID</td><td style="padding:8px;">#${complaintId.toString().slice(-6).toUpperCase()}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Title</td><td style="padding:8px;">${title}</td></tr>
      <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Priority</td><td style="padding:8px;color:#dc2626;">${priority.toUpperCase()}</td></tr>
    </table>
    <p>Please log in to the dashboard and update the status.</p>
    <p style="color:#6b7280;font-size:13px;">— Smart Hostel Management</p>
  </div>
`;
