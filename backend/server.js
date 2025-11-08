require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables. Please create a .env file with MONGO_URI.');
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1); // Exit process with failure
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

// Connect to MongoDB
connectDB();

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
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Middleware for auth
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ msg: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Invalid token' });
  }
};

// Routes

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ msg: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ msg: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ msg: 'Username already exists' });
    }

    // Hash password and create user
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed });
    await user.save();

    res.status(201).json({ msg: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ msg: 'Server error during registration' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(400).json({ msg: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
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

// Customer Routes (protected)
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const customers = await Customer.find();
    // Debug: Log all customer IDs
    console.log('All customers:', customers.map(c => ({ 
      id: c._id.toString(), 
      name: c.name 
    })));
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));