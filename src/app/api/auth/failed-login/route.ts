// src/app/api/auth/failed-login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/database/mongodb";
import { UserSecurityModel } from "@/database/schemas/user-security";
import { connectDB } from "@/database/mongodb";
import { z } from "zod";

// Validation schema for the request
const FailedLoginSchema = z.object({
  userId: z.string().min(1).optional(), // Make userId optional
  ipAddress: z.string().optional(),
  email: z.string().email(),
});

// Helper function to check if a user exists by email and get their info
async function checkIfUserExists(email: string): Promise<{ userId: string; role?: string } | null> {
  try {
    // Use the database directly to find the user by email
    const collection = db.collection("user");
    const user = await collection.findOne({ email: email });
    
    if (user) {
      // Try to get user ID - Better-Auth might store it as 'id' or use MongoDB '_id'
      const userId = user.id || user._id?.toString();
      
      if (userId) {
        console.log(`Found user ID for email ${email}: ${userId}, role: ${user.role}`);
        return { userId, role: user.role };
      }
    }
    
    console.log(`No user found for email: ${email}`);
    return null;
  } catch (error) {
    console.error('Error checking if user exists:', error);
    return null;
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
      userSecurity.accountLocked = true;
      userSecurity.lockedAt = new Date();
      userSecurity.lockedReason = "Automatic lockout due to 3 failed login attempts";
      shouldLock = true;
      attemptsRemaining = 0;
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