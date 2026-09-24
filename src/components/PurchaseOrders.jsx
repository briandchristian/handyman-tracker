import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import API_BASE_URL from '../config/api';
import CameraCapture from './CameraCapture';
import AdiPartPriceCheck from './AdiPartPriceCheck';
import {
  fetchAdiPriceInventory,
  generateAdiOrder,
  inquireAdiOrder,
} from '../services/adiSupplierApi';
import {
  adiAllowedLabel,
  adiItemNumberFromSku,
  adiSupportCode,
  applyAdiPriceInventory,
  buildAdiGenerateOrderPayload,
  collectAdiCarts,
  collectAdiShipments,
  deriveAdiInquiryStatus,
  extractAdiOrderNumber,
  plainAdiItemMessage,
  splitCatalogSku,
  validateAdiGenerateOrder,
} from '../utils/adiIntegration';
import { handleApiError, formatErrorAlert } from '../utils/errorHandler';
import {
  DEFAULT_PO_FILTER,
  PO_FILTERS,
  countPurchaseOrdersByStatus,
  filterPurchaseOrders,
  nextPoStatusFilter,
} from '../utils/purchaseOrders';

const FILTER_LABELS = {
  [PO_FILTERS.all]: 'All purchase orders',
  [PO_FILTERS.draft]: 'Draft',
  [PO_FILTERS.sent]: 'Sent',
  [PO_FILTERS.received]: 'Received',
};

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
  const [statusFilter, setStatusFilter] = useState(DEFAULT_PO_FILTER);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const statuses = ['Draft', 'Sent', 'Confirmed', 'Received', 'Paid', 'Cancelled'];

  useEffect(() => {
    fetchPOs();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = '/login';
  };

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/purchase-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

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

  const stats = useMemo(() => countPurchaseOrdersByStatus(pos), [pos]);
  const visiblePOs = useMemo(
    () => filterPurchaseOrders(pos, statusFilter),
    [pos, statusFilter]
  );

  const cardClass = (filter) =>
    `text-left w-full bg-white border rounded-lg p-4 min-h-[44px] ${
      statusFilter === filter
        ? 'border-gray-900 ring-2 ring-gray-900'
        : 'border-gray-300 hover:border-gray-500'
    }`;

  if (loading) {
    return (
      <div className="p-8 text-black max-w-6xl mx-auto">
        <h1 className="text-2xl mb-4 text-black">Purchase Orders</h1>
        <p className="text-black">Loading purchase orders...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 text-black max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Link to="/suppliers" className="btn-staff text-sm">
              Back to Suppliers
            </Link>
            <Link to="/suppliers?openQuickReorder=1" className="btn-primary w-auto text-sm">
              + Create New PO
            </Link>
            <Link to="/inventory" className="btn-staff text-sm">
              Order from Inventory
            </Link>
          </div>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-black">Purchase Orders</h1>
        <p className="text-gray-600 mt-2">Check a part price, or manage purchase orders</p>
        <AdiPartPriceCheck purchaseOrders={pos} />
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-black">
          Create new purchase orders from `Suppliers` using the Quick Reorder panel, or start from `Inventory` to add stock-managed items.
        </div>
      </div>

      {/* Quick Stats — Total / Draft / Sent / Received filter the list like the dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <button
          type="button"
          aria-pressed={statusFilter === PO_FILTERS.all}
          onClick={() => setStatusFilter(nextPoStatusFilter(statusFilter, PO_FILTERS.all))}
          className={cardClass(PO_FILTERS.all)}
        >
          <p className="text-gray-600 text-sm">Total POs</p>
          <p className="text-3xl font-bold text-black">{stats.total}</p>
        </button>
        <button
          type="button"
          aria-pressed={statusFilter === PO_FILTERS.draft}
          onClick={() => setStatusFilter(nextPoStatusFilter(statusFilter, PO_FILTERS.draft))}
          className={cardClass(PO_FILTERS.draft)}
        >
          <p className="text-gray-600 text-sm">Draft</p>
          <p className="text-3xl font-bold text-gray-600">{stats.draft}</p>
        </button>
        <button
          type="button"
          aria-pressed={statusFilter === PO_FILTERS.sent}
          onClick={() => setStatusFilter(nextPoStatusFilter(statusFilter, PO_FILTERS.sent))}
          className={cardClass(PO_FILTERS.sent)}
        >
          <p className="text-gray-600 text-sm">Sent</p>
          <p className="text-3xl font-bold text-blue-600">{stats.sent}</p>
        </button>
        <button
          type="button"
          aria-pressed={statusFilter === PO_FILTERS.received}
          onClick={() => setStatusFilter(nextPoStatusFilter(statusFilter, PO_FILTERS.received))}
          className={cardClass(PO_FILTERS.received)}
        >
          <p className="text-gray-600 text-sm">Received</p>
          <p className="text-3xl font-bold text-green-600">{stats.received}</p>
        </button>
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
            value={statusFilter === PO_FILTERS.all ? '' : statusFilter}
            onChange={(e) => setStatusFilter(e.target.value || PO_FILTERS.all)}
            className="p-2 border border-gray-300 rounded text-black bg-white"
          >
            <option value="">All Status</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          {statusFilter !== PO_FILTERS.all && (
            <button
              onClick={() => setStatusFilter(PO_FILTERS.all)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* PO Table */}
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
        <h2 className="text-lg md:text-xl font-semibold p-4 pb-0 text-black">
          {FILTER_LABELS[statusFilter] || statusFilter}
          {visiblePOs.length !== pos.length
            ? ` — ${visiblePOs.length} of ${pos.length}`
            : ''}
        </h2>
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
        ) : visiblePOs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">
              No purchase orders match this filter. Try another card or clear the status filter.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-4 p-4">
              {visiblePOs.map(po => (
                <div key={po._id} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <button
                      onClick={() => openPODetail(po)}
                      className="text-blue-600 hover:text-blue-800 font-semibold text-left text-lg flex-1"
                    >
                      {po.poNumber}
                    </button>
                    <span className={`px-3 py-1 rounded text-sm ml-2 ${getStatusBadge(po.status)}`}>
                      {getStatusIcon(po.status)} {po.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-base">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Supplier:</span>
                      <span className="text-black font-medium">{po.supplier?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Date:</span>
                      <span className="text-gray-600">{format(new Date(po.orderDate), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expected Delivery:</span>
                      <span className="text-gray-600">{po.expectedDelivery ? format(new Date(po.expectedDelivery), 'MMM d, yyyy') : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total:</span>
                      <span className="text-black font-semibold text-lg">${po.total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => openPODetail(po)}
                      className="w-full bg-blue-500 text-white text-center py-3 rounded hover:bg-blue-600 font-medium"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left p-4 text-black font-semibold text-sm">PO Number</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Supplier</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Status</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Order Date</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Expected Delivery</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Total</th>
                    <th className="text-left p-4 text-black font-semibold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePOs.map(po => (
                    <tr key={po._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4">
                        <button
                          onClick={() => openPODetail(po)}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                        >
                          {po.poNumber}
                        </button>
                      </td>
                      <td className="p-4 text-black text-sm">{po.supplier?.name || 'Unknown'}</td>
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
                      <td className="p-4 text-black font-semibold text-sm">
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
            </div>
          </>
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
          onSync={(id, patch) => {
            setSelectedPO((current) => (current && current._id === id ? { ...current, ...patch } : current));
            setPOs((list) => list.map((entry) => (entry._id === id ? { ...entry, ...patch } : entry)));
          }}
        />
      )}

      {/* Bottom-right page footer actions */}
      <div data-testid="page-footer" className="mt-8 flex justify-end items-center gap-3">
        <Link
          to="/dashboard"
          className="btn-staff"
        >
          Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className="btn-danger"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

// PO Detail Modal Component
const fulfillmentFromIntegration = (source = {}) => ({
  shipmentPickupIndicator: source.shipmentPickupIndicator || 'P',
  referenceNumber: source.referenceNumber || '',
  shipmentComplete: source.shipmentComplete || '',
  shipmentCarrier: source.shipmentCarrier || '',
  shipmentMethod: source.shipmentMethod || '',
  pickupDC: source.pickupDC || '',
  promoCode: source.promoCode || '',
  promoCodeType: source.promoCodeType || '',
  emailAddress: source.emailAddress || '',
  dropShipmentName: source.dropShipmentName || '',
  dropShipmentAddress1: source.dropShipmentAddress1 || '',
  dropShipmentAddress2: source.dropShipmentAddress2 || '',
  dropShipmentAddress3: source.dropShipmentAddress3 || '',
  dropShipmentCity: source.dropShipmentCity || '',
  dropShipmentStateProvince: source.dropShipmentStateProvince || '',
  dropShipmentZipcode: source.dropShipmentZipcode || '',
  dropShipmentCountryCode: source.dropShipmentCountryCode || '',
});

export function PODetailModal({ po, onClose, onUpdate, onSync }) {
  console.log('PODetailModal rendering with:', po);
  
  const [showCamera, setShowCamera] = useState(false);
  const [attachedPhotos, setAttachedPhotos] = useState([]);

  const [status, setStatus] = useState(po?.status || 'Draft');
  const [notes, setNotes] = useState(po?.notes || '');
  
  // Safe date formatting
  const safeFormatDate = (date) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'yyyy-MM-dd');
    } catch {
      return '';
    }
  };

  const [expectedDelivery, setExpectedDelivery] = useState(safeFormatDate(po?.expectedDelivery));
  const [receivedDate, setReceivedDate] = useState(safeFormatDate(po?.receivedDate));
  const [paidDate, setPaidDate] = useState(safeFormatDate(po?.paidDate));
  const supplierAdiAccount = po?.supplier?.adiAccount || {};
  const [adiCustomerNumber, setAdiCustomerNumber] = useState(
    supplierAdiAccount.customerNumber || po?.adiIntegration?.customerNumber || ''
  );
  const [adiCustomerSuffix, setAdiCustomerSuffix] = useState(
    supplierAdiAccount.customerSuffix || po?.adiIntegration?.customerSuffix || '000'
  );
  const [editingAccount, setEditingAccount] = useState(
    !(supplierAdiAccount.customerNumber || po?.adiIntegration?.customerNumber)
  );
  const [orderConfirmOpen, setOrderConfirmOpen] = useState(false);
  const [adiOrderNumber, setAdiOrderNumber] = useState(po?.adiIntegration?.adiOrderNumber || '');
  const [adiLoading, setAdiLoading] = useState(false);
  const [adiLastMessage, setAdiLastMessage] = useState('');
  const [adiLastSyncedAt, setAdiLastSyncedAt] = useState(po?.adiIntegration?.lastSyncedAt || null);
  const [adiInquirySnapshot, setAdiInquirySnapshot] = useState({
    status: po?.adiIntegration?.lastInquiryStatus || '',
    message: po?.adiIntegration?.lastInquiryMessage || '',
    at: po?.adiIntegration?.lastInquiryAt || null,
  });
  const [adiFulfillment, setAdiFulfillment] = useState(fulfillmentFromIntegration(po?.adiIntegration));
  const [adiPriceLines, setAdiPriceLines] = useState(
    Array.isArray(po?.adiIntegration?.priceLines) ? po.adiIntegration.priceLines : []
  );
  const [adiShipments, setAdiShipments] = useState(
    Array.isArray(po?.adiIntegration?.shipments) ? po.adiIntegration.shipments : []
  );
  const [adiCarts, setAdiCarts] = useState(
    Array.isArray(po?.adiIntegration?.carts) ? po.adiIntegration.carts : []
  );
  const [displayItems, setDisplayItems] = useState(Array.isArray(po?.items) ? po.items : []);
  const [displayTotals, setDisplayTotals] = useState({
    subtotal: po?.subtotal || 0,
    tax: po?.tax || 0,
    shipping: po?.shipping || 0,
    total: po?.total || 0,
  });

  // Safety check after hooks to keep hook order stable across renders.
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

  const setFulfillmentField = (field, value) => {
    setAdiFulfillment((current) => ({ ...current, [field]: value }));
  };

  const ensureAdiCustomerFields = () => {
    if (!adiCustomerNumber.trim()) {
      alert('Enter ADI Customer Number first.');
      return false;
    }
    if (!adiCustomerSuffix.trim()) {
      alert('Enter ADI Customer Suffix first.');
      return false;
    }
    return true;
  };

  const persistSupplierAccount = async (customerNumber, customerSuffix) => {
    const supplierId = po.supplier?._id;
    if (!supplierId || !customerNumber) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/suppliers/${supplierId}`,
        { adiAccount: { customerNumber, customerSuffix } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onSync?.(po._id, {
        supplier: {
          ...po.supplier,
          adiAccount: { customerNumber, customerSuffix },
        },
      });
    } catch (err) {
      console.error('Error saving ADI account on supplier:', err);
    }
  };

  const quoteForLine = (line) => {
    const adiSku = adiItemNumberFromSku(line?.sku).toLowerCase();
    return adiPriceLines.find((entry) => adiItemNumberFromSku(entry.itemNumber).toLowerCase() === adiSku);
  };

  const handleAdiPriceLookup = async () => {
    if (!ensureAdiCustomerFields()) return;

    try {
      setAdiLoading(true);
      const payload = {
        customerNumber: adiCustomerNumber.trim(),
        customerSuffix: adiCustomerSuffix.trim(),
        itemList: displayItems.map((item) => ({
          ItemNumber: adiItemNumberFromSku(item.sku),
          Quantity: Number(item.quantity) || 0,
        })),
      };

      const response = await fetchAdiPriceInventory(payload);
      const applied = applyAdiPriceInventory(
        { items: displayItems, tax: displayTotals.tax, shipping: displayTotals.shipping },
        response
      );
      const syncedAt = new Date().toISOString();
      const integration = buildAdiIntegrationPayload({
        priceLines: applied.priceLines,
        lastSyncedAt: syncedAt,
      });
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/purchase-orders/${po._id}`,
        {
          items: applied.items,
          subtotal: applied.subtotal,
          tax: applied.tax,
          shipping: applied.shipping,
          total: applied.total,
          adiIntegration: integration,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setDisplayItems(applied.items);
      setDisplayTotals({
        subtotal: applied.subtotal,
        tax: applied.tax,
        shipping: applied.shipping,
        total: applied.total,
      });
      setAdiPriceLines(applied.priceLines);
      setAdiLastSyncedAt(syncedAt);
      setEditingAccount(false);
      await persistSupplierAccount(adiCustomerNumber.trim(), adiCustomerSuffix.trim());
      onSync?.(po._id, {
        items: applied.items,
        subtotal: applied.subtotal,
        tax: applied.tax,
        shipping: applied.shipping,
        total: applied.total,
        adiIntegration: integration,
      });

      const priced = applied.priceLines.filter((line) => line.itemPrice).length;
      let message = `ADI Price Lookup complete (${applied.priceLines.length} items). ReturnCode: ${response.ReturnCode || 'N/A'}. Prices applied to ${priced} line${priced === 1 ? '' : 's'}.`;
      if (applied.unmatchedSkus.length) {
        message += ` No ADI quote for: ${applied.unmatchedSkus.join(', ')}.`;
      }
      setAdiLastMessage(message);
      alert(`✅ ${message}`);
    } catch (err) {
      const errorInfo = handleApiError(err, 'ADI price lookup');
      alert(formatErrorAlert(errorInfo));
    } finally {
      setAdiLoading(false);
    }
  };

  const persistAdiIntegration = async (adiIntegrationPayload) => {
    const token = localStorage.getItem('token');
    await axios.put(
      `${API_BASE_URL}/api/purchase-orders/${po._id}`,
      { adiIntegration: adiIntegrationPayload },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (adiIntegrationPayload.lastSyncedAt !== undefined) {
      setAdiLastSyncedAt(adiIntegrationPayload.lastSyncedAt);
    }
  };

  const buildAdiIntegrationPayload = (overrides = {}) => ({
    customerNumber: (overrides.customerNumber ?? adiCustomerNumber ?? '').toString().trim(),
    customerSuffix: (overrides.customerSuffix ?? adiCustomerSuffix ?? '').toString().trim(),
    adiOrderNumber: (overrides.adiOrderNumber ?? adiOrderNumber ?? '').toString().trim(),
    lastSyncedAt:
      overrides.lastSyncedAt ??
      adiLastSyncedAt ??
      po?.adiIntegration?.lastSyncedAt ??
      null,
    lastInquiryStatus:
      (overrides.lastInquiryStatus ?? adiInquirySnapshot.status ?? po?.adiIntegration?.lastInquiryStatus ?? '')
        .toString()
        .trim(),
    lastInquiryMessage:
      (overrides.lastInquiryMessage ?? adiInquirySnapshot.message ?? po?.adiIntegration?.lastInquiryMessage ?? '')
        .toString()
        .trim(),
    lastInquiryAt:
      overrides.lastInquiryAt ??
      adiInquirySnapshot.at ??
      po?.adiIntegration?.lastInquiryAt ??
      null,
    ...adiFulfillment,
    priceLines: adiPriceLines,
    shipments: adiShipments,
    carts: adiCarts,
    ...overrides,
  });

  const handleAdiOrderGeneration = async () => {
    if (!ensureAdiCustomerFields()) return;

    const orderForm = {
      customerNumber: adiCustomerNumber.trim(),
      customerSuffix: adiCustomerSuffix.trim(),
      poNumber: po.poNumber,
      ...adiFulfillment,
      items: displayItems,
    };
    const validationError = validateAdiGenerateOrder(orderForm);
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      setAdiLoading(true);
      const payload = buildAdiGenerateOrderPayload(orderForm);

      const response = await generateAdiOrder(payload);
      const message = response.ReturnMessage || 'ADI order generation completed.';
      setAdiLastMessage(message);

      let successAlert = `✅ ${message}`;
      // Extract 10-digit ADI order number from response/message when present.
      const foundOrderNumber = extractAdiOrderNumber(response, message);
      if (foundOrderNumber) {
        setAdiOrderNumber(foundOrderNumber);
        setEditingAccount(false);
        setOrderConfirmOpen(false);
        await persistSupplierAccount(adiCustomerNumber.trim(), adiCustomerSuffix.trim());

        // Auto-inquiry keeps the PO snapshot fresh right after generation.
        const inquiryResponse = await inquireAdiOrder({
          customerNumber: adiCustomerNumber.trim(),
          customerSuffix: adiCustomerSuffix.trim(),
          adiOrderNumber: foundOrderNumber,
        });
        const inquiryMessage = inquiryResponse?.ReturnMessage || 'ADI order inquiry completed.';
        const inquiryStatus = deriveAdiInquiryStatus(inquiryResponse);
        const inquiryAt = new Date().toISOString();
        const shipments = collectAdiShipments(inquiryResponse);
        const carts = collectAdiCarts(inquiryResponse);

        setAdiInquirySnapshot({
          status: inquiryStatus,
          message: inquiryMessage,
          at: inquiryAt,
        });
        setAdiShipments(shipments);
        setAdiCarts(carts);
        setAdiLastSyncedAt(inquiryAt);

        await persistAdiIntegration(buildAdiIntegrationPayload({
          customerNumber: adiCustomerNumber.trim(),
          customerSuffix: adiCustomerSuffix.trim(),
          adiOrderNumber: foundOrderNumber,
          lastSyncedAt: inquiryAt,
          lastInquiryStatus: inquiryStatus,
          lastInquiryMessage: inquiryMessage,
          lastInquiryAt: inquiryAt,
          shipments,
          carts,
        }));

        setAdiLastMessage(`${message} Inquiry: ${inquiryMessage}`);
      } else {
        const pendingMessage =
          'ADI order number could not be auto-detected. Enter ADI Order Number and run ADI Order Inquiry.';
        const syncedAt = new Date().toISOString();
        const previousInquiryAt = adiInquirySnapshot.at ?? po?.adiIntegration?.lastInquiryAt ?? null;
        setAdiOrderNumber('');
        setAdiInquirySnapshot({
          status: 'Pending Manual Inquiry',
          message: pendingMessage,
          at: previousInquiryAt,
        });
        setAdiLastSyncedAt(syncedAt);
        await persistAdiIntegration(
          buildAdiIntegrationPayload({
            customerNumber: adiCustomerNumber.trim(),
            customerSuffix: adiCustomerSuffix.trim(),
            adiOrderNumber: '',
            lastSyncedAt: syncedAt,
            lastInquiryStatus: 'Pending Manual Inquiry',
            lastInquiryMessage: pendingMessage,
            lastInquiryAt: previousInquiryAt,
          })
        );
        setAdiLastMessage(`${message} ${pendingMessage}`);
        successAlert = `⚠️ ${pendingMessage}`;
      }

      alert(successAlert);
    } catch (err) {
      const errorInfo = handleApiError(err, 'ADI order generation');
      alert(formatErrorAlert(errorInfo));
    } finally {
      setAdiLoading(false);
    }
  };

  const handleAdiOrderInquiry = async () => {
    if (!ensureAdiCustomerFields()) return;
    if (!adiOrderNumber.trim()) {
      alert('Enter ADI Order Number first.');
      return;
    }

    try {
      setAdiLoading(true);
      const payload = {
        customerNumber: adiCustomerNumber.trim(),
        customerSuffix: adiCustomerSuffix.trim(),
        adiOrderNumber: adiOrderNumber.trim(),
      };

      const response = await inquireAdiOrder(payload);
      const message = response.ReturnMessage || 'ADI order inquiry completed.';
      const inquiryStatus = deriveAdiInquiryStatus(response);
      const inquiryAt = new Date().toISOString();
      const shipments = collectAdiShipments(response);
      const carts = collectAdiCarts(response);

      setAdiLastMessage(message);
      setAdiInquirySnapshot({
        status: inquiryStatus,
        message,
        at: inquiryAt,
      });
      setAdiShipments(shipments);
      setAdiCarts(carts);
      setAdiLastSyncedAt(inquiryAt);
      await persistAdiIntegration(buildAdiIntegrationPayload({
        customerNumber: adiCustomerNumber.trim(),
        customerSuffix: adiCustomerSuffix.trim(),
        adiOrderNumber: adiOrderNumber.trim(),
        lastSyncedAt: inquiryAt,
        lastInquiryStatus: inquiryStatus,
        lastInquiryMessage: message,
        lastInquiryAt: inquiryAt,
        shipments,
        carts,
      }));
      alert(`✅ ${message}`);
    } catch (err) {
      const errorInfo = handleApiError(err, 'ADI order inquiry');
      alert(formatErrorAlert(errorInfo));
    } finally {
      setAdiLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const updates = { status: newStatus, notes, adiIntegration: buildAdiIntegrationPayload() };

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
      await axios.put(
        `${API_BASE_URL}/api/purchase-orders/${po._id}`,
        {
          notes,
          expectedDelivery: expectedDelivery || null,
          receivedDate: receivedDate || null,
          paidDate: paidDate || null,
          // Preserve ADI metadata so manual PO edits do not drop integration state.
          adiIntegration: buildAdiIntegrationPayload(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

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
            ${displayItems.map(item => `
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
              <td>$${(displayTotals.subtotal || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="5" class="totals">Tax:</td>
              <td>$${(displayTotals.tax || 0).toFixed(2)}</td>
            </tr>
            ${(displayTotals.shipping || 0) > 0 ? `
              <tr>
                <td colspan="5" class="totals">Shipping:</td>
                <td>$${(displayTotals.shipping || 0).toFixed(2)}</td>
              </tr>
            ` : ''}
            <tr style="font-size: 18px;">
              <td colspan="5" class="totals"><strong>TOTAL:</strong></td>
              <td><strong>$${(displayTotals.total || 0).toFixed(2)}</strong></td>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

          {/* ADI pricing, ordering, and tracking */}
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <h3 className="font-bold text-black mb-3">ADI</h3>
            {adiCustomerNumber.trim() && !editingAccount ? (
              <p className="text-sm text-black mb-3">
                ADI account {adiCustomerNumber.trim()}-{adiCustomerSuffix.trim() || '000'}
                <button
                  type="button"
                  onClick={() => setEditingAccount(true)}
                  className="ml-3 text-indigo-700 underline"
                >
                  Change account
                </button>
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label htmlFor="adi-customer-number" className="block text-sm font-medium text-black mb-1">
                    ADI customer number
                  </label>
                  <input
                    id="adi-customer-number"
                    type="text"
                    value={adiCustomerNumber}
                    onChange={(e) => setAdiCustomerNumber(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="adi-customer-suffix" className="block text-sm font-medium text-black mb-1">
                    Account suffix
                  </label>
                  <input
                    id="adi-customer-suffix"
                    type="text"
                    value={adiCustomerSuffix}
                    onChange={(e) => setAdiCustomerSuffix(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                    placeholder="000"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAdiPriceLookup}
                disabled={adiLoading}
                className="bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 disabled:opacity-60"
              >
                Update prices from ADI
              </button>
              {!orderConfirmOpen && (
                <button
                  type="button"
                  onClick={() => setOrderConfirmOpen(true)}
                  disabled={adiLoading}
                  className="bg-white text-indigo-800 border border-indigo-300 px-3 py-2 rounded hover:bg-indigo-100 disabled:opacity-60"
                >
                  Place order with ADI
                </button>
              )}
            </div>

            {orderConfirmOpen && (
              <div className="mt-4 p-3 bg-white border border-indigo-200 rounded">
                <p className="text-sm font-medium text-black mb-2">This sends a real order to ADI.</p>
                <p className="text-sm text-black mb-2">
                  {displayItems.length} lines · ${Number(displayTotals.total || 0).toFixed(2)}
                </p>
                <ul className="text-sm text-gray-700 mb-3 list-disc pl-5">
                  {displayItems.map((item, index) => {
                    const parts = splitCatalogSku(item.sku);
                    return (
                      <li key={`${parts.adiItemNumber}-${index}`}>
                        {parts.adiItemNumber || 'Item'} × {item.quantity || 0}
                      </li>
                    );
                  })}
                </ul>
                <div className="mb-3">
                  <label htmlFor="adi-fulfillment" className="block text-sm font-medium text-black mb-1">
                    Fulfillment
                  </label>
                  <select
                    id="adi-fulfillment"
                    value={adiFulfillment.shipmentPickupIndicator}
                    onChange={(e) => setFulfillmentField('shipmentPickupIndicator', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black bg-white"
                  >
                    <option value="P">Pickup</option>
                    <option value="S">Ship to address</option>
                  </select>
                </div>
                {adiFulfillment.shipmentPickupIndicator === 'S' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label htmlFor="adi-drop-name" className="block text-sm font-medium text-black mb-1">Drop shipment name</label>
                      <input id="adi-drop-name" type="text" value={adiFulfillment.dropShipmentName} onChange={(e) => setFulfillmentField('dropShipmentName', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black bg-white" />
                    </div>
                    <div>
                      <label htmlFor="adi-drop-address" className="block text-sm font-medium text-black mb-1">Drop shipment address</label>
                      <input id="adi-drop-address" type="text" value={adiFulfillment.dropShipmentAddress1} onChange={(e) => setFulfillmentField('dropShipmentAddress1', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black bg-white" />
                    </div>
                    <div>
                      <label htmlFor="adi-drop-city" className="block text-sm font-medium text-black mb-1">Drop shipment city</label>
                      <input id="adi-drop-city" type="text" value={adiFulfillment.dropShipmentCity} onChange={(e) => setFulfillmentField('dropShipmentCity', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black bg-white" />
                    </div>
                    <div>
                      <label htmlFor="adi-drop-state" className="block text-sm font-medium text-black mb-1">Drop shipment state</label>
                      <input id="adi-drop-state" type="text" value={adiFulfillment.dropShipmentStateProvince} onChange={(e) => setFulfillmentField('dropShipmentStateProvince', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black bg-white" />
                    </div>
                    <div>
                      <label htmlFor="adi-drop-zip" className="block text-sm font-medium text-black mb-1">Drop shipment ZIP</label>
                      <input id="adi-drop-zip" type="text" value={adiFulfillment.dropShipmentZipcode} onChange={(e) => setFulfillmentField('dropShipmentZipcode', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black bg-white" />
                    </div>
                    <div>
                      <label htmlFor="adi-drop-country" className="block text-sm font-medium text-black mb-1">Drop shipment country</label>
                      <input id="adi-drop-country" type="text" value={adiFulfillment.dropShipmentCountryCode} onChange={(e) => setFulfillmentField('dropShipmentCountryCode', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black bg-white" />
                    </div>
                  </div>
                )}
                <details className="mb-3">
                  <summary className="text-sm font-medium text-black cursor-pointer">More options</summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label htmlFor="adi-carrier" className="block text-sm font-medium text-black mb-1">Shipment carrier</label>
                      <input id="adi-carrier" type="text" value={adiFulfillment.shipmentCarrier} onChange={(e) => setFulfillmentField('shipmentCarrier', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black bg-white" />
                    </div>
                    <div>
                      <label htmlFor="adi-method" className="block text-sm font-medium text-black mb-1">Shipment method</label>
                      <input id="adi-method" type="text" value={adiFulfillment.shipmentMethod} onChange={(e) => setFulfillmentField('shipmentMethod', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black bg-white" />
                    </div>
                    <div>
                      <label htmlFor="adi-pickup-dc" className="block text-sm font-medium text-black mb-1">Pickup DC</label>
                      <input id="adi-pickup-dc" type="text" value={adiFulfillment.pickupDC} onChange={(e) => setFulfillmentField('pickupDC', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black bg-white" />
                    </div>
                    <div>
                      <label htmlFor="adi-reference" className="block text-sm font-medium text-black mb-1">Reference number</label>
                      <input id="adi-reference" type="text" value={adiFulfillment.referenceNumber} onChange={(e) => setFulfillmentField('referenceNumber', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black bg-white" />
                    </div>
                    <div>
                      <label htmlFor="adi-email" className="block text-sm font-medium text-black mb-1">Confirmation email</label>
                      <input id="adi-email" type="email" value={adiFulfillment.emailAddress} onChange={(e) => setFulfillmentField('emailAddress', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black bg-white" />
                    </div>
                    <div>
                      <label htmlFor="adi-promo-code" className="block text-sm font-medium text-black mb-1">Promo code</label>
                      <input id="adi-promo-code" type="text" value={adiFulfillment.promoCode} onChange={(e) => setFulfillmentField('promoCode', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-black bg-white" />
                    </div>
                  </div>
                </details>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleAdiOrderGeneration}
                    disabled={adiLoading}
                    className="bg-indigo-700 text-white px-3 py-2 rounded hover:bg-indigo-800 disabled:opacity-60"
                  >
                    Send order to ADI
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderConfirmOpen(false)}
                    className="bg-white text-black border border-gray-300 px-3 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {(adiOrderNumber.trim() || adiShipments.length > 0 || adiInquirySnapshot.status) && (
              <div className="mt-4">
                {adiOrderNumber.trim() && (
                  <p className="text-sm text-black mb-2">ADI order {adiOrderNumber.trim()}</p>
                )}
                {adiOrderNumber.trim() && (
                  <button
                    type="button"
                    onClick={handleAdiOrderInquiry}
                    disabled={adiLoading}
                    className="bg-white text-indigo-800 border border-indigo-300 px-3 py-2 rounded hover:bg-indigo-100 disabled:opacity-60"
                  >
                    Check status
                  </button>
                )}
                {adiInquirySnapshot.status && (
                  <div className="mt-2 text-sm text-gray-700">
                    <p><span className="font-medium">ADI status:</span> {adiInquirySnapshot.status}</p>
                    {adiInquirySnapshot.message && (
                      <p>{plainAdiItemMessage(adiInquirySnapshot.message)}</p>
                    )}
                  </div>
                )}
                {adiCarts.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table aria-label="ADI cart units" className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-indigo-200 text-left">
                          <th className="p-2">Cart</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Carrier</th>
                          <th className="p-2">Tracking</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adiCarts.map((row, index) => (
                          <tr key={`${row.cartNumber}-${index}`}>
                            <td className="p-2">{row.cartNumber || '-'}</td>
                            <td className="p-2">{row.status || '-'}</td>
                            <td className="p-2">{row.carrier || '-'}</td>
                            <td className="p-2">{row.trackingNumber || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {adiShipments.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table aria-label="ADI shipments" className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-indigo-200 text-left">
                          <th className="p-2">Tracking</th>
                          <th className="p-2">Carrier</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Ship date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adiShipments.map((row, index) => (
                          <tr key={`${row.trackingNumber}-${index}`} className="border-b border-indigo-100">
                            <td className="p-2">{row.trackingNumber || '-'}</td>
                            <td className="p-2">{row.carrier || '-'}</td>
                            <td className="p-2">{row.status || '-'}</td>
                            <td className="p-2">{row.shipDate || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {adiLastMessage && (
              <p className="text-sm text-gray-700 mt-3">{adiLastMessage}</p>
            )}
          </div>

          {/* Items */}
          <div className="mb-6">
            <h3 className="font-bold text-black mb-3">Line Items</h3>
            <div className="bg-gray-50 border border-gray-300 rounded-lg overflow-hidden">
              <table aria-label="Line items" className="w-full">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-100">
                    <th className="text-left p-3 text-black text-sm">Manufacturer part</th>
                    <th className="text-left p-3 text-black text-sm">ADI item</th>
                    <th className="text-left p-3 text-black text-sm">Description</th>
                    <th className="text-left p-3 text-black text-sm">Qty</th>
                    <th className="text-left p-3 text-black text-sm">Unit</th>
                    <th className="text-left p-3 text-black text-sm">Your price</th>
                    <th className="text-left p-3 text-black text-sm">ADI price</th>
                    <th className="text-left p-3 text-black text-sm">Stock</th>
                    <th className="text-left p-3 text-black text-sm">Can buy</th>
                    <th className="text-left p-3 text-black text-sm">Total</th>
                  </tr>
                </thead>
                  <tbody>
                    {displayItems.map((item, idx) => {
                      const parts = splitCatalogSku(item.sku);
                      const quote = quoteForLine(item);
                      const adiPriceNumber = Number(quote?.itemPrice);
                      const adiPrice = Number.isFinite(adiPriceNumber) && adiPriceNumber > 0
                        ? `$${adiPriceNumber.toFixed(2)}`
                        : '—';
                      const note = quote?.returnMessage
                        ? plainAdiItemMessage(quote.returnMessage, parts.adiItemNumber)
                        : '';
                      const supportCode = quote?.returnMessage ? adiSupportCode(quote.returnMessage) : '';
                      const sale = [quote?.saleStartDate, quote?.saleEndDate].filter(Boolean).join(' – ');
                      return (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="p-3 text-black text-sm">{parts.manufacturerPart || '—'}</td>
                        <td className="p-3 text-black text-sm">
                          {parts.adiItemNumber || '—'}
                          {note && <p className="text-xs text-gray-600 mt-1">{note}</p>}
                          {supportCode && <p className="text-xs text-gray-500">{supportCode}</p>}
                        </td>
                        <td className="p-3 text-black">{item.description || 'N/A'}</td>
                        <td className="p-3 text-black">{item.quantity || 0}</td>
                        <td className="p-3 text-black text-sm">{item.unit || ''}</td>
                        <td className="p-3 text-black">${(item.unitPrice || 0).toFixed(2)}</td>
                        <td className="p-3 text-black">
                          {adiPrice}
                          {sale && <p className="text-xs text-gray-600">{sale}</p>}
                        </td>
                        <td className="p-3 text-black text-sm">{quote?.nationalInventory || '—'}</td>
                        <td className="p-3 text-black text-sm">{adiAllowedLabel(quote?.allowedToBuy) || '—'}</td>
                        <td className="p-3 text-black font-medium">${(item.total || 0).toFixed(2)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300">
                      <td colSpan="9" className="p-3 text-right font-medium text-black">Subtotal:</td>
                      <td className="p-3 font-medium text-black">${(displayTotals.subtotal || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan="9" className="p-3 text-right text-gray-600 text-sm">Tax:</td>
                      <td className="p-3 text-gray-600 text-sm">${(displayTotals.tax || 0).toFixed(2)}</td>
                    </tr>
                    {(displayTotals.shipping || 0) > 0 && (
                      <tr>
                        <td colSpan="9" className="p-3 text-right text-gray-600 text-sm">Shipping:</td>
                        <td className="p-3 text-gray-600 text-sm">${(displayTotals.shipping || 0).toFixed(2)}</td>
                      </tr>
                    )}
                    <tr className="bg-gray-100">
                      <td colSpan="9" className="p-3 text-right font-bold text-black text-lg">TOTAL:</td>
                      <td className="p-3 font-bold text-black text-lg">${(displayTotals.total || 0).toFixed(2)}</td>
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

          {/* Photo Attachments */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-black">📸 Photos</h4>
              <button
                onClick={() => setShowCamera(true)}
                className="bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 text-sm font-medium"
              >
                📷 Take Photo
              </button>
            </div>
            
            {attachedPhotos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {attachedPhotos.map((photo, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={photo}
                      alt={`Attachment ${idx + 1}`}
                      className="w-full h-24 object-cover rounded border border-gray-300"
                    />
                    <button
                      onClick={() => setAttachedPhotos(attachedPhotos.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-center text-gray-600 text-sm">
                No photos attached. Use camera to add photos (invoices, damage, delivery).
              </div>
            )}
          </div>
        </div>

        {/* Camera Modal */}
        {showCamera && (
          <CameraCapture
            title="Attach Photo to PO"
            onCapture={(imageData) => {
              setAttachedPhotos([...attachedPhotos, imageData]);
              setShowCamera(false);
            }}
            onClose={() => setShowCamera(false)}
          />
        )}

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

