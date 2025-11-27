import { db } from "@/database/mongodb";
import { sendEmail } from "@/resend/resend";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { admin as adminPlugin, twoFactor } from "better-auth/plugins";

// Provide fallback URLs for build time when env vars may not be available
const getBaseURL = () => {
  if (process.env.NODE_ENV === "production") {
    return process.env.NEXT_PUBLIC_URL || "https://www.subdivisync.com";
  }
  return process.env.BETTER_AUTH_URL || "http://localhost:3000";
};

export const auth = betterAuth({
  baseURL: getBaseURL(),
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 10,
      customRules: {
        "/two-factor/*": {
          window: 10,
          max: 5,
        },
        "/two-factor/send-otp": {
          window: 60,
          max: 5,
        },
      },
    },
  },
  user: {
    additionalFields: {
      address: {
        type: "string",
        required: false,
      },
      gender: {
        type: "string",
        required: false,
      },
      age: {
        type: "number",
        required: false,
      },
      dateOfBirth: {
        type: "date",
        required: false,
      },
      phoneNumber: {
        type: "string",
        required: false,
      },
      status: {
        type: "string",
        required: false,
      },
    },
  },
  database: mongodbAdapter(db),
  trustedOrigins: [
    getBaseURL(),
    "https://www.subdivisync.com",
    "https://subdivisync.com",
  ].filter(Boolean),
  appName: "SubdiviSync",
  emailAndPassword: {
    requireEmailVerification: true,
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <div style="background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">SubdiviSync</h1>
                <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px;">Password Reset Request</p>
              </div>
              <div style="padding: 30px;">
                <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hello ${user.name || 'there'},</p>
                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                  We received a request to reset your password for your SubdiviSync account. Click the button below to set a new password:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">Reset Password</a>
                </div>
                <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
                  If you didn't request this password reset, you can safely ignore this email. This link will expire in 1 hour.
                </p>
              </div>
              <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; margin: 0; font-size: 11px;">&copy; ${new Date().getFullYear()} SubdiviSync. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      await sendEmail({
        to: [{ email: user.email, name: user.name }],
        subject: "Reset Your SubdiviSync Password",
        htmlContent,
        textContent: `Hello ${user.name || 'there'}, We received a request to reset your password. Visit this link to reset: ${url}. If you didn't request this, you can ignore this email.`,
        sender: {
          email: process.env.BREVO_SENDER_EMAIL!,
          name: "SubdiviSync"
        }
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <div style="background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">SubdiviSync</h1>
                <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px;">Email Verification</p>
              </div>
              <div style="padding: 30px;">
                <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Welcome ${user.name || 'there'}!</p>
                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                  Thank you for creating a SubdiviSync account. Please verify your email address by clicking the button below:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">Verify Email Address</a>
                </div>
                <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
                  If you didn't create a SubdiviSync account, you can safely ignore this email.
                </p>
              </div>
              <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; margin: 0; font-size: 11px;">&copy; ${new Date().getFullYear()} SubdiviSync. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      await sendEmail({
        to: [{ email: user.email, name: user.name }],
        subject: "Verify Your SubdiviSync Email Address",
        htmlContent,
        textContent: `Welcome ${user.name || 'there'}! Thank you for creating a SubdiviSync account. Verify your email by visiting: ${url}`,
        sender: {
          email: process.env.BREVO_SENDER_EMAIL!,
          name: "SubdiviSync"
        }
      });
    },
  },
  plugins: [
    adminPlugin({
      adminRoles: ["admin"],
      defaultRole: "tenant",
    }),
    twoFactor({
      skipVerificationOnEnable: true,
      otpOptions: {
        async sendOTP({ user, otp }) {
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <div style="background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">SubdiviSync</h1>
                    <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px;">Two-Factor Authentication</p>
                  </div>
                  <div style="padding: 30px; text-align: center;">
                    <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hello ${user.name || 'there'},</p>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                      Your verification code for SubdiviSync is:
                    </p>
                    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
                      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1f2937;">${otp}</span>
                    </div>
                    <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
                      This code will expire in 5 minutes. If you didn't request this code, please secure your account immediately.
                    </p>
                  </div>
                  <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; margin: 0; font-size: 11px;">&copy; ${new Date().getFullYear()} SubdiviSync. All rights reserved.</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `;
          await sendEmail({
            to: [{ email: user.email, name: user.name }],
            subject: "Your SubdiviSync Verification Code",
            htmlContent,
            textContent: `Your SubdiviSync verification code is: ${otp}. This code expires in 5 minutes.`,
            sender: {
              email: process.env.BREVO_SENDER_EMAIL!,
              name: "SubdiviSync"
            }
          });
        },
      },
    }),
    nextCookies(),
  ],
});
