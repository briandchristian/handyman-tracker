# Purchase Orders Management - User Guide

## 🎯 Overview

The Purchase Orders system provides complete PO lifecycle management with status tracking, automatic numbering, and print capabilities.

## 📋 Features

### **Status Workflow**
```
Draft → Sent → Confirmed → Received → Paid
         └─────────────────→ Cancelled (anytime)
```

Each status transition:
- ✅ One-click status updates
- ✅ Auto-timestamps important events
- ✅ Clear visual progression
- ✅ Prevents invalid status changes

### **Auto-Generated PO Numbers**
- Format: `PO-YYYY-NNNN` (e.g., PO-2025-0001)
- Sequential numbering per year
- Never duplicate
- Easy to reference

### **Smart Calculations**
- Subtotal = Σ(quantity × unit price)
- Tax = Configurable % (default 8%)
- Shipping = Optional amount
- Total = Subtotal + Tax + Shipping

### **Print-Ready**
- Professional PDF-style output
- Includes all line items
- Supplier info, dates, totals
- Ready to email or fax

## 🚀 Creating Purchase Orders

### Method 1: Via Quick Reorder (Recommended)

1. **Go to Suppliers page** (`/suppliers`)
2. **Use Quick Reorder panel** (right sidebar)
3. **Add items** from low stock or frequently ordered
4. **Click "📋 Generate PO"**
5. **Enter prices** and details
6. **Create!**

### Method 2: Via API (Advanced)

```javascript
POST /api/purchase-orders
{
  supplier: "supplier_id",
  items: [
    {
      sku: "LUM-2X4-8",
      description: "2x4 Lumber (8ft)",
      quantity: 50,
      unit: "each",
      unitPrice: 3.99,
      total: 199.50
    }
  ],
  subtotal: 199.50,
  tax: 15.96,
  shipping: 0,
  total: 215.46,
  notes: "Deliver to job site",
  expectedDelivery: "2025-11-20",
  status: "Draft"
}
```

## 📊 Purchase Orders Page

### Stats Dashboard

**6 Key Metrics:**
1. **Total POs** - All purchase orders
2. **Draft** - Not yet sent (gray)
3. **Sent** - Out to suppliers (blue)
4. **Received** - Delivered (green)
5. **Paid** - Invoice paid (dark green)
6. **Total Value** - Sum of all POs

### Filters

- **By Status:** Draft, Sent, Confirmed, etc.
- **Clear Filter** - Show all

### PO Table Columns

| Column | Info |
|--------|------|
| PO Number | Click to open details |
| Supplier | Who you're ordering from |
| Status | Current stage with icon |
| Order Date | When PO was created |
| Expected Delivery | When you expect items |
| Total | Total cost ($) |
| Actions | View Details button |

## 🔄 Status Management

### Draft → Sent
**When:** You've finalized the PO and sent it to supplier
- Click **"📤 Mark as Sent"**
- Updates status immediately
- Ready for supplier confirmation

### Sent → Confirmed
**When:** Supplier confirms they received the order
- Click **"✓ Confirm Order"**
- Supplier acknowledged
- Waiting for delivery

### Confirmed → Received
**When:** Items physically delivered to you
- Click **"📦 Mark as Received"**
- Auto-sets received date (editable)
- Ready to pay

### Received → Paid
**When:** You've paid the invoice
- Click **"💰 Mark as Paid"**
- Auto-sets paid date (editable)
- PO complete! ✅

### Cancel Order
**When:** Order needs to be cancelled (any status except Paid)
- Click **"❌ Cancel Order"**
- Confirms before cancelling
- Removes from open POs count

## 📄 PO Detail View

Click any PO number or "View Details" to open:

### Information Shown:
- **PO Number** & creation info
- **Supplier name**
- **All dates** (order, expected, received, paid)
- **Current status** with visual badge
- **Complete line items table**
- **Cost breakdown** (subtotal, tax, total)
- **Notes field**

### Actions Available:
- **Update Status** - Status workflow buttons
- **Edit Dates** - Change expected/received/paid dates
- **Update Notes** - Add information
- **Print PO** - Generate printable version
- **Save Changes** - Save edits

## 🖨️ Printing Purchase Orders

### How to Print

1. **Open PO detail** (click PO number)
2. **Click "🖨️ Print PO"** button (bottom left)
3. **Print dialog opens** with formatted PO
4. **Print or Save as PDF**

### What's Included

- Company header (customize later)
- PO number and dates
- Supplier information
- Status badge
- Complete line items table
- Subtotal, tax, shipping, total
- Notes section
- Generation timestamp

### Use Cases

- 📧 **Email to supplier** - Save as PDF and attach
- 📠 **Fax** - Print and fax
- 📁 **File** - Keep paper records
- 💻 **Screen capture** - Quick share

## 💡 Best Practices

### Tip 1: Use Draft Status
- Create POs in Draft initially
- Review prices and quantities
- Update to Sent only when ready

### Tip 2: Track Dates
- Set **Expected Delivery** when creating
- Update **Received Date** when items arrive
- Update **Paid Date** when invoice paid
- Helps with supplier performance tracking

### Tip 3: Add Notes
- Delivery instructions
- Special requests
- Damaged items documentation
- Payment reference numbers

### Tip 4: Regular Review
- Check "Sent" POs weekly (follow up if delayed)
- Mark Received promptly (for accurate inventory)
- Mark Paid for accounting reconciliation

## 📈 Reporting (Data Available)

From the API, you can query:
- Total spend per supplier
- Average lead times
- Open PO value
- Monthly purchasing trends
- Supplier performance metrics

## 🔮 Coming in Phase 2C & 2D

**Catalog Integration:**
- Import prices from supplier catalogs
- Auto-fill prices when creating POs
- Price history tracking

**Advanced Features:**
- Attach photos (damaged goods, invoices)
- Email PO directly to supplier
- Supplier portal (they update status)
- QuickBooks/Xero export
- Multi-currency support
- Approval workflows

## 🛠️ Technical Details

### PO Number Format
- **Pattern:** `PO-YYYY-NNNN`
- **Example:** `PO-2025-0001`
- **Sequential:** Auto-increments each year
- **Year Reset:** Starts at 0001 each January 1st

### Data Structure
```javascript
{
  poNumber: "PO-2025-0001",
  supplier: ObjectId,
  status: "Draft|Sent|Confirmed|Received|Paid|Cancelled",
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
  orderDate: Date,
  expectedDelivery: Date,
  receivedDate: Date,
  paidDate: Date,
  createdBy: ObjectId
}
```

## 🔐 Permissions

All PO operations require authentication (`authMiddleware`):
- Create PO: Any authenticated admin
- View POs: Any authenticated admin
- Update PO: Any authenticated admin
- Delete PO: Not implemented (use Cancel status instead)

## 📱 Mobile Optimized

The Purchase Orders page works great on mobile:
- Responsive table (scrolls horizontally)
- Touch-friendly buttons
- Large tap targets for status updates
- Modal fits any screen size

## Quick Reference

| Action | Location |
|--------|----------|
| View all POs | Dashboard → "📋 Orders" |
| Create PO | Suppliers → Quick Reorder → Generate PO |
| View PO details | Click PO number in table |
| Update status | PO detail → Status buttons |
| Print PO | PO detail → "🖨️ Print PO" |
| Filter by status | Dropdown at top of PO page |

---

**Your Purchase Orders system is now ready!** 🎉

