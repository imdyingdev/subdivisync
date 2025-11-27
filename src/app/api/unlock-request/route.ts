// src/app/api/unlock-request/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/database/mongodb";
import { UserSecurityModel } from "@/database/schemas/user-security";
import { connectDB } from "@/database/mongodb";
import { z } from "zod";
import { sendEmail } from "@/resend/resend";

// Validation schema for unlock request submission
const UnlockRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1, "Name is required").optional(),
  reason: z.string().min(20, "Reason must be at least 20 characters"),
  token: z.string().min(1, "Token is required"),
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

// POST - Submit unlock request
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { email, name, reason, token } = UnlockRequestSchema.parse(body);

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

    // Validate the token
    if (!userSecurity.unlockToken || userSecurity.unlockToken !== token) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired unlock link. Please use the link from your email." },
        { status: 403 }
      );
    }

    // Check if token is expired
    if (userSecurity.unlockTokenExpires && new Date() > userSecurity.unlockTokenExpires) {
      return NextResponse.json(
        { success: false, message: "This unlock link has expired. Please contact support for a new link." },
        { status: 403 }
      );
    }

    // Save the unlock request (overwrite any existing one - user may be resubmitting from email)
    userSecurity.unlockRequest = {
      email,
      name: name || user.name,
      reason,
      submittedAt: new Date(),
      status: 'pending',
    };

    await userSecurity.save();

    return NextResponse.json({
      success: true,
      message: "Unlock request submitted successfully. An administrator will review your request.",
    });

  } catch (error) {
    console.error("Unlock request error:", error);
    
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

// GET - Check if account is locked and has pending request
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const token = searchParams.get("token");

    if (!email || !token) {
      return NextResponse.json(
        { success: false, message: "Invalid unlock request link" },
        { status: 400 }
      );
    }

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
      return NextResponse.json({
        success: true,
        accountLocked: false,
        hasUnlockRequest: false,
      });
    }

    // Validate the token
    if (!userSecurity.unlockToken || userSecurity.unlockToken !== token) {
      return NextResponse.json(
        { success: false, message: "Invalid unlock link. Please use the link from your email." },
        { status: 403 }
      );
    }

    // Check if token is expired
    if (userSecurity.unlockTokenExpires && new Date() > userSecurity.unlockTokenExpires) {
      return NextResponse.json(
        { success: false, message: "This unlock link has expired. Please contact support." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      accountLocked: userSecurity.accountLocked,
      hasUnlockRequest: !!userSecurity.unlockRequest,
      unlockRequestStatus: userSecurity.unlockRequest?.status,
      lockedAt: userSecurity.lockedAt,
      tokenValid: true,
    });

  } catch (error) {
    console.error("Check unlock request error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
