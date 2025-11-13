# Inventory Management - User Guide

## 🎯 Overview

Complete inventory tracking system to manage stock levels, prevent stock-outs, and automate reordering.

## 📦 Features

### **Stock Status Indicators**
- ✅ **Good Stock** (Green) - At or above par level
- ⚠️ **Low Stock** (Orange) - Below par level, needs reordering
- ❌ **Out of Stock** (Red) - Zero stock, order immediately

### **Par Level System**
- Set minimum stock you want to maintain
- When `currentStock < parLevel` → triggers low stock alert
- Appears in Quick Reorder panel automatically
- Click-to-filter from stats dashboard

### **Quick Stock Adjustments**
- **± button** next to each item
- Add stock (restocking from supplier)
- Remove stock (used on job)
- Preview before applying
- Auto-timestamps restocking

### **Auto-Reorder Alerts**
- Enable per-item
- Get notified when stock hits par level
- Shows in Quick Reorder panel
- Integrates with supplier system

## 🚀 Getting Started

### Add Your First Inventory Item

1. **Go to Inventory page** (`📦 Inventory` from dashboard)
2. **Click "+ Add Item"**
3. **Fill out form:**
   - Item Name (required)
   - SKU (optional but recommended)
   - Category
   - Current Stock
   - Par Level (minimum stock)
   - Unit (each, box, ft, etc.)
   - Preferred Supplier
   - Auto-Reorder toggle

4. **Click "Create Item"**

### Or Use Test Data

```bash
npm run seed-test-data
```

Creates 8 sample inventory items with suppliers and par levels.

## 📊 Inventory Page Layout

### Stats Dashboard (Top)

**6 Key Metrics:**
1. **Total Items** - All inventory items
2. **Good Stock** - At or above par (green)
3. **Low Stock** - Below par, needs ordering (orange, clickable)
4. **Out of Stock** - Zero stock (red, clickable)
5. **Auto-Reorder** - Items with auto-reorder enabled
6. **Est. Value** - Total inventory value

💡 **Tip:** Click "Low Stock" or "Out of Stock" to filter instantly!

### Filters

- **Search** - By item name or SKU
- **Category** - Filter by type (Electrical, Plumbing, etc.)
- **Stock Status** - All, Low Stock Only, Out of Stock Only

### Inventory Table

| Column | Description |
|--------|-------------|
| Item Name | Click to edit details |
| SKU | Product identifier |
| Category | Color-coded tag |
| Stock | Current quantity with **± adjust button** |
| Par Level | Minimum stock target |
| Status | Visual badge (Good/Low/Out) |
| Supplier | Preferred supplier for reordering |
| Auto-Reorder | ✓ if enabled |
| Actions | Edit button |

## 🔄 Stock Adjustments

### Adding Stock (Restocking)

1. **Click the ± button** next to stock amount
2. **Select "➕ Add Stock (Restock)"**
3. **Enter quantity** to add
4. **Add reason** (optional): "Restock from Home Depot"
5. **Preview** shows: `10 each → 30 each (+20)`
6. **Click "➕ Add Stock"**
7. ✅ Stock updated, last restocked date set

### Removing Stock (Usage)

1. **Click the ± button**
2. **Select "➖ Remove Stock (Used)"**
3. **Enter quantity** used
4. **Add reason** (optional): "Used on Smith job"
5. **Preview** shows: `30 each → 20 each (-10)`
6. **Click "➖ Remove Stock"**
7. ✅ Stock decreased

### Use Cases

**Restocking:**
- Received delivery from supplier
- Found extra items in storage
- Returned unused items from job

**Usage:**
- Used materials on a job
- Gave samples to customer
- Damaged/defective items

## 🎯 Par Level Best Practices

### What is Par Level?

**Par Level** = The minimum quantity you want to keep in stock

When stock falls below par:
- ⚠️ Appears in "Low Stock" alerts
- Shows in Quick Reorder panel
- Auto-reorder notification (if enabled)

### Setting Par Levels

| Item Type | Example Par Level | Reasoning |
|-----------|------------------|-----------|
| Common consumables | 20-50 units | Use frequently, cheap |
| Expensive items | 2-5 units | Minimize cash tied up |
| Fast-moving | 30+ units | High turnover |
| Slow-moving | 5-10 units | Lower demand |
| Seasonal | Varies | Adjust by season |

### Examples

**2x4 Lumber:**
- Par Level: 50 pieces
- Lead Time: 1 day (Home Depot)
- Usage: ~10 per week
- Result: 5 weeks buffer

**Wire Nuts:**
- Par Level: 10 packs
- Lead Time: 3 days
- Usage: ~2 packs per week
- Result: 5 weeks buffer

**Specialty Flooring:**
- Par Level: 2 boxes
- Lead Time: 7 days
- Usage: 1 per month
- Result: 2 months buffer

## 🔔 Auto-Reorder System

### How It Works

1. **Enable Auto-Reorder** on an item
2. **Set Par Level** (minimum stock)
3. **Assign Preferred Supplier**
4. **When stock < par:**
   - ⚠️ Shows in Quick Reorder panel
   - Badge shows "Low Stock"
   - One-click add to PO cart

### Setting Up Auto-Reorder

1. **Edit inventory item**
2. **Check "Enable Auto-Reorder Alerts"**
3. **Set realistic par level**
4. **Select preferred supplier**
5. **Save**

Now when stock drops below par:
- Appears automatically in Quick Reorder
- No manual checking needed
- Fast reordering workflow

## 🔗 Integration with Other Features

### With Quick Reorder Panel
- Low stock items → automatically appear
- Par level → suggests reorder quantity
- Preferred supplier → auto-groups in PO

### With Suppliers
- Preferred supplier → shown in inventory table
- Click supplier name → view supplier details
- Supplier catalog → link to inventory items

### With Purchase Orders
- Create PO → updates "Last Restocked" date
- Receive PO → can auto-update stock levels (future)
- Track spending per item (future)

## 📱 Mobile Friendly

The Inventory page works great on mobile:
- Responsive table (horizontal scroll)
- Large tap targets
- Quick stock adjustment on the go
- Search and filter optimized for touch

## 💡 Pro Tips

### Tip 1: Regular Stock Counts
- Do physical counts weekly or monthly
- Adjust discrepancies using ± button
- Track reasons for variance

### Tip 2: Review Par Levels Quarterly
- Based on actual usage patterns
- Seasonal adjustments
- Account for lead time changes

### Tip 3: Use SKUs Consistently
- Makes searching faster
- Links to supplier catalogs
- Barcode scanning (future)

### Tip 4: Enable Auto-Reorder on Essentials
- Items you always need
- High-use consumables
- Long lead-time items

### Tip 5: Assign Suppliers Early
- Makes Quick Reorder work better
- Tracks supplier reliability
- Faster PO generation

## 🔮 Coming Soon

Features planned for future updates:
- **Restock history log** - Track all adjustments
- **Usage analytics** - See consumption patterns
- **Value tracking** - Cost per item, total value
- **Photo uploads** - Pictures of items
- **Location tracking** - Where items are stored
- **Bulk import** - CSV upload for mass updates
- **Expiration dates** - For perishable items
- **Serial numbers** - Track individual items

## 🛠️ Troubleshooting

### Items not showing in Quick Reorder

**Check:**
- Is par level set > 0?
- Is current stock < par level?
- Is preferred supplier assigned?
- Refresh the Suppliers page

### Can't adjust stock

**Solution:**
- Make sure you're logged in
- Check browser console for errors
- Verify item exists in database

### Par level alerts not working

**Verify:**
- Par level is set (not 0)
- Current stock is actually below par
- Auto-reorder is enabled (optional)

## Quick Reference

| Action | How To |
|--------|--------|
| View all inventory | Dashboard → "📦 Inventory" |
| Add new item | Click "+ Add Item" |
| Edit item | Click item name in table |
| Adjust stock | Click ± button next to stock |
| Filter low stock | Click "Low Stock" stat or use dropdown |
| Search items | Type in search box |
| Enable auto-reorder | Edit item → check box |
| Set par level | Edit item → enter par level |

---

**Your inventory management system is ready!** 🎉

