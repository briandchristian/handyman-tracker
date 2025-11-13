import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import API_BASE_URL from '../config/api';

// Helper functions (outside component so modal can use them)
const getStatusBadge = (status) => {
  const badges = {
    'Draft': 'bg-gray-100 text-gray-800',
    'Sent': 'bg-blue-100 text-blue-800',
    'Confirmed': 'bg-yellow-100 text-yellow-800',
    'Received': 'bg-green-100 text-green-800',
    'Paid': 'bg-green-600 text-white',
    'Cancelled': 'bg-red-100 text-red-800'
  };
  return badges[status] || 'bg-gray-100 text-gray-800';
};

const getStatusIcon = (status) => {
  const icons = {
    'Draft': '📝',
    'Sent': '📤',
    'Confirmed': '✓',
    'Received': '📦',
    'Paid': '💰',
    'Cancelled': '❌'
  };
  return icons[status] || '📄';
};

export default function PurchaseOrders() {
  const [pos, setPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPO, setSelectedPO] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const statuses = ['Draft', 'Sent', 'Confirmed', 'Received', 'Paid', 'Cancelled'];

  useEffect(() => {
    fetchPOs();
  }, [statusFilter]);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const res = await axios.get(
        `${API_BASE_URL}/api/purchase-orders?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPOs(res.data);
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
      alert('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const openPODetail = (po) => {
    console.log('Opening PO detail:', po);
    setSelectedPO(po);
    setShowModal(true);
  };

  // Calculate stats
  const stats = {
    total: pos.length,
    draft: pos.filter(p => p.status === 'Draft').length,
    sent: pos.filter(p => p.status === 'Sent' || p.status === 'Confirmed').length,
    received: pos.filter(p => p.status === 'Received').length,
    paid: pos.filter(p => p.status === 'Paid').length,
    totalValue: pos.reduce((sum, p) => sum + (p.total || 0), 0)
  };

  if (loading) {
    return (
      <div className="p-8 text-black">
        <h1 className="text-2xl mb-4 text-black">Purchase Orders</h1>
        <p className="text-black">Loading purchase orders...</p>
      </div>
    );
  }

  return (
    <div className="p-6 text-black">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Link to="/suppliers" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Back to Suppliers
          </Link>
          <Link to="/" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Dashboard
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-black">Purchase Orders</h1>
        <p className="text-gray-600 mt-2">Manage and track all purchase orders</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Total POs</p>
          <p className="text-3xl font-bold text-black">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Draft</p>
          <p className="text-3xl font-bold text-gray-600">{stats.draft}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Sent</p>
          <p className="text-3xl font-bold text-blue-600">{stats.sent}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Received</p>
          <p className="text-3xl font-bold text-green-600">{stats.received}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Paid</p>
          <p className="text-3xl font-bold text-green-700">{stats.paid}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Total Value</p>
          <p className="text-2xl font-bold text-black">
            ${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
        <div className="flex gap-4 items-center">
          <label htmlFor="status-filter" className="text-sm font-medium text-black">Status:</label>
          <select
            id="status-filter"
            name="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 border border-gray-300 rounded text-black bg-white"
          >
            <option value="">All Status</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* PO Table */}
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
        {pos.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 mb-4">No purchase orders found.</p>
            <Link 
              to="/suppliers" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Go to Suppliers → Quick Reorder to create your first PO
            </Link>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left p-4 text-black font-semibold">PO Number</th>
                <th className="text-left p-4 text-black font-semibold">Supplier</th>
                <th className="text-left p-4 text-black font-semibold">Status</th>
                <th className="text-left p-4 text-black font-semibold">Order Date</th>
                <th className="text-left p-4 text-black font-semibold">Expected Delivery</th>
                <th className="text-left p-4 text-black font-semibold">Total</th>
                <th className="text-left p-4 text-black font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pos.map(po => (
                <tr key={po._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <button
                      onClick={() => openPODetail(po)}
                      className="text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      {po.poNumber}
                    </button>
                  </td>
                  <td className="p-4 text-black">{po.supplier?.name || 'Unknown'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(po.status)}`}>
                      {getStatusIcon(po.status)} {po.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600 text-sm">
                    {format(new Date(po.orderDate), 'MMM d, yyyy')}
                  </td>
                  <td className="p-4 text-gray-600 text-sm">
                    {po.expectedDelivery ? format(new Date(po.expectedDelivery), 'MMM d, yyyy') : '-'}
                  </td>
                  <td className="p-4 text-black font-semibold">
                    ${po.total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => openPODetail(po)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
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

      {/* PO Detail Modal */}
      {showModal && selectedPO && (
        <PODetailModal
          po={selectedPO}
          onClose={() => {
            setShowModal(false);
            setSelectedPO(null);
          }}
          onUpdate={() => {
            setShowModal(false);
            setSelectedPO(null);
            fetchPOs();
          }}
        />
      )}
    </div>
  );
}

// PO Detail Modal Component
function PODetailModal({ po, onClose, onUpdate }) {
  console.log('PODetailModal rendering with:', po);
  
  // Safety check first
  if (!po || !po.items || !Array.isArray(po.items)) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
          <h2 className="text-xl font-bold text-black mb-4">Error</h2>
          <p className="text-black mb-4">Unable to load purchase order details. Missing items data.</p>
          <button
            onClick={onClose}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const [status, setStatus] = useState(po.status || 'Draft');
  const [notes, setNotes] = useState(po.notes || '');
  
  // Safe date formatting
  const safeFormatDate = (date) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'yyyy-MM-dd');
    } catch {
      return '';
    }
  };

  const [expectedDelivery, setExpectedDelivery] = useState(safeFormatDate(po.expectedDelivery));
  const [receivedDate, setReceivedDate] = useState(safeFormatDate(po.receivedDate));
  const [paidDate, setPaidDate] = useState(safeFormatDate(po.paidDate));

  const handleUpdateStatus = async (newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const updates = { status: newStatus, notes };

      // Auto-set dates based on status
      if (newStatus === 'Received' && !receivedDate) {
        updates.receivedDate = new Date().toISOString();
        setReceivedDate(format(new Date(), 'yyyy-MM-dd'));
      }
      if (newStatus === 'Paid' && !paidDate) {
        updates.paidDate = new Date().toISOString();
        setPaidDate(format(new Date(), 'yyyy-MM-dd'));
      }

      await axios.put(`${API_BASE_URL}/api/purchase-orders/${po._id}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setStatus(newStatus);
      alert(`✅ Status updated to ${newStatus}`);
      onUpdate();
    } catch (err) {
      console.error('Error updating PO:', err);
      alert('❌ Failed to update purchase order');
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/purchase-orders/${po._id}`, {
        notes,
        expectedDelivery: expectedDelivery || null,
        receivedDate: receivedDate || null,
        paidDate: paidDate || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('✅ Purchase order updated!');
      onUpdate();
    } catch (err) {
      console.error('Error updating PO:', err);
      alert('❌ Failed to update purchase order');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const content = generatePrintHTML();
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const generatePrintHTML = () => {
    const formatDateSafe = (date) => {
      if (!date) return 'Not set';
      try {
        return format(new Date(date), 'MMMM d, yyyy');
      } catch {
        return 'Invalid date';
      }
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order ${po.poNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #000; }
          h1 { color: #000; border-bottom: 2px solid #000; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
          .totals { text-align: right; font-weight: bold; }
          .header-info { margin: 20px 0; }
          .status { display: inline-block; padding: 5px 10px; background: #e0e0e0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Purchase Order</h1>
        <div class="header-info">
          <p><strong>PO Number:</strong> ${po.poNumber}</p>
          <p><strong>Supplier:</strong> ${po.supplier?.name || 'N/A'}</p>
          <p><strong>Order Date:</strong> ${formatDateSafe(po.orderDate)}</p>
          <p><strong>Status:</strong> <span class="status">${po.status || 'Draft'}</span></p>
          ${po.expectedDelivery ? `<p><strong>Expected Delivery:</strong> ${formatDateSafe(po.expectedDelivery)}</p>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${po.items.map(item => `
              <tr>
                <td>${item.sku || '-'}</td>
                <td>${item.description || 'N/A'}</td>
                <td>${item.quantity || 0}</td>
                <td>${item.unit || ''}</td>
                <td>$${(item.unitPrice || 0).toFixed(2)}</td>
                <td>$${(item.total || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" class="totals">Subtotal:</td>
              <td>$${(po.subtotal || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="5" class="totals">Tax:</td>
              <td>$${(po.tax || 0).toFixed(2)}</td>
            </tr>
            ${(po.shipping || 0) > 0 ? `
              <tr>
                <td colspan="5" class="totals">Shipping:</td>
                <td>$${(po.shipping || 0).toFixed(2)}</td>
              </tr>
            ` : ''}
            <tr style="font-size: 18px;">
              <td colspan="5" class="totals"><strong>TOTAL:</strong></td>
              <td><strong>$${(po.total || 0).toFixed(2)}</strong></td>
            </tr>
          </tfoot>
        </table>

        ${po.notes ? `
          <div style="margin-top: 30px;">
            <h3>Notes:</h3>
            <p style="border: 1px solid #ccc; padding: 10px; background: #f9f9f9;">${po.notes}</p>
          </div>
        ` : ''}

        <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px;">
          <p>Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-300 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-black">{po.poNumber}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Created {po.createdAt ? format(new Date(po.createdAt), 'MMM d, yyyy') : 'Unknown'} by {po.createdBy?.username || 'Unknown'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* PO Info */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              <div>
                <p className="block text-sm font-medium text-black mb-1">Supplier</p>
                <div className="p-2 bg-gray-50 border border-gray-300 rounded text-black">
                  {po.supplier?.name || 'Unknown'}
                </div>
              </div>
              <div>
                <p className="block text-sm font-medium text-black mb-1">Order Date</p>
                <div className="p-2 bg-gray-50 border border-gray-300 rounded text-black">
                  {po.orderDate ? format(new Date(po.orderDate), 'MMMM d, yyyy') : 'Not set'}
                </div>
              </div>
              <div>
                <label htmlFor="expected-delivery" className="block text-sm font-medium text-black mb-1">Expected Delivery</label>
                <input
                  id="expected-delivery"
                  name="expected-delivery"
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="block text-sm font-medium text-black mb-1">Current Status</p>
                <div className={`p-2 rounded text-center font-medium ${getStatusBadge(status)}`}>
                  {getStatusIcon(status)} {status}
                </div>
              </div>
              {status === 'Received' || status === 'Paid' ? (
                <div>
                  <label htmlFor="received-date" className="block text-sm font-medium text-black mb-1">Received Date</label>
                  <input
                    id="received-date"
                    name="received-date"
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                  />
                </div>
              ) : null}
              {status === 'Paid' && (
                <div>
                  <label htmlFor="paid-date" className="block text-sm font-medium text-black mb-1">Paid Date</label>
                  <input
                    id="paid-date"
                    name="paid-date"
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Status Workflow Buttons */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-bold text-black mb-3">Update Status:</h3>
            <div className="flex flex-wrap gap-2">
              {status === 'Draft' && (
                <button
                  onClick={() => handleUpdateStatus('Sent')}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 font-medium"
                >
                  📤 Mark as Sent
                </button>
              )}
              {status === 'Sent' && (
                <button
                  onClick={() => handleUpdateStatus('Confirmed')}
                  className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 font-medium"
                >
                  ✓ Confirm Order
                </button>
              )}
              {(status === 'Sent' || status === 'Confirmed') && (
                <button
                  onClick={() => handleUpdateStatus('Received')}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium"
                >
                  📦 Mark as Received
                </button>
              )}
              {status === 'Received' && (
                <button
                  onClick={() => handleUpdateStatus('Paid')}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-medium"
                >
                  💰 Mark as Paid
                </button>
              )}
              {status !== 'Cancelled' && status !== 'Paid' && (
                <button
                  onClick={() => {
                    if (confirm('Cancel this purchase order?')) {
                      handleUpdateStatus('Cancelled');
                    }
                  }}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 font-medium"
                >
                  ❌ Cancel Order
                </button>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="mb-6">
            <h3 className="font-bold text-black mb-3">Line Items</h3>
            <div className="bg-gray-50 border border-gray-300 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-100">
                    <th className="text-left p-3 text-black text-sm">SKU</th>
                    <th className="text-left p-3 text-black text-sm">Description</th>
                    <th className="text-left p-3 text-black text-sm">Qty</th>
                    <th className="text-left p-3 text-black text-sm">Unit</th>
                    <th className="text-left p-3 text-black text-sm">Unit Price</th>
                    <th className="text-left p-3 text-black text-sm">Total</th>
                  </tr>
                </thead>
                  <tbody>
                    {po.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="p-3 text-black text-sm">{item.sku || '-'}</td>
                        <td className="p-3 text-black">{item.description || 'N/A'}</td>
                        <td className="p-3 text-black">{item.quantity || 0}</td>
                        <td className="p-3 text-black text-sm">{item.unit || ''}</td>
                        <td className="p-3 text-black">${(item.unitPrice || 0).toFixed(2)}</td>
                        <td className="p-3 text-black font-medium">${(item.total || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300">
                      <td colSpan="5" className="p-3 text-right font-medium text-black">Subtotal:</td>
                      <td className="p-3 font-medium text-black">${(po.subtotal || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan="5" className="p-3 text-right text-gray-600 text-sm">Tax:</td>
                      <td className="p-3 text-gray-600 text-sm">${(po.tax || 0).toFixed(2)}</td>
                    </tr>
                    {(po.shipping || 0) > 0 && (
                      <tr>
                        <td colSpan="5" className="p-3 text-right text-gray-600 text-sm">Shipping:</td>
                        <td className="p-3 text-gray-600 text-sm">${(po.shipping || 0).toFixed(2)}</td>
                      </tr>
                    )}
                    <tr className="bg-gray-100">
                      <td colSpan="5" className="p-3 text-right font-bold text-black text-lg">TOTAL:</td>
                      <td className="p-3 font-bold text-black text-lg">${(po.total || 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="po-notes" className="block text-sm font-medium text-black mb-1">Notes</label>
            <textarea
              id="po-notes"
              name="po-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white h-24 resize-none"
              placeholder="Add notes about this order..."
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-300 p-6 flex justify-between items-center">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 font-medium"
          >
            🖨️ Print PO
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded text-black bg-white hover:bg-gray-100 font-medium"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

