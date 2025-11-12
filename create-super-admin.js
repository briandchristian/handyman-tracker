// Quick script to create a super-admin for testing
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true },
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

async function createSuperAdmin() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI not found in environment variables');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // Check if any super-admin exists
    const existingSuperAdmin = await User.findOne({ role: 'super-admin' });
    if (existingSuperAdmin) {
      console.log('✅ Super-admin already exists:', existingSuperAdmin.username);
      process.exit(0);
    }

    // Create super-admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const superAdmin = new User({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@example.com',
      role: 'super-admin',
      status: 'approved',
      createdAt: new Date()
    });

    await superAdmin.save();
    console.log('✅ Super-admin created successfully!');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Email: admin@example.com');
    console.log('\nYou can now log in with these credentials.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createSuperAdmin();

