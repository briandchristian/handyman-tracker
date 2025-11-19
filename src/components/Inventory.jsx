import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import API_BASE_URL from '../config/api';
import BarcodeScanner from './BarcodeScanner';

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
  const [showScanner, setShowScanner] = useState(false);

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
    // Search filter - search by name OR SKU
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesName = item.name.toLowerCase().includes(search);
      const matchesSKU = item.sku && item.sku.toLowerCase().includes(search);
      if (!matchesName && !matchesSKU) {
        return false;
      }
    }
    // Category filter
    if (categoryFilter && item.category !== categoryFilter) {
      return false;
    }
    // Stock filter
    if (stockFilter === 'low') {
      const status = getStockStatus(item);
      // Show both low and out of stock when filtering by 'low'
      if (status !== 'low' && status !== 'out') {
        return false;
      }
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

  const handleBarcodeScan = (code) => {
    console.log('Scanned code:', code);
    // Search for item by SKU
    const found = items.find(item => item.sku === code);
    if (found) {
      openStockAdjust(found);
      alert(`✅ Found: ${found.name}`);
    } else {
      // Search in search box
      setSearchTerm(code);
      alert(`🔍 Searching for: ${code}`);
    }
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
    <div className="p-4 md:p-6 text-black">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <Link to="/" className="bg-blue-500 text-white px-4 py-3 md:px-3 md:py-2 rounded hover:bg-blue-600 text-base md:text-sm font-medium flex-1 sm:flex-none text-center">
              Dashboard
            </Link>
            <Link to="/suppliers" className="bg-green-500 text-white px-4 py-3 md:px-3 md:py-2 rounded hover:bg-green-600 text-base md:text-sm font-medium flex-1 sm:flex-none text-center">
              Suppliers
            </Link>
            <button
              onClick={() => setShowScanner(true)}
              className="bg-purple-500 text-white px-4 py-3 md:px-3 md:py-2 rounded hover:bg-purple-600 text-base md:text-sm font-medium flex-1 sm:flex-none"
            >
              📱 Scan Barcode
            </button>
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
            className="bg-blue-500 text-white px-4 py-3 md:py-2 rounded hover:bg-blue-600 text-base md:text-sm font-medium w-full sm:w-auto"
          >
            + Add Item
          </button>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-black">Inventory Management</h1>
        <p className="text-gray-600 mt-2 text-base md:text-sm">Track stock levels and manage par levels</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-4">
          <p className="text-gray-600 text-base md:text-sm">Total Items</p>
          <p className="text-3xl font-bold text-black">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-4">
          <p className="text-gray-600 text-base md:text-sm">Good Stock</p>
          <p className="text-3xl font-bold text-green-600">{stats.goodStock}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-4 cursor-pointer hover:bg-gray-50" onClick={() => setStockFilter('low')}>
          <p className="text-gray-600 text-base md:text-sm">Low Stock</p>
          <p className="text-3xl font-bold text-orange-600">{stats.lowStock}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-4 cursor-pointer hover:bg-gray-50" onClick={() => setStockFilter('out')}>
          <p className="text-gray-600 text-base md:text-sm">Out of Stock</p>
          <p className="text-3xl font-bold text-red-600">{stats.outOfStock}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-4">
          <p className="text-gray-600 text-base md:text-sm">Auto-Reorder</p>
          <p className="text-3xl font-bold text-purple-600">{stats.autoReorder}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-4">
          <p className="text-gray-600 text-base md:text-sm">Est. Value</p>
          <p className="text-2xl font-bold text-black">
            ${stats.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="search-inventory" className="block text-base md:text-sm font-medium text-black mb-2">Search</label>
            <input
              id="search-inventory"
              name="search-inventory"
              type="text"
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white text-base md:text-sm"
            />
          </div>
          <div>
            <label htmlFor="category-filter" className="block text-base md:text-sm font-medium text-black mb-2">Category</label>
            <select
              id="category-filter"
              name="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white text-base md:text-sm"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="stock-filter" className="block text-base md:text-sm font-medium text-black mb-2">Stock Status</label>
            <select
              id="stock-filter"
              name="stock-filter"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white text-base md:text-sm"
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
              className="text-blue-600 hover:text-blue-800 text-base md:text-sm font-medium py-3 md:py-0"
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
            <p className="text-gray-600 mb-4 text-base md:text-sm">
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
                className="bg-blue-500 text-white px-4 py-3 md:py-2 rounded hover:bg-blue-600 text-base md:text-sm font-medium"
              >
                Add Your First Item
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-4 p-4">
              {filteredItems.map(item => {
                const stockStatus = getStockStatus(item);
                return (
                  <div key={item._id} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex justify-between items-start mb-3">
                      <button
                        onClick={() => openItemDetail(item)}
                        className="text-blue-600 hover:text-blue-800 font-semibold text-left text-lg flex-1"
                      >
                        {item.name}
                      </button>
                      <span className={`px-3 py-1 rounded text-sm ml-2 ${getStockBadge(stockStatus)}`}>
                        {getStockLabel(stockStatus)}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-base">
                      {item.sku && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">SKU:</span>
                          <span className="text-black">{item.sku}</span>
                        </div>
                      )}
                      {item.category && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Category:</span>
                          <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded">
                            {item.category}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Stock:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-black font-semibold">{item.currentStock} {item.unit}</span>
                          <button
                            onClick={() => openStockAdjust(item)}
                            className="text-blue-600 hover:text-blue-800 text-base font-bold px-2 py-1 bg-blue-50 rounded"
                            title="Adjust stock"
                          >
                            ±
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Par Level:</span>
                        <span className="text-black">{item.parLevel || '-'}</span>
                      </div>
                      {item.preferredSupplier?.name && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Supplier:</span>
                          <span className="text-black">{item.preferredSupplier.name}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Auto-Reorder:</span>
                        {item.autoReorder ? (
                          <span className="text-green-600 font-bold text-lg" title="Auto-reorder enabled">✓</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => openItemDetail(item)}
                        className="w-full bg-blue-500 text-white text-center py-3 rounded hover:bg-blue-600 font-medium"
                      >
                        Edit Item
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left p-4 text-black font-semibold text-sm">Item Name</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">SKU</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Category</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Stock</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Par Level</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Status</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Supplier</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Auto-Reorder</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Actions</th>
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
                            className="text-blue-600 hover:text-blue-800 font-semibold text-left text-sm"
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
                            <span className="text-black font-semibold text-sm">{item.currentStock}</span>
                            <span className="text-gray-600 text-sm">{item.unit}</span>
                            <button
                              onClick={() => openStockAdjust(item)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-bold px-2 py-1"
                              title="Adjust stock"
                            >
                              ±
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-black text-sm">{item.parLevel || '-'}</td>
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
            </div>
          </>
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

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          title="Scan Item Barcode"
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
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
        <div className="sticky top-0 bg-white border-b border-gray-300 p-4 md:p-6 flex justify-between items-center">
          <h2 className="text-xl md:text-2xl font-bold text-black">
            {item.isNew ? 'Add Inventory Item' : 'Edit Inventory Item'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-3xl md:text-2xl font-bold w-11 h-11 md:w-8 md:h-8 flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="item-name" className="block text-base md:text-sm font-medium text-black mb-2">Item Name *</label>
              <input
                id="item-name"
                name="item-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white text-base md:text-sm"
                placeholder="e.g., 2x4 Lumber (8ft)"
              />
            </div>
            <div>
              <label htmlFor="item-sku" className="block text-base md:text-sm font-medium text-black mb-2">SKU</label>
              <input
                id="item-sku"
                name="item-sku"
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white text-base md:text-sm"
                placeholder="e.g., LUM-2X4-8"
              />
            </div>
          </div>

          <div>
            <label htmlFor="item-description" className="block text-base md:text-sm font-medium text-black mb-2">Description</label>
            <textarea
              id="item-description"
              name="item-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white h-24 md:h-20 resize-none text-base md:text-sm"
              placeholder="Additional details about this item..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="item-category" className="block text-base md:text-sm font-medium text-black mb-2">Category</label>
              <select
                id="item-category"
                name="item-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white text-base md:text-sm"
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="item-unit" className="block text-base md:text-sm font-medium text-black mb-2">Unit</label>
              <select
                id="item-unit"
                name="item-unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white text-base md:text-sm"
              >
                {units.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="current-stock" className="block text-base md:text-sm font-medium text-black mb-2">Current Stock</label>
              <input
                id="current-stock"
                name="current-stock"
                type="number"
                value={formData.currentStock}
                onChange={(e) => setFormData({ ...formData, currentStock: parseInt(e.target.value) || 0 })}
                className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white text-base md:text-sm"
                min="0"
              />
            </div>
            <div>
              <label htmlFor="par-level" className="block text-base md:text-sm font-medium text-black mb-2">
                Par Level
                <span className="text-gray-500 text-sm md:text-xs ml-1">(Minimum stock)</span>
              </label>
              <input
                id="par-level"
                name="par-level"
                type="number"
                value={formData.parLevel}
                onChange={(e) => setFormData({ ...formData, parLevel: parseInt(e.target.value) || 0 })}
                className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white text-base md:text-sm"
                min="0"
              />
            </div>
          </div>

          <div>
            <label htmlFor="preferred-supplier" className="block text-base md:text-sm font-medium text-black mb-2">Preferred Supplier</label>
            <select
              id="preferred-supplier"
              name="preferred-supplier"
              value={formData.preferredSupplier}
              onChange={(e) => setFormData({ ...formData, preferredSupplier: e.target.value })}
              className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white text-base md:text-sm"
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
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-300 p-4 md:p-6 flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 md:px-4 md:py-2 border border-gray-300 rounded text-black bg-white hover:bg-gray-100 font-medium text-base md:text-sm w-full sm:w-auto"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-3 md:px-4 md:py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium text-base md:text-sm w-full sm:w-auto"
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
        <div className="bg-white border-b border-gray-300 p-4 md:p-6 flex justify-between items-center">
          <h2 className="text-xl md:text-xl font-bold text-black">Adjust Stock</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-3xl md:text-2xl font-bold w-11 h-11 md:w-8 md:h-8 flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 md:p-6 space-y-4">
          <div>
            <p className="font-semibold text-black text-lg md:text-lg">{item.name}</p>
            <p className="text-base md:text-sm text-gray-600 mt-1">Current Stock: {item.currentStock} {item.unit}</p>
          </div>

          <div>
            <label className="block text-base md:text-sm font-medium text-black mb-3">Adjustment Type</label>
            <div className="flex flex-col sm:flex-row gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="adjustment-type"
                  checked={adjustmentType === 'add'}
                  onChange={() => setAdjustmentType('add')}
                  className="mr-3 w-5 h-5 md:w-4 md:h-4"
                />
                <span className="text-black text-base md:text-sm">➕ Add Stock (Restock)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="adjustment-type"
                  checked={adjustmentType === 'remove'}
                  onChange={() => setAdjustmentType('remove')}
                  className="mr-3 w-5 h-5 md:w-4 md:h-4"
                />
                <span className="text-black text-base md:text-sm">➖ Remove Stock (Used)</span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="adjustment-amount" className="block text-base md:text-sm font-medium text-black mb-2">
              Amount to {adjustmentType === 'add' ? 'Add' : 'Remove'}
            </label>
            <input
              id="adjustment-amount"
              name="adjustment-amount"
              type="number"
              value={adjustment}
              onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
              className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white text-base md:text-sm"
              min="0"
              placeholder="Enter quantity"
            />
          </div>

          <div>
            <label htmlFor="adjustment-reason" className="block text-base md:text-sm font-medium text-black mb-2">
              Reason (Optional)
            </label>
            <input
              id="adjustment-reason"
              name="adjustment-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-4 md:p-2 border border-gray-300 rounded text-black bg-white text-base md:text-sm"
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
        <div className="bg-gray-50 border-t border-gray-300 p-4 md:p-6 flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 md:px-4 md:py-2 border border-gray-300 rounded text-black bg-white hover:bg-gray-100 font-medium text-base md:text-sm w-full sm:w-auto"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`px-6 py-3 md:px-4 md:py-2 text-white rounded font-medium text-base md:text-sm w-full sm:w-auto ${
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

