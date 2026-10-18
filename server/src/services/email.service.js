import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const env = loadEnv();

const PREVIEWS_DIR = path.resolve(__dirname, '../../mail-previews');

function ensurePreviewsDir() {
  try {
    if (!fs.existsSync(PREVIEWS_DIR)) {
      fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
    }
  } catch {
    // Ignore preview directory errors
  }
}

function savePreview(filename, htmlContent) {
  try {
    ensurePreviewsDir();
    const filePath = path.join(PREVIEWS_DIR, filename);
    fs.writeFileSync(filePath, htmlContent, 'utf-8');
  } catch (err) {
    console.warn(`[EMAIL PREVIEW WARNING] Failed to write preview: ${err.message}`);
  }
}

/**
 * Shared base HTML layout for all transactional emails
 */
function renderBaseEmailTemplate({ title, badge, contentHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ClientFlow</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #090d16; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" width="100%" max-width="580px" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #0f1523; border: 1px solid rgba(241, 245, 249, 0.1); border-radius: 12px; overflow: hidden; box-shadow: 0 15px 30px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 35px 20px 35px; border-bottom: 1px solid rgba(241, 245, 249, 0.08); background: linear-gradient(180deg, #161e31 0%, #0f1523 100%);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;">CLIENTFLOW</span>
                    <span style="font-size: 11px; font-weight: 700; color: #06b6d4; background-color: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.3); padding: 2px 7px; border-radius: 4px; margin-left: 8px; text-transform: uppercase;">CRM</span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">${badge || 'NOTIFICATION'}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 35px 35px 30px 35px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 35px; background-color: #090d16; border-top: 1px solid rgba(241, 245, 249, 0.06); text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
                Sent securely by <strong>VIEK / ClientFlow Management System</strong>
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                If you did not expect this communication, please disregard this email or report to security@clientflow.com.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const emailService = {
  /**
   * Send verification email containing 6-digit OTP and clickable direct URL.
   */
  async sendVerificationEmail({ email, fullName, otp, verifyUrl }) {
    const htmlContent = renderBaseEmailTemplate({
      title: 'Verify your email address',
      badge: 'Account Verification',
      contentHtml: `
        <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff;">Verify your corporate email</h1>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
          Hello${fullName ? ` <strong>${fullName}</strong>` : ''},<br>
          Thank you for registering your organization on ClientFlow. Please use the 6-digit verification code below to activate your account:
        </p>

        <div style="margin: 25px 0; text-align: center; background-color: #161e31; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 18px 24px;">
          <span style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #60a5fa; font-family: monospace;">${otp}</span>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">This code expires in 15 minutes</p>
        </div>

        <p style="margin: 20px 0 25px 0; font-size: 14px; line-height: 1.5; color: #94a3b8;">
          Or activate your workspace immediately by clicking the button below:
        </p>

        <div style="text-align: center; margin-bottom: 25px;">
          <a href="${verifyUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 6px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);">
            Verify Email Address →
          </a>
        </div>
      `,
    });

    savePreview(`verify_${email.replace(/[^a-z0-9]/gi, '_')}.html`, htmlContent);

    if (env.MAIL_DRIVER === 'log' || env.NODE_ENV === 'test') {
      const separator = '═'.repeat(60);
      console.log(`\n${separator}`);
      console.log(`📬 [EMAIL LOG] - EMAIL VERIFICATION`);
      console.log(`To: ${fullName ? `${fullName} <${email}>` : email}`);
      console.log(`Subject: Verify your email address - ClientFlow`);
      console.log(`Code: ${otp}`);
      console.log(`URL:  ${verifyUrl}`);
      console.log(`${separator}\n`);
      return { success: true, driver: 'log', htmlContent };
    }

    return { success: true, driver: 'noop', htmlContent };
  },

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail({ email, fullName, otp, resetUrl }) {
    const htmlContent = renderBaseEmailTemplate({
      title: 'Reset your password',
      badge: 'Security Reset',
      contentHtml: `
        <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff;">Password Reset Request</h1>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
          Hello${fullName ? ` <strong>${fullName}</strong>` : ''},<br>
          We received a request to reset your password. Use the 6-digit code below to verify your identity:
        </p>

        <div style="margin: 25px 0; text-align: center; background-color: #161e31; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 18px 24px;">
          <span style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #f87171; font-family: monospace;">${otp}</span>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">This code expires in 15 minutes</p>
        </div>

        <div style="text-align: center; margin-bottom: 25px;">
          <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 6px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);">
            Reset Password Directly →
          </a>
        </div>
      `,
    });

    savePreview(`reset_${email.replace(/[^a-z0-9]/gi, '_')}.html`, htmlContent);

    if (env.MAIL_DRIVER === 'log' || env.NODE_ENV === 'test') {
      const separator = '═'.repeat(60);
      console.log(`\n${separator}`);
      console.log(`📬 [EMAIL LOG] - PASSWORD RESET`);
      console.log(`To: ${fullName ? `${fullName} <${email}>` : email}`);
      console.log(`Subject: Reset your password - ClientFlow`);
      console.log(`Code: ${otp}`);
      console.log(`URL:  ${resetUrl}`);
      console.log(`${separator}\n`);
      return { success: true, driver: 'log', htmlContent };
    }

    return { success: true, driver: 'noop', htmlContent };
  },

  /**
   * Send Team Invitation Email (FR-02)
   * 7-day expiration with secure token URL
   */
  async sendTeamInvitationEmail({ email, organizationName, role, inviterName, inviteUrl, expiresAt }) {
    const formattedExpiry = new Date(expiresAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const roleBadgeColor = role === 'ADMIN' ? '#ef4444' : role === 'MANAGER' ? '#3b82f6' : '#10b981';

    const htmlContent = renderBaseEmailTemplate({
      title: `You have been invited to join ${organizationName}`,
      badge: 'Team Invitation',
      contentHtml: `
        <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff;">Join ${organizationName} on ClientFlow</h1>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
          <strong>${inviterName || 'An administrator'}</strong> has invited you to join the 
          <strong>${organizationName}</strong> workspace on ClientFlow as a 
          <span style="display: inline-block; font-size: 12px; font-weight: 700; color: ${roleBadgeColor}; background-color: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">${role}</span>.
        </p>

        <div style="margin: 25px 0; background-color: #161e31; border: 1px solid rgba(241, 245, 249, 0.08); border-radius: 8px; padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size: 13px; color: #94a3b8; padding-bottom: 6px;">Workspace Organization:</td>
              <td align="right" style="font-size: 13px; font-weight: 700; color: #ffffff; padding-bottom: 6px;">${organizationName}</td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #94a3b8; padding-bottom: 6px;">Assigned Role:</td>
              <td align="right" style="font-size: 13px; font-weight: 700; color: ${roleBadgeColor}; padding-bottom: 6px;">${role}</td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #94a3b8;">Invitation Expiration:</td>
              <td align="right" style="font-size: 13px; font-weight: 600; color: #fbbf24;">7 Days (${formattedExpiry})</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 13px 32px; border-radius: 6px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
            Accept Invitation & Setup Account →
          </a>
        </div>

        <p style="margin: 20px 0 0 0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
          This secure link will expire in 7 days. If you do not activate your account before then, an administrator will need to issue a new invitation.
        </p>
      `,
    });

    savePreview(`invite_${email.replace(/[^a-z0-9]/gi, '_')}.html`, htmlContent);

    if (env.MAIL_DRIVER === 'log' || env.NODE_ENV === 'test') {
      const separator = '═'.repeat(60);
      console.log(`\n${separator}`);
      console.log(`📬 [EMAIL LOG] - TEAM INVITATION (7-DAY EXPIRY)`);
      console.log(`To: ${email}`);
      console.log(`Org: ${organizationName} | Role: ${role}`);
      console.log(`Subject: You have been invited to join ${organizationName} on ClientFlow`);
      console.log(`Accept Link: ${inviteUrl}`);
      console.log(`Expires:     ${formattedExpiry}`);
      console.log(`${separator}\n`);
      return { success: true, driver: 'log', htmlContent };
    }

    return { success: true, driver: 'noop', htmlContent };
  },

  /**
   * Send 6th-day Invitation Reminder Email
   */
  async sendInvitationReminderEmail({ email, organizationName, role, inviteUrl, hoursLeft }) {
    const htmlContent = renderBaseEmailTemplate({
      title: `Reminder: Invitation to join ${organizationName} expires soon`,
      badge: 'Expiring Soon',
      contentHtml: `
        <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #fbbf24;">Your invitation will expire soon</h1>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
          This is a friendly reminder that your invitation to join <strong>${organizationName}</strong> on ClientFlow 
          will expire in approximately <strong>${hoursLeft || '24'} hours</strong>.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" target="_blank" style="display: inline-block; background-color: #f59e0b; color: #000000; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 32px; border-radius: 6px; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">
            Activate Account Before Expiration →
          </a>
        </div>
      `,
    });

    savePreview(`reminder_${email.replace(/[^a-z0-9]/gi, '_')}.html`, htmlContent);

    if (env.MAIL_DRIVER === 'log' || env.NODE_ENV === 'test') {
      const separator = '═'.repeat(60);
      console.log(`\n${separator}`);
      console.log(`📬 [EMAIL LOG] - INVITATION EXPIRING REMINDER`);
      console.log(`To: ${email}`);
      console.log(`Org: ${organizationName}`);
      console.log(`Subject: Reminder: Invitation to join ${organizationName} expires soon`);
      console.log(`Accept Link: ${inviteUrl}`);
      console.log(`${separator}\n`);
      return { success: true, driver: 'log', htmlContent };
    }

    return { success: true, driver: 'noop', htmlContent };
  },

  /**
   * Send Role Change Notification Email
   */
  async sendRoleChangeEmail({ email, fullName, organizationName, oldRole, newRole }) {
    const htmlContent = renderBaseEmailTemplate({
      title: `Your role in ${organizationName} was updated`,
      badge: 'Role Update',
      contentHtml: `
        <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff;">Workspace Role Updated</h1>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
          Hello${fullName ? ` <strong>${fullName}</strong>` : ''},<br>
          An administrator has updated your workspace permissions in <strong>${organizationName}</strong>:
        </p>

        <div style="margin: 25px 0; background-color: #161e31; border: 1px solid rgba(241, 245, 249, 0.08); border-radius: 8px; padding: 18px 24px; text-align: center;">
          <span style="font-size: 14px; color: #94a3b8;">${oldRole}</span>
          <span style="margin: 0 12px; font-size: 16px; color: #60a5fa;">➔</span>
          <span style="font-size: 16px; font-weight: 800; color: #34d399;">${newRole}</span>
        </div>

        <p style="margin: 20px 0 0 0; font-size: 13px; color: #94a3b8;">
          Your updated permissions are active immediately for your next session.
        </p>
      `,
    });

    savePreview(`role_${email.replace(/[^a-z0-9]/gi, '_')}.html`, htmlContent);

    if (env.MAIL_DRIVER === 'log' || env.NODE_ENV === 'test') {
      const separator = '═'.repeat(60);
      console.log(`\n${separator}`);
      console.log(`📬 [EMAIL LOG] - ROLE CHANGE NOTIFICATION`);
      console.log(`To: ${email}`);
      console.log(`Org: ${organizationName} | Changed: ${oldRole} -> ${newRole}`);
      console.log(`${separator}\n`);
      return { success: true, driver: 'log', htmlContent };
    }

    return { success: true, driver: 'noop', htmlContent };
  },

  /**
   * Send Account Status Change Notification Email (Deactivated / Reactivated)
   */
  async sendStatusChangeEmail({ email, fullName, organizationName, status, reason }) {
    const isSuspended = status === 'SUSPENDED';
    const statusTitle = isSuspended ? 'Workspace Access Suspended' : 'Workspace Access Reactivated';
    const statusColor = isSuspended ? '#ef4444' : '#10b981';

    const htmlContent = renderBaseEmailTemplate({
      title: `${statusTitle} - ${organizationName}`,
      badge: 'Account Status',
      contentHtml: `
        <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: ${statusColor};">${statusTitle}</h1>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
          Hello${fullName ? ` <strong>${fullName}</strong>` : ''},<br>
          Your account in <strong>${organizationName}</strong> has been <strong>${isSuspended ? 'deactivated' : 'reactivated'}</strong> by an administrator.
        </p>

        ${reason ? `
        <div style="margin: 20px 0; background-color: #161e31; border-left: 3px solid ${statusColor}; padding: 12px 16px; font-size: 13px; color: #cbd5e1;">
          <strong>Reason / Note:</strong> ${reason}
        </div>
        ` : ''}

        <p style="margin: 20px 0 0 0; font-size: 13px; color: #94a3b8;">
          ${isSuspended 
            ? 'While deactivated, you will not be able to log in or access workspace records. Contact your organization administrator if you believe this is in error.' 
            : 'You can now sign in and access your workspace normally.'}
        </p>
      `,
    });

    savePreview(`status_${email.replace(/[^a-z0-9]/gi, '_')}.html`, htmlContent);

    if (env.MAIL_DRIVER === 'log' || env.NODE_ENV === 'test') {
      const separator = '═'.repeat(60);
      console.log(`\n${separator}`);
      console.log(`📬 [EMAIL LOG] - ACCOUNT STATUS CHANGED (${status})`);
      console.log(`To: ${email}`);
      console.log(`Org: ${organizationName} | Status: ${status}`);
      console.log(`${separator}\n`);
      return { success: true, driver: 'log', htmlContent };
    }

    return { success: true, driver: 'noop', htmlContent };
  },
};
