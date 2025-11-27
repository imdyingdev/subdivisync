// src/database/schemas/user-security.ts
import mongoose, { Document, Model } from "mongoose";

export interface IUnlockRequest {
  email: string;
  reason: string;
  submittedAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'needs_more_info';
  adminNotes?: string;
}

export interface IUserSecurity {
  userId: string; // Reference to the Better-Auth user ID
  failedLoginCount: number;
  accountLocked: boolean;
  lockedAt?: Date;
  lockedBy?: string; // Admin user ID who locked the account
  lockedReason?: string;
  unlockedAt?: Date;
  unlockedBy?: string; // Admin user ID who unlocked the account
  unlockReason?: string;
  lastLoginAttempt?: Date;
  lastSuccessfulLogin?: Date;
  ipAddress?: string; // Last IP that attempted login
  lockEmailSent?: boolean; // Whether the lock notification email was sent
  unlockRequest?: IUnlockRequest; // Homeowner's unlock request
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserSecurityDocument extends Omit<IUserSecurity, "id">, Document {
  id: string;
}

// Create the UserSecurity schema
const UserSecuritySchema = new mongoose.Schema<IUserSecurityDocument>(
  {
    userId: { 
      type: String, 
      required: true, 
      unique: true,
      ref: "User"
    },
    failedLoginCount: { 
      type: Number, 
      required: true, 
      default: 0,
      min: 0,
      max: 10 // Prevent excessive values
    },
    accountLocked: { 
      type: Boolean, 
      required: true, 
      default: false 
    },
    lockedAt: { 
      type: Date 
    },
    lockedBy: { 
      type: String 
    },
    lockedReason: { 
      type: String, 
      maxLength: 500 
    },
    unlockedAt: { 
      type: Date 
    },
    unlockedBy: { 
      type: String 
    },
    unlockReason: { 
      type: String, 
      maxLength: 500 
    },
    lastLoginAttempt: { 
      type: Date 
    },
    lastSuccessfulLogin: { 
      type: Date 
    },
    ipAddress: { 
      type: String,
      validate: {
        validator: function(v: string) {
          // Basic IP address validation
          return !v || /^(\d{1,3}\.){3}\d{1,3}$/.test(v) || 
                 /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(v);
        },
        message: "Invalid IP address format"
      }
    },
    lockEmailSent: {
      type: Boolean,
      default: false
    },
    unlockRequest: {
      email: { type: String },
      reason: { type: String, maxLength: 1000 },
      submittedAt: { type: Date },
      status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected', 'needs_more_info'],
        default: 'pending'
      },
      adminNotes: { type: String, maxLength: 500 }
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Create compound indexes for better performance
UserSecuritySchema.index({ userId: 1 });
UserSecuritySchema.index({ accountLocked: 1 });
UserSecuritySchema.index({ lockedAt: -1 });

// Pre-save middleware to handle failedLoginCount limits
UserSecuritySchema.pre("save", function(next) {
  if (this.failedLoginCount > 10) {
    this.failedLoginCount = 10;
  }
  if (this.failedLoginCount < 0) {
    this.failedLoginCount = 0;
  }
  next();
});

// Export the model
export const UserSecurityModel: Model<IUserSecurityDocument> =
  mongoose.models.UserSecurity || 
  mongoose.model<IUserSecurityDocument>("UserSecurity", UserSecuritySchema);