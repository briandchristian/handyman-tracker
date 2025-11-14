import { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';

export default function QuickReorder({ onCreatePO }) {
  const [reorderCart, setReorderCart] = useState([]);
  const [frequentItems, setFrequentItems] = useState([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    fetchFrequentItems();
    fetchLowStockItems();
  }, []);

  const fetchFrequentItems = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/inventory?lowStock=false`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Get top 10 items (could be based on frequency in future)
      setFrequentItems(res.data.slice(0, 10));
    } catch (err) {
      console.error('Error fetching frequent items:', err);
    }
  };

  const fetchLowStockItems = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/inventory?lowStock=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLowStockItems(res.data);
    } catch (err) {
      console.error('Error fetching low stock items:', err);
    }
  };

  const addToCart = (item) => {
    const existing = reorderCart.find(i => i._id === item._id);
    if (existing) {
      setReorderCart(reorderCart.map(i => 
        i._id === item._id 
          ? { ...i, quantity: i.quantity + (item.parLevel || 1) }
          : i
      ));
    } else {
      setReorderCart([...reorderCart, {
        ...item,
        quantity: item.parLevel || 1,
        unitPrice: 0 // Will be filled in PO
      }]);
    }
  };

  const removeFromCart = (itemId) => {
    setReorderCart(reorderCart.filter(i => i._id !== itemId));
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setReorderCart(reorderCart.map(i => 
      i._id === itemId ? { ...i, quantity: newQuantity } : i
    ));
  };

  const generatePO = () => {
    if (reorderCart.length === 0) {
      alert('Add items to cart first!');
      return;
    }

    // Group by supplier
    const itemsBySupplier = {};
    reorderCart.forEach(item => {
      const supplierId = item.preferredSupplier?._id || 'no-supplier';
      if (!itemsBySupplier[supplierId]) {
        itemsBySupplier[supplierId] = {
          supplier: item.preferredSupplier,
          items: []
        };
      }
      itemsBySupplier[supplierId].items.push(item);
    });

    onCreatePO(itemsBySupplier);
    setReorderCart([]); // Clear cart after generating PO
  };

  const totalItems = reorderCart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className={`fixed right-0 top-0 h-full bg-white border-l-2 border-gray-300 shadow-xl transition-all duration-300 z-40 
      ${isExpanded ? 'w-96 max-w-full' : 'w-12'} 
      lg:block ${!isExpanded && 'hidden lg:block'}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -left-10 top-4 bg-blue-500 text-white px-3 py-2 rounded-l hover:bg-blue-600 font-bold lg:flex hidden"
      >
        {isExpanded ? '→' : '🛒'}
      </button>
      
      {/* Mobile Toggle (Bottom FAB) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="lg:hidden fixed bottom-4 right-4 bg-blue-500 text-white w-14 h-14 rounded-full shadow-lg hover:bg-blue-600 flex items-center justify-center text-2xl z-50"
      >
        🛒
      </button>

      {isExpanded && (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-300 bg-blue-50">
            <h2 className="text-xl font-bold text-black">Quick Reorder</h2>
            <p className="text-sm text-gray-600">Add items and generate PO</p>
          </div>

          {/* Cart Summary */}
          {reorderCart.length > 0 && (
            <div className="p-4 bg-green-50 border-b border-gray-300">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-black">Cart ({totalItems} items)</span>
                <button
                  onClick={() => setReorderCart([])}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Clear All
                </button>
              </div>
              <button
                onClick={generatePO}
                className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 font-medium"
              >
                📋 Generate PO
              </button>
            </div>
          )}

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Cart Items */}
            {reorderCart.length > 0 && (
              <div className="p-4 border-b border-gray-300">
                <h3 className="font-bold text-black mb-2">Cart Items</h3>
                <div className="space-y-2">
                  {reorderCart.map(item => (
                    <div key={item._id} className="bg-gray-50 border border-gray-300 rounded p-2">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium text-black">{item.name}</span>
                        <button
                          onClick={() => removeFromCart(item._id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item._id, parseInt(e.target.value) || 0)}
                          className="w-16 p-1 border border-gray-300 rounded text-black text-sm bg-white"
                          min="1"
                        />
                        <span className="text-xs text-gray-600">{item.unit}</span>
                      </div>
                      {item.preferredSupplier && (
                        <div className="text-xs text-gray-500 mt-1">
                          📦 {item.preferredSupplier.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low Stock Alert */}
            {lowStockItems.length > 0 && (
              <div className="p-4 border-b border-gray-300 bg-orange-50">
                <h3 className="font-bold text-black mb-2 flex items-center gap-2">
                  ⚠️ Low Stock ({lowStockItems.length})
                </h3>
                <div className="space-y-2">
                  {lowStockItems.map(item => (
                    <div key={item._id} className="bg-white border border-orange-300 rounded p-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-black">{item.name}</div>
                          <div className="text-xs text-gray-600">
                            Stock: {item.currentStock} / Par: {item.parLevel}
                          </div>
                          {item.preferredSupplier && (
                            <div className="text-xs text-gray-500">
                              📦 {item.preferredSupplier.name}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => addToCart(item)}
                          className="bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600 text-xs"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Frequently Ordered */}
            <div className="p-4">
              <h3 className="font-bold text-black mb-2">Frequently Ordered</h3>
              {frequentItems.length === 0 ? (
                <p className="text-sm text-gray-600">No items yet. Set up inventory items to enable quick reordering.</p>
              ) : (
                <div className="space-y-2">
                  {frequentItems.map(item => {
                    const isInCart = reorderCart.some(i => i._id === item._id);
                    return (
                      <div key={item._id} className="bg-gray-50 border border-gray-300 rounded p-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-black">{item.name}</div>
                            <div className="text-xs text-gray-600">
                              Par: {item.parLevel} {item.unit}
                            </div>
                            {item.preferredSupplier && (
                              <div className="text-xs text-gray-500">
                                📦 {item.preferredSupplier.name}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => addToCart(item)}
                            disabled={isInCart}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              isInCart 
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                          >
                            {isInCart ? '✓ Added' : '+ Add'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer Tips */}
          <div className="p-4 bg-gray-50 border-t border-gray-300 text-xs text-gray-600">
            💡 Tip: Set par levels in inventory to see smart reorder suggestions
          </div>
        </div>
      )}
    </div>
  );
}

