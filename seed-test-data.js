// Quick script to seed test suppliers and inventory for testing Quick Reorder
import 'dotenv/config';
import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contactName: String,
  phone: String,
  email: String,
  categories: [String],
  leadTimeDays: { type: Number, default: 0 },
  minimumOrder: { type: Number, default: 0 },
  paymentTerms: String,
  isFavorite: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  totalSpent: { type: Number, default: 0 }
});
const Supplier = mongoose.model('Supplier', supplierSchema);

const inventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: String,
  description: String,
  category: String,
  currentStock: { type: Number, default: 0 },
  unit: String,
  parLevel: { type: Number, default: 0 },
  autoReorder: { type: Boolean, default: false },
  preferredSupplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  createdAt: { type: Date, default: Date.now }
});
const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);

async function seedData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // Create test suppliers
    const homeDepot = await Supplier.findOneAndUpdate(
      { name: 'Home Depot' },
      {
        name: 'Home Depot',
        contactName: 'Pro Desk',
        phone: '555-HOME-DEPOT',
        email: 'pro@homedepot.com',
        categories: ['Lumber', 'Hardware', 'Paint'],
        leadTimeDays: 1,
        minimumOrder: 0,
        paymentTerms: 'Net 30',
        isFavorite: true,
        isActive: true
      },
      { upsert: true, new: true }
    );

    const lowes = await Supplier.findOneAndUpdate(
      { name: 'Lowes' },
      {
        name: 'Lowes',
        contactName: 'Pro Services',
        phone: '555-LOWES-PRO',
        email: 'pro@lowes.com',
        categories: ['Electrical', 'Plumbing', 'Flooring'],
        leadTimeDays: 2,
        minimumOrder: 50,
        paymentTerms: 'Net 30',
        isFavorite: true,
        isActive: true
      },
      { upsert: true, new: true }
    );

    const electrical = await Supplier.findOneAndUpdate(
      { name: 'Acme Electrical Supply' },
      {
        name: 'Acme Electrical Supply',
        contactName: 'Bob Johnson',
        phone: '555-ELECTRIC',
        email: 'bob@acmeelectric.com',
        categories: ['Electrical'],
        leadTimeDays: 3,
        minimumOrder: 100,
        paymentTerms: 'Net 60',
        isFavorite: false,
        isActive: true
      },
      { upsert: true, new: true }
    );

    console.log('✅ Suppliers created');

    // Create test inventory items
    const testItems = [
      { name: '2x4 Lumber (8ft)', sku: 'LUM-2X4-8', category: 'Lumber', currentStock: 5, parLevel: 20, unit: 'each', supplier: homeDepot },
      { name: 'Drywall Screws (1lb)', sku: 'HW-SCREW-DW', category: 'Hardware', currentStock: 2, parLevel: 10, unit: 'box', supplier: homeDepot },
      { name: 'Wire Nuts (100pk)', sku: 'EL-WIRENUT', category: 'Electrical', currentStock: 3, parLevel: 5, unit: 'pack', supplier: electrical },
      { name: 'PVC Pipe 1/2" (10ft)', sku: 'PLM-PVC-HALF', category: 'Plumbing', currentStock: 8, parLevel: 15, unit: 'each', supplier: lowes },
      { name: 'Paint Primer (1gal)', sku: 'PNT-PRIMER-1G', category: 'Paint', currentStock: 1, parLevel: 5, unit: 'gallon', supplier: homeDepot },
      { name: 'Outlet Boxes', sku: 'EL-OUTLET-BOX', category: 'Electrical', currentStock: 15, parLevel: 20, unit: 'each', supplier: electrical },
      { name: 'Copper Wire 12/2', sku: 'EL-WIRE-12-2', category: 'Electrical', currentStock: 50, parLevel: 100, unit: 'ft', supplier: electrical },
      { name: 'PEX Tubing 1/2"', sku: 'PLM-PEX-HALF', category: 'Plumbing', currentStock: 25, parLevel: 100, unit: 'ft', supplier: lowes },
    ];

    for (const itemData of testItems) {
      await InventoryItem.findOneAndUpdate(
        { sku: itemData.sku },
        {
          ...itemData,
          preferredSupplier: itemData.supplier._id,
          autoReorder: itemData.currentStock < itemData.parLevel
        },
        { upsert: true, new: true }
      );
    }

    console.log('✅ Inventory items created');
    console.log('\nTest Data Summary:');
    console.log('- 3 Suppliers (Home Depot, Lowes, Acme Electrical)');
    console.log('- 8 Inventory items with par levels');
    console.log('- Several items below par level (for low stock alerts)');
    console.log('\nYou can now test the Quick Reorder panel!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seedData();

