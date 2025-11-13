# Quick Reorder Panel - User Guide

## 🎯 What is Quick Reorder?

The Quick Reorder Panel is a **sticky sidebar** on the Suppliers page that makes reordering materials fast and efficient. It shows:

1. **Low Stock Alerts** ⚠️ - Items below par level (needs restocking NOW)
2. **Frequently Ordered Items** - Your most-used materials
3. **Quick Cart** - One-click add to cart
4. **Instant PO Generation** - Generate purchase orders in seconds

## 🚀 Getting Started

### 1. Add Test Data (First Time Setup)

Run this command to populate test suppliers and inventory:

```bash
npm run seed-test-data
```

This creates:
- **3 Suppliers:** Home Depot, Lowes, Acme Electrical Supply
- **8 Inventory Items** with par levels
- **Low stock items** to trigger alerts

### 2. Access Quick Reorder

1. Go to **Suppliers & Materials** page (🏪 Suppliers button from dashboard)
2. The Quick Reorder panel appears on the **right side** of the screen
3. Click **🛒** to expand/collapse the panel

## 📋 How to Use Quick Reorder

### Adding Items to Cart

**Method 1: From Low Stock Alerts**
- Low stock items appear at the top with ⚠️ warning
- Click **"+ Add"** button
- Quantity auto-fills based on par level

**Method 2: From Frequently Ordered**
- Browse frequently used items below
- Click **"+ Add"** button
- Par level quantity suggested automatically

### Managing Cart

**Adjust Quantities:**
- Click in the quantity field
- Type new amount
- Changes save automatically

**Remove Items:**
- Click the **✕** button next to any item

**Clear Cart:**
- Click **"Clear All"** to empty the entire cart

### Generating Purchase Orders

1. **Add items to cart** using methods above
2. **Cart summary** shows total items at the top
3. Click **"📋 Generate PO"** button
4. **PO Modal opens:**
   - Items grouped by supplier automatically
   - Select supplier from dropdown
   - Enter unit prices for each item
   - Subtotal, tax (8%), and total calculated automatically
   - Add expected delivery date (optional)
   - Add notes (optional)
5. Click **"Create Purchase Order"**
6. ✅ PO created with auto-generated number (PO-2025-0001, etc.)

## 🎨 Features

### Smart Grouping
- Items automatically grouped by preferred supplier
- One PO per supplier
- If multiple suppliers, you'll create multiple POs

### Par Level Integration
- **Par Level** = Minimum stock you want to maintain
- When `currentStock < parLevel` → appears in Low Stock Alerts
- Suggested reorder quantity = par level

### Auto-Calculations
- **Subtotal** = Sum of (quantity × unit price)
- **Tax** = Subtotal × 8% (configurable)
- **Total** = Subtotal + Tax + Shipping

### Collapse/Expand
- Click the **🛒** button to hide the panel
- Get more screen space when not reordering
- Click **→** to expand again

## 📊 Setting Up Inventory Items

To get the most out of Quick Reorder, set up your inventory:

### Add Inventory Item (via API or future UI):

```javascript
{
  name: "2x4 Lumber (8ft)",
  sku: "LUM-2X4-8",
  category: "Lumber",
  currentStock: 10,      // How many you have now
  parLevel: 50,          // Minimum you want to keep
  unit: "each",
  preferredSupplier: "supplier_id_here",
  autoReorder: false     // Enable for auto-reorder alerts
}
```

### Par Level Examples:

| Item | Par Level | Reasoning |
|------|-----------|-----------|
| Common screws | 20 boxes | Use on most jobs |
| Specialty lumber | 5 pieces | Less frequent |
| Wire nuts | 10 packs | Small, cheap, always needed |
| Paint primer | 3 gallons | Takes up space, medium use |

## 🔔 Low Stock Alerts

### How It Works:

When `currentStock < parLevel`:
- ⚠️ Item appears in Low Stock section (top of panel)
- Orange alert background
- Shows: "Stock: 5 / Par: 20"
- One-click add to cart

### Dashboard Widget:

The main Suppliers page shows:
- **"Low Stock Items" stat** with count
- ⚠️ Warning icon if > 0
- Helps you spot issues at a glance

## 💡 Pro Tips

### Tip 1: Set Realistic Par Levels
- Too high = wasted cash tied up in inventory
- Too low = constant reordering and stock-outs
- Review quarterly based on actual usage

### Tip 2: Use Favorites
- Star ⭐ your most-used suppliers
- Filter by favorites for faster access
- Quick reorder shows items from favorite suppliers first

### Tip 3: Batch Orders
- Add multiple items to cart before generating PO
- Save on shipping by ordering together
- Reach minimum order amounts

### Tip 4: Check Lead Times
- Suppliers table shows average lead time
- Plan ahead for items with longer lead times
- Order before hitting par level

## 🛠️ Troubleshooting

### "No items yet" in frequently ordered

**Solution:** Add inventory items with preferred suppliers set
```bash
npm run seed-test-data  # Adds test data
```

### Items added but can't see cart

**Solution:** Scroll up in the panel - cart is at the top

### "No suppliers assigned" warning

**Solution:** Each inventory item needs a `preferredSupplier` set

### PO not creating

**Check:**
- Is a supplier selected?
- Are prices entered? (can be 0 if needed)
- Check browser console for errors

## 📱 Mobile Friendly

The Quick Reorder panel is optimized for mobile:
- Collapses to just 🛒 icon on small screens
- Touch-friendly buttons
- Swipe to expand/collapse
- Works with tablets and phones

## 🔮 Coming Soon

Features planned for future updates:
- **Auto-reorder triggers** - Generate PO when item hits par
- **Price memory** - Remember last prices paid
- **Favorites list** - Save custom reorder lists
- **Barcode scanning** - Scan items to add to cart
- **Voice commands** - "Add 20 2x4s"
- **Email integration** - Send PO directly to supplier

---

## Quick Reference

| Action | How To |
|--------|--------|
| Open Panel | Click 🛒 icon |
| Add Item | Click "+ Add" button |
| Remove Item | Click ✕ on cart item |
| Change Quantity | Type in quantity field |
| Create PO | Click "📋 Generate PO" |
| Collapse Panel | Click → button |

**Enjoy lightning-fast reordering!** ⚡

