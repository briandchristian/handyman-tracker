import { useEffect, useState } from 'react';
import { fetchAdiPriceInventory } from '../services/adiSupplierApi';
import { handleApiError, formatErrorAlert } from '../utils/errorHandler';
import {
  adiAllowedLabel,
  adiItemNumberFromSku,
  adiSupportCode,
  findAdiAccount,
  plainAdiItemMessage,
} from '../utils/adiIntegration';

/**
 * Look up one ADI part price and stock without creating a purchase order.
 */
export default function AdiPartPriceCheck({ purchaseOrders = [] }) {
  const savedAccount = findAdiAccount(purchaseOrders);
  const [customerNumber, setCustomerNumber] = useState(savedAccount?.customerNumber || '');
  const [customerSuffix, setCustomerSuffix] = useState(savedAccount?.customerSuffix || '000');
  const [editingAccount, setEditingAccount] = useState(!savedAccount?.customerNumber);
  const [partNumber, setPartNumber] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!savedAccount?.customerNumber) return;
    setCustomerNumber(savedAccount.customerNumber);
    setCustomerSuffix(savedAccount.customerSuffix || '000');
    setEditingAccount(false);
  }, [savedAccount?.customerNumber, savedAccount?.customerSuffix]);

  const checkPrice = async () => {
    const itemNumber = adiItemNumberFromSku(partNumber);
    const qty = Number(quantity);
    if (!itemNumber) {
      setResult({ error: 'Enter a part number.' });
      return;
    }
    if (!customerNumber.trim()) {
      setResult({ error: 'Enter your ADI customer number.' });
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setResult({ error: 'Quantity must be at least 1.' });
      return;
    }

    try {
      setLoading(true);
      const response = await fetchAdiPriceInventory({
        customerNumber: customerNumber.trim(),
        customerSuffix: customerSuffix.trim() || '000',
        itemList: [{ ItemNumber: itemNumber, Quantity: qty }],
      });
      const line = Array.isArray(response?.ItemList) ? response.ItemList[0] || {} : {};
      const priceNumber = Number(line.ItemPrice);
      const message = plainAdiItemMessage(line.ReturnMessage || response?.ReturnMessage, itemNumber);
      setResult({
        itemNumber: adiItemNumberFromSku(line.ItemNumber) || itemNumber,
        price: Number.isFinite(priceNumber) && priceNumber > 0 ? `$${priceNumber.toFixed(2)}` : '',
        stock: line.NationalInventory || line.ItemNationalInventory || '',
        allowed: adiAllowedLabel(line.AllowedToBuy),
        message,
        code: adiSupportCode(line.ReturnMessage || response?.ReturnMessage),
      });
    } catch (err) {
      const errorInfo = handleApiError(err, 'ADI price check');
      setResult({ error: formatErrorAlert(errorInfo) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="adi-price" aria-label="Check a part price" className="mb-6 bg-white border border-gray-300 rounded-lg p-4">
      <h2 className="text-xl font-bold text-black">Check a part price</h2>
      <p className="text-sm text-gray-600 mt-1 mb-3">
        Look up an ADI price and stock level. This does not create an order.
      </p>

      {customerNumber.trim() && !editingAccount ? (
        <p className="text-sm text-black mb-3">
          Using ADI account {customerNumber.trim()}-{customerSuffix.trim() || '000'}
          <button type="button" onClick={() => setEditingAccount(true)} className="ml-3 text-indigo-700 underline">
            Change account
          </button>
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label htmlFor="part-price-customer" className="block text-sm font-medium text-black mb-1">
              ADI customer number
            </label>
            <input
              id="part-price-customer"
              type="text"
              value={customerNumber}
              onChange={(e) => setCustomerNumber(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white"
            />
          </div>
          <div>
            <label htmlFor="part-price-suffix" className="block text-sm font-medium text-black mb-1">
              Account suffix
            </label>
            <input
              id="part-price-suffix"
              type="text"
              value={customerSuffix}
              onChange={(e) => setCustomerSuffix(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-black bg-white"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_8rem_auto] gap-3 items-end">
        <div>
          <label htmlFor="part-number" className="block text-sm font-medium text-black mb-1">
            Part number
          </label>
          <input
            id="part-number"
            type="text"
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
            placeholder="3W-MX922"
            className="w-full p-2 border border-gray-300 rounded text-black bg-white"
          />
        </div>
        <div>
          <label htmlFor="part-quantity" className="block text-sm font-medium text-black mb-1">
            Quantity
          </label>
          <input
            id="part-quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-black bg-white"
          />
        </div>
        <button
          type="button"
          onClick={checkPrice}
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-60"
        >
          Check price
        </button>
      </div>

      {result?.error && (
        <p className="text-sm text-red-700 mt-3">{result.error}</p>
      )}
      {result && !result.error && (
        <div role="status" aria-label="ADI price result" className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-gray-600">ADI item</p>
            <p className="font-medium text-black">{result.itemNumber}</p>
          </div>
          <div>
            <p className="text-gray-600">Price</p>
            <p className="font-medium text-black">{result.price || '—'}</p>
          </div>
          <div>
            <p className="text-gray-600">Stock</p>
            <p className="font-medium text-black">{result.stock || '—'}</p>
          </div>
          <div>
            <p className="text-gray-600">Can buy</p>
            <p className="font-medium text-black">{result.allowed || '—'}</p>
          </div>
          {result.message && (
            <p className="col-span-2 md:col-span-4 text-gray-700">
              {result.message}
              {result.code && <span className="block text-xs text-gray-500">{result.code}</span>}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
