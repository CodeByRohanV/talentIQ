import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  requireTLS: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false }
});

const getFrontendBaseUrl = () => {
  const rawUrl = process.env.FRONTEND_URL || 'https://skillztest.scaloz.com';
  if (rawUrl.includes(',')) {
    const urls = rawUrl.split(',').map(u => u.trim());
    const standardHttps = urls.find(u => u.startsWith('https://') && !u.includes('*'));
    if (standardHttps) return standardHttps;
    const standardHttp = urls.find(u => u.startsWith('http://') && !u.includes('*'));
    if (standardHttp) return standardHttp;
    return urls[0].replace('*.', '');
  }
  return rawUrl;
};

export const sendVerificationEmail = async (email, token) => {
    const verificationLink = `${getFrontendBaseUrl()}/verify?token=${token}`;

    const mailOptions = {
        from: `"skillz" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Verify your email - skillz',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 8px;">
                <h2 style="color: #6d28d9; text-align: center;">Welcome to skillz</h2>
                <p>Hello,</p>
                <p>Thank you for signing up for skillz! To get started, please verify your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationLink}" style="background-color: #6d28d9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
                </div>
                <p>If the button above doesn't work, copy and paste the following link into your browser:</p>
                <p style="word-break: break-all; color: #6d28d9;">${verificationLink}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666; text-align: center;">This link will expire in 24 hours. If you did not create an account, no further action is required.</p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (email, token) => {
    const resetLink = `${getFrontendBaseUrl()}/reset-password?token=${token}`;

    const mailOptions = {
        from: `"skillz" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Reset your password - skillz',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #6d28d9; text-align: center;">Reset Your Password</h2>
                <p>Hello,</p>
                <p>We received a request to reset your password. Click the button below to choose a new one:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background-color: #6d28d9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
                </div>
                <p>If the button above doesn't work, copy and paste the following link into your browser:</p>
                <p style="word-break: break-all; color: #6d28d9;">${resetLink}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666; text-align: center;">This link will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
};

export const sendCredentialsEmail = async (email, temporaryPassword) => {
    const loginLink = `${getFrontendBaseUrl()}/auth`;

    const mailOptions = {
        from: `"skillz" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your skillz Account Credentials',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #6d28d9; text-align: center;">Welcome to skillz</h2>
                <p>Hello,</p>
                <p>An administrator has created an account for you on the skillz platform.</p>
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 10px 0 0 0;"><strong>Temporary Password:</strong> ${temporaryPassword}</p>
                </div>
                <p>You will be required to change this password upon your first login.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${loginLink}" style="background-color: #6d28d9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Login to Your Dashboard</a>
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666; text-align: center;">If you have any questions, please contact your administrator.</p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
};

export const sendAssessmentLinkEmail = async (email, assessmentTitle, shareToken) => {
    const assessmentLink = `${getFrontendBaseUrl()}/test/${shareToken}`;

    const mailOptions = {
        from: `"skillz" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Assessment Invite: ${assessmentTitle} - skillz`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #6d28d9; margin: 0;">skillz Assessment</h2>
                </div>
                <p>Hello,</p>
                <p>You have been invited to take the <strong>${assessmentTitle}</strong> assessment on skillz.</p>
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <p style="margin: 0 0 15px 0; color: #4b5563;">Click the button below to start your test:</p>
                    <a href="${assessmentLink}" style="background-color: #6d28d9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Start Assessment</a>
                </div>
                <p>If the button above doesn't work, copy and paste the following link into your browser:</p>
                <p style="word-break: break-all; color: #6d28d9;">${assessmentLink}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666; text-align: center;">This is an automated message from skillz. Please do not reply to this email.</p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
};

export const sendOtpEmail = async (email, otp, assessmentTitle) => {
    const mailOptions = {
        from: `"skillz" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Your Verification Code for ${assessmentTitle}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #6d28d9; margin: 0;">skillz Verification</h2>
                </div>
                <p>Hello,</p>
                <p>You requested to start the assessment <strong>${assessmentTitle}</strong>. Please use the following 6-digit code to verify your email address:</p>
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px; color: #1f2937;">${otp}</h1>
                </div>
                <p>This code will expire in 10 minutes.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666; text-align: center;">If you did not request this, please ignore this email.</p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
};
