import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();

// Trust proxy to get real client IPs (important for LAN connections)
app.set('trust proxy', true);

// Helper function to get client IP address (defined early for use in middleware)
const getClientIp = (req) => {
  // Try multiple methods to get the real client IP
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, get the first one (original client)
    return forwarded.split(',')[0].trim();
  }
  
  // Express's req.ip (works with trust proxy setting)
  if (req.ip) {
    // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
    return req.ip.replace(/^::ffff:/, '');
  }
  
  // Fallback to socket address
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress.replace(/^::ffff:/, '');
  }
  
  // Last resort
  return 'Unknown';
};

app.use(cors());
app.use(express.json());

// Debug middleware - log authentication-related requests with IP
app.use((req, res, next) => {
  const authEndpoints = ['/api/login', '/api/register'];
  if (authEndpoints.includes(req.url)) {
    const timestamp = new Date().toISOString();
    const clientIp = getClientIp(req);
    console.log(`[${timestamp}] 📥 ${req.method} ${req.url} - IP: ${clientIp}`);
  }
  next();
});

// MongoDB connection with caching for serverless
let cachedDb = null;
let isConnecting = false;

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined in environment variables.');
  }

  // Use cached connection if available and ready
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }

  // If already connecting, wait for that connection
  if (isConnecting) {
    console.log('Waiting for existing connection attempt...');
    let attempts = 0;
    while (isConnecting && attempts < 50) { // Wait up to 5 seconds
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
  }

  try {
    isConnecting = true;
    console.log('Establishing new MongoDB connection...');
    
    // Disconnect if in a bad state
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds for serverless cold starts
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    
    cachedDb = mongoose.connection;
    console.log('MongoDB connected successfully');
    return cachedDb;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    cachedDb = null;
    throw err;
  } finally {
    isConnecting = false;
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
  cachedDb = null;
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  cachedDb = null;
});

// Connect to MongoDB on startup (for local development)
if (process.env.VERCEL !== '1') {
  connectDB().catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
}

// Ensure DB connection before handling requests (for serverless)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection failed:', err);
    console.error('MongoDB URI present:', !!process.env.MONGO_URI);
    
    let errorMsg = 'Database connection error. Please try again.';
    if (err.message.includes('ENOTFOUND')) {
      errorMsg = 'Cannot reach database server. Please check your MongoDB connection string.';
    } else if (err.message.includes('authentication failed')) {
      errorMsg = 'Database authentication failed. Please check your MongoDB credentials.';
    } else if (err.message.includes('timeout')) {
      errorMsg = 'Database connection timed out. Please try again in a moment.';
    }
    
    return res.status(503).json({ 
      msg: errorMsg,
      details: process.env.NODE_ENV === 'development' ? err.message : 'Service temporarily unavailable'
    });
  }
});

// Models
const customerSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  address: String,
  projects: [{
    name: String,
    description: String,
    bidAmount: Number,
    billAmount: Number,
    status: { type: String, enum: ['Pending', 'Bidded', 'Scheduled', 'Completed', 'Billed'] },
    scheduleDate: Date,
    materials: [{ item: String, quantity: Number, cost: Number }],
    createdAt: { type: Date, default: Date.now }
  }]
});
const Customer = mongoose.model('Customer', customerSchema);

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

// Middleware for auth
const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  const clientIp = getClientIp(req);
  const timestamp = new Date().toISOString();
  const endpoint = req.originalUrl || req.url;
  
  if (!token) {
    console.log(`[${timestamp}] ❌ AUTH FAILED - No token provided - IP: ${clientIp} - Endpoint: ${endpoint}`);
    return res.status(401).json({ msg: 'No token' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user to check status
    const user = await User.findById(decoded.id);
    if (!user) {
      console.log(`[${timestamp}] ❌ AUTH FAILED - User not found - IP: ${clientIp} - Endpoint: ${endpoint}`);
      return res.status(401).json({ msg: 'User not found' });
    }
    
    if (user.status !== 'approved') {
      console.log(`[${timestamp}] ❌ AUTH FAILED - User not approved (status: ${user.status}) - IP: ${clientIp} - Endpoint: ${endpoint}`);
      return res.status(403).json({ msg: 'Your account is pending admin approval', status: user.status });
    }
    
    req.user = { id: decoded.id, role: user.role, username: user.username };
    console.log(`[${timestamp}] ✅ AUTH SUCCESS - User: ${user.username} (${user.role}) - IP: ${clientIp} - Endpoint: ${endpoint}`);
    next();
  } catch (err) {
    console.log(`[${timestamp}] ❌ AUTH FAILED - Invalid/Expired token - IP: ${clientIp} - Endpoint: ${endpoint} - Error: ${err.message}`);
    res.status(401).json({ msg: 'Invalid token' });
  }
};

// Middleware for admin-only routes
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
    return res.status(403).json({ msg: 'Access denied. Admin privileges required.' });
  }
  next();
};

// Middleware for super-admin-only routes
const superAdminMiddleware = (req, res, next) => {
  if (req.user.role !== 'super-admin') {
    return res.status(403).json({ msg: 'Access denied. Super admin privileges required.' });
  }
  next();
};

// Routes

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    const clientIp = getClientIp(req);
    const timestamp = new Date().toISOString();

    // Validation
    if (!username || !password || !email) {
      console.log(`[${timestamp}] ❌ REGISTRATION FAILED - Missing credentials - IP: ${clientIp}`);
      return res.status(400).json({ msg: 'Username, password, and email are required' });
    }

    if (username.length < 3) {
      console.log(`[${timestamp}] ❌ REGISTRATION FAILED - Username too short: "${username}" - IP: ${clientIp}`);
      return res.status(400).json({ msg: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      console.log(`[${timestamp}] ❌ REGISTRATION FAILED - Password too short for user: "${username}" - IP: ${clientIp}`);
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log(`[${timestamp}] ❌ REGISTRATION FAILED - Invalid email: "${email}" - IP: ${clientIp}`);
      return res.status(400).json({ msg: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      console.log(`[${timestamp}] ❌ REGISTRATION FAILED - Username or email already exists: "${username}" - IP: ${clientIp}`);
      return res.status(400).json({ msg: 'Username or email already exists' });
    }

    // Check if a super-admin already exists (atomic check to prevent race condition)
    // This is more reliable than counting all users, as it directly checks for the condition we care about
    const existingSuperAdmin = await User.findOne({ role: 'super-admin' });
    const isFirstUser = !existingSuperAdmin;
    const role = isFirstUser ? 'super-admin' : 'pending';
    const status = isFirstUser ? 'approved' : 'pending';

    // Hash password and create user
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ 
      username, 
      password: hashed, 
      email,
      role,
      status
    });
    await user.save();

    // After save, verify we're still the only super-admin (handle race condition)
    // If multiple super-admins were created simultaneously, keep only the first one
    if (isFirstUser && role === 'super-admin') {
      const allSuperAdmins = await User.find({ role: 'super-admin' }).sort({ createdAt: 1 });
      if (allSuperAdmins.length > 1) {
        // Multiple super-admins exist - keep only the first one (oldest by createdAt)
        const firstSuperAdmin = allSuperAdmins[0];
        if (user._id.toString() !== firstSuperAdmin._id.toString()) {
          // We're not the first super-admin, downgrade to pending
          user.role = 'pending';
          user.status = 'pending';
          await user.save();
          console.log(`[${timestamp}] ⚠️ RACE CONDITION HANDLED - User "${username}" downgraded from super-admin to pending - IP: ${clientIp}`);
          
          res.status(201).json({ 
            msg: 'Registration successful! Your account is pending admin approval. You will be notified when approved.',
            status: 'pending'
          });
          return;
        }
      }
    }

    console.log(`[${timestamp}] ✅ REGISTRATION SUCCESS - New user: "${username}" (${role}/${status}) - IP: ${clientIp}`);
    
    if (isFirstUser && role === 'super-admin') {
      res.status(201).json({ 
        msg: 'First user created successfully as super-admin. You can now login.',
        role: 'super-admin'
      });
    } else {
      res.status(201).json({ 
        msg: 'Registration successful! Your account is pending admin approval. You will be notified when approved.',
        status: 'pending'
      });
    }
  } catch (err) {
    const timestamp = new Date().toISOString();
    const clientIp = getClientIp(req);
    console.error(`[${timestamp}] ❌ REGISTRATION ERROR - IP: ${clientIp} - Error:`, err.message);
    res.status(500).json({ msg: 'Server error during registration' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const clientIp = getClientIp(req);
    const timestamp = new Date().toISOString();
    
    // Validation
    if (!username || !password) {
      console.log(`[${timestamp}] ❌ LOGIN FAILED - Missing credentials - IP: ${clientIp}`);
      return res.status(400).json({ msg: 'Username and password are required' });
    }
    
    const user = await User.findOne({ username });
    
    if (!user) {
      console.log(`[${timestamp}] ❌ LOGIN FAILED - User not found: "${username}" - IP: ${clientIp}`);
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log(`[${timestamp}] ❌ LOGIN FAILED - Invalid password for user: "${username}" - IP: ${clientIp}`);
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    
    // Check if user is approved
    if (user.status === 'pending') {
      console.log(`[${timestamp}] ❌ LOGIN FAILED - User pending approval: "${username}" - IP: ${clientIp}`);
      return res.status(403).json({ 
        msg: 'Your account is pending admin approval. Please wait for an administrator to approve your account.',
        status: 'pending'
      });
    }
    
    if (user.status === 'rejected') {
      console.log(`[${timestamp}] ❌ LOGIN FAILED - User rejected: "${username}" - IP: ${clientIp}`);
      return res.status(403).json({ 
        msg: 'Your account has been rejected. Please contact an administrator.',
        status: 'rejected'
      });
    }
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log(`[${timestamp}] ✅ LOGIN SUCCESS - User: "${username}" (${user.role}) - IP: ${clientIp}`);
    res.json({ 
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    const timestamp = new Date().toISOString();
    const clientIp = getClientIp(req);
    console.error(`[${timestamp}] ❌ LOGIN ERROR - IP: ${clientIp} - Error:`, err.message);
    res.status(500).json({ msg: 'Server error during login' });
  }
});

// Public Customer Bid Route (no authentication required)
app.post('/api/customer-bid', async (req, res) => {
  try {
    const { name, email, phone, address, projectName, projectDescription } = req.body;

    // Validation
    if (!name || !email || !phone) {
      return res.status(400).json({ msg: 'Name, email, and phone are required' });
    }

    if (!projectName || !projectDescription) {
      return res.status(400).json({ msg: 'Project name and description are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ msg: 'Invalid email format' });
    }

    // Check if customer already exists by email
    let customer = await Customer.findOne({ email });

    if (customer) {
      // Customer exists, add new project to existing customer
      customer.projects.push({
        name: projectName,
        description: projectDescription,
        status: 'Pending',
        createdAt: new Date()
      });
      await customer.save();
      res.json({ 
        msg: 'Bid request submitted successfully! We found your existing account and added this project to it.',
        customer: {
          name: customer.name,
          email: customer.email
        }
      });
    } else {
      // Create new customer with the project
      const newCustomer = new Customer({
        name,
        email,
        phone,
        address: address || '',
        projects: [{
          name: projectName,
          description: projectDescription,
          status: 'Pending',
          createdAt: new Date()
        }]
      });
      await newCustomer.save();
      res.status(201).json({ 
        msg: 'Bid request submitted successfully! We will contact you soon.',
        customer: {
          name: newCustomer.name,
          email: newCustomer.email
        }
      });
    }
  } catch (err) {
    console.error('Error submitting customer bid:', err);
    res.status(500).json({ msg: 'Server error during bid submission', error: err.message });
  }
});

// Admin User Management Routes
// Get all users (admin only)
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('approvedBy', 'username')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Get pending users (admin only)
app.get('/api/admin/users/pending', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pendingUsers = await User.find({ status: 'pending' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(pendingUsers);
  } catch (err) {
    console.error('Error fetching pending users:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Approve user (admin only)
app.put('/api/admin/users/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { role } = req.body; // 'admin' to approve as admin, or omit/undefined to approve with current role
    const userId = req.params.id;

    // Role is optional - if provided, must be 'admin'
    if (role && role !== 'admin') {
      return res.status(400).json({ msg: 'Invalid role. Must be "admin" if provided.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (user.status === 'approved') {
      return res.status(400).json({ msg: 'User is already approved' });
    }

    user.status = 'approved';
    // Approved users become admins (per ADMIN_APPROVAL_SYSTEM.md: "Approve: User becomes an admin and can log in")
    // The role parameter is for future extensibility, but currently all approved users become admins
    user.role = 'admin';
    user.approvedBy = req.user.id;
    user.approvedAt = new Date();
    await user.save();

    console.log(`✅ User approved: ${user.username} by ${req.user.username}`);
    res.json({ 
      msg: `User ${user.username} has been approved as ${user.role}`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    console.error('Error approving user:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Reject user (admin only)
app.put('/api/admin/users/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.status = 'rejected';
    await user.save();

    console.log(`❌ User rejected: ${user.username} by ${req.user.username}`);
    res.json({ 
      msg: `User ${user.username} has been rejected`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        status: user.status
      }
    });
  } catch (err) {
    console.error('Error rejecting user:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Delete user (super-admin only)
app.delete('/api/admin/users/:id', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({ msg: 'Cannot delete your own account' });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    console.log(`🗑️ User deleted: ${user.username} by ${req.user.username}`);
    res.json({ msg: `User ${user.username} has been deleted` });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Promote user to super-admin (super-admin only)
app.put('/api/admin/users/:id/promote', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (user.role === 'super-admin') {
      return res.status(400).json({ msg: 'User is already a super-admin' });
    }

    user.role = 'super-admin';
    user.status = 'approved';
    await user.save();

    console.log(`⭐ User promoted: ${user.username} by ${req.user.username}`);
    res.json({ 
      msg: `User ${user.username} has been promoted to super-admin`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Error promoting user:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Customer Routes (protected)
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.get('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const customerId = req.params.id.trim();
    console.log('Fetching customer with ID:', customerId);
    console.log('ID length:', customerId.length);
    console.log('ID type:', typeof customerId);
    
    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      console.error('Invalid customer ID format:', customerId);
      return res.status(400).json({ msg: 'Invalid customer ID format', id: customerId });
    }
    
    // Try multiple query methods
    let customer = null;
    
    // Method 1: Try findById with string
    customer = await Customer.findById(customerId);
    
    // Method 2: If not found, try with ObjectId conversion
    if (!customer) {
      try {
        const objectId = new mongoose.Types.ObjectId(customerId);
        customer = await Customer.findById(objectId);
      } catch (objIdErr) {
        console.error('Error converting to ObjectId:', objIdErr);
      }
    }
    
    // Method 3: Try findOne with _id field
    if (!customer) {
      customer = await Customer.findOne({ _id: customerId });
    }
    
    // Method 4: Try findOne with _id as ObjectId
    if (!customer) {
      try {
        const objectId = new mongoose.Types.ObjectId(customerId);
        customer = await Customer.findOne({ _id: objectId });
      } catch (objIdErr) {
        console.error('Error with ObjectId findOne:', objIdErr);
      }
    }
    
    if (!customer) {
      console.error('Customer not found with ID:', customerId);
      // List all customer IDs for debugging
      const allCustomers = await Customer.find({}, '_id name');
      const customerList = allCustomers.map(c => ({ 
        id: c._id.toString(), 
        idType: typeof c._id,
        name: c.name 
      }));
      console.log('Available customers:', customerList);
      console.log('Searching for ID:', customerId);
      console.log('Available IDs:', customerList.map(c => c.id));
      
      // Check if the ID exists but with different format
      const matchingId = customerList.find(c => c.id === customerId || c.id.toLowerCase() === customerId.toLowerCase());
      if (matchingId) {
        console.log('Found matching ID with different case:', matchingId);
      }
      
      return res.status(404).json({ 
        msg: 'Customer not found', 
        id: customerId,
        availableCustomers: customerList
      });
    }
    
    // Ensure projects array exists
    if (!customer.projects) {
      customer.projects = [];
    }
    console.log('Customer found:', customer.name, 'with', customer.projects.length, 'projects');
    console.log('Customer ID:', customer._id.toString());
    res.json(customer);
  } catch (err) {
    console.error('Error fetching customer:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/customers', authMiddleware, async (req, res) => {
  try {
    const customerData = { ...req.body };
    // Ensure projects array is initialized
    if (!customerData.projects) {
      customerData.projects = [];
    }
    const customer = new Customer(customerData);
    await customer.save();
    res.json(customer);
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    
    // Update customer fields
    if (req.body.name) customer.name = req.body.name;
    if (req.body.email) customer.email = req.body.email;
    if (req.body.phone) customer.phone = req.body.phone;
    if (req.body.address !== undefined) customer.address = req.body.address;
    
    await customer.save();
    console.log('Customer updated:', customer.name);
    res.json(customer);
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.delete('/api/customers/:id', authMiddleware, async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  res.json({ msg: 'Customer deleted' });
});

// Project Routes (nested under customer)
app.post('/api/customers/:customerId/projects', authMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    customer.projects.push(req.body);
    await customer.save();
    // Return the newly created project (last one in the array)
    const newProject = customer.projects[customer.projects.length - 1];
    res.json(newProject);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.delete('/api/customers/:customerId/projects/:projectId', authMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    
    // Use pull instead of remove
    customer.projects.pull(req.params.projectId);
    await customer.save();
    
    console.log('Project deleted:', req.params.projectId);
    res.json({ msg: 'Project deleted' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customers/:customerId/projects/:projectId/bid', authMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    project.bidAmount = req.body.bidAmount;
    project.status = 'Bidded';
    await customer.save();
    res.json(project);
  } catch (err) {
    console.error('Error updating bid:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customers/:customerId/projects/:projectId/bill', authMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    project.billAmount = req.body.billAmount;
    project.status = 'Billed';
    await customer.save();
    res.json(project);
  } catch (err) {
    console.error('Error updating bill:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customers/:customerId/projects/:projectId/schedule', authMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    project.scheduleDate = req.body.scheduleDate;
    project.status = 'Scheduled';
    await customer.save();
    res.json(project);
  } catch (err) {
    console.error('Error updating schedule:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customers/:customerId/projects/:projectId/complete', authMiddleware, async (req, res) => {
  try {
    console.log('Marking project as complete - Customer ID:', req.params.customerId, 'Project ID:', req.params.projectId);
    
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      console.error('Customer not found:', req.params.customerId);
      return res.status(404).json({ msg: 'Customer not found', customerId: req.params.customerId });
    }
    
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      console.error('Project not found:', req.params.projectId);
      const availableProjects = customer.projects.map(p => ({ id: p._id.toString(), name: p.name }));
      console.log('Available projects:', availableProjects);
      return res.status(404).json({ 
        msg: 'Project not found', 
        projectId: req.params.projectId,
        availableProjects 
      });
    }
    
    project.status = 'Completed';
    await customer.save();
    console.log('Project marked as completed:', project.name);
    res.json(project);
  } catch (err) {
    console.error('Error marking project as completed:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/customers/:customerId/projects/:projectId/materials', authMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    
    project.materials.push(req.body);
    await customer.save();
    
    console.log('Material added to project:', project.name);
    res.json(project.materials);
  } catch (err) {
    console.error('Error adding material:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.delete('/api/customers/:customerId/projects/:projectId/materials/:materialId', authMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    
    // Use pull instead of remove
    project.materials.pull(req.params.materialId);
    await customer.save();
    
    console.log('Material deleted:', req.params.materialId);
    res.json({ msg: 'Material deleted', materials: project.materials });
  } catch (err) {
    console.error('Error deleting material:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

const PORT = process.env.PORT || 5000;

// Only start the server if not in Vercel (serverless) environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Server running on port ${PORT} (accessible on LAN)`);
    console.log(`📝 Authentication logging: ENABLED (with IP detection)`);
    console.log(`   - Login attempts will be logged`);
    console.log(`   - Token validation will be tracked`);
    console.log(`   - Client IP addresses will be recorded`);
    console.log(`   - Trust proxy: ENABLED for LAN clients`);
    console.log(`${'='.repeat(60)}\n`);
  });
}

// Export for Vercel serverless functions
export default app;