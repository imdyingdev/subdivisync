// src/app/api/admin/resend-unlock-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/database/mongodb";
import { UserSecurityModel } from "@/database/schemas/user-security";
import { connectDB } from "@/database/mongodb";
import { sendEmail } from "@/resend/resend";
import { z } from "zod";

const ResendEmailSchema = z.object({
  email: z.string().email(),
  userName: z.string().optional(),
});

// Helper function to find user by email
async function findUserByEmail(email: string) {
  const collection = db.collection("user");
  const user = await collection.findOne({ email });
  if (user) {
    return {
      userId: user.id || user._id?.toString(),
      name: user.name,
      email: user.email,
    };
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { email, userName } = ResendEmailSchema.parse(body);

    // Find the user
    const user = await findUserByEmail(email);
    if (!user || !user.userId) {
      return NextResponse.json(
        { success: false, message: "No account found with this email" },
        { status: 404 }
      );
    }

    // Find the security record
    const userSecurity = await UserSecurityModel.findOne({ userId: user.userId });
    
    if (!userSecurity) {
      return NextResponse.json(
        { success: false, message: "No security record found for this account" },
        { status: 404 }
      );
    }

    if (!userSecurity.accountLocked) {
      return NextResponse.json(
        { success: false, message: "This account is not locked" },
        { status: 400 }
      );
    }

    // Clear the existing unlock request so user can resubmit
    userSecurity.unlockRequest = undefined;
    await userSecurity.save();

    // Send email requesting more info
    const baseUrl = process.env.NEXT_PUBLIC_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000';
    const unlockRequestUrl = `${baseUrl}/unlock-request?email=${encodeURIComponent(email)}`;
    
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
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">SubdiviSync</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px;">Additional Information Required</p>
            </div>
            <div style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hello ${userName || user.name || 'there'},</p>
              <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">📝 More Information Needed</p>
                <p style="color: #78350f; font-size: 14px; margin: 0;">
                  An administrator has reviewed your unlock request and requires additional information 
                  before your account can be unlocked.
                </p>
              </div>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Please click the button below to submit a more detailed explanation for why your account 
                should be unlocked. Be sure to provide clear and specific information.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${unlockRequestUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">Submit New Reason</a>
              </div>
              <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
                If you have any questions, please contact our support team for assistance.
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
      to: [{ email, name: userName || user.name }],
      subject: "📝 Additional Information Required - SubdiviSync Account Unlock",
      htmlContent,
      textContent: `Hello ${userName || user.name || 'there'}, An administrator has reviewed your unlock request and requires additional information. Please visit: ${unlockRequestUrl} to submit a more detailed explanation.`,
      sender: {
        email: process.env.BREVO_SENDER_EMAIL!,
        name: "SubdiviSync Support"
      }
    });

    return NextResponse.json({
      success: true,
      message: "Email sent successfully. User can now resubmit their reason.",
    });

  } catch (error) {
    console.error("Resend unlock email error:", error);
    
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return NextResponse.json(
        { success: false, message: firstError?.message || "Invalid request data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
