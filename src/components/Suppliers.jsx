import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import API_BASE_URL from '../config/api';
import QuickReorder from './QuickReorder';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [poData, setPOData] = useState(null);

  const categories = ['Electrical', 'Plumbing', 'Lumber', 'Hardware', 'HVAC', 'Roofing', 'Flooring', 'Paint'];

  // Debounced search - only fetch after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers();
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer); // Cancel previous timer
  }, [searchTerm, categoryFilter, favoritesOnly]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (categoryFilter) params.append('category', categoryFilter);
      if (favoritesOnly) params.append('favorites', 'true');

      const res = await axios.get(
        `${API_BASE_URL}/api/suppliers?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuppliers(res.data.suppliers);
      setStats(res.data.stats);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      alert('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (supplierId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/suppliers/${supplierId}/favorite`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchSuppliers();
    } catch (err) {
      console.error('Error toggling favorite:', err);
      alert('Failed to update favorite');
    }
  };

  const openSupplierDetail = async (supplierId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API_BASE_URL}/api/suppliers/${supplierId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedSupplier(res.data);
      setShowModal(true);
    } catch (err) {
      console.error('Error fetching supplier details:', err);
      alert('Failed to load supplier details');
    }
  };

  const handleCreatePO = (itemsBySupplier) => {
    setPOData(itemsBySupplier);
    setShowPOModal(true);
  };

  if (loading) {
    return (
      <div className="p-8 text-black">
        <h1 className="text-2xl mb-4 text-black">Suppliers & Materials</h1>
        <p className="text-black">Loading suppliers...</p>
      </div>
    );
  }

  return (
    <div className="p-6 text-black pr-[400px]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-3">
            <Link to="/" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Dashboard
            </Link>
            <Link to="/purchase-orders" className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600">
              📋 View POs ({stats.openPOs || 0})
            </Link>
          </div>
          <button
            onClick={() => {
              setSelectedSupplier({ name: '', contactName: '', phone: '', email: '', categories: [], isNew: true });
              setShowModal(true);
            }}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            + Add Supplier
          </button>
        </div>
        <h1 className="text-3xl font-bold text-black">Suppliers & Materials</h1>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Active Suppliers</p>
          <p className="text-3xl font-bold text-black">{stats.totalSuppliers || 0}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Open POs / Quotes</p>
          <p className="text-3xl font-bold text-blue-600">{stats.openPOs || 0}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Spend This Month</p>
          <p className="text-3xl font-bold text-green-600">
            ${(stats.monthlySpend || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Low Stock Items</p>
          <p className="text-3xl font-bold text-orange-600">
            {stats.lowStockItems || 0}
            {stats.lowStockItems > 0 && <span className="text-sm ml-2">⚠️</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Category</label>
            <select
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
          <div className="flex items-end">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={favoritesOnly}
                onChange={(e) => setFavoritesOnly(e.target.checked)}
                className="mr-2 h-4 w-4"
              />
              <span className="text-sm font-medium text-black">⭐ Favorites Only</span>
            </label>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('');
                setFavoritesOnly(false);
              }}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Supplier Table */}
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
        {suppliers.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            No suppliers found. {favoritesOnly ? 'Try removing filters.' : 'Add your first supplier to get started!'}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left p-4 text-black font-semibold">⭐</th>
                <th className="text-left p-4 text-black font-semibold">Name</th>
                <th className="text-left p-4 text-black font-semibold">Contact</th>
                <th className="text-left p-4 text-black font-semibold">Categories</th>
                <th className="text-left p-4 text-black font-semibold">Lead Time</th>
                <th className="text-left p-4 text-black font-semibold">Min Order</th>
                <th className="text-left p-4 text-black font-semibold">Last Order</th>
                <th className="text-left p-4 text-black font-semibold">Total Spent</th>
                <th className="text-left p-4 text-black font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(supplier => (
                <tr key={supplier._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <button
                      onClick={() => toggleFavorite(supplier._id)}
                      className="text-2xl hover:scale-110 transition-transform"
                    >
                      {supplier.isFavorite ? '⭐' : '☆'}
                    </button>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => openSupplierDetail(supplier._id)}
                      className="text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      {supplier.name}
                    </button>
                  </td>
                  <td className="p-4 text-black text-sm">
                    <div>{supplier.contactName || '-'}</div>
                    {supplier.phone && (
                      <a href={`tel:${supplier.phone}`} className="text-blue-600 hover:underline block">
                        📞 {supplier.phone}
                      </a>
                    )}
                    {supplier.email && (
                      <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline block">
                        ✉️ {supplier.email}
                      </a>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {supplier.categories?.slice(0, 3).map((cat, idx) => (
                        <span key={idx} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          {cat}
                        </span>
                      ))}
                      {supplier.categories?.length > 3 && (
                        <span className="text-gray-500 text-xs">+{supplier.categories.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-black">{supplier.leadTimeDays} days</td>
                  <td className="p-4 text-black">
                    {supplier.minimumOrder > 0 ? `$${supplier.minimumOrder}` : '-'}
                  </td>
                  <td className="p-4 text-gray-600 text-sm">
                    {supplier.lastOrderDate ? format(new Date(supplier.lastOrderDate), 'MMM d, yyyy') : 'Never'}
                  </td>
                  <td className="p-4 text-black font-semibold">
                    ${supplier.totalSpent?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => openSupplierDetail(supplier._id)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View Details →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Supplier Detail Modal */}
      {showModal && selectedSupplier && (
        <SupplierModal
          supplier={selectedSupplier}
          onClose={() => {
            setShowModal(false);
            setSelectedSupplier(null);
            fetchSuppliers();
          }}
        />
      )}

      {/* PO Creation Modal */}
      {showPOModal && poData && (
        <POCreationModal
          poData={poData}
          suppliers={suppliers}
          onClose={() => {
            setShowPOModal(false);
            setPOData(null);
          }}
          onSuccess={() => {
            setShowPOModal(false);
            setPOData(null);
            fetchSuppliers(); // Refresh to update stats
          }}
        />
      )}

      {/* Quick Reorder Panel */}
      <QuickReorder onCreatePO={handleCreatePO} />
    </div>
  );
}

// Supplier Detail Modal Component
function SupplierModal({ supplier, onClose }) {
  const [formData, setFormData] = useState({
    name: supplier.supplier?.name || supplier.name || '',
    contactName: supplier.supplier?.contactName || supplier.contactName || '',
    phone: supplier.supplier?.phone || supplier.phone || '',
    email: supplier.supplier?.email || supplier.email || '',
    website: supplier.supplier?.website || supplier.website || '',
    categories: supplier.supplier?.categories || supplier.categories || [],
    leadTimeDays: supplier.supplier?.leadTimeDays || supplier.leadTimeDays || 0,
    minimumOrder: supplier.supplier?.minimumOrder || supplier.minimumOrder || 0,
    paymentTerms: supplier.supplier?.paymentTerms || supplier.paymentTerms || '',
    notes: supplier.supplier?.notes || supplier.notes || ''
  });
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'catalog', 'orders'

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      if (supplier.isNew) {
        await axios.post(`${API_BASE_URL}/api/suppliers`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('✅ Supplier created successfully!');
      } else {
        await axios.put(`${API_BASE_URL}/api/suppliers/${supplier.supplier?._id || supplier._id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('✅ Supplier updated successfully!');
      }
      onClose();
    } catch (err) {
      console.error('Error saving supplier:', err);
      alert('❌ Failed to save supplier');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-300 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-black">
            {supplier.isNew ? 'Add New Supplier' : formData.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-300 px-6">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2 px-4 ${activeTab === 'details' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Details
          </button>
          {!supplier.isNew && (
            <>
              <button
                onClick={() => setActiveTab('catalog')}
                className={`pb-2 px-4 ${activeTab === 'catalog' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Catalog
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`pb-2 px-4 ${activeTab === 'orders' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Order History
              </button>
            </>
          )}
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                  placeholder="https://"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Lead Time (days)</label>
                  <input
                    type="number"
                    value={formData.leadTimeDays}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) || 0 })}
                    className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Minimum Order ($)</label>
                  <input
                    type="number"
                    value={formData.minimumOrder}
                    onChange={(e) => setFormData({ ...formData, minimumOrder: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                  placeholder="e.g., Net 30, COD, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-black bg-white h-24 resize-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'catalog' && !supplier.isNew && (
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-8 text-center">
              <p className="text-gray-600 font-medium">Catalog management coming soon!</p>
              <p className="text-sm text-gray-600 mt-2">You'll be able to upload price lists and manage product catalogs here.</p>
            </div>
          )}

          {activeTab === 'orders' && !supplier.isNew && (
            <div>
              <h3 className="text-lg font-bold text-black mb-4">Order History</h3>
              {supplier.orders?.length > 0 ? (
                <div className="space-y-2">
                  {supplier.orders.map((order, idx) => (
                    <div key={idx} className="border border-gray-300 rounded p-3 bg-gray-50">
                      <div className="flex justify-between">
                        <span className="font-semibold text-black">{order.poNumber}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          order.status === 'Paid' ? 'bg-green-100 text-green-800' :
                          order.status === 'Received' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {format(new Date(order.orderDate), 'MMM d, yyyy')} • ${order.total?.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-8 text-center">
                  <p className="text-gray-600">No orders yet</p>
                </div>
              )}
            </div>
          )}
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
            {supplier.isNew ? 'Create Supplier' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// PO Creation Modal Component
function POCreationModal({ poData, suppliers, onClose, onSuccess }) {
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');

  useEffect(() => {
    // If only one supplier, auto-select it
    const supplierIds = Object.keys(poData);
    if (supplierIds.length === 1 && supplierIds[0] !== 'no-supplier') {
      setSelectedSupplier(supplierIds[0]);
      setItems(poData[supplierIds[0]].items.map(item => ({
        ...item,
        unitPrice: 0
      })));
    }
  }, [poData]);

  const handleSupplierChange = (supplierId) => {
    setSelectedSupplier(supplierId);
    if (poData[supplierId]) {
      setItems(poData[supplierId].items.map(item => ({
        ...item,
        unitPrice: 0
      })));
    }
  };

  const updateItemPrice = (itemId, price) => {
    setItems(items.map(i => 
      i._id === itemId ? { ...i, unitPrice: parseFloat(price) || 0 } : i
    ));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const createPO = async () => {
    if (!selectedSupplier) {
      alert('Please select a supplier');
      return;
    }

    if (items.some(item => item.unitPrice === 0)) {
      if (!confirm('Some items have no price set. Continue anyway?')) {
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      const subtotal = calculateSubtotal();
      const tax = subtotal * 0.08; // 8% tax, make configurable later
      const shipping = 0; // Add shipping logic later
      const total = subtotal + tax + shipping;

      const poPayload = {
        supplier: selectedSupplier,
        items: items.map(item => ({
          sku: item.sku || '',
          description: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice
        })),
        subtotal,
        tax,
        shipping,
        total,
        notes,
        expectedDelivery: expectedDelivery || null,
        status: 'Draft'
      };

      await axios.post(`${API_BASE_URL}/api/purchase-orders`, poPayload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('✅ Purchase Order created successfully!');
      onSuccess();
    } catch (err) {
      console.error('Error creating PO:', err);
      alert('❌ Failed to create purchase order: ' + (err.response?.data?.msg || err.message));
    }
  };

  const supplierList = Object.entries(poData).filter(([id]) => id !== 'no-supplier');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-300 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-black">Create Purchase Order</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          {/* Supplier Selection */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">Select Supplier *</label>
            <select
              value={selectedSupplier}
              onChange={(e) => handleSupplierChange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white"
            >
              <option value="">-- Select Supplier --</option>
              {supplierList.map(([id, data]) => (
                <option key={id} value={id}>{data.supplier?.name || 'Unknown Supplier'}</option>
              ))}
            </select>
            {supplierList.length === 0 && (
              <p className="text-sm text-red-600 mt-1">⚠️ No suppliers assigned to items. Please assign suppliers in inventory.</p>
            )}
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div>
              <h3 className="font-bold text-black mb-2">Items</h3>
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left p-2 text-black text-sm">Item</th>
                      <th className="text-left p-2 text-black text-sm">Qty</th>
                      <th className="text-left p-2 text-black text-sm">Unit</th>
                      <th className="text-left p-2 text-black text-sm">Unit Price</th>
                      <th className="text-left p-2 text-black text-sm">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item._id} className="border-b border-gray-200">
                        <td className="p-2 text-black">{item.name}</td>
                        <td className="p-2 text-black">{item.quantity}</td>
                        <td className="p-2 text-black">{item.unit}</td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateItemPrice(item._id, e.target.value)}
                            className="w-24 p-1 border border-gray-300 rounded text-black bg-white"
                            placeholder="0.00"
                            step="0.01"
                          />
                        </td>
                        <td className="p-2 text-black font-medium">
                          ${(item.quantity * item.unitPrice).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-bold">
                      <td colSpan="4" className="p-2 text-right text-black">Subtotal:</td>
                      <td className="p-2 text-black">${calculateSubtotal().toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan="4" className="p-2 text-right text-gray-600 text-sm">Tax (8%):</td>
                      <td className="p-2 text-gray-600 text-sm">${(calculateSubtotal() * 0.08).toFixed(2)}</td>
                    </tr>
                    <tr className="font-bold text-lg">
                      <td colSpan="4" className="p-2 text-right text-black">Total:</td>
                      <td className="p-2 text-black">${(calculateSubtotal() * 1.08).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Additional Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="po-expected-delivery" className="block text-sm font-medium text-black mb-1">
                Expected Delivery Date (Optional)
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-blue-600 text-lg">
                  📅
                </div>
                <input
                  id="po-expected-delivery"
                  name="po-expected-delivery"
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="w-full p-2 pl-10 pr-3 border-2 border-blue-400 rounded text-black bg-white hover:border-blue-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 cursor-pointer text-base"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">👆 Click field to open calendar picker</p>
            </div>
            <div>
              <label htmlFor="po-status" className="block text-sm font-medium text-black mb-1">Status</label>
              <select 
                id="po-status"
                name="po-status"
                className="w-full p-2 border border-gray-300 rounded text-black bg-gray-100" 
                disabled
              >
                <option>Draft</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="po-notes" className="block text-sm font-medium text-black mb-1">Notes</label>
            <textarea
              id="po-notes"
              name="po-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white h-24 resize-none"
              placeholder="Add any notes for this purchase order..."
            />
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
            onClick={createPO}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-medium"
          >
            Create Purchase Order
          </button>
        </div>
      </div>
    </div>
  );
}

