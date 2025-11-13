# Catalog Management - User Guide

## 🎯 Overview

Manage supplier product catalogs with CSV import/export, manual entry, and searchable product listings. Keep pricing up-to-date and speed up ordering.

## 📚 Features

### **CSV Import**
- 📤 Drag & drop or browse for CSV files
- Auto-parse common formats
- Bulk import hundreds of items at once
- Validates data before importing

### **Manual Entry**
- ➕ Add individual items one at a time
- SKU, description, unit, price
- Perfect for small updates

### **Searchable Catalog**
- 🔍 Search by SKU or description
- Sortable table view
- Quick filtering
- Easy to find items

### **Export Functionality**
- 📥 Export to CSV anytime
- Includes all current pricing
- Backup your data
- Share with team or accounting

### **Price Tracking**
- Last updated date per item
- Average price calculation
- Total items count
- Quick stats view

## 🚀 Getting Started

### Accessing Catalog Management

1. **Go to Suppliers page** (`/suppliers`)
2. **Click any supplier name** to open details
3. **Click "Catalog" tab**
4. You're in catalog management!

## 📤 Importing Catalogs (CSV)

### Step 1: Prepare Your CSV

**Format Required:**
```csv
SKU,Description,Unit,Price
LUM-2X4-8,2x4 Lumber 8ft,each,3.99
HW-SCREW-DW,Drywall Screws 1lb,box,5.99
```

**Columns (in order):**
1. **SKU** - Product identifier (optional)
2. **Description** - Item name (required)
3. **Unit** - each, box, ft, gallon, etc. (required)
4. **Price** - Dollar amount (required)

### Step 2: Use Sample Template

A sample file is included: `sample-catalog-template.csv`

It has 20 common items pre-filled. Use it as a template!

### Step 3: Import

1. **Click "📤 Import CSV"** button
2. **Select your CSV file**
3. **System parses automatically**
4. **Success!** All items added to catalog

### What Happens

- ✅ Skips header row automatically
- ✅ Validates each row
- ✅ Sets "Last Updated" to today
- ✅ Adds to existing catalog (doesn't replace)
- ✅ Shows count of imported items

### Common CSV Sources

- **Supplier price lists** - Most suppliers provide CSV
- **Your own spreadsheet** - Export from Excel as CSV
- **Previous exports** - Re-import edited catalogs
- **Sample template** - Start with provided template

## ✏️ Manual Entry

### Adding Single Items

1. **Click "+ Add Item"** button
2. **Fill out form:**
   - SKU (optional)
   - Description (required)
   - Unit (dropdown)
   - Price (required)
3. **Click "Add to Catalog"**
4. ✅ Item added!

### When to Use Manual Entry

- Quick price updates
- New products (1-2 items)
- Corrections to imported data
- Custom/special items

## 🔍 Searching the Catalog

**Search box finds:**
- Matches in SKU
- Matches in description
- Case-insensitive
- Live filtering

**Example searches:**
- "2x4" → finds all 2x4 lumber
- "screw" → finds all screw types
- "LUM-" → finds all lumber SKUs

## 📥 Exporting Catalogs

### Why Export?

- **Backup** - Save your pricing data
- **Share** - Send to team members
- **Print** - Physical price lists
- **Accounting** - Cost tracking
- **Compare** - Track price changes over time

### How to Export

1. **Click "📥 Export CSV"** button
2. **File downloads automatically**
3. **Filename:** `Supplier-Name-catalog-2025-11-13.csv`
4. **Open in Excel or Google Sheets**

### What's Included

- All catalog items
- Current prices
- Last updated dates
- SKUs and units
- Ready to re-import if needed

## 🗑️ Managing Items

### Deleting Items

1. **Find item in table**
2. **Click "Delete"** button
3. **Confirm deletion**
4. ✅ Item removed from catalog

**Note:** This doesn't affect your inventory - only the supplier's catalog.

### Updating Prices

**Method 1: Edit & Re-import**
1. Export current catalog
2. Edit prices in Excel
3. Save as CSV
4. Re-import (adds new items, you'll need to delete old ones)

**Method 2: Delete & Re-add**
1. Delete old item
2. Click "+ Add Item"
3. Enter new price
4. Add back to catalog

**Future:** Inline editing coming soon!

## 📊 Catalog Stats

At the bottom, you'll see:

1. **Total Items** - Count of products
2. **Avg Price** - Average across all items
3. **Last Updated** - Most recent update date

## 🔗 Integration with Other Features

### With Quick Reorder
- Catalog prices auto-fill in PO generation (future)
- Quick add catalog items to reorder (future)

### With Inventory
- Match catalog SKUs to inventory
- Price updates flow to inventory cost (future)
- Create inventory from catalog item (future)

### With Purchase Orders
- Catalog prices pre-fill unit prices
- Reduces manual entry
- Consistency in pricing

## 💡 Best Practices

### Tip 1: Keep SKUs Consistent
- Use same SKU format across inventory and catalogs
- Makes matching easier
- Enables auto-fill features

### Tip 2: Update Catalogs Regularly
- Import new price lists when received
- Export monthly for records
- Track price increases

### Tip 3: One Catalog Per Supplier
- Each supplier has their own catalog tab
- Keep pricing separate
- Compare prices between suppliers

### Tip 4: Use Meaningful Descriptions
- Include size, material, brand
- "2x4 Lumber 8ft" not just "Lumber"
- Helps with searching

### Tip 5: Standard Units
- Use consistent unit names
- "each" not "ea" or "pcs"
- Matches your inventory units

## 📄 CSV Format Details

### Headers (First Row)
```
SKU,Description,Unit,Price
```

### Data Rows
```
LUM-2X4-8,2x4 Lumber 8ft,each,3.99
```

### Rules
- **Comma-separated** (not semicolon or tab)
- **No quotes needed** (unless description has comma)
- **Decimals use period** (3.99 not 3,99)
- **No $ signs** (just numbers)
- **Header row required** (gets skipped automatically)

### Valid Units
- each, box, ft, yd, lb, gallon, pack, roll, sheet

### Example CSV

See `sample-catalog-template.csv` in your project root for a working example with 20 items.

## 🔮 Coming Soon

Features planned for future updates:

- **Inline editing** - Edit prices directly in table
- **Price history** - Track changes over time with graph
- **Bulk price updates** - Update multiple items at once
- **Price alerts** - Notify when prices increase
- **Catalog sync** - Auto-import from supplier APIs
- **Photo uploads** - Add product images
- **Price comparison** - Compare same item across suppliers
- **Link to inventory** - One-click create inventory from catalog
- **PDF parsing** - Extract from PDF price lists

## 🛠️ Troubleshooting

### CSV Won't Import

**Check:**
- File ends in `.csv` (not `.xlsx` or `.txt`)
- Has header row: SKU,Description,Unit,Price
- Columns in correct order
- No special characters in descriptions
- Prices are numbers (no $ or commas)

**Fix:**
- Open in Excel or Google Sheets
- Save As → CSV format
- Verify format matches template

### Items Not Showing After Import

**Solution:**
- Check console for errors
- Verify CSV had valid data rows
- Try manual add to test connection
- Refresh the page

### Delete Not Working

**Check:**
- Are you logged in?
- Do you have network connection?
- Check browser console for errors

### Export Button Missing

**Reason:** No items in catalog yet
**Solution:** Add or import items first

## Quick Reference

| Action | How To |
|--------|--------|
| Import catalog | Click "📤 Import CSV" |
| Add single item | Click "+ Add Item" |
| Search catalog | Type in search box |
| Delete item | Click "Delete" on row |
| Export catalog | Click "📥 Export CSV" |
| View stats | Scroll to bottom |

---

## Sample CSV Template

Use `sample-catalog-template.csv` as a starting point. It includes:
- 20 common handyman items
- Proper formatting
- Various categories (lumber, hardware, electrical, plumbing, paint)
- Ready to import and test!

**Your catalog management system is ready!** 📚

