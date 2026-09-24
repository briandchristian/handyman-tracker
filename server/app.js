// Load .env first. `override: true` so project .env wins over stale MONGO_* vars in Windows User/System
// environment (default dotenv does not override existing vars — a common cause of persistent "bad auth").
import dotenv from 'dotenv';
import { shouldOverrideDotenv } from './lib/envConfig.js';
dotenv.config({ override: shouldOverrideDotenv(process.env) });
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  applyMongoDatabaseName,
  mongoConnectionStringMissingDbName,
} from './lib/mongoUri.js';
import { fetchAdiPriceAndInventoryDetails } from './lib/suppliers/adiPriceInventory.js';
import { fetchAdiOrderGeneration } from './lib/suppliers/adiOrderGeneration.js';
import { fetchAdiOrderInquiry } from './lib/suppliers/adiOrderInquiry.js';
import { sendMetaLeadEvent } from './lib/metaCapi.js';
import {
  applyJobUsageToProject,
  applyStockChange,
  isDuplicateKeyError,
  jobAssignmentError,
  normalizeSku,
  reconcileCount,
} from './lib/inventoryStock.js';
import { buildAccountingSummary } from './lib/accountingSummary.js';
import { normalizeCostCenterCode } from './lib/costCenters.js';
import { isKnownLaborWorkType, normalizeLaborWorkType } from './lib/laborWorkTypes.js';
import { normalizeProjectWorkType, serviceHistoryTypeFromProjectWorkType } from './lib/projectWorkTypes.js';
import { parseRangeBound } from './lib/dateRange.js';
import { ensureCostCenters } from './lib/seedCostCenters.js';
import {
  collectAccountNumbers,
  collectJobNumbers,
  ensureJobIdentity,
  isUniqueNumber,
  nextAccountNumber,
  nextJobNumber,
  normalizeNumber,
} from './lib/jobIdentity.js';
import {
  DEFAULT_SUBCONTRACTOR_JOB_TYPE,
  DEFAULT_SUBCONTRACTOR_STATUS,
  SUBCONTRACTOR_JOB_TYPE_VALUES,
  SUBCONTRACTOR_STATUS_VALUES,
  filterWorkOrdersByStatus,
  isKnownStatus,
  validateWorkOrder,
} from './lib/subcontractorWorkOrders.js';

const app = express();

// Toggleable API debug logging (set DEBUG_API=1 in env to enable; see docs/VERCEL_DEBUG_AND_TESTING.md)
const DEBUG_API = /^(1|true|yes)$/i.test(process.env.DEBUG_API || '');

// Trust proxy to get real client IPs (important for LAN connections)
app.set('trust proxy', true);

// On Vercel, same-origin POST can have empty req.body; read raw stream first for JSON
if (process.env.VERCEL === '1') {
  app.use((req, res, next) => {
    if (!/^(POST|PUT|PATCH)$/i.test(req.method)) return next();
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('application/json')) return next();
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        req.body = raw ? JSON.parse(raw) : {};
      } catch (_) {
        req.body = {};
      }
      next();
    });
    req.on('error', next);
  });
}

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

// MongoDB connection with caching for serverless
let cachedDb = null;
let isConnecting = false;

// Single MongoDB connection: same MONGO_URI everywhere (from .env locally, from Vercel env in production). No loopback vs cloud branching.
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI?.trim();
  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined in environment variables.');
  }
  const mongoUser = process.env.MONGO_USER?.trim();
  const mongoPassword = process.env.MONGO_PASSWORD?.trim();

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

    // Prefer MONGO_USER + MONGO_PASSWORD when set: avoids edge cases parsing user:pass inside a long mongodb:// URI.
    const connectOptions = {
      serverSelectionTimeoutMS: 30000, // 30 seconds for serverless cold starts
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
    };
    let connectionUri = mongoUri;
    const isLocalMongoUri = /^mongodb:\/\/(127\.0\.0\.1|localhost)/.test(connectionUri);
    if (!isLocalMongoUri && mongoUser && mongoPassword) {
      connectOptions.user = mongoUser;
      connectOptions.pass = mongoPassword;
      connectOptions.authSource = 'admin';
      connectionUri = mongoUri.replace(/^mongodb:\/\/[^@]+@/, 'mongodb://');
    }
    const mongoDbName =
      process.env.MONGO_DATABASE?.trim() || process.env.MONGO_DB_NAME?.trim();
    connectionUri = applyMongoDatabaseName(connectionUri, mongoDbName);
    if (mongoConnectionStringMissingDbName(connectionUri)) {
      throw new Error(
        'MongoDB URI has no database name, so the driver uses "test" and Atlas can deny reads (e.g. test.users). ' +
          'In Vercel, set MONGO_DATABASE (or MONGO_DB_NAME) to the Atlas database that contains your data, ' +
          'or add /yourDbName before ? in MONGO_URI.'
      );
    }
    if (/^(1|true|yes)$/i.test(process.env.DEBUG_MONGO_AUTH || '')) {
      const u = mongoUser || '(from MONGO_URI only)';
      const plen = mongoPassword?.length ?? 0;
      const uriHead = connectionUri.replace(/^mongodb:\/\/[^@]+@/, 'mongodb://***@').slice(0, 72);
      console.log(`[DEBUG_MONGO_AUTH] user=${u} passwordLength=${plen} uriPrefix=${uriHead}...`);
    }
    await mongoose.connect(connectionUri, connectOptions);

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

app.use(cors());
const jsonParser = express.json();
app.use((req, res, next) => {
  if (req.body !== undefined) return next();
  jsonParser(req, res, next);
});

// On Vercel, normalize path so Express routes see /api/:path (catchall rewrite passes path as query param)
app.use((req, res, next) => {
  if (DEBUG_API) req._debugRawUrl = req.url;
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  if (process.env.VERCEL === '1' && req.query && req.query.path != null) {
    const pathSeg = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path);
    req.url = '/api/' + pathSeg + q;
    req.originalUrl = '/api/' + pathSeg + (req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '');
    return next();
  }
  if (req.path === '/api/catchall' || req.path === '/catchall') {
    const pathSeg = (req.query.path != null)
      ? (Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path))
      : '';
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = '/api/' + pathSeg + qs;
    req.originalUrl = '/api/' + pathSeg + (req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '');
  } else if (process.env.VERCEL === '1') {
    const pathname = req.url.includes('?') ? req.url.slice(0, req.url.indexOf('?')) : req.url;
    if (pathname && !pathname.startsWith('/api')) {
      req.url = '/api' + (pathname.startsWith('/') ? pathname : '/' + pathname) + q;
      req.originalUrl = '/api' + (pathname.startsWith('/') ? pathname : '/' + pathname) + (req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '');
    }
  }
  next();
});

// Optional debug logging: request path + response status (enable with DEBUG_API=1)
app.use((req, res, next) => {
  if (!DEBUG_API) return next();
  const ts = new Date().toISOString();
  const pathInfo = req._debugRawUrl !== undefined && req._debugRawUrl !== req.url
    ? ` (normalized from ${req._debugRawUrl})`
    : '';
  console.log(`[DEBUG_API] ${ts} ${req.method} url=${req.url} path=${req.path} query.path=${JSON.stringify(req.query?.path)} VERCEL=${process.env.VERCEL || '0'}${pathInfo}`);
  res.on('finish', () => {
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    console.log(`[DEBUG_API] ${ts} ${req.method} ${req.url} -> ${res.statusCode} [${level}]`);
  });
  next();
});

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

// Models
const customerSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  address: String,
  accountNumber: { type: String, default: '', trim: true },
  projects: [{
    name: String,
    jobNumber: { type: String, default: '', trim: true },
    description: String,
    equipmentCategories: {
      burglarAlarm: { type: Boolean, default: false },
      fireAlarm: { type: Boolean, default: false },
      accessControl: { type: Boolean, default: false },
      cctv: { type: Boolean, default: false },
      monitoring: { type: Boolean, default: false }
    },
    bidAmount: Number,
    billAmount: Number,
    taxRate: { type: Number, default: 0 },
    paidToDate: { type: Number, default: 0 },
    status: { type: String, enum: ['Pending', 'Bidded', 'Scheduled', 'Completed', 'Billed'] },
    workType: {
      type: String,
      enum: ['installation', 'service', 'consultation'],
      default: 'installation',
    },
    scheduleDate: Date,
    completedAt: Date,
    materials: [{
      item: String,
      sku: String,
      inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
      quantity: Number,
      cost: Number,
      markup: Number,
      taxable: { type: Boolean, default: true },
      chargedFromStock: { type: Boolean, default: true },
    }],
    bidMaterials: [{
      item: String,
      sku: String,
      quantity: Number,
      estimate: Number,
    }],
    payments: [{
      amount: Number,
      note: { type: String, default: '' },
      paidAt: { type: Date, default: Date.now },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }],
    notes: [{ text: String, addedAt: { type: Date, default: Date.now } }],
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
    enum: ['pending', 'admin', 'super-admin', 'customer'],
    default: 'pending'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerProfile: { phone: String, address: String },
  laborRate: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Supplier Schema
const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: String,
  contactName: String,
  phone: String,
  email: String,
  address: {
    street: String,
    city: String,
    state: String,
    zip: String,
    country: String
  },
  categories: [String], // ['Electrical', 'Plumbing', 'Lumber', etc.]
  leadTimeDays: { type: Number, default: 0 }, // Average lead time
  minimumOrder: { type: Number, default: 0 },
  paymentTerms: String, // 'Net 30', 'COD', etc.
  taxRate: Number,
  shippingMethod: String,
  website: String,
  notes: String,
  adiAccount: {
    customerNumber: String,
    customerSuffix: String,
  },
  isFavorite: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  catalog: [{
    sku: String,
    description: String,
    unit: String, // 'each', 'box', 'ft', etc.
    price: Number,
    lastUpdated: { type: Date, default: Date.now }
  }],
  attachments: [{
    name: String,
    url: String,
    type: String, // 'price-list', 'catalog', 'contract', etc.
    uploadedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  lastOrderDate: Date,
  totalSpent: { type: Number, default: 0 }
});
const Supplier = mongoose.model('Supplier', supplierSchema);

// Purchase Order Schema
const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, unique: true, required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  status: { 
    type: String, 
    enum: ['Draft', 'Sent', 'Confirmed', 'Received', 'Paid', 'Cancelled'], 
    default: 'Draft' 
  },
  items: [{
    sku: String,
    description: String,
    quantity: Number,
    unit: String,
    unitPrice: Number,
    total: Number
  }],
  subtotal: Number,
  tax: Number,
  shipping: Number,
  total: Number,
  notes: String,
  // ADI integration metadata so inquiry can be re-run later without re-entering IDs.
  adiIntegration: {
    customerNumber: String,
    customerSuffix: String,
    adiOrderNumber: String,
    lastSyncedAt: Date,
    lastInquiryStatus: String,
    lastInquiryMessage: String,
    lastInquiryAt: Date,
    shipmentPickupIndicator: String,
    referenceNumber: String,
    shipmentComplete: String,
    shipmentCarrier: String,
    shipmentMethod: String,
    pickupDC: String,
    promoCode: String,
    promoCodeType: String,
    emailAddress: String,
    dropShipmentName: String,
    dropShipmentAddress1: String,
    dropShipmentAddress2: String,
    dropShipmentAddress3: String,
    dropShipmentCity: String,
    dropShipmentStateProvince: String,
    dropShipmentZipcode: String,
    dropShipmentCountryCode: String,
    priceLines: [{
      itemNumber: String,
      quantity: Number,
      itemPrice: String,
      allowedToBuy: String,
      saleStartDate: String,
      saleEndDate: String,
      nationalInventory: String,
      returnCode: String,
      returnMessage: String,
    }],
    shipments: [{
      trackingNumber: String,
      carrier: String,
      status: String,
      shipDate: String,
      itemNumber: String,
      quantity: String,
    }],
    carts: [{
      cartNumber: String,
      status: String,
      carrier: String,
      trackingNumber: String,
    }],
  },
  attachments: [{
    name: String,
    url: String,
    type: String, // 'quote', 'invoice', 'delivery-photo', etc.
    uploadedAt: { type: Date, default: Date.now }
  }],
  orderDate: { type: Date, default: Date.now },
  expectedDelivery: Date,
  receivedDate: Date,
  paidDate: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});
const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

const supplierPaymentSchema = new mongoose.Schema({
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
  amount: { type: Number, required: true },
  note: { type: String, default: '' },
  paidAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});
const SupplierPayment = mongoose.model('SupplierPayment', supplierPaymentSchema);

// Inventory Item Schema (for par levels and auto-reorder)
const inventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, unique: true, sparse: true },
  description: String,
  category: String,
  currentStock: { type: Number, default: 0, min: 0 },
  unit: String,
  parLevel: { type: Number, default: 0 }, // Minimum stock level
  /** Per-unit cost/price for estimating on-hand value (Est. Value = sum of stock × lastPrice). */
  lastPrice: { type: Number, min: 0 },
  autoReorder: { type: Boolean, default: false },
  preferredSupplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  adiQuote: {
    itemNumber: String,
    itemPrice: String,
    allowedToBuy: String,
    nationalInventory: String,
    saleStartDate: String,
    saleEndDate: String,
    returnMessage: String,
    checkedAt: Date,
  },
  priceHistory: [{
    previousPrice: Number,
    newPrice: Number,
    changeAmount: Number,
    changePercent: Number,
    updatedAt: Date,
  }],
  lastRestocked: Date,
  createdAt: { type: Date, default: Date.now }
});
const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);

/** Ledger of inventory qty changes (manual adjust, PO receive, job usage). */
const inventoryMovementSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  sku: String,
  type: {
    type: String,
    enum: ['add', 'remove', 'set', 'receive', 'use', 'untracked'],
    required: true,
  },
  quantity: { type: Number, required: true },
  previousStock: Number,
  newStock: Number,
  unitCost: Number,
  reason: { type: String, default: '' },
  source: {
    kind: { type: String, default: 'manual' },
    id: String,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});
const InventoryMovement = mongoose.model('InventoryMovement', inventoryMovementSchema);

// Installation and Service History (Phase 1): log when projects are completed; editable with audit trail
const serviceHistorySchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId },
  customerName: String,
  customerPhone: String,
  customerAddress: String,
  projectName: String,
  summary: String,
  details: String,
  type: { type: String, enum: ['installation', 'service', 'consultation'], default: 'installation' },
  completedAt: { type: Date, default: Date.now },
  editHistory: [{
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    editedByUsername: String,
    editedAt: { type: Date, default: Date.now },
    changes: String
  }],
  createdAt: { type: Date, default: Date.now }
});
const ServiceHistory = mongoose.model('ServiceHistory', serviceHistorySchema);

const costCenterSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true },
  defaultClass: { type: String, enum: ['indirect', 'direct'], default: 'indirect' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});
const CostCenter = mongoose.model('CostCenter', costCenterSchema);

const expenseSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
  payee: { type: String, default: '' },
  description: { type: String, default: '' },
  costCenterCode: { type: String, required: true, uppercase: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  projectId: { type: mongoose.Schema.Types.ObjectId },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});
const Expense = mongoose.model('Expense', expenseSchema);

const laborEntrySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hours: { type: Number, required: true },
  hourlyCost: { type: Number, required: true },
  workType: {
    type: String,
    enum: ['install', 'service', 'consult', 'bidding', 'warranty', 'admin'],
    required: true,
  },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  projectId: { type: mongoose.Schema.Types.ObjectId },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});
const LaborEntry = mongoose.model('LaborEntry', laborEntrySchema);

/**
 * Principal work orders (Brinks tickets). Separate from Customer.projects.
 * Totals are stored on the document and are not posted to the light ledger.
 */
const subcontractorWorkOrderSchema = new mongoose.Schema({
  principal: { type: String, default: 'Brinks' },
  workOrderNumber: { type: String, required: true, trim: true },
  completionNumber: { type: String, default: '' },
  siteName: { type: String, default: '' },
  siteAddress: { type: String, default: '' },
  siteCity: { type: String, default: '' },
  jobType: {
    type: String,
    enum: SUBCONTRACTOR_JOB_TYPE_VALUES,
    default: DEFAULT_SUBCONTRACTOR_JOB_TYPE,
  },
  status: {
    type: String,
    enum: SUBCONTRACTOR_STATUS_VALUES,
    default: DEFAULT_SUBCONTRACTOR_STATUS,
  },
  scheduledDate: Date,
  completedDate: Date,
  hoursWorked: { type: Number, default: 0 },
  hourlyRate: { type: Number, default: 0 },
  travelPay: { type: Number, default: 0 },
  laborPay: { type: Number, default: 0 },
  equipmentLines: [{
    description: { type: String, default: '' },
    sku: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    reimbursable: { type: Boolean, default: true },
  }],
  equipmentTotal: { type: Number, default: 0 },
  amountDue: { type: Number, default: 0 },
  paidAmount: { type: Number, default: null },
  paidDate: Date,
  reconciliationNotes: { type: String, default: '' },
  variance: { type: Number, default: null },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
const SubcontractorWorkOrder = mongoose.model('SubcontractorWorkOrder', subcontractorWorkOrderSchema);

async function assertJobRef(customerId, projectId) {
  if (!customerId && !projectId) return { customerId: undefined, projectId: undefined };
  if (!customerId || !projectId) {
    return { error: { status: 400, msg: 'customerId and projectId are required together' } };
  }
  if (!mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(projectId)) {
    return { error: { status: 400, msg: 'Invalid customer or project id' } };
  }
  const customer = await Customer.findById(customerId);
  if (!customer) return { error: { status: 404, msg: 'Customer not found' } };
  const project = customer.projects.id(projectId);
  if (!project) return { error: { status: 404, msg: 'Project not found' } };
  return { customerId: customer._id, projectId: project._id };
}

/** Job expense/hours rows keep their original customerId/projectId on PUT. */
function jobRefMoveError(existing, body) {
  if (!existing || !body || typeof body !== 'object') return null;
  const hasCustomer = Object.prototype.hasOwnProperty.call(body, 'customerId');
  const hasProject = Object.prototype.hasOwnProperty.call(body, 'projectId');
  if (hasCustomer && String(body.customerId || '') !== String(existing.customerId || '')) {
    return { status: 400, msg: 'Cannot move this row to a different customer' };
  }
  if (hasProject && String(body.projectId || '') !== String(existing.projectId || '')) {
    return { status: 400, msg: 'Cannot move this row to a different project' };
  }
  return null;
}

function dateQuery(from, to) {
  const start = parseRangeBound(from, false);
  const end = parseRangeBound(to, true);
  if (!start && !end) return null;
  const range = {};
  if (start) range.$gte = start;
  if (end) range.$lte = end;
  return range;
}

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
    
    req.user = {
      id: decoded.id,
      role: user.role,
      username: user.username,
      customerId: user.customerId,
      customerProfile: user.customerProfile || {}
    };
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

// Middleware for customer-only routes (Phase 1 & 2)
const customerMiddleware = (req, res, next) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ msg: 'Access denied. Customer account required.' });
  }
  next();
};

// Routes

// Health check (no auth) - use GET /api/health to confirm the API is reachable on Vercel
app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true, message: 'API is reachable' });
});

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

    // Allow login by username or email (admin often types email in username field)
    const user = await User.findOne({ $or: [{ username }, { email: username }] });

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
    console.log(`[${timestamp}] ✅ LOGIN SUCCESS - User: "${user.username}" (${user.role}) - IP: ${clientIp}`);
    const payload = {
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
    if (user.role === 'customer' && user.customerId) {
      payload.user.customerId = user.customerId;
    }
    res.json(payload);
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
    const { address, projectName, projectDescription } = req.body;

    // Public form input: autofill and copy-paste routinely add surrounding
    // whitespace, which the email regex below would otherwise reject.
    const name = String(req.body.name ?? '').trim();
    const email = String(req.body.email ?? '').trim();
    const phone = String(req.body.phone ?? '').trim();

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

    // Server-side Meta Conversions API Lead event. The browser pixel is often
    // blocked, so this is the more reliable conversion signal. Deliberately not
    // awaited: the response is already sent, and email/phone are hashed inside
    // sendMetaLeadEvent. No-ops when META_CAPI_ACCESS_TOKEN is unset. Both the
    // synchronous and asynchronous paths are guarded so a CAPI problem can
    // never turn a saved bid into a failed request.
    try {
      Promise.resolve(
        sendMetaLeadEvent({
          email,
          phone,
          eventSourceUrl: req.headers?.referer,
          clientIpAddress: getClientIp(req),
          clientUserAgent: req.headers?.['user-agent'],
        })
      ).catch((capiErr) => {
        console.error('Meta CAPI Lead event failed:', capiErr?.message || capiErr);
      });
    } catch (capiErr) {
      console.error('Meta CAPI Lead event failed:', capiErr?.message || capiErr);
    }
  } catch (err) {
    console.error('Error submitting customer bid:', err);
    res.status(500).json({ msg: 'Server error during bid submission', error: err.message });
  }
});

// Customer Register (Phase 1): same data as request a bid + password; creates Customer + User (role customer)
app.post('/api/customer/register', async (req, res) => {
  try {
    const { name, email, phone, address, projectName, projectDescription, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ msg: 'Name, email, phone, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ msg: 'Invalid email format' });
    }

    const existingUser = await User.findOne({ $or: [{ username: email }, { email }] });
    if (existingUser) {
      return res.status(400).json({ msg: 'An account with this email already exists. Please login instead.' });
    }

    let customer = await Customer.findOne({ email });
    if (customer) {
      // Update existing customer with registration data so record stays consistent
      customer.name = name.trim();
      customer.phone = phone;
      customer.address = address !== undefined ? (address || '') : customer.address;
      if (projectName && projectDescription) {
        customer.projects.push({
          name: projectName,
          description: projectDescription,
          status: 'Pending',
          createdAt: new Date()
        });
      }
      await customer.save();
    } else {
      customer = new Customer({
        name,
        email,
        phone,
        address: address || '',
        projects: projectName && projectDescription
          ? [{ name: projectName, description: projectDescription, status: 'Pending', createdAt: new Date() }]
          : []
      });
      await customer.save();
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      username: email,
      email,
      password: hashed,
      role: 'customer',
      status: 'approved',
      customerId: customer._id
    });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: 'customer',
        customerId: customer._id
      },
      msg: 'Account created. You are now logged in.'
    });
  } catch (err) {
    console.error('Error in customer register:', err);
    res.status(500).json({ msg: 'Server error during registration', error: err.message });
  }
});

// Customer My Info (Phase 2): view/edit profile only; does not change Customer Management
app.get('/api/customer/me', authMiddleware, customerMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer record not found' });
    }
    const user = await User.findById(req.user.id).select('customerProfile');
    const profile = user?.customerProfile || {};
    res.json({ customer, profile: { phone: profile.phone || '', address: profile.address || '' } });
  } catch (err) {
    console.error('Error fetching customer me:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customer/me', authMiddleware, customerMiddleware, async (req, res) => {
  try {
    const { phone, address } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ msg: 'User not found' });
    if (!user.customerProfile) user.customerProfile = {};
    if (phone !== undefined) user.customerProfile.phone = phone;
    if (address !== undefined) user.customerProfile.address = address;
    await user.save();
    const profile = user.customerProfile || {};
    res.json({ profile: { phone: profile.phone || '', address: profile.address || '' } });
  } catch (err) {
    console.error('Error updating customer profile:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Request for Service / New Bid (logged-in customer; name/email from account)
app.post('/api/customer/me/bid', authMiddleware, customerMiddleware, async (req, res) => {
  try {
    const { projectName, projectDescription, phone, address } = req.body;
    if (!projectName || !projectDescription) {
      return res.status(400).json({ msg: 'Project name and description are required' });
    }
    const customer = await Customer.findById(req.user.customerId);
    if (!customer) return res.status(404).json({ msg: 'Customer record not found' });
    if (!customer.projects) customer.projects = [];
    customer.projects.push({
      name: projectName.trim(),
      description: projectDescription.trim(),
      status: 'Pending',
      createdAt: new Date()
    });
    await customer.save();
    res.status(201).json({
      msg: 'Request for service submitted. We will contact you soon.',
      customer: { name: customer.name, email: customer.email }
    });
  } catch (err) {
    console.error('Error submitting customer new bid:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
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
    if (user.role === 'customer') {
      return res.status(400).json({ msg: 'Customers cannot be promoted.' });
    }

    user.role = 'super-admin';
    user.status = 'approved';
    await user.save();

    console.log(`⬆️ User promoted to super-admin: ${user.username} by ${req.user.username}`);
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

// Reset user password (admin only)
app.put('/api/admin/users/:id/password', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = req.params.id;

    if (!newPassword) {
      return res.status(400).json({ msg: 'New password is required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    console.log(`🔑 Password reset for user: ${user.username} by ${req.user.username}`);
    res.json({ msg: `Password updated for ${user.username}` });
  } catch (err) {
    console.error('Error resetting user password:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Customer Routes (admin only; customers use GET/PUT /api/customer/me)
app.get('/api/customers', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await ensureJobIdentity(Customer);
    const customers = await Customer.find();
    res.json(customers);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.get('/api/customers/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customerId = req.params.id.trim();
    
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
      return res.status(404).json({ 
        msg: 'Customer not found'
      });
    }
    
    // Ensure projects array exists
    if (!customer.projects) {
      customer.projects = [];
    }
    await ensureJobIdentity(Customer);
    const refreshed = await Customer.findById(customer._id);
    res.json(refreshed || customer);
  } catch (err) {
    console.error('Error fetching customer:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/customers', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customerData = { ...req.body };
    // Ensure projects array is initialized
    if (!customerData.projects) {
      customerData.projects = [];
    }
    const existingCustomers = await Customer.find({}).select('accountNumber projects.jobNumber');
    const requestedAccount = normalizeNumber(customerData.accountNumber);
    if (requestedAccount && !isUniqueNumber(requestedAccount, collectAccountNumbers(existingCustomers))) {
      return res.status(400).json({ msg: 'Account number is already in use' });
    }
    customerData.accountNumber = requestedAccount || nextAccountNumber(collectAccountNumbers(existingCustomers));
    const jobNumbers = collectJobNumbers(existingCustomers);
    customerData.projects = (customerData.projects || []).map((project) => {
      const requestedJob = normalizeNumber(project.jobNumber);
      if (requestedJob && !isUniqueNumber(requestedJob, jobNumbers)) {
        return { ...project, jobNumber: nextJobNumber(jobNumbers) };
      }
      const jobNumber = requestedJob || nextJobNumber(jobNumbers);
      jobNumbers.push(jobNumber);
      return { ...project, jobNumber };
    });
    const customer = new Customer(customerData);
    await customer.save();
    res.json(customer);
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customers/:id', authMiddleware, adminMiddleware, async (req, res) => {
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
    if (req.body.accountNumber !== undefined) {
      const nextAccount = normalizeNumber(req.body.accountNumber);
      if (nextAccount) {
        const others = await Customer.find({ _id: { $ne: customer._id } }).select('accountNumber');
        if (!isUniqueNumber(nextAccount, collectAccountNumbers(others))) {
          return res.status(400).json({ msg: 'Account number is already in use' });
        }
        customer.accountNumber = nextAccount;
      }
    }
    
    await customer.save();
    console.log('Customer updated:', customer.name);
    res.json(customer);
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.delete('/api/customers/:id', authMiddleware, adminMiddleware, async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  res.json({ msg: 'Customer deleted' });
});

// Project Routes (nested under customer, admin only)
app.post('/api/customers/:customerId/projects', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    const existingCustomers = await Customer.find({}).select('projects.jobNumber');
    const jobNumbers = collectJobNumbers(existingCustomers);
    const requestedJob = normalizeNumber(req.body?.jobNumber);
    if (requestedJob && !isUniqueNumber(requestedJob, jobNumbers)) {
      return res.status(400).json({ msg: 'Job number is already in use' });
    }
    customer.projects.push({
      ...req.body,
      jobNumber: requestedJob || nextJobNumber(jobNumbers),
    });
    await customer.save();
    // Return the newly created project (last one in the array)
    const newProject = customer.projects[customer.projects.length - 1];
    res.json(newProject);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.delete('/api/customers/:customerId/projects/:projectId', authMiddleware, adminMiddleware, async (req, res) => {
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

app.put('/api/customers/:customerId/projects/:projectId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    const { name, description, equipmentCategories, workType, jobNumber } = req.body || {};
    if (name !== undefined) project.name = String(name).trim();
    if (description !== undefined) project.description = String(description).trim();
    if (workType !== undefined) project.workType = normalizeProjectWorkType(workType);
    if (jobNumber !== undefined) {
      const nextJob = normalizeNumber(jobNumber);
      if (nextJob) {
        const others = await Customer.find({}).select('projects.jobNumber');
        const used = collectJobNumbers(others).filter((value) => value !== project.jobNumber);
        if (!isUniqueNumber(nextJob, used)) {
          return res.status(400).json({ msg: 'Job number is already in use' });
        }
        project.jobNumber = nextJob;
      }
    }
    if (equipmentCategories && typeof equipmentCategories === 'object') {
      const ec = equipmentCategories;
      if (!project.equipmentCategories) {
        project.equipmentCategories = {};
      }
      if (ec.burglarAlarm !== undefined) project.equipmentCategories.burglarAlarm = Boolean(ec.burglarAlarm);
      if (ec.fireAlarm !== undefined) project.equipmentCategories.fireAlarm = Boolean(ec.fireAlarm);
      if (ec.accessControl !== undefined) project.equipmentCategories.accessControl = Boolean(ec.accessControl);
      if (ec.cctv !== undefined) project.equipmentCategories.cctv = Boolean(ec.cctv);
      if (ec.monitoring !== undefined) project.equipmentCategories.monitoring = Boolean(ec.monitoring);
    }
    await customer.save();
    res.json({ msg: 'Project updated', project });
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customers/:customerId/projects/:projectId/bid', authMiddleware, adminMiddleware, async (req, res) => {
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

app.put('/api/customers/:customerId/projects/:projectId/bill', authMiddleware, adminMiddleware, async (req, res) => {
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

app.put('/api/customers/:customerId/projects/:projectId/paid', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    const paidToDate = Number(req.body?.paidToDate);
    if (!Number.isFinite(paidToDate) || paidToDate < 0) {
      return res.status(400).json({ msg: 'paidToDate must be a valid non-negative number' });
    }

    project.paidToDate = paidToDate;
    await customer.save();
    res.json(project);
  } catch (err) {
    console.error('Error updating paid to date:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customers/:customerId/projects/:projectId/tax-rate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    const taxRate = Number(req.body?.taxRate);
    if (!Number.isFinite(taxRate) || taxRate < 0) {
      return res.status(400).json({ msg: 'taxRate must be a valid non-negative number' });
    }

    project.taxRate = taxRate;
    await customer.save();
    res.json(project);
  } catch (err) {
    console.error('Error updating tax rate:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customers/:customerId/projects/:projectId/schedule', authMiddleware, adminMiddleware, async (req, res) => {
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

app.put('/api/customers/:customerId/projects/:projectId/complete', authMiddleware, adminMiddleware, async (req, res) => {
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
    
    const completedAt = new Date();
    project.status = 'Completed';
    project.completedAt = completedAt;
    await customer.save();

    const historyEntry = new ServiceHistory({
      customerId: customer._id,
      projectId: project._id,
      customerName: customer.name,
      customerPhone: customer.phone || '',
      customerAddress: customer.address || '',
      projectName: project.name,
      summary: project.description || project.name,
      details: '',
      type: serviceHistoryTypeFromProjectWorkType(project.workType),
      completedAt,
      editHistory: []
    });
    await historyEntry.save();

    console.log('Project marked as completed:', project.name);
    res.json(project);
  } catch (err) {
    console.error('Error marking project as completed:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Installation and Service History (Phase 1 & 2)
app.get('/api/customers/:customerId/history', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const list = await ServiceHistory.find({ customerId: req.params.customerId })
      .sort({ completedAt: -1 })
      .lean();
    res.json(list);
  } catch (err) {
    console.error('Error fetching customer history:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Export route must be defined before the general list route so /export is matched first
app.get('/api/installation-history/export', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const idStrs = req.query.ids ? req.query.ids.split(',').map(id => id.trim()).filter(Boolean) : null;
    const objectIds = idStrs && idStrs.length > 0
      ? idStrs.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id))
      : [];
    const query = objectIds.length > 0 ? { _id: { $in: objectIds } } : {};
    const list = await ServiceHistory.find(query).sort({ completedAt: -1 }).lean();

    const headers = ['Customer Name', 'Phone', 'Address', 'Project Name', 'Summary', 'Type', 'Completed At', 'Details', 'Edit Count'];
    const escape = (v) => {
      const s = String(v == null ? '' : v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = list.map(e => [
      escape(e.customerName),
      escape(e.customerPhone || ''),
      escape(e.customerAddress || ''),
      escape(e.projectName),
      escape(e.summary),
      escape(e.type),
      escape(e.completedAt ? new Date(e.completedAt).toISOString() : ''),
      escape(e.details),
      escape((e.editHistory && e.editHistory.length) || 0)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="installation-service-history.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Error exporting history:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.get('/api/installation-history', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    let query = {};
    if (req.query.customerId) {
      const customerIdStr = req.query.customerId.trim();
      if (!mongoose.Types.ObjectId.isValid(customerIdStr)) {
        return res.status(400).json({ msg: 'Invalid customer ID format' });
      }
      query.customerId = new mongoose.Types.ObjectId(customerIdStr);
    }
    const list = await ServiceHistory.find(query).sort({ completedAt: -1 }).lean();
    res.json(list);
  } catch (err) {
    console.error('Error fetching installation history:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/installation-history/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const entry = await ServiceHistory.findById(req.params.id);
    if (!entry) return res.status(404).json({ msg: 'History entry not found' });

    const changes = [];
    if (req.body.summary !== undefined && req.body.summary !== entry.summary) {
      changes.push(`summary: "${entry.summary}" → "${req.body.summary}"`);
      entry.summary = req.body.summary;
    }
    if (req.body.details !== undefined && req.body.details !== entry.details) {
      changes.push(`details: "${entry.details || ''}" → "${req.body.details}"`);
      entry.details = req.body.details;
    }
    if (req.body.completedAt !== undefined) {
      const oldVal = entry.completedAt ? entry.completedAt.toISOString() : '';
      const newVal = new Date(req.body.completedAt).toISOString();
      if (oldVal !== newVal) {
        changes.push(`completedAt: ${oldVal} → ${newVal}`);
        entry.completedAt = new Date(req.body.completedAt);
      }
    }

    if (changes.length > 0) {
      const user = await User.findById(req.user.id);
      entry.editHistory.push({
        editedBy: req.user.id,
        editedByUsername: user ? user.username : 'unknown',
        editedAt: new Date(),
        changes: changes.join('; ')
      });
    }
    await entry.save();
    res.json(entry);
  } catch (err) {
    console.error('Error updating history entry:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/customers/:customerId/projects/:projectId/materials', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    
    const { item, quantity, cost, markup, taxable, sku } = req.body || {};
    const qty = Number(quantity);
    let skuValue = normalizeSku(sku);
    let inventoryItemId;
    let unitCost = cost === undefined || cost === null || cost === '' ? undefined : Number(cost);

    if (skuValue) {
      const stockItem = await InventoryItem.findOne({ sku: skuValue });
      if (!stockItem) {
        return res.status(404).json({ msg: 'Inventory SKU not found' });
      }
      await applyAndRecordStockMovement({
        item: stockItem,
        type: 'use',
        quantity: qty,
        reason: `Used on ${project.name}`,
        source: { kind: 'job', id: `${customer._id}:${project._id}` },
        userId: req.user.id,
      });
      inventoryItemId = stockItem._id;
      if (unitCost === undefined || Number.isNaN(unitCost)) {
        unitCost = Number(stockItem.lastPrice) || 0;
      }
    }

    project.materials.push({
      item,
      sku: skuValue || undefined,
      inventoryItemId,
      quantity: qty,
      cost: Number(unitCost || 0),
      markup: Number(markup || 0),
      taxable: taxable === undefined ? true : Boolean(taxable),
    });
    await customer.save();
    
    console.log('Material added to project:', project.name);
    res.json(project.materials);
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ msg: err.message });
    }
    console.error('Error adding material:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customers/:customerId/projects/:projectId/materials/:materialId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    const material = project.materials.id(req.params.materialId);
    if (!material) {
      return res.status(404).json({ msg: 'Material not found' });
    }

    const { item, quantity, cost, markup, taxable } = req.body;

    if (item !== undefined) material.item = String(item).trim();
    if (quantity !== undefined) material.quantity = Number(quantity);
    if (cost !== undefined) material.cost = Number(cost);
    if (markup !== undefined) material.markup = Number(markup);
    if (taxable !== undefined) material.taxable = Boolean(taxable);

    await customer.save();
    res.json({ msg: 'Material updated', materials: project.materials });
  } catch (err) {
    console.error('Error updating material:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.delete('/api/customers/:customerId/projects/:projectId/materials/:materialId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    const material = project.materials.id(req.params.materialId);
    if ((material?.sku || material?.inventoryItemId) && material.chargedFromStock !== false) {
      const stockItem = material.inventoryItemId
        ? await InventoryItem.findById(material.inventoryItemId)
        : await InventoryItem.findOne({ sku: normalizeSku(material.sku) });
      if (stockItem) {
        await applyAndRecordStockMovement({
          item: stockItem,
          type: 'add',
          quantity: Number(material.quantity) || 0,
          reason: `Removed from ${project.name}`,
          source: { kind: 'job', id: `${customer._id}:${project._id}` },
          userId: req.user.id,
        });
      }
    }
    
    project.materials.pull(req.params.materialId);
    await customer.save();
    
    console.log('Material deleted:', req.params.materialId);
    res.json({ msg: 'Material deleted', materials: project.materials });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ msg: err.message });
    }
    console.error('Error deleting material:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

function findCustomerProject(customer, projectId) {
  if (!customer) return { error: { status: 404, msg: 'Customer not found' } };
  const project = customer.projects.id(projectId);
  if (!project) return { error: { status: 404, msg: 'Project not found' } };
  return { customer, project };
}

app.post('/api/customers/:customerId/projects/:projectId/bid-materials', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    const found = findCustomerProject(customer, req.params.projectId);
    if (found.error) return res.status(found.error.status).json({ msg: found.error.msg });
    const { project } = found;
    if (!project.bidMaterials) project.bidMaterials = [];
    const item = String(req.body?.item || '').trim();
    const quantity = Number(req.body?.quantity);
    const estimate = Number(req.body?.estimate);
    if (!item || !Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ msg: 'item and a positive quantity are required' });
    }
    project.bidMaterials.push({
      item,
      sku: req.body?.sku ? String(req.body.sku).trim() : undefined,
      quantity,
      estimate: Number.isFinite(estimate) && estimate >= 0 ? estimate : 0,
    });
    await customer.save();
    res.json(project.bidMaterials);
  } catch (err) {
    console.error('Error adding bid worksheet line:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/customers/:customerId/projects/:projectId/bid-materials/copy-to-job', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    const found = findCustomerProject(customer, req.params.projectId);
    if (found.error) return res.status(found.error.status).json({ msg: found.error.msg });
    const { project } = found;
    (project.bidMaterials || []).forEach((line) => {
      project.materials.push({
        item: line.item,
        sku: line.sku || undefined,
        quantity: Number(line.quantity) || 0,
        cost: Number(line.estimate) || 0,
        markup: 0,
        taxable: true,
        chargedFromStock: false,
      });
    });
    await customer.save();
    res.json({ materials: project.materials, bidMaterials: project.bidMaterials });
  } catch (err) {
    console.error('Error copying bid worksheet to job materials:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customers/:customerId/projects/:projectId/bid-materials/:bidMaterialId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    const found = findCustomerProject(customer, req.params.projectId);
    if (found.error) return res.status(found.error.status).json({ msg: found.error.msg });
    const line = found.project.bidMaterials.id(req.params.bidMaterialId);
    if (!line) return res.status(404).json({ msg: 'Bid worksheet line not found' });
    if (req.body?.item !== undefined) line.item = String(req.body.item).trim();
    if (req.body?.quantity !== undefined) line.quantity = Number(req.body.quantity);
    if (req.body?.estimate !== undefined) line.estimate = Number(req.body.estimate);
    if (req.body?.sku !== undefined) line.sku = String(req.body.sku).trim();
    await customer.save();
    res.json({ msg: 'Bid worksheet line updated', bidMaterials: found.project.bidMaterials });
  } catch (err) {
    console.error('Error updating bid worksheet line:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.delete('/api/customers/:customerId/projects/:projectId/bid-materials/:bidMaterialId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    const found = findCustomerProject(customer, req.params.projectId);
    if (found.error) return res.status(found.error.status).json({ msg: found.error.msg });
    const line = found.project.bidMaterials.id(req.params.bidMaterialId);
    if (!line) return res.status(404).json({ msg: 'Bid worksheet line not found' });
    found.project.bidMaterials.pull(req.params.bidMaterialId);
    await customer.save();
    res.json({ msg: 'Bid worksheet line deleted', bidMaterials: found.project.bidMaterials });
  } catch (err) {
    console.error('Error deleting bid worksheet line:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/customers/:customerId/projects/:projectId/payments', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    const project = customer.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ msg: 'Payment amount must be greater than zero' });
    }
    if (!project.payments) project.payments = [];
    project.payments.push({
      amount,
      note: req.body?.note ? String(req.body.note) : '',
      paidAt: new Date(),
      createdBy: req.user.id,
    });
    project.paidToDate = project.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    await customer.save();
    res.status(201).json({
      paidToDate: project.paidToDate,
      payments: project.payments,
    });
  } catch (err) {
    console.error('Error recording project payment:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/customers/:customerId/projects/:projectId/notes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { customerId, projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ msg: 'Invalid customer ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ msg: 'Invalid project ID format' });
    }
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ msg: 'Customer not found' });
    const project = customer.projects.id(projectId);
    if (!project) return res.status(404).json({ msg: 'Project not found' });
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ msg: 'Note text is required' });
    }
    if (!project.notes) project.notes = [];
    project.notes.push({ text: text.trim(), addedAt: new Date() });
    await customer.save();
    res.status(201).json(project.notes);
  } catch (err) {
    console.error('Error adding note:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/customers/:customerId/projects/:projectId/notes/:noteId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { customerId, projectId, noteId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ msg: 'Invalid customer ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ msg: 'Invalid project ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ msg: 'Invalid note ID format' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ msg: 'Customer not found' });

    const project = customer.projects.id(projectId);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    const note = project.notes.id(noteId);
    if (!note) return res.status(404).json({ msg: 'Note not found' });

    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ msg: 'Note text is required' });
    }

    note.text = text.trim();
    await customer.save();
    res.json({ msg: 'Note updated', notes: project.notes });
  } catch (err) {
    console.error('Error updating note:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.delete('/api/customers/:customerId/projects/:projectId/notes/:noteId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { customerId, projectId, noteId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ msg: 'Invalid customer ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ msg: 'Invalid project ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ msg: 'Invalid note ID format' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ msg: 'Customer not found' });

    const project = customer.projects.id(projectId);
    if (!project) return res.status(404).json({ msg: 'Project not found' });

    const note = project.notes.id(noteId);
    if (!note) return res.status(404).json({ msg: 'Note not found' });

    project.notes.pull(noteId);
    await customer.save();
    res.json({ msg: 'Note deleted', notes: project.notes });
  } catch (err) {
    console.error('Error deleting note:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ===== SUPPLIER ROUTES =====

// Get all suppliers with stats
app.get('/api/suppliers', authMiddleware, async (req, res) => {
  try {
    const { category, favorites, search } = req.query;
    
    let query = { isActive: true };
    if (category) query.categories = category;
    if (favorites === 'true') query.isFavorite = true;
    if (search) query.name = { $regex: search, $options: 'i' };
    
    const suppliers = await Supplier.find(query).sort({ name: 1 });
    
    // Calculate stats
    const totalSuppliers = suppliers.length;
    const openPOs = await PurchaseOrder.countDocuments({ 
      status: { $in: ['Draft', 'Sent', 'Confirmed'] } 
    });
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const monthlySpend = await PurchaseOrder.aggregate([
      { $match: { orderDate: { $gte: thisMonth }, status: { $ne: 'Cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    
    const lowStockItems = await InventoryItem.countDocuments({
      $expr: { $lt: ['$currentStock', '$parLevel'] },
      parLevel: { $gt: 0 }
    });
    
    res.json({
      suppliers,
      stats: {
        totalSuppliers,
        openPOs,
        monthlySpend: monthlySpend[0]?.total || 0,
        lowStockItems
      }
    });
  } catch (err) {
    console.error('Error fetching suppliers:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Get single supplier with details
app.get('/api/suppliers/:id', authMiddleware, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ msg: 'Supplier not found' });
    }
    
    // Get order history
    const orders = await PurchaseOrder.find({ supplier: req.params.id })
      .sort({ orderDate: -1 })
      .limit(20);
    
    res.json({ supplier, orders });
  } catch (err) {
    console.error('Error fetching supplier:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Create supplier
app.post('/api/suppliers', authMiddleware, async (req, res) => {
  try {
    const supplier = new Supplier(req.body);
    await supplier.save();
    res.status(201).json(supplier);
  } catch (err) {
    console.error('Error creating supplier:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Update supplier
app.put('/api/suppliers/:id', authMiddleware, async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!supplier) {
      return res.status(404).json({ msg: 'Supplier not found' });
    }
    res.json(supplier);
  } catch (err) {
    console.error('Error updating supplier:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Delete supplier
app.delete('/api/suppliers/:id', authMiddleware, async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!supplier) {
      return res.status(404).json({ msg: 'Supplier not found' });
    }
    res.json({ msg: 'Supplier archived' });
  } catch (err) {
    console.error('Error deleting supplier:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Toggle favorite
app.put('/api/suppliers/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ msg: 'Supplier not found' });
    }
    supplier.isFavorite = !supplier.isFavorite;
    await supplier.save();
    res.json(supplier);
  } catch (err) {
    console.error('Error toggling favorite:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ===== ADI SUPPLIER INTEGRATION ROUTES =====
/**
 * Phase 2 (Price & Inventory): proxy endpoint for ADI price/inventory lookups.
 * Uses env-backed ADI credentials and reuses shared auth-signature generation.
 */
app.post('/api/suppliers/adi/price-inventory', authMiddleware, async (req, res) => {
  try {
    const credentials = {
      apiKey: process.env.ADI_API_KEY,
      apiPassword: process.env.ADI_API_PASSWORD,
      apiSecretKey: process.env.ADI_API_SECRET_KEY,
    };

    if (!credentials.apiKey || !credentials.apiPassword || !credentials.apiSecretKey) {
      return res.status(500).json({ msg: 'ADI API credentials are not configured.' });
    }

    const { customerNumber, customerSuffix, itemList, clientRequestId, timestamp } = req.body || {};

    const adiRequest = {
      credentials,
      customerNumber,
      customerSuffix,
      itemList,
    };
    if (clientRequestId !== undefined) adiRequest.clientRequestId = clientRequestId;
    if (timestamp !== undefined) adiRequest.timestamp = timestamp;

    const adiResponse = await fetchAdiPriceAndInventoryDetails(adiRequest);

    return res.json(adiResponse);
  } catch (err) {
    const message = err?.message || 'Failed to fetch ADI price and inventory details.';
    const isValidationError =
      message.includes('required') ||
      message.includes('cannot contain more than 50 items') ||
      message.includes('must be a positive number');

    if (isValidationError) {
      return res.status(400).json({ msg: message });
    }

    return res.status(502).json({ msg: 'ADI request failed.', details: message });
  }
});

/**
 * Phase 3 (Order Generation): proxy endpoint for ADI order placement.
 * Uses env-backed ADI credentials and shared signature generation.
 */
app.post('/api/suppliers/adi/order-generation', authMiddleware, async (req, res) => {
  try {
    const credentials = {
      apiKey: process.env.ADI_API_KEY,
      apiPassword: process.env.ADI_API_PASSWORD,
      apiSecretKey: process.env.ADI_API_SECRET_KEY,
    };

    if (!credentials.apiKey || !credentials.apiPassword || !credentials.apiSecretKey) {
      return res.status(500).json({ msg: 'ADI API credentials are not configured.' });
    }

    const {
      customerNumber,
      customerSuffix,
      poNumber,
      referenceNumber,
      shipmentPickupIndicator,
      shipmentComplete,
      shipmentCarrier,
      shipmentMethod,
      pickupDC,
      promoCode,
      promoCodeType,
      emailAddress,
      dropShipmentName,
      dropShipmentAddress1,
      dropShipmentAddress2,
      dropShipmentAddress3,
      dropShipmentCity,
      dropShipmentStateProvince,
      dropShipmentZipcode,
      dropShipmentCountryCode,
      orderList,
      clientRequestId,
      timestamp,
    } = req.body || {};

    const adiRequest = {
      credentials,
      customerNumber,
      customerSuffix,
      poNumber,
      referenceNumber,
      shipmentPickupIndicator,
      shipmentComplete,
      shipmentCarrier,
      shipmentMethod,
      pickupDC,
      promoCode,
      promoCodeType,
      emailAddress,
      dropShipmentName,
      dropShipmentAddress1,
      dropShipmentAddress2,
      dropShipmentAddress3,
      dropShipmentCity,
      dropShipmentStateProvince,
      dropShipmentZipcode,
      dropShipmentCountryCode,
      orderList,
    };
    if (clientRequestId !== undefined) adiRequest.clientRequestId = clientRequestId;
    if (timestamp !== undefined) adiRequest.timestamp = timestamp;

    const adiResponse = await fetchAdiOrderGeneration(adiRequest);

    return res.json(adiResponse);
  } catch (err) {
    const message = err?.message || 'Failed to generate ADI order.';
    const isValidationError =
      message.includes('required') ||
      message.includes('must be') ||
      message.includes('cannot');

    if (isValidationError) {
      return res.status(400).json({ msg: message });
    }

    return res.status(502).json({ msg: 'ADI request failed.', details: message });
  }
});

/**
 * Phase 4 (Order Inquiry): proxy endpoint for ADI order tracking/inquiry.
 * Uses env-backed ADI credentials and shared signature generation.
 */
app.post('/api/suppliers/adi/order-inquiry', authMiddleware, async (req, res) => {
  try {
    const credentials = {
      apiKey: process.env.ADI_API_KEY,
      apiPassword: process.env.ADI_API_PASSWORD,
      apiSecretKey: process.env.ADI_API_SECRET_KEY,
    };

    if (!credentials.apiKey || !credentials.apiPassword || !credentials.apiSecretKey) {
      return res.status(500).json({ msg: 'ADI API credentials are not configured.' });
    }

    const {
      customerNumber,
      customerSuffix,
      adiOrderNumber,
      clientRequestId,
      timestamp,
    } = req.body || {};

    const adiRequest = {
      credentials,
      customerNumber,
      customerSuffix,
      adiOrderNumber,
    };
    if (clientRequestId !== undefined) adiRequest.clientRequestId = clientRequestId;
    if (timestamp !== undefined) adiRequest.timestamp = timestamp;

    const adiResponse = await fetchAdiOrderInquiry(adiRequest);

    return res.json(adiResponse);
  } catch (err) {
    const message = err?.message || 'Failed to fetch ADI order inquiry details.';
    const isValidationError = message.includes('required') || message.includes('must be');

    if (isValidationError) {
      return res.status(400).json({ msg: message });
    }

    return res.status(502).json({ msg: 'ADI request failed.', details: message });
  }
});

// ===== PURCHASE ORDER ROUTES =====

// Get all purchase orders
app.get('/api/purchase-orders', authMiddleware, async (req, res) => {
  try {
    const { status, supplierId } = req.query;
    let query = {};
    if (status) query.status = status;
    if (supplierId) query.supplier = supplierId;
    
    const pos = await PurchaseOrder.find(query)
      .populate('supplier', 'name adiAccount')
      .populate('createdBy', 'username')
      .sort({ orderDate: -1 });
    res.json(pos);
  } catch (err) {
    console.error('Error fetching purchase orders:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Generate next PO number
async function generatePONumber() {
  const year = new Date().getFullYear();
  const lastPO = await PurchaseOrder.findOne({
    poNumber: new RegExp(`^PO-${year}`)
  }).sort({ createdAt: -1 });
  
  if (!lastPO) {
    return `PO-${year}-0001`;
  }
  
  const lastNum = parseInt(lastPO.poNumber.split('-')[2]);
  const nextNum = (lastNum + 1).toString().padStart(4, '0');
  return `PO-${year}-${nextNum}`;
}

// Create purchase order
app.post('/api/purchase-orders', authMiddleware, async (req, res) => {
  try {
    const poNumber = await generatePONumber();
    const po = new PurchaseOrder({
      ...req.body,
      poNumber,
      createdBy: req.user.id
    });
    await po.save();
    
    // Update supplier's last order date and total spent
    await Supplier.findByIdAndUpdate(po.supplier, {
      lastOrderDate: po.orderDate,
      $inc: { totalSpent: po.total }
    });
    
    res.status(201).json(po);
  } catch (err) {
    console.error('Error creating purchase order:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Update purchase order
app.put('/api/purchase-orders/:id', authMiddleware, async (req, res) => {
  try {
    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('supplier', 'name');
    
    if (!po) {
      return res.status(404).json({ msg: 'Purchase order not found' });
    }
    res.json(po);
  } catch (err) {
    console.error('Error updating purchase order:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/purchase-orders/:id/receive', authMiddleware, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
      return res.status(404).json({ msg: 'Purchase order not found' });
    }
    if (po.status === 'Received' || po.status === 'Paid') {
      return res.status(400).json({ msg: 'Purchase order already received or paid' });
    }
    if (po.status === 'Cancelled') {
      return res.status(400).json({ msg: 'Cannot receive a cancelled purchase order' });
    }

    for (const line of po.items || []) {
      const sku = normalizeSku(line.sku);
      if (!sku) continue;
      const quantity = Number(line.quantity) || 0;
      if (quantity <= 0) continue;

      let item = await InventoryItem.findOne({ sku });
      if (!item) {
        item = await InventoryItem.create({
          name: line.description || sku,
          sku,
          currentStock: 0,
          lastPrice: Number(line.unitPrice) || 0,
          unit: line.unit || 'each',
        });
      }

      await applyAndRecordStockMovement({
        item,
        type: 'receive',
        quantity,
        unitCost: Number(line.unitPrice) || 0,
        reason: `Received ${po.poNumber}`,
        source: { kind: 'purchase-order', id: po._id.toString() },
        userId: req.user.id,
      });
    }

    po.status = 'Received';
    po.receivedDate = new Date();
    await po.save();
    const populated = await PurchaseOrder.findById(po._id).populate('supplier', 'name');
    res.json(populated);
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ msg: err.message });
    }
    console.error('Error receiving purchase order:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/purchase-orders/:id/pay', authMiddleware, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
      return res.status(404).json({ msg: 'Purchase order not found' });
    }
    if (po.status === 'Paid') {
      return res.status(400).json({ msg: 'Purchase order already paid' });
    }
    if (po.status !== 'Received') {
      return res.status(400).json({ msg: 'Receive the purchase order before recording payment' });
    }

    po.status = 'Paid';
    po.paidDate = new Date();
    await po.save();

    const payment = await SupplierPayment.create({
      supplierId: po.supplier,
      purchaseOrderId: po._id,
      amount: Number(po.total) || 0,
      note: req.body?.note ? String(req.body.note) : '',
      paidAt: po.paidDate,
      createdBy: req.user.id,
    });

    const populated = await PurchaseOrder.findById(po._id).populate('supplier', 'name');
    res.json({ po: populated, payment });
  } catch (err) {
    console.error('Error paying purchase order:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ===== INVENTORY ROUTES =====

/** Normalize client body so ObjectId fields don’t use "" (cast error aborts the whole update). */
function inventoryPayloadFromBody(body) {
  const supplierRaw = body.preferredSupplier;
  const preferredSupplier =
    supplierRaw != null && String(supplierRaw).trim() !== '' ? supplierRaw : null;

  const stockRaw = body.currentStock;
  const currentStock =
    stockRaw === undefined || stockRaw === null || stockRaw === ''
      ? 0
      : Number(stockRaw);

  return {
    name: String(body.name ?? '').trim(),
    sku: normalizeSku(body.sku),
    description: body.description != null ? String(body.description) : '',
    category: body.category != null ? String(body.category) : '',
    currentStock,
    unit: body.unit != null ? String(body.unit) : 'each',
    parLevel: Math.max(0, Number(body.parLevel) || 0),
    lastPrice: Math.max(0, Number(body.lastPrice) || 0),
    autoReorder: Boolean(body.autoReorder),
    preferredSupplier,
  };
}

function priceChangeFromBody(change) {
  if (!change || typeof change !== 'object') return null;
  const previousPrice = Number(change.previousPrice);
  const newPrice = Number(change.newPrice);
  if (!Number.isFinite(previousPrice) || previousPrice < 0) return null;
  if (!Number.isFinite(newPrice) || newPrice < 0) return null;
  const updatedAt = change.updatedAt ? new Date(change.updatedAt) : new Date();
  if (Number.isNaN(updatedAt.getTime())) return null;
  const roundedPrevious = Math.round(previousPrice * 100) / 100;
  const roundedNext = Math.round(newPrice * 100) / 100;
  const changeAmount = Math.round((roundedNext - roundedPrevious) * 100) / 100;
  const changePercent = roundedPrevious > 0
    ? Math.round(((changeAmount / roundedPrevious) * 100) * 100) / 100
    : null;
  return {
    previousPrice: roundedPrevious,
    newPrice: roundedNext,
    changeAmount,
    changePercent,
    updatedAt,
  };
}

function adiQuoteFromBody(quote) {
  if (!quote || typeof quote !== 'object') return null;
  return {
    itemNumber: String(quote.itemNumber || ''),
    itemPrice: String(quote.itemPrice || ''),
    allowedToBuy: String(quote.allowedToBuy || ''),
    nationalInventory: String(quote.nationalInventory || ''),
    saleStartDate: String(quote.saleStartDate || ''),
    saleEndDate: String(quote.saleEndDate || ''),
    returnMessage: String(quote.returnMessage || ''),
    checkedAt: quote.checkedAt ? new Date(quote.checkedAt) : new Date(),
  };
}

async function ensureUniqueInventorySku(sku, excludeId) {
  if (!sku) return;
  const query = { sku };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await InventoryItem.findOne(query);
  if (existing) {
    const err = new Error('SKU already exists');
    err.statusCode = 409;
    throw err;
  }
}

async function applyAndRecordStockMovement({
  item,
  type,
  quantity,
  reason = '',
  unitCost,
  source,
  userId,
}) {
  const result = applyStockChange(item.currentStock, { type, quantity });
  if (result.error) {
    const err = new Error(result.error);
    err.statusCode = 400;
    throw err;
  }

  item.currentStock = result.newStock;
  if (result.delta > 0) item.lastRestocked = new Date();
  if (
    type === 'receive' &&
    unitCost != null &&
    Number.isFinite(Number(unitCost)) &&
    Number(unitCost) >= 0
  ) {
    item.lastPrice = Number(unitCost);
  }
  await item.save();

  const movement = await InventoryMovement.create({
    itemId: item._id,
    sku: item.sku,
    type,
    quantity: Number(quantity),
    previousStock: result.previousStock,
    newStock: result.newStock,
    unitCost: unitCost != null ? Number(unitCost) : item.lastPrice,
    reason: reason ? String(reason) : '',
    source: source || { kind: 'manual' },
    createdBy: userId,
  });

  return { item, movement };
}

function inventoryConflictResponse(res, err) {
  if (err.statusCode === 409 || isDuplicateKeyError(err)) {
    return res.status(409).json({ msg: 'SKU already exists' });
  }
  if (err.statusCode === 400) {
    return res.status(400).json({ msg: err.message });
  }
  return null;
}

// Get inventory items (with low stock alert)
app.get('/api/inventory', authMiddleware, async (req, res) => {
  try {
    const { lowStock } = req.query;
    let query = {};
    
    if (lowStock === 'true') {
      // Find items where currentStock < parLevel
      const items = await InventoryItem.find({
        parLevel: { $gt: 0 }
      }).populate('preferredSupplier', 'name adiAccount');
      
      const lowStockItems = items.filter(item => item.currentStock < item.parLevel);
      return res.json(lowStockItems);
    }
    
    const items = await InventoryItem.find(query)
      .populate('preferredSupplier', 'name adiAccount')
      .sort({ name: 1 });
    res.json(items);
  } catch (err) {
    console.error('Error fetching inventory:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Create inventory item
app.post('/api/inventory', authMiddleware, async (req, res) => {
  try {
    const data = inventoryPayloadFromBody(req.body);
    if (!data.name) {
      return res.status(400).json({ msg: 'Item name is required' });
    }
    if (!Number.isFinite(data.currentStock) || data.currentStock < 0) {
      return res.status(400).json({ msg: 'Stock cannot be negative' });
    }
    await ensureUniqueInventorySku(data.sku);
    if (data.sku == null) delete data.sku;
    const item = new InventoryItem(data);
    await item.save();
    await item.populate('preferredSupplier', 'name adiAccount');
    res.status(201).json(item);
  } catch (err) {
    if (inventoryConflictResponse(res, err)) return;
    console.error('Error creating inventory item:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/inventory/:id', authMiddleware, async (req, res) => {
  try {
    const data = inventoryPayloadFromBody(req.body);
    if (!data.name) {
      return res.status(400).json({ msg: 'Item name is required' });
    }
    if (!Number.isFinite(data.currentStock) || data.currentStock < 0) {
      return res.status(400).json({ msg: 'Stock cannot be negative' });
    }
    await ensureUniqueInventorySku(data.sku, req.params.id);

    const existing = await InventoryItem.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ msg: 'Inventory item not found' });
    }

    existing.name = data.name;
    if (data.sku == null) {
      existing.sku = undefined;
      existing.$unset('sku');
    } else {
      existing.sku = data.sku;
    }
    existing.description = data.description;
    existing.category = data.category;
    existing.unit = data.unit;
    existing.parLevel = data.parLevel;
    existing.lastPrice = data.lastPrice;
    existing.autoReorder = data.autoReorder;
    existing.preferredSupplier = data.preferredSupplier;
    existing.currentStock = data.currentStock;
    if (req.body.adiQuote) {
      existing.adiQuote = adiQuoteFromBody(req.body.adiQuote);
    }
    if (req.body.replacePriceHistory === true) {
      const replacement = Array.isArray(req.body.priceHistory) ? req.body.priceHistory : [];
      existing.priceHistory = replacement.map(priceChangeFromBody).filter(Boolean);
    } else {
      const priceChange = priceChangeFromBody(req.body.priceChange);
      if (priceChange) {
        existing.priceHistory = [priceChange, ...(existing.priceHistory || [])];
      }
    }
    await existing.save();
    await existing.populate('preferredSupplier', 'name adiAccount');
    res.json(existing);
  } catch (err) {
    if (inventoryConflictResponse(res, err)) return;
    console.error('Error updating inventory item:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/inventory/:id/stock', authMiddleware, async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ msg: 'Inventory item not found' });
    }
    const { type, quantity, reason, unitCost, source, customerId, projectId } = req.body || {};
    const preview = applyStockChange(item.currentStock, { type, quantity });
    if (preview.error) {
      return res.status(400).json({ msg: preview.error });
    }

    const assignmentError = jobAssignmentError(preview.delta, { customerId, projectId, type });
    if (assignmentError) {
      return res.status(400).json({ msg: assignmentError });
    }

    let customer = null;
    let project = null;
    if (customerId && projectId) {
      customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({ msg: 'Customer not found' });
      }
      project = customer.projects.id(projectId);
      if (!project) {
        return res.status(404).json({ msg: 'Project not found' });
      }
    }

    const usedQty = type === 'untracked'
      ? Number(quantity)
      : (preview.delta < 0 ? -preview.delta : 0);
    const jobLabel = project ? `${customer.name} — ${project.name}` : '';
    let movementReason = reason != null ? String(reason) : '';
    if (!movementReason) {
      if (type === 'untracked' && jobLabel) movementReason = `Used on ${jobLabel}, never received into inventory`;
      else if (jobLabel && usedQty) movementReason = `Used on ${jobLabel}`;
      else if (type === 'set') movementReason = 'Physical count';
    }

    const result = await applyAndRecordStockMovement({
      item,
      type,
      quantity,
      reason: movementReason,
      unitCost,
      source: project
        ? { kind: 'job', id: `${customer._id}:${project._id}` }
        : (source || { kind: type === 'set' ? 'count' : 'manual' }),
      userId: req.user.id,
    });

    let jobMaterial = null;
    if (project && usedQty > 0) {
      jobMaterial = applyJobUsageToProject(project, item, usedQty, {
        chargedFromStock: type !== 'untracked',
      });
      await customer.save();
    }

    await result.item.populate('preferredSupplier', 'name adiAccount');
    const payload = { item: result.item, movement: result.movement };
    if (type === 'set') {
      const counted = reconcileCount(preview.previousStock, quantity);
      if (!counted.error) payload.reconcile = counted;
    }
    if (jobMaterial) payload.jobMaterial = jobMaterial;
    res.json(payload);
  } catch (err) {
    if (inventoryConflictResponse(res, err)) return;
    console.error('Error adjusting inventory stock:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.get('/api/inventory/:id/movements', authMiddleware, async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ msg: 'Inventory item not found' });
    }
    const movements = await InventoryMovement.find({ itemId: item._id }).sort({ createdAt: -1 });
    res.json(movements);
  } catch (err) {
    console.error('Error fetching inventory movements:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.delete('/api/inventory/:id', authMiddleware, async (req, res) => {
  try {
    const item = await InventoryItem.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ msg: 'Inventory item not found' });
    }
    await InventoryMovement.deleteMany({ itemId: item._id });
    res.json({ msg: 'Inventory item deleted' });
  } catch (err) {
    console.error('Error deleting inventory item:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.get('/api/cost-centers', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const centers = await ensureCostCenters(CostCenter);
    res.json(centers);
  } catch (err) {
    console.error('Error listing cost centers:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/cost-centers', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const code = normalizeCostCenterCode(req.body?.code);
    const name = String(req.body?.name || '').trim();
    if (!code || !name) {
      return res.status(400).json({ msg: 'code and name are required' });
    }
    const center = await CostCenter.create({
      code,
      name,
      defaultClass: req.body?.defaultClass === 'direct' ? 'direct' : 'indirect',
      active: req.body?.active !== false,
    });
    res.status(201).json(center);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return res.status(400).json({ msg: 'Cost center code already exists' });
    }
    console.error('Error creating cost center:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.get('/api/expenses', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const filter = {};
    if (req.query.customerId) filter.customerId = req.query.customerId;
    if (req.query.projectId) filter.projectId = req.query.projectId;
    if (req.query.costCenterCode) filter.costCenterCode = normalizeCostCenterCode(req.query.costCenterCode);
    const range = dateQuery(req.query.from, req.query.to);
    if (range) filter.date = range;
    const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  } catch (err) {
    console.error('Error listing expenses:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/expenses', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await ensureCostCenters(CostCenter);
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ msg: 'amount must be a positive number' });
    }
    const costCenterCode = normalizeCostCenterCode(req.body?.costCenterCode);
    if (!costCenterCode) {
      return res.status(400).json({ msg: 'costCenterCode is required' });
    }
    const center = await CostCenter.findOne({ code: costCenterCode, active: { $ne: false } });
    if (!center) {
      return res.status(400).json({ msg: 'Unknown cost center' });
    }
    const date = req.body?.date ? new Date(req.body.date) : new Date();
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ msg: 'Invalid date' });
    }
    const job = await assertJobRef(req.body?.customerId, req.body?.projectId);
    if (job.error) return res.status(job.error.status).json({ msg: job.error.msg });

    const expense = await Expense.create({
      date,
      amount,
      payee: String(req.body?.payee || '').trim(),
      description: String(req.body?.description || '').trim(),
      costCenterCode,
      customerId: job.customerId,
      projectId: job.projectId,
      purchaseOrderId: req.body?.purchaseOrderId || undefined,
      createdBy: req.user.id,
    });
    res.status(201).json(expense);
  } catch (err) {
    console.error('Error creating expense:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/expenses/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ msg: 'Expense not found' });

    const moveErr = jobRefMoveError(expense, req.body || {});
    if (moveErr) return res.status(moveErr.status).json({ msg: moveErr.msg });

    if (req.body?.amount != null && req.body.amount !== '') {
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ msg: 'amount must be a positive number' });
      }
      expense.amount = amount;
    }
    if (req.body?.costCenterCode != null && req.body.costCenterCode !== '') {
      await ensureCostCenters(CostCenter);
      const costCenterCode = normalizeCostCenterCode(req.body.costCenterCode);
      const center = await CostCenter.findOne({ code: costCenterCode, active: { $ne: false } });
      if (!center) {
        return res.status(400).json({ msg: 'Unknown cost center' });
      }
      expense.costCenterCode = costCenterCode;
    }
    if (req.body?.date) {
      const date = new Date(req.body.date);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ msg: 'Invalid date' });
      }
      expense.date = date;
    }
    if (req.body?.payee != null) expense.payee = String(req.body.payee).trim();
    if (req.body?.description != null) expense.description = String(req.body.description).trim();

    await expense.save();
    res.json(expense);
  } catch (err) {
    console.error('Error updating expense:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.delete('/api/expenses/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ msg: 'Expense not found' });
    res.json({ msg: 'Expense deleted' });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.get('/api/labor-entries', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const filter = {};
    if (req.query.customerId) filter.customerId = req.query.customerId;
    if (req.query.projectId) filter.projectId = req.query.projectId;
    if (req.query.workType) filter.workType = normalizeLaborWorkType(req.query.workType);
    if (req.query.userId) filter.userId = req.query.userId;
    const range = dateQuery(req.query.from, req.query.to);
    if (range) filter.date = range;
    const entries = await LaborEntry.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(entries);
  } catch (err) {
    console.error('Error listing labor entries:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/labor-entries', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const hours = Number(req.body?.hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      return res.status(400).json({ msg: 'hours must be a positive number' });
    }
    const workType = normalizeLaborWorkType(req.body?.workType);
    if (!isKnownLaborWorkType(workType)) {
      return res.status(400).json({ msg: 'Invalid workType' });
    }
    const userId = req.body?.userId || req.user.id;
    const worker = await User.findById(userId);
    if (!worker) return res.status(404).json({ msg: 'User not found' });
    let hourlyCost = req.body?.hourlyCost;
    if (hourlyCost == null || hourlyCost === '') {
      hourlyCost = Number(worker.laborRate) || 0;
    } else {
      hourlyCost = Number(hourlyCost);
    }
    if (!Number.isFinite(hourlyCost) || hourlyCost < 0) {
      return res.status(400).json({ msg: 'hourlyCost must be a non-negative number' });
    }
    const date = req.body?.date ? new Date(req.body.date) : new Date();
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ msg: 'Invalid date' });
    }
    const job = await assertJobRef(req.body?.customerId, req.body?.projectId);
    if (job.error) return res.status(job.error.status).json({ msg: job.error.msg });

    const entry = await LaborEntry.create({
      date,
      userId: worker._id,
      hours,
      hourlyCost,
      workType,
      customerId: job.customerId,
      projectId: job.projectId,
      notes: String(req.body?.notes || '').trim(),
      createdBy: req.user.id,
    });
    res.status(201).json(entry);
  } catch (err) {
    console.error('Error creating labor entry:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/labor-entries/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const entry = await LaborEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ msg: 'Labor entry not found' });

    const moveErr = jobRefMoveError(entry, req.body || {});
    if (moveErr) return res.status(moveErr.status).json({ msg: moveErr.msg });

    if (req.body?.hours != null && req.body.hours !== '') {
      const hours = Number(req.body.hours);
      if (!Number.isFinite(hours) || hours <= 0) {
        return res.status(400).json({ msg: 'hours must be a positive number' });
      }
      entry.hours = hours;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'hourlyCost')) {
      let hourlyCost = req.body.hourlyCost;
      if (hourlyCost == null || hourlyCost === '') {
        const worker = await User.findById(entry.userId);
        hourlyCost = Number(worker?.laborRate) || 0;
      } else {
        hourlyCost = Number(hourlyCost);
      }
      if (!Number.isFinite(hourlyCost) || hourlyCost < 0) {
        return res.status(400).json({ msg: 'hourlyCost must be a non-negative number' });
      }
      entry.hourlyCost = hourlyCost;
    }
    if (req.body?.workType != null && req.body.workType !== '') {
      const workType = normalizeLaborWorkType(req.body.workType);
      if (!isKnownLaborWorkType(workType)) {
        return res.status(400).json({ msg: 'Invalid workType' });
      }
      entry.workType = workType;
    }
    if (req.body?.date) {
      const date = new Date(req.body.date);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ msg: 'Invalid date' });
      }
      entry.date = date;
    }
    if (req.body?.notes != null) entry.notes = String(req.body.notes).trim();

    await entry.save();
    res.json(entry);
  } catch (err) {
    console.error('Error updating labor entry:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.delete('/api/labor-entries/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const entry = await LaborEntry.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ msg: 'Labor entry not found' });
    res.json({ msg: 'Labor entry deleted' });
  } catch (err) {
    console.error('Error deleting labor entry:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.get('/api/accounting/summary', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const customers = await Customer.find({}).lean();
    const projects = customers.flatMap((customer) =>
      (customer.projects || []).map((project) => ({
        ...project,
        customerName: customer.name,
        accountNumber: customer.accountNumber,
        customerId: customer._id,
      }))
    );
    const purchaseOrders = await PurchaseOrder.find({}).lean();
    const supplierPayments = await SupplierPayment.find({}).lean();
    const expenses = await Expense.find({}).lean();
    const laborEntries = await LaborEntry.find({}).lean();
    const from = req.query.from || null;
    const to = req.query.to || null;
    res.json(buildAccountingSummary({
      projects,
      purchaseOrders,
      supplierPayments,
      expenses,
      laborEntries,
      from,
      to,
    }));
  } catch (err) {
    console.error('Error building accounting summary:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ===== SUBCONTRACTOR WORK ORDERS (Brinks tickets; not Customer.projects) =====

app.get('/api/subcontractor-work-orders', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const orders = await SubcontractorWorkOrder.find({}).sort({ createdAt: -1, scheduledDate: -1 });
    const status = req.query.status;
    if (status && !isKnownStatus(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }
    res.json(filterWorkOrdersByStatus(orders, status));
  } catch (err) {
    console.error('Error listing subcontractor work orders:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.post('/api/subcontractor-work-orders', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const checked = validateWorkOrder(req.body || {});
    if (checked.error) return res.status(400).json({ msg: checked.error });
    const order = await SubcontractorWorkOrder.create({
      ...checked.value,
      createdBy: req.user.id,
    });
    res.status(201).json(order);
  } catch (err) {
    console.error('Error creating subcontractor work order:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.put('/api/subcontractor-work-orders/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const checked = validateWorkOrder(req.body || {});
    if (checked.error) return res.status(400).json({ msg: checked.error });
    const order = await SubcontractorWorkOrder.findByIdAndUpdate(
      req.params.id,
      { ...checked.value, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!order) return res.status(404).json({ msg: 'Work order not found' });
    res.json(order);
  } catch (err) {
    console.error('Error updating subcontractor work order:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

app.delete('/api/subcontractor-work-orders/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const order = await SubcontractorWorkOrder.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ msg: 'Work order not found' });
    res.json({ msg: 'Work order deleted' });
  } catch (err) {
    console.error('Error deleting subcontractor work order:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Catch-all: no route matched. When DEBUG_API is on, return path info in response so you can see it in F12 → Network.
app.use((req, res) => {
  if (DEBUG_API) {
    return res.status(404).json({
      msg: 'Not found',
      debug: {
        path: req.path,
        url: req.url,
        originalUrl: req.originalUrl,
        queryPath: req.query?.path,
        method: req.method,
        hint: 'Enable DEBUG_API on server to see this. Check Vercel Logs for [DEBUG_API] request/response lines.',
      },
    });
  }
  res.status(404).json({ msg: 'Not found' });
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