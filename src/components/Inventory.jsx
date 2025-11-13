import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import API_BASE_URL from '../config/api';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState(''); // 'all', 'low', 'out'
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const categories = ['Electrical', 'Plumbing', 'Lumber', 'Hardware', 'HVAC', 'Roofing', 'Flooring', 'Paint'];

  useEffect(() => {
    fetchInventory();
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/suppliers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuppliers(res.data.suppliers || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(res.data);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      alert('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (item) => {
    if (item.currentStock === 0) return 'out';
    if (item.currentStock < item.parLevel && item.parLevel > 0) return 'low';
    return 'good';
  };

  const getStockBadge = (status) => {
    const badges = {
      'good': 'bg-green-100 text-green-800',
      'low': 'bg-orange-100 text-orange-800',
      'out': 'bg-red-100 text-red-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStockLabel = (status) => {
    const labels = {
      'good': '✓ Good Stock',
      'low': '⚠️ Low Stock',
      'out': '❌ Out of Stock'
    };
    return labels[status] || 'Unknown';
  };

  const filteredItems = items.filter(item => {
    // Search filter
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    // Category filter
    if (categoryFilter && item.category !== categoryFilter) {
      return false;
    }
    // Stock filter
    if (stockFilter === 'low' && getStockStatus(item) !== 'low') {
      return false;
    }
    if (stockFilter === 'out' && getStockStatus(item) !== 'out') {
      return false;
    }
    return true;
  });

  // Calculate stats
  const stats = {
    total: items.length,
    lowStock: items.filter(i => getStockStatus(i) === 'low').length,
    outOfStock: items.filter(i => getStockStatus(i) === 'out').length,
    goodStock: items.filter(i => getStockStatus(i) === 'good').length,
    autoReorder: items.filter(i => i.autoReorder).length,
    totalValue: items.reduce((sum, i) => sum + (i.currentStock * (i.lastPrice || 0)), 0)
  };

  const openItemDetail = (item) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  const openStockAdjust = (item) => {
    setSelectedItem(item);
    setShowAdjustModal(true);
  };

  if (loading) {
    return (
      <div className="p-8 text-black">
        <h1 className="text-2xl mb-4 text-black">Inventory Management</h1>
        <p className="text-black">Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="p-6 text-black">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-3">
            <Link to="/" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Dashboard
            </Link>
            <Link to="/suppliers" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
              Suppliers
            </Link>
          </div>
          <button
            onClick={() => {
              setSelectedItem({ 
                name: '', 
                sku: '', 
                category: '', 
                currentStock: 0, 
                parLevel: 0, 
                unit: 'each',
                autoReorder: false,
                isNew: true 
              });
              setShowModal(true);
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            + Add Item
          </button>
        </div>
        <h1 className="text-3xl font-bold text-black">Inventory Management</h1>
        <p className="text-gray-600 mt-2">Track stock levels and manage par levels</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Total Items</p>
          <p className="text-3xl font-bold text-black">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Good Stock</p>
          <p className="text-3xl font-bold text-green-600">{stats.goodStock}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50" onClick={() => setStockFilter('low')}>
          <p className="text-gray-600 text-sm">Low Stock</p>
          <p className="text-3xl font-bold text-orange-600">{stats.lowStock}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50" onClick={() => setStockFilter('out')}>
          <p className="text-gray-600 text-sm">Out of Stock</p>
          <p className="text-3xl font-bold text-red-600">{stats.outOfStock}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Auto-Reorder</p>
          <p className="text-3xl font-bold text-purple-600">{stats.autoReorder}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Est. Value</p>
          <p className="text-2xl font-bold text-black">
            ${stats.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="search-inventory" className="block text-sm font-medium text-black mb-1">Search</label>
            <input
              id="search-inventory"
              name="search-inventory"
              type="text"
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white"
            />
          </div>
          <div>
            <label htmlFor="category-filter" className="block text-sm font-medium text-black mb-1">Category</label>
            <select
              id="category-filter"
              name="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="stock-filter" className="block text-sm font-medium text-black mb-1">Stock Status</label>
            <select
              id="stock-filter"
              name="stock-filter"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white"
            >
              <option value="">All Stock Levels</option>
              <option value="low">Low Stock Only</option>
              <option value="out">Out of Stock Only</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('');
                setStockFilter('');
              }}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 mb-4">
              {items.length === 0 ? 'No inventory items yet.' : 'No items match your filters.'}
            </p>
            {items.length === 0 && (
              <button
                onClick={() => {
                  setSelectedItem({ 
                    name: '', 
                    sku: '', 
                    category: '', 
                    currentStock: 0, 
                    parLevel: 0, 
                    unit: 'each',
                    autoReorder: false,
                    isNew: true 
                  });
                  setShowModal(true);
                }}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Add Your First Item
              </button>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left p-4 text-black font-semibold">Item Name</th>
                <th className="text-left p-4 text-black font-semibold">SKU</th>
                <th className="text-left p-4 text-black font-semibold">Category</th>
                <th className="text-left p-4 text-black font-semibold">Stock</th>
                <th className="text-left p-4 text-black font-semibold">Par Level</th>
                <th className="text-left p-4 text-black font-semibold">Status</th>
                <th className="text-left p-4 text-black font-semibold">Supplier</th>
                <th className="text-left p-4 text-black font-semibold">Auto-Reorder</th>
                <th className="text-left p-4 text-black font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const stockStatus = getStockStatus(item);
                return (
                  <tr key={item._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <button
                        onClick={() => openItemDetail(item)}
                        className="text-blue-600 hover:text-blue-800 font-semibold text-left"
                      >
                        {item.name}
                      </button>
                    </td>
                    <td className="p-4 text-gray-600 text-sm">{item.sku || '-'}</td>
                    <td className="p-4">
                      {item.category && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          {item.category}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-black font-semibold">{item.currentStock}</span>
                        <span className="text-gray-600 text-sm">{item.unit}</span>
                        <button
                          onClick={() => openStockAdjust(item)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                          title="Adjust stock"
                        >
                          ±
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-black">{item.parLevel || '-'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStockBadge(stockStatus)}`}>
                        {getStockLabel(stockStatus)}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 text-sm">
                      {item.preferredSupplier?.name || '-'}
                    </td>
                    <td className="p-4 text-center">
                      {item.autoReorder ? (
                        <span className="text-green-600 font-bold" title="Auto-reorder enabled">✓</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openItemDetail(item)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Item Detail/Edit Modal */}
      {showModal && selectedItem && (
        <ItemModal
          item={selectedItem}
          suppliers={suppliers}
          onClose={() => {
            setShowModal(false);
            setSelectedItem(null);
          }}
          onSave={() => {
            setShowModal(false);
            setSelectedItem(null);
            fetchInventory();
          }}
        />
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustModal && selectedItem && (
        <StockAdjustModal
          item={selectedItem}
          onClose={() => {
            setShowAdjustModal(false);
            setSelectedItem(null);
          }}
          onSave={() => {
            setShowAdjustModal(false);
            setSelectedItem(null);
            fetchInventory();
          }}
        />
      )}
    </div>
  );
}

// Item Edit Modal
function ItemModal({ item, suppliers, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: item.name || '',
    sku: item.sku || '',
    description: item.description || '',
    category: item.category || '',
    currentStock: item.currentStock || 0,
    unit: item.unit || 'each',
    parLevel: item.parLevel || 0,
    autoReorder: item.autoReorder || false,
    preferredSupplier: item.preferredSupplier?._id || ''
  });

  const units = ['each', 'box', 'ft', 'yd', 'lb', 'gallon', 'pack', 'roll', 'sheet'];
  const categories = ['Electrical', 'Plumbing', 'Lumber', 'Hardware', 'HVAC', 'Roofing', 'Flooring', 'Paint'];

  const handleSave = async () => {
    if (!formData.name) {
      alert('Item name is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (item.isNew) {
        await axios.post(`${API_BASE_URL}/api/inventory`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('✅ Inventory item created!');
      } else {
        await axios.put(`${API_BASE_URL}/api/inventory/${item._id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('✅ Inventory item updated!');
      }
      onSave();
    } catch (err) {
      console.error('Error saving inventory item:', err);
      alert('❌ Failed to save item');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-300 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-black">
            {item.isNew ? 'Add Inventory Item' : 'Edit Inventory Item'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="item-name" className="block text-sm font-medium text-black mb-1">Item Name *</label>
              <input
                id="item-name"
                name="item-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                placeholder="e.g., 2x4 Lumber (8ft)"
              />
            </div>
            <div>
              <label htmlFor="item-sku" className="block text-sm font-medium text-black mb-1">SKU</label>
              <input
                id="item-sku"
                name="item-sku"
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                placeholder="e.g., LUM-2X4-8"
              />
            </div>
          </div>

          <div>
            <label htmlFor="item-description" className="block text-sm font-medium text-black mb-1">Description</label>
            <textarea
              id="item-description"
              name="item-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white h-20 resize-none"
              placeholder="Additional details about this item..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="item-category" className="block text-sm font-medium text-black mb-1">Category</label>
              <select
                id="item-category"
                name="item-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-black bg-white"
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="item-unit" className="block text-sm font-medium text-black mb-1">Unit</label>
              <select
                id="item-unit"
                name="item-unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-black bg-white"
              >
                {units.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="current-stock" className="block text-sm font-medium text-black mb-1">Current Stock</label>
              <input
                id="current-stock"
                name="current-stock"
                type="number"
                value={formData.currentStock}
                onChange={(e) => setFormData({ ...formData, currentStock: parseInt(e.target.value) || 0 })}
                className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                min="0"
              />
            </div>
            <div>
              <label htmlFor="par-level" className="block text-sm font-medium text-black mb-1">
                Par Level
                <span className="text-gray-500 text-xs ml-1">(Minimum stock)</span>
              </label>
              <input
                id="par-level"
                name="par-level"
                type="number"
                value={formData.parLevel}
                onChange={(e) => setFormData({ ...formData, parLevel: parseInt(e.target.value) || 0 })}
                className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                min="0"
              />
            </div>
          </div>

          <div>
            <label htmlFor="preferred-supplier" className="block text-sm font-medium text-black mb-1">Preferred Supplier</label>
            <select
              id="preferred-supplier"
              name="preferred-supplier"
              value={formData.preferredSupplier}
              onChange={(e) => setFormData({ ...formData, preferredSupplier: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white"
            >
              <option value="">No Supplier</option>
              {suppliers.map(supplier => (
                <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoReorder}
                onChange={(e) => setFormData({ ...formData, autoReorder: e.target.checked })}
                className="mr-3 h-5 w-5"
              />
              <div>
                <span className="font-medium text-black">Enable Auto-Reorder Alerts</span>
                <p className="text-xs text-gray-600 mt-1">
                  Get notified when stock falls below par level
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-300 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded text-black bg-white hover:bg-gray-100 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium"
          >
            {item.isNew ? 'Create Item' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Stock Adjustment Modal
function StockAdjustModal({ item, onClose, onSave }) {
  const [adjustment, setAdjustment] = useState(0);
  const [reason, setReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('add'); // 'add' or 'remove'

  const newStock = adjustmentType === 'add' 
    ? item.currentStock + adjustment 
    : Math.max(0, item.currentStock - adjustment);

  const handleSave = async () => {
    if (adjustment === 0) {
      alert('Please enter an adjustment amount');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/inventory/${item._id}`, {
        currentStock: newStock,
        lastRestocked: adjustmentType === 'add' ? new Date().toISOString() : item.lastRestocked
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(`✅ Stock ${adjustmentType === 'add' ? 'added' : 'removed'} successfully!`);
      onSave();
    } catch (err) {
      console.error('Error adjusting stock:', err);
      alert('❌ Failed to adjust stock');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Modal Header */}
        <div className="bg-white border-b border-gray-300 p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold text-black">Adjust Stock</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          <div>
            <p className="font-semibold text-black text-lg">{item.name}</p>
            <p className="text-sm text-gray-600">Current Stock: {item.currentStock} {item.unit}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">Adjustment Type</label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="adjustment-type"
                  checked={adjustmentType === 'add'}
                  onChange={() => setAdjustmentType('add')}
                  className="mr-2"
                />
                <span className="text-black">➕ Add Stock (Restock)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="adjustment-type"
                  checked={adjustmentType === 'remove'}
                  onChange={() => setAdjustmentType('remove')}
                  className="mr-2"
                />
                <span className="text-black">➖ Remove Stock (Used)</span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="adjustment-amount" className="block text-sm font-medium text-black mb-1">
              Amount to {adjustmentType === 'add' ? 'Add' : 'Remove'}
            </label>
            <input
              id="adjustment-amount"
              name="adjustment-amount"
              type="number"
              value={adjustment}
              onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white"
              min="0"
              placeholder="Enter quantity"
            />
          </div>

          <div>
            <label htmlFor="adjustment-reason" className="block text-sm font-medium text-black mb-1">
              Reason (Optional)
            </label>
            <input
              id="adjustment-reason"
              name="adjustment-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white"
              placeholder="e.g., Restock from supplier, Used on job"
            />
          </div>

          {/* Preview */}
          <div className={`p-4 rounded-lg border-2 ${
            adjustmentType === 'add' ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-300'
          }`}>
            <p className="text-sm font-medium text-black mb-2">Preview:</p>
            <div className="flex justify-between items-center">
              <span className="text-black">
                {item.currentStock} {item.unit} 
                <span className="mx-2 text-gray-600">→</span>
                <strong className={adjustmentType === 'add' ? 'text-green-600' : 'text-orange-600'}>
                  {newStock} {item.unit}
                </strong>
              </span>
              <span className={`text-sm font-bold ${
                adjustmentType === 'add' ? 'text-green-600' : 'text-orange-600'
              }`}>
                {adjustmentType === 'add' ? '+' : '-'}{adjustment}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 border-t border-gray-300 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded text-black bg-white hover:bg-gray-100 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-2 text-white rounded font-medium ${
              adjustmentType === 'add' 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {adjustmentType === 'add' ? '➕ Add Stock' : '➖ Remove Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

