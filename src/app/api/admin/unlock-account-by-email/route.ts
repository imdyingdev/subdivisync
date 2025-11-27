// src/app/api/admin/unlock-account-by-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/database/mongodb";
import { UserSecurityModel } from "@/database/schemas/user-security";
import { connectDB } from "@/database/mongodb";
import { z } from "zod";
import { sendEmail } from "@/resend/resend";

// Helper function to send account unlock notification email
async function sendAccountUnlockEmail(email: string, userName?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000';
  const loginUrl = `${baseUrl}/login`;
  
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
          <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">SubdiviSync</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px;">Account Update</p>
          </div>
          <div style="padding: 30px;">
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hello ${userName || 'there'},</p>
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <p style="color: #166534; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">✅ Your Account Has Been Unlocked</p>
              <p style="color: #15803d; font-size: 14px; margin: 0;">
                Great news! An administrator has reviewed your request and unlocked your SubdiviSync account.
              </p>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
              You can now log in to your account. Please ensure you use the correct password to avoid being locked out again.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">Log In Now</a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
              If you continue to have issues logging in, please contact support for assistance.
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
      subject: "✅ Your SubdiviSync Account Has Been Unlocked",
      htmlContent,
      textContent: `Hello ${userName || 'there'}, Great news! Your SubdiviSync account has been unlocked. You can now log in at: ${loginUrl}`,
      sender: {
        email: process.env.BREVO_SENDER_EMAIL!,
        name: "SubdiviSync Support"
      }
    });
    console.log(`Unlock notification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send unlock notification email:', error);
    return false;
  }
}

// Validation schema for unlocking request
const UnlockByEmailSchema = z.object({
  email: z.string().email(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth.api.getSession(request);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    if (session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Admin access required" },
        { status: 403 }
      );
    }

    await connectDB();

    const body = await request.json();
    const { email, reason } = UnlockByEmailSchema.parse(body);

    // First, find the actual user by email
    const userCollection = db.collection("user");
    const user = await userCollection.findOne({ email });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found with this email" },
        { status: 404 }
      );
    }

    // Get userId - Better-Auth might store it as 'id' or use MongoDB '_id'
    const correctUserId = user.id || user._id?.toString();

    if (!correctUserId) {
      return NextResponse.json(
        { success: false, message: "User found but has no ID field" },
        { status: 500 }
      );
    }

    // Try to find user security record by correct userId first
    let userSecurity = await UserSecurityModel.findOne({ userId: correctUserId });

    // If not found, search for records with email patterns
    if (!userSecurity) {
      const possiblePatterns = [
        email,
        `email:${email}`,
      ];

      for (const pattern of possiblePatterns) {
        userSecurity = await UserSecurityModel.findOne({ userId: pattern });
        if (userSecurity) {
          console.log(`Found security record with userId pattern: ${pattern}`);
          break;
        }
      }
    }

    if (!userSecurity) {
      return NextResponse.json(
        { success: false, message: "No security record found for this email" },
        { status: 404 }
      );
    }

    if (!userSecurity.accountLocked) {
      return NextResponse.json(
        { success: false, message: "Account is not locked" },
        { status: 400 }
      );
    }

    // Store previous state
    const previousLockedState = {
      lockedAt: userSecurity.lockedAt,
      lockedBy: userSecurity.lockedBy,
      lockedReason: userSecurity.lockedReason,
      failedLoginCount: userSecurity.failedLoginCount,
      oldUserId: userSecurity.userId,
    };

    // Unlock and fix the userId
    userSecurity.accountLocked = false;
    userSecurity.unlockedAt = new Date();
    userSecurity.unlockedBy = session.user.id;
    userSecurity.unlockReason = reason || "Unlocked by admin via email";
    userSecurity.failedLoginCount = 0;
    userSecurity.userId = correctUserId; // Fix the userId!
    
    // Clear the locked state and token
    userSecurity.lockedAt = undefined;
    userSecurity.lockedBy = undefined;
    userSecurity.lockedReason = undefined;
    userSecurity.unlockToken = undefined;
    userSecurity.unlockTokenExpires = undefined;
    userSecurity.unlockRequest = undefined;

    await userSecurity.save();

    // Send unlock notification email (async, don't wait for it)
    sendAccountUnlockEmail(email, user.name).catch(err => {
      console.error('Failed to send unlock email:', err);
    });

    return NextResponse.json({
      success: true,
      message: "Account unlocked and userId corrected successfully",
      data: {
        email,
        correctedUserId: correctUserId,
        unlockedAt: userSecurity.unlockedAt,
        unlockedBy: session.user.id,
        unlockReason: userSecurity.unlockReason,
        previousState: previousLockedState,
        userIdWasFixed: previousLockedState.oldUserId !== correctUserId,
      },
    });

  } catch (error) {
    console.error("Unlock by email error:", error);
    
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

