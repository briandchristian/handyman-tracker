// Script to create or reset admin account
// Usage:
//   node reset-admin.js create <username> <email> <password> [role]
//   node reset-admin.js reset <username-or-email> <new-password>
//   node reset-admin.js list
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { 
    type: String, 
    enum: ['pending', 'admin', 'super-admin'], 
    default: 'pending' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function resetAdmin() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI not found in environment variables');
    }

    const command = process.argv[2];

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected!\n');

    if (command === 'create') {
      // Create new admin: node reset-admin.js create <username> <email> <password> [role]
      const username = process.argv[3];
      const email = process.argv[4];
      const password = process.argv[5];
      const role = process.argv[6] || 'super-admin';

      if (!username || !email || !password) {
        console.log('❌ Usage: node reset-admin.js create <username> <email> <password> [role]');
        console.log('   Example: node reset-admin.js create admin admin@example.com mypassword123 super-admin');
        process.exit(1);
      }

      if (!['admin', 'super-admin'].includes(role)) {
        console.log('❌ Role must be "admin" or "super-admin"');
        process.exit(1);
      }

      // Check if username or email already exists
      const existing = await User.findOne({ $or: [{ username }, { email }] });
      if (existing) {
        console.log(`❌ Error: User with username "${username}" or email "${email}" already exists!`);
        console.log(`   Existing user: ${existing.username} (${existing.email})`);
        process.exit(1);
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newAdmin = new User({
        username,
        password: hashedPassword,
        email,
        role,
        status: 'approved',
        createdAt: new Date()
      });

      await newAdmin.save();
      console.log('✅ Admin account created successfully!');
      console.log(`   Username: ${username}`);
      console.log(`   Email: ${email}`);
      console.log(`   Role: ${role}`);
      console.log(`   Password: ${password}`);
      console.log('\nYou can now log in with these credentials.');

    } else if (command === 'reset') {
      // Reset password: node reset-admin.js reset <username-or-email> <new-password>
      const identifier = process.argv[3];
      const newPassword = process.argv[4];

      if (!identifier || !newPassword) {
        console.log('❌ Usage: node reset-admin.js reset <username-or-email> <new-password>');
        console.log('   Example: node reset-admin.js reset admin newpassword123');
        process.exit(1);
      }

      const user = await User.findOne({ 
        $or: [{ username: identifier }, { email: identifier }] 
      });

      if (!user) {
        console.log(`❌ Error: No user found with username or email "${identifier}"`);
        process.exit(1);
      }

      if (!['admin', 'super-admin'].includes(user.role)) {
        console.log(`❌ Error: User "${identifier}" is not an admin (current role: ${user.role})`);
        console.log('   Use "list" command to see all admin accounts.');
        process.exit(1);
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      user.status = 'approved'; // Ensure they're approved
      await user.save();

      console.log('✅ Password reset successfully!');
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   New Password: ${newPassword}`);
      console.log('\nYou can now log in with the new password.');

    } else if (command === 'list') {
      // List all admins
      const admins = await User.find({ 
        role: { $in: ['admin', 'super-admin'] } 
      }).select('username email role status createdAt').sort({ createdAt: -1 });

      if (admins.length === 0) {
        console.log('❌ No admin accounts found.');
      } else {
        console.log(`✅ Found ${admins.length} admin account(s):\n`);
        admins.forEach((admin, index) => {
          console.log(`${index + 1}. Username: ${admin.username}`);
          console.log(`   Email: ${admin.email}`);
          console.log(`   Role: ${admin.role}`);
          console.log(`   Status: ${admin.status}`);
          console.log(`   Created: ${admin.createdAt}`);
          console.log('');
        });
      }

    } else {
      console.log('Admin Account Management Tool\n');
      console.log('Usage:');
      console.log('  Create new admin:');
      console.log('    node reset-admin.js create <username> <email> <password> [role]');
      console.log('    Example: node reset-admin.js create admin admin@example.com mypassword123 super-admin\n');
      console.log('  Reset password:');
      console.log('    node reset-admin.js reset <username-or-email> <new-password>');
      console.log('    Example: node reset-admin.js reset admin newpassword123\n');
      console.log('  List all admins:');
      console.log('    node reset-admin.js list\n');
      process.exit(1);
    }

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.code === 11000) {
      console.error('   Duplicate key error - username or email already exists');
    }
    await mongoose.disconnect();
    process.exit(1);
  }
}

resetAdmin();
