// src/app/api/create-payment/verify-payment/route.ts
import { getServerSession } from "@/better-auth/action";
import { connectDB, db } from "@/database/mongodb";
import { sendEmail } from "@/resend/resend";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

const KEY = process.env.PAYMONGO_SECRET_API_KEY;

async function generateAndSaveReceipt(data: {
  requestId: string;
  paymentIntentId: string;
  amount: number;
  description: string;
}): Promise<string> {
  const receiptsCollection = db.collection("receipts");

  const receipt = {
    type: "service_payment",
    amount: data.amount,
    requestId: data.requestId,
    transactionId: data.paymentIntentId,
    paidDate: new Date().toISOString(),
    description: data.description,
    created_at: new Date().toISOString(),
  };

  const result = await receiptsCollection.insertOne(receipt);
  return result.insertedId.toString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function sendReceiptEmail(params: {
  userEmail: string;
  userName: string;
  receiptId: string;
  transactionId: string;
  amount: number;
  description: string;
  receiptUrl: string;
  paidDate: Date;
}): Promise<void> {
  const { userEmail, userName, receiptId, transactionId, amount, description, receiptUrl, paidDate } = params;

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
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Payment Receipt</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px;">SubdiviSync Payment System</p>
          </div>
          
          <!-- Success Icon -->
          <div style="text-align: center; padding: 30px 20px 10px 20px;">
            <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
              <tr>
                <td style="width: 60px; height: 60px; background-color: #dcfce7; border-radius: 50%; text-align: center; vertical-align: middle;">
                  <span style="color: #16a34a; font-size: 30px; line-height: 60px;">&#10003;</span>
                </td>
              </tr>
            </table>
            <h2 style="color: #16a34a; margin: 15px 0 5px 0; font-size: 20px;">Payment Successful!</h2>
            <p style="color: #6b7280; margin: 0; font-size: 14px;">Thank you for your payment</p>
          </div>
          
          <!-- Amount -->
          <div style="text-align: center; padding: 20px;">
            <p style="color: #6b7280; margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Total Amount Paid</p>
            <p style="color: #111827; margin: 0; font-size: 32px; font-weight: 700;">${formatCurrency(amount)}</p>
          </div>
          
          <!-- Receipt Details -->
          <div style="background-color: #f9fafb; margin: 0 20px; padding: 20px; border-radius: 8px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Receipt ID:</td>
                <td style="padding: 10px 0; color: #111827; font-size: 14px; text-align: right; font-family: monospace;">${receiptId}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">Payment Date:</td>
                <td style="padding: 10px 0; color: #111827; font-size: 14px; text-align: right; border-top: 1px solid #e5e7eb;">${formatDate(paidDate)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">Description:</td>
                <td style="padding: 10px 0; color: #111827; font-size: 14px; text-align: right; border-top: 1px solid #e5e7eb;">${description}</td>
              </tr>
            </table>
          </div>
          
          <!-- View Receipt Button -->
          <div style="padding: 30px 20px; text-align: center;">
            <a href="${receiptUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">View Full Receipt</a>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 12px;">This is an official receipt for your payment.</p>
            <p style="color: #9ca3af; margin: 0; font-size: 11px;">Thank you for using SubdiviSync.</p>
          </div>
          
        </div>
        
        <!-- Email Footer -->
        <div style="text-align: center; padding: 20px;">
          <p style="color: #9ca3af; margin: 0; font-size: 11px;">&copy; ${new Date().getFullYear()} SubdiviSync. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Payment Receipt - SubdiviSync
=============================

Payment Successful!

Dear ${userName},

Thank you for your payment. Here are your receipt details:

Total Amount Paid: ${formatCurrency(amount)}

Receipt Details:
- Receipt ID: ${receiptId}
- Payment Date: ${formatDate(paidDate)}
- Description: ${description}

View your full receipt online: ${receiptUrl}

This is an official receipt for your payment.
Thank you for using SubdiviSync.

&copy; ${new Date().getFullYear()} SubdiviSync. All rights reserved.
  `;

  await sendEmail({
    to: [{ email: userEmail, name: userName }],
    subject: `Your SubdiviSync Payment Receipt #${receiptId.slice(-8)}`,
    htmlContent,
    textContent,
    sender: {
      email: process.env.BREVO_SENDER_EMAIL!,
      name: "SubdiviSync",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { paymentIntentId, requestId } = await request.json();

    if (!paymentIntentId || !requestId) {
      return NextResponse.json(
        { success: false, error: "Missing payment intent ID or request ID" },
        { status: 400 }
      );
    }

    console.log("Verifying payment:", { paymentIntentId, requestId });

    // Get PayMongo API key from environment variables
    const KEY = process.env.PAYMONGO_SECRET_API_KEY;
    if (!KEY) {
      console.error("Missing PayMongo API key");
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Check payment intent status from PayMongo
    const paymongoResponse = await fetch(
      `https://api.paymongo.com/v1/payment_intents/${paymentIntentId}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Basic ${Buffer.from(`${KEY}:`).toString("base64")}`,
        },
      }
    );

    const paymongoData = await paymongoResponse.json();

    console.log("PayMongo response:", {
      status: paymongoResponse.status,
      paymentStatus: paymongoData.data?.attributes?.status,
    });

    if (!paymongoResponse.ok) {
      console.error("PayMongo API error:", paymongoData);
      return NextResponse.json(
        { success: false, error: "Failed to verify payment" },
        { status: paymongoResponse.status }
      );
    }

    const paymentStatus = paymongoData.data.attributes.status;
    const payments = paymongoData.data.attributes.payments || [];

    console.log("Payment intent details:", {
      status: paymentStatus,
      paymentsCount: payments.length,
    });

    // Check if there are successful payments attached
    let hasSuccessfulPayment = false;
    if (payments.length > 0) {
      for (const payment of payments) {
        try {
          const paymentResponse = await fetch(
            `https://api.paymongo.com/v1/payments/${payment.id}`,
            {
              method: "GET",
              headers: {
                accept: "application/json",
                authorization: `Basic ${Buffer.from(`${KEY}:`).toString("base64")}`,
              },
            }
          );

          if (paymentResponse.ok) {
            const paymentData = await paymentResponse.json();
            const pStatus = paymentData.data?.attributes?.status;
            console.log(`Payment ${payment.id} status:`, pStatus);

            if (pStatus === "paid" || pStatus === "succeeded") {
              hasSuccessfulPayment = true;
              console.log(" Found successful payment!");
              break;
            }
          }
        } catch (err) {
          console.error(`Error checking payment:`, err);
        }
      }
    }

    // Connect to MongoDB
    await connectDB();
    const serviceRequestsCollection = db.collection("service-requests");

    // Verify the service request exists
    const serviceRequest = await serviceRequestsCollection.findOne({
      _id: new ObjectId(requestId),
    });

    if (!serviceRequest) {
      return NextResponse.json(
        { success: false, error: "Service request not found" },
        { status: 404 }
      );
    }

    console.log("Service request found:", {
      id: serviceRequest._id,
      status: serviceRequest.status,
      payment_status: serviceRequest.payment_status,
      checkout_session_id: serviceRequest.checkout_session_id || "none",
    });

    // Try to retrieve checkout session if we have the ID
    if (!hasSuccessfulPayment && serviceRequest.checkout_session_id) {
      try {
        console.log("Retrieving checkout session:", serviceRequest.checkout_session_id);

        const sessionResponse = await fetch(
          `https://api.paymongo.com/v1/checkout_sessions/${serviceRequest.checkout_session_id}`,
          {
            method: "GET",
            headers: {
              accept: "application/json",
              authorization: `Basic ${Buffer.from(`${KEY}:`).toString("base64")}`,
            },
          }
        );

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          const sessionStatus = sessionData.data?.attributes?.status;
          const sessionPayments = sessionData.data?.attributes?.payments || [];

          console.log("Checkout session retrieved:", {
            status: sessionStatus,
            paymentsCount: sessionPayments.length,
          });

          // Check session status
          if (sessionStatus === "paid" || sessionStatus === "succeeded" || sessionStatus === "completed") {
            hasSuccessfulPayment = true;
            console.log(" Checkout session shows payment completed!");
          }

          // Check payments in session
          if (!hasSuccessfulPayment && sessionPayments.length > 0) {
            for (const payment of sessionPayments) {
              const paymentId = typeof payment === 'string' ? payment : payment.id;
              try {
                const pResponse = await fetch(
                  `https://api.paymongo.com/v1/payments/${paymentId}`,
                  {
                    method: "GET",
                    headers: {
                      accept: "application/json",
                      authorization: `Basic ${Buffer.from(`${KEY}:`).toString("base64")}`,
                    },
                  }
                );

                if (pResponse.ok) {
                  const pData = await pResponse.json();
                  const pStatus = pData.data?.attributes?.status;
                  console.log(`Session payment ${paymentId} status:`, pStatus);

                  if (pStatus === "paid" || pStatus === "succeeded") {
                    hasSuccessfulPayment = true;
                    console.log(" Found successful payment in checkout session!");
                    break;
                  }
                }
              } catch (err) {
                console.error("Error checking session payment:", err);
              }
            }
          }
        } else {
          console.log("Could not retrieve checkout session, status:", sessionResponse.status);
        }
      } catch (err) {
        console.error("Error retrieving checkout session:", err);
      }
    }

    // Update local payment status based on PayMongo status
    let localStatus: "pending" | "paid" | "failed" = "pending";

    if (paymentStatus === "succeeded" || hasSuccessfulPayment) {
      localStatus = "paid";
    } else if (
      paymentStatus === "awaiting_payment_method" ||
      paymentStatus === "awaiting_next_action" ||
      paymentStatus === "processing"
    ) {
      localStatus = "pending";
    } else {
      localStatus = "failed";
    }

    console.log("Determined local status:", localStatus);

    const updateData: Record<string, unknown> = {
      payment_status: localStatus,
      updated_at: new Date(),
    };

    if (localStatus === "paid") {
      updateData.payment_id = paymentIntentId;
      updateData.paid_at = new Date();

      // Generate receipt
      try {
        const receiptId = await generateAndSaveReceipt({
          requestId: requestId,
          paymentIntentId: paymentIntentId,
          amount: serviceRequest?.final_cost || serviceRequest?.estimated_cost || 0,
          description: `Payment for ${serviceRequest?.category || "service"} service`,
        });

        // Fix: Get the correct base URL - prioritize local URL in development
        const baseUrl = process.env.NODE_ENV === 'development'
          ? (process.env.BETTER_AUTH_URL || `http://${request.headers.get('host')}`)
          : (process.env.NEXT_PUBLIC_URL || `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`);
        
        console.log("Using base URL for receipt:", baseUrl);

        updateData.receipt_url = `${baseUrl}/receipts/${receiptId}`;
        console.log("Receipt generated with URL:", updateData.receipt_url);

        // Send receipt email
        try {
          const paymentAmount = serviceRequest?.final_cost || serviceRequest?.estimated_cost || 0;
          const paymentDescription = `Payment for ${serviceRequest?.category || "service"} service`;
          
          await sendReceiptEmail({
            userEmail: session.user.email,
            userName: session.user.name || "Valued Customer",
            receiptId: receiptId,
            transactionId: paymentIntentId,
            amount: paymentAmount,
            description: paymentDescription,
            receiptUrl: updateData.receipt_url as string,
            paidDate: new Date(),
          });
          console.log("Receipt email sent to:", session.user.email);
        } catch (emailError) {
          console.error("Error sending receipt email:", emailError);
          // Continue without email if there's an error
        }
      } catch (receiptError) {
        console.error("Error generating receipt:", receiptError);
        // Continue without receipt if there's an error
      }
    }

    const result = await serviceRequestsCollection.updateOne(
      { _id: new ObjectId(requestId) },
      { $set: updateData }
    );

    console.log("Database update result:", {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });

    if (result.matchedCount === 0) {
      console.error("Service request not found for update:", requestId);
      return NextResponse.json(
        { success: false, error: "Service request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      status: paymentStatus,
      localStatus: localStatus,
      receiptUrl: updateData.receipt_url,
      amount: serviceRequest?.final_cost || serviceRequest?.estimated_cost || 0,
      description: `Payment for ${serviceRequest?.category || "service"} service`,
    });

  } catch (error) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}