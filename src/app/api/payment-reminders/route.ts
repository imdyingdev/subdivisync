import { NextResponse } from "next/server";
import { connectDB, db } from "@/database/mongodb";
import { sendEmail } from "@/resend/resend";

export async function POST() {
  try {
    await connectDB();
    const monthlyPaymentsCollection = db.collection("monthly_payments");
    const today = new Date();
    const sevenDaysFromNow = new Date(
      today.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    // Find payments due within 7 days
    const upcomingPayments = await monthlyPaymentsCollection
      .find({
        status: "pending",
        dueDate: {
          $gte: today.toISOString(),
          $lte: sevenDaysFromNow.toISOString(),
        },
      })
      .toArray();

    const emailPromises = upcomingPayments.map(async (payment) => {
      const daysUntilDue = Math.ceil(
        (new Date(payment.dueDate).getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const dueDateFormatted = new Date(payment.dueDate).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const amountFormatted = `₱${payment.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

      try {
        await sendEmail({
          to: [{ 
            email: payment.tenantEmail, 
            name: payment.tenantName 
          }],
          subject: `SubdiviSync Payment Reminder - Due ${dueDateFormatted}`,
          htmlContent: `
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
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">SubdiviSync</h1>
                    <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px;">Payment Reminder</p>
                  </div>
                  
                  <!-- Content -->
                  <div style="padding: 30px;">
                    <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hello ${payment.tenantName},</p>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                      This is a friendly reminder that your monthly payment is due in <strong>${daysUntilDue} day${daysUntilDue > 1 ? "s" : ""}</strong>.
                    </p>
                    
                    <!-- Payment Details -->
                    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Property:</td>
                          <td style="padding: 10px 0; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${payment.propertyTitle}</td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">Amount Due:</td>
                          <td style="padding: 10px 0; color: #16a34a; font-size: 16px; text-align: right; font-weight: 700; border-top: 1px solid #e5e7eb;">${amountFormatted}</td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">Due Date:</td>
                          <td style="padding: 10px 0; color: #111827; font-size: 14px; text-align: right; font-weight: 500; border-top: 1px solid #e5e7eb;">${dueDateFormatted}</td>
                        </tr>
                      </table>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                      Please ensure your payment is made on or before the due date to avoid late fees.
                    </p>
                    <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
                      If you have already made this payment, please disregard this notice.
                    </p>
                  </div>
                  
                  <!-- Footer -->
                  <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 12px;">Best regards,</p>
                    <p style="color: #374151; margin: 0; font-size: 14px; font-weight: 500;">SubdiviSync Management</p>
                  </div>
                  
                </div>
                
                <!-- Email Footer -->
                <div style="text-align: center; padding: 20px;">
                  <p style="color: #9ca3af; margin: 0; font-size: 11px;">&copy; ${new Date().getFullYear()} SubdiviSync. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          textContent: `SubdiviSync Payment Reminder

Hello ${payment.tenantName},

This is a friendly reminder that your monthly payment is due in ${daysUntilDue} day${daysUntilDue > 1 ? "s" : ""}.

Payment Details:
- Property: ${payment.propertyTitle}
- Amount Due: ${amountFormatted}
- Due Date: ${dueDateFormatted}

Please ensure your payment is made on or before the due date to avoid late fees.
If you have already made this payment, please disregard this notice.

Best regards,
SubdiviSync Management

&copy; ${new Date().getFullYear()} SubdiviSync. All rights reserved.
          `,
          sender: {
            email: process.env.BREVO_SENDER_EMAIL!,
            name: "SubdiviSync"
          }
        });

        // Update last reminder sent date
        await monthlyPaymentsCollection.updateOne(
          { _id: payment._id },
          {
            $set: {
              lastReminderSent: today.toISOString(),
              reminderCount: (payment.reminderCount || 0) + 1,
            },
          }
        );

        return { success: true, email: payment.tenantEmail };
      } catch (error) {
        console.error(`Failed to send email to ${payment.tenantEmail}:`, error);
        return { success: false, email: payment.tenantEmail, error };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Sent ${successCount} of ${upcomingPayments.length} payment reminders`,
      results,
    });
  } catch (error) {
    console.error("Error sending payment reminders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send payment reminders" },
      { status: 500 }
    );
  }
}