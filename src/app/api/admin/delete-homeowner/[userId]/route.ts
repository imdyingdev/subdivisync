import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { client } from "@/database/mongodb";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    // Verify admin session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 }
      );
    }

    await client.connect();
    const db = client.db("subdivisync");

    // Check if the user exists and is a tenant/homeowner
    const user = await db.collection("user").findOne({ id: userId });
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Homeowner not found" },
        { status: 404 }
      );
    }

    if (user.role !== "tenant") {
      return NextResponse.json(
        { success: false, message: "Can only delete homeowner accounts" },
        { status: 400 }
      );
    }

    // Check if homeowner has any active property leases
    const hasActiveLease = await db.collection("properties").findOne({
      "leasedTo.userId": userId,
      status: "LEASED"
    });

    if (hasActiveLease) {
      return NextResponse.json(
        { success: false, message: "Cannot delete homeowner with active property lease. Please end the lease first." },
        { status: 400 }
      );
    }

    // Delete associated data
    // 1. Delete user security records
    await db.collection("user_security").deleteMany({ userId: userId });
    
    // 2. Delete sessions
    await db.collection("session").deleteMany({ userId: userId });
    
    // 3. Delete accounts (OAuth links)
    await db.collection("account").deleteMany({ userId: userId });
    
    // 4. Remove user's inquiries from properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.collection("properties").updateMany(
      { "inquiries.email": user.email },
      { $pull: { inquiries: { email: user.email } as any } }
    );
    
    // 5. Delete service requests
    await db.collection("service_requests").deleteMany({ user_id: userId });
    
    // 6. Finally delete the user
    await db.collection("user").deleteOne({ id: userId });

    return NextResponse.json({
      success: true,
      message: "Homeowner deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting homeowner:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete homeowner" },
      { status: 500 }
    );
  }
}
