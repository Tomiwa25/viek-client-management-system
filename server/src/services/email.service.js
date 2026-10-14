import { loadEnv } from '../config/env.js';

const env = loadEnv();

/**
 * Service to handle transactional emails (verification, OTP, passwords).
 * Defaults to 'mail=log' driver in development to inspect codes directly without external SMTP.
 */
export const emailService = {
  /**
   * Send verification email containing 6-digit OTP and clickable direct URL.
   */
  async sendVerificationEmail({ email, fullName, otp, verifyUrl }) {
    if (env.MAIL_DRIVER === 'log' || env.NODE_ENV === 'test') {
      const separator = '═'.repeat(60);
      console.log(`\n${separator}`);
      console.log(`📬 [EMAIL LOG] - EMAIL VERIFICATION`);
      console.log(`To: ${fullName ? `${fullName} <${email}>` : email}`);
      console.log(`Subject: Verify your email address - ClientFlow`);
      console.log(`────────────────────────────────────────────────────────────`);
      console.log(`Hello${fullName ? ` ${fullName}` : ''},`);
      console.log(`Thank you for registering your organization on ClientFlow.`);
      console.log(`Your 6-digit verification code is:`);
      console.log(`\n        >>>  ${otp}  <<<\n`);
      console.log(`This code will expire in 15 minutes.`);
      console.log(`Or click the button / link below to verify directly:`);
      console.log(`${verifyUrl}`);
      console.log(`${separator}\n`);
      return { success: true, driver: 'log' };
    }

    // Future SMTP or third-party adapter (e.g. Resend, Sendgrid) can be slotted here
    return { success: true, driver: 'noop' };
  },

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail({ email, fullName, resetUrl }) {
    if (env.MAIL_DRIVER === 'log' || env.NODE_ENV === 'test') {
      console.log(`\n📬 [EMAIL LOG] Password Reset -> To: ${email} | URL: ${resetUrl}\n`);
      return { success: true, driver: 'log' };
    }
    return { success: true, driver: 'noop' };
  },
};
