// src/app/api/auth/failed-login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/database/mongodb";
import { UserSecurityModel } from "@/database/schemas/user-security";
import { connectDB } from "@/database/mongodb";
import { z } from "zod";
import { sendEmail } from "@/resend/resend";
import crypto from "crypto";

// Validation schema for the request
const FailedLoginSchema = z.object({
  userId: z.string().min(1).optional(), // Make userId optional
  ipAddress: z.string().optional(),
  email: z.string().email(),
});

// Helper function to check if a user exists by email and get their info
async function checkIfUserExists(email: string): Promise<{ userId: string; role?: string; name?: string } | null> {
  try {
    // Use the database directly to find the user by email
    const collection = db.collection("user");
    const user = await collection.findOne({ email: email });
    
    if (user) {
      // Try to get user ID - Better-Auth might store it as 'id' or use MongoDB '_id'
      const userId = user.id || user._id?.toString();
      
      if (userId) {
        console.log(`Found user ID for email ${email}: ${userId}, role: ${user.role}`);
        return { userId, role: user.role, name: user.name };
      }
    }
    
    console.log(`No user found for email: ${email}`);
    return null;
  } catch (error) {
    console.error('Error checking if user exists:', error);
    return null;
  }
}

// Helper function to generate a secure token
function generateUnlockToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to send account lock notification email
async function sendAccountLockEmail(email: string, userName?: string, token?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000';
  const unlockRequestUrl = `${baseUrl}/unlock-request?email=${encodeURIComponent(email)}${token ? `&token=${token}` : ''}`;
  
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
          <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">SubdiviSync</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px;">Account Security Alert</p>
          </div>
          <div style="padding: 30px;">
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hello ${userName || 'there'},</p>
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <p style="color: #991b1b; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">⚠️ Your Account Has Been Locked</p>
              <p style="color: #7f1d1d; font-size: 14px; margin: 0;">
                Your SubdiviSync account has been locked due to 3 failed login attempts. This is a security measure to protect your account.
              </p>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              To request account unlock, please click the button below and submit a reason for unlock. An administrator will review your request.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${unlockRequestUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">Request Account Unlock</a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
              If you did not attempt to log in, please contact our support team immediately as someone may be trying to access your account.
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

  try {
    await sendEmail({
      to: [{ email, name: userName }],
      subject: "⚠️ Your SubdiviSync Account Has Been Locked",
      htmlContent,
      textContent: `Hello ${userName || 'there'}, Your SubdiviSync account has been locked due to 3 failed login attempts. To request account unlock, please visit: ${unlockRequestUrl}`,
      sender: {
        email: process.env.BREVO_SENDER_EMAIL!,
        name: "SubdiviSync Security"
      }
    });
    console.log(`Lock notification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send lock notification email:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { userId, ipAddress, email } = FailedLoginSchema.parse(body);

    // Use userId if available, otherwise check if email belongs to existing user
    let identifier = userId;
    let userRole: string | undefined;
    let userName: string | undefined;
    
    if (!identifier && email) {
      // Check if user exists before tracking failed attempts
      const existingUser = await checkIfUserExists(email);
      
      if (existingUser === null) {
        // User doesn't exist, don't track failed attempt
        return NextResponse.json(
          {
            success: false,
            message: "Invalid credentials.",
            accountLocked: false,
            failedLoginCount: 0,
            attemptsRemaining: 0, 
          },
          { status: 401 }
        );
      }
      
      identifier = existingUser.userId;
      userRole = existingUser.role;
      userName = existingUser.name;
    }
    
    if (!identifier) {
      return NextResponse.json(
        { success: false, message: "User identification failed" },
        { status: 400 }
      );
    }

    // Admin accounts are exempt from lockout
    if (userRole === "admin") {
      console.log(`Admin account ${email} - skipping lockout tracking`);
      return NextResponse.json(
        {
          success: false,
          message: "Invalid credentials.",
          accountLocked: false,
          failedLoginCount: 0,
          attemptsRemaining: null,
        },
        { status: 401 }
      );
    }
    
    // Get or create user security record
    let userSecurity = await UserSecurityModel.findOne({ userId: identifier });
    
    if (!userSecurity) {
      userSecurity = new UserSecurityModel({
        userId: identifier,
        failedLoginCount: 0,
        accountLocked: false,
      });
    }

    // Check if account is already locked
    if (userSecurity.accountLocked) {
      return NextResponse.json(
        {
          success: false,
          message: "Account is locked. Please contact admin or customer service.",
          accountLocked: true,
          attemptsRemaining: 0,
        },
        { status: 423 }
      );
    }

    // Increment failed login count
    userSecurity.failedLoginCount += 1;
    userSecurity.lastLoginAttempt = new Date();
    if (ipAddress) {
      userSecurity.ipAddress = ipAddress;
    }

    let shouldLock = false;
    let attemptsRemaining = Math.max(0, 3 - userSecurity.failedLoginCount);

    // Lock account if attempts reach 3
    if (userSecurity.failedLoginCount >= 3) {
      // Generate a secure token for unlock request access
      const unlockToken = generateUnlockToken();
      const tokenExpiry = new Date();
      tokenExpiry.setDate(tokenExpiry.getDate() + 7); // Token valid for 7 days
      
      userSecurity.accountLocked = true;
      userSecurity.lockedAt = new Date();
      userSecurity.lockedReason = "Automatic lockout due to 3 failed login attempts";
      userSecurity.unlockToken = unlockToken;
      userSecurity.unlockTokenExpires = tokenExpiry;
      shouldLock = true;
      attemptsRemaining = 0;
      
      // Send lock notification email with token (async, don't wait for it)
      sendAccountLockEmail(email, userName, unlockToken).then((sent) => {
        if (sent) {
          // Update the record to mark email as sent
          UserSecurityModel.updateOne(
            { userId: identifier },
            { $set: { lockEmailSent: true } }
          ).catch(err => console.error('Failed to update lockEmailSent:', err));
        }
      });
    }

    await userSecurity.save();

    const response = {
      success: false,
      message: shouldLock 
        ? "Account locked. Too many failed login attempts. Please contact admin or customer service."
        : `Invalid credentials. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`,
      accountLocked: shouldLock,
      failedLoginCount: userSecurity.failedLoginCount,
      attemptsRemaining,
    };

    const status = shouldLock ? 423 : 401;
    return NextResponse.json(response, { status });

  } catch (error) {
    console.error("Failed login tracking error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "Invalid request data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to check account status
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");

    if (!userId && !email) {
      return NextResponse.json(
        { success: false, message: "userId or email is required" },
        { status: 400 }
      );
    }

    let targetUserId = userId;

    // If email is provided, look up the user ID
    if (email && !userId) {
      const existingUser = await checkIfUserExists(email);
      targetUserId = existingUser?.userId || null;
    }

    let userSecurity = null;

    if (targetUserId) {
      userSecurity = await UserSecurityModel.findOne({ userId: targetUserId });
    }

    if (!userSecurity) {
      // For non-existent users or new users with no security record,
      // return empty status - don't show attempts remaining warning
      return NextResponse.json({
        success: true,
        accountLocked: false,
        failedLoginCount: 0,
        attemptsRemaining: null, // null means no warning should be shown
        isNewUser: true,
      });
    }

    // For existing users with security records
    const attemptsRemaining = Math.max(0, 3 - userSecurity.failedLoginCount);
    
    return NextResponse.json({
      success: true,
      accountLocked: userSecurity.accountLocked,
      failedLoginCount: userSecurity.failedLoginCount,
      attemptsRemaining: userSecurity.failedLoginCount > 0 ? attemptsRemaining : null,
      lockedAt: userSecurity.lockedAt,
      lastLoginAttempt: userSecurity.lastLoginAttempt,
      isNewUser: false,
    });

  } catch (error) {
    console.error("Get account status error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}