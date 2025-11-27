// src/app/api/admin/locked-accounts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/database/mongodb";
import { UserSecurityModel } from "@/database/schemas/user-security";
import { connectDB } from "@/database/mongodb";

// Helper function to escape regex special characters to prevent ReDoS attacks
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to get start of today
function getStartOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

// GET endpoint to fetch all locked accounts for admin management
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth.api.getSession(request);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user is admin (you may need to adjust this based on your role system)
    if (session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Admin access required" },
        { status: 403 }
      );
    }

    await connectDB();

    // Get query parameters for pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "lockedAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    // Build search filter
    let filter: any = { accountLocked: true };
    
    if (search) {
      // Escape regex special characters to prevent ReDoS attacks
      const escapedSearch = escapeRegex(search);
      filter.$or = [
        { lockedReason: { $regex: escapedSearch, $options: "i" } },
        { userId: { $regex: escapedSearch, $options: "i" } },
        { lockedBy: { $regex: escapedSearch, $options: "i" } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalCount = await UserSecurityModel.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch locked accounts with user details
    const lockedAccounts = await UserSecurityModel
      .find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get all unique user IDs from locked accounts
    const userIds = lockedAccounts
      .map((account) => account.userId)
      .filter((id): id is string => Boolean(id));

    // Fetch user details from Better-Auth user collection in bulk
    const usersCollection = db.collection("user");
    const users = await usersCollection
      .find({ id: { $in: userIds } })
      .toArray();

    // Create a map for quick lookup
    const userMap = new Map(
      users.map((user) => [user.id, { email: user.email, name: user.name }])
    );

    // Enrich accounts with user data
    const formattedAccounts = lockedAccounts.map((account) => {
      const userData = account.userId ? userMap.get(account.userId) : null;

      return {
        id: account._id.toString(),
        userId: account.userId,
        userEmail: userData?.email || null,
        userName: userData?.name || null,
        failedLoginCount: account.failedLoginCount,
        accountLocked: account.accountLocked,
        lockedAt: account.lockedAt,
        lockedBy: account.lockedBy,
        lockedReason: account.lockedReason,
        lastLoginAttempt: account.lastLoginAttempt,
        unlockRequest: account.unlockRequest || null,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        accounts: formattedAccounts,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });

  } catch (error) {
    console.error("Get locked accounts error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST endpoint to manually lock an account (admin action)
export async function POST(request: NextRequest) {
  try {
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
    const { userId, reason } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "userId is required" },
        { status: 400 }
      );
    }

    // Get or create user security record
    let userSecurity = await UserSecurityModel.findOne({ userId });
    
    if (!userSecurity) {
      userSecurity = new UserSecurityModel({
        userId,
        failedLoginCount: 0,
      });
    }

    // Lock the account manually
    userSecurity.accountLocked = true;
    userSecurity.lockedAt = new Date();
    userSecurity.lockedBy = session.user.id;
    userSecurity.lockedReason = reason || "Manually locked by admin";

    await userSecurity.save();

    return NextResponse.json({
      success: true,
      message: "Account locked successfully",
      data: {
        userId,
        lockedAt: userSecurity.lockedAt,
        lockedBy: session.user.id,
        lockedReason: userSecurity.lockedReason,
      },
    });

  } catch (error) {
    console.error("Lock account error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH endpoint to get security statistics
export async function PATCH(request: NextRequest) {
  try {
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

    const startOfToday = getStartOfToday();

    // Get total locked accounts count
    const totalLockedAccounts = await UserSecurityModel.countDocuments({ 
      accountLocked: true 
    });

    // Get failed attempts today - sum all failed login counts for users with attempts today
    // First, find users who had login attempts today
    const usersWithAttemptsToday = await UserSecurityModel.find({
      lastLoginAttempt: { $gte: startOfToday }
    }).select('failedLoginCount').lean();

    // Sum up all failed login attempts for users who attempted today
    const failedAttemptsToday = usersWithAttemptsToday.reduce((total, user) => {
      return total + (user.failedLoginCount || 0);
    }, 0);

    return NextResponse.json({
      success: true,
      data: {
        totalLockedAccounts,
        failedAttemptsToday,
      },
    });

  } catch (error) {
    console.error("Get security statistics error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}