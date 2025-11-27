// scripts/reset-failed-login.js
// Run this script to reset failed login count for a specific user or all users
// Usage: 
//   node scripts/reset-failed-login.js                    - Reset all users
//   node scripts/reset-failed-login.js user@email.com     - Reset specific user by email

require('dotenv').config(); // Load .env file
const mongoose = require('mongoose');

// MongoDB Connection URI from .env file
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in .env file');
  console.log('Please add MONGODB_URI to your .env file');
  process.exit(1);
}

const UserSecuritySchema = new mongoose.Schema({
  userId: String,
  failedLoginCount: Number,
  accountLocked: Boolean,
  lockedAt: Date,
  lockedBy: String,
  lockedReason: String,
  unlockedAt: Date,
  unlockedBy: String,
  unlockReason: String,
  lastLoginAttempt: Date,
  lastSuccessfulLogin: Date,
  ipAddress: String,
}, {
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
});

const UserSchema = new mongoose.Schema({
  email: String,
  name: String,
  role: String,
});

async function resetFailedLogin() {
  try {
    const emailArg = process.argv[2];
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const UserSecurity = mongoose.model('UserSecurity', UserSecuritySchema);
    const User = mongoose.model('user', UserSchema);

    if (emailArg) {
      // Reset specific user by email
      console.log(`\n🔍 Looking up user with email: ${emailArg}`);
      
      const user = await User.findOne({ email: emailArg });
      
      if (!user) {
        console.log(`❌ No user found with email: ${emailArg}`);
        await mongoose.disconnect();
        process.exit(1);
      }

      const userId = user.id || user._id?.toString();
      console.log(`✅ Found user: ${user.name} (ID: ${userId})`);

      const userSecurity = await UserSecurity.findOne({ userId });

      if (!userSecurity) {
        console.log('ℹ️  No security record found for this user. Nothing to reset.');
        await mongoose.disconnect();
        process.exit(0);
      }

      console.log(`\n📊 Current status:`);
      console.log(`   - Failed login count: ${userSecurity.failedLoginCount}`);
      console.log(`   - Account locked: ${userSecurity.accountLocked}`);
      console.log(`   - Last login attempt: ${userSecurity.lastLoginAttempt || 'N/A'}`);

      if (userSecurity.failedLoginCount === 0 && !userSecurity.accountLocked) {
        console.log('\n✨ Account is already in good standing. Nothing to reset!');
        await mongoose.disconnect();
        process.exit(0);
      }

      // Reset the security record
      userSecurity.failedLoginCount = 0;
      userSecurity.accountLocked = false;
      userSecurity.lockedAt = undefined;
      userSecurity.lockedBy = undefined;
      userSecurity.lockedReason = undefined;
      userSecurity.unlockedAt = new Date();
      userSecurity.unlockReason = 'Reset via script';

      await userSecurity.save();

      console.log(`\n✅ Successfully reset security record for ${emailArg}!`);
      console.log('   - Failed login count: 0');
      console.log('   - Account locked: false');

    } else {
      // Reset all users
      const countBefore = await UserSecurity.countDocuments({ 
        $or: [
          { failedLoginCount: { $gt: 0 } },
          { accountLocked: true }
        ]
      });

      console.log(`\n📊 Found ${countBefore} user(s) with failed login attempts or locked accounts`);

      if (countBefore === 0) {
        console.log('✨ All accounts are in good standing. Nothing to reset!');
        await mongoose.disconnect();
        process.exit(0);
      }

      // List affected users
      const affectedRecords = await UserSecurity.find({
        $or: [
          { failedLoginCount: { $gt: 0 } },
          { accountLocked: true }
        ]
      });

      console.log('\n📋 Affected accounts:');
      for (const record of affectedRecords) {
        const user = await User.findOne({ 
          $or: [
            { id: record.userId },
            { _id: record.userId }
          ]
        });
        console.log(`   - ${user?.email || 'Unknown'}: ${record.failedLoginCount} failed attempts, locked: ${record.accountLocked}`);
      }

      console.log('\n⚠️  WARNING: This will reset failed login count for all affected users!');
      console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Reset all affected records
      const result = await UserSecurity.updateMany(
        {
          $or: [
            { failedLoginCount: { $gt: 0 } },
            { accountLocked: true }
          ]
        },
        {
          $set: {
            failedLoginCount: 0,
            accountLocked: false,
            lockedAt: null,
            lockedBy: null,
            lockedReason: null,
            unlockedAt: new Date(),
            unlockReason: 'Reset via script'
          }
        }
      );

      console.log(`\n✅ Successfully reset ${result.modifiedCount} security record(s)!`);
    }

    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
resetFailedLogin();
