/**
 * Comprehensive Tests for Inventory Component - Phase 2C
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Inventory from '../Inventory';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('Inventory Component - Phase 2C', () => {
  const mockInventoryData = [
    {
      _id: 'item1',
      name: '2x4 Lumber',
      sku: 'LUM-2X4',
      description: 'Standard 2x4 lumber 8ft',
      category: 'Lumber',
      currentStock: 50,
      unit: 'each',
      parLevel: 50,
      autoReorder: true,
      preferredSupplier: { _id: 'sup1', name: 'Home Depot' },
      lastRestocked: '2024-11-01T00:00:00.000Z'
    },
    {
      _id: 'item2',
      name: 'Drywall Screws',
      sku: 'HW-SCREW',
      description: '#6 x 1-1/4" drywall screws',
      category: 'Hardware',
      currentStock: 5,
      unit: 'box',
      parLevel: 20,
      autoReorder: false,
      preferredSupplier: { _id: 'sup2', name: "Lowe's" },
      lastRestocked: '2024-10-15T00:00:00.000Z'
    },
    {
      _id: 'item3',
      name: 'Paint Primer',
      sku: 'PAINT-PRIM',
      description: 'Interior latex primer',
      category: 'Paint',
      currentStock: 0,
      unit: 'gallon',
      parLevel: 10,
      autoReorder: true
    }
  ];

  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();
    global.alert = jest.fn();
    global.confirm = jest.fn(() => true);
    
    // Mock API calls - Inventory fetches both inventory and suppliers
    axios.get.mockImplementation((url) => {
      if (url.includes('/suppliers')) {
        return Promise.resolve({ 
          data: { 
            suppliers: [
              { _id: 'sup1', name: 'Home Depot' },
              { _id: 'sup2', name: "Lowe's" }
            ], 
            stats: {} 
          } 
        });
      }
      // Default: return inventory data
      return Promise.resolve({ data: mockInventoryData });
    });
    axios.put.mockResolvedValue({ data: { msg: 'Stock updated' } });
    axios.post.mockResolvedValue({ 
      data: { 
        _id: 'newItem', 
        name: 'New Item', 
        currentStock: 10 
      } 
    });
  });

  test('should render inventory page with items', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      expect(screen.getByText('2x4 Lumber')).toBeInTheDocument();
      expect(screen.getByText('Drywall Screws')).toBeInTheDocument();
    });
  });

  test('should display stock status badges correctly', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      // Check for stock status badges in the table (with emojis)
      expect(screen.getByText('✓ Good Stock')).toBeInTheDocument();
      expect(screen.getByText('⚠️ Low Stock')).toBeInTheDocument();
      expect(screen.getByText('❌ Out of Stock')).toBeInTheDocument();
    });
  });

  test('should show auto-reorder status', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      expect(screen.getByText('2x4 Lumber')).toBeInTheDocument();
    });
    
    // Auto-reorder is shown in stats card and table header
    const autoReorderTexts = screen.getAllByText('Auto-Reorder');
    expect(autoReorderTexts.length).toBeGreaterThan(0);
    
    // Stats show 2 items with auto-reorder enabled
    const statsNumbers = screen.getAllByText('2');
    expect(statsNumbers.length).toBeGreaterThan(0);
  });

  test('should open adjust stock modal when clicked', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      expect(screen.getByText('2x4 Lumber')).toBeInTheDocument();
    });
    
    const adjustButtons = screen.getAllByTitle('Adjust stock');
    fireEvent.click(adjustButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Adjust Stock')).toBeInTheDocument();
      expect(screen.getByText(/Current Stock:/i)).toBeInTheDocument();
    });
  });

  test('should add stock to inventory', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      expect(screen.getByText('2x4 Lumber')).toBeInTheDocument();
    });
    
    // Open modal
    const adjustButtons = screen.getAllByTitle('Adjust stock');
    fireEvent.click(adjustButtons[0]);
    
    // Enter adjustment amount
    await waitFor(() => {
      const quantityInput = screen.getByPlaceholderText(/Enter quantity/i);
      fireEvent.change(quantityInput, { target: { value: '10' } });
    });
    
    // Click Add Stock button
    const addButtons = screen.getAllByText(/➕ Add Stock/i);
    const addButton = addButtons.find(btn => btn.tagName === 'BUTTON');
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('item1'),
        expect.objectContaining({
          currentStock: 60 // 50 + 10
        }),
        expect.any(Object)
      );
    });
  });

  test('should remove stock from inventory', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      expect(screen.getByText('2x4 Lumber')).toBeInTheDocument();
    });
    
    // Open modal
    const adjustButtons = screen.getAllByTitle('Adjust stock');
    fireEvent.click(adjustButtons[0]);
    
    // Switch to Remove mode
    await waitFor(() => {
      const removeRadio = screen.getByLabelText(/Remove/i);
      fireEvent.click(removeRadio);
    });
    
    // Enter adjustment amount
    await waitFor(() => {
      const quantityInput = screen.getByPlaceholderText(/Enter quantity/i);
      fireEvent.change(quantityInput, { target: { value: '5' } });
    });
    
    // Add reason if field exists
    const reasonInputs = screen.queryAllByPlaceholderText(/reason/i);
    if (reasonInputs.length > 0) {
      fireEvent.change(reasonInputs[0], { target: { value: 'Used on project' } });
    }
    
    // Click Remove Stock button
    const removeButtons = screen.getAllByText(/➖ Remove Stock/i);
    const removeButton = removeButtons.find(btn => btn.tagName === 'BUTTON');
    fireEvent.click(removeButton);
    
    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('item1'),
        expect.objectContaining({
          currentStock: 45 // 50 - 5
        }),
        expect.any(Object)
      );
    });
  });

  test('should adjust stock with add or remove', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      expect(screen.getByText('2x4 Lumber')).toBeInTheDocument();
    });
    
    // Open modal
    const adjustButtons = screen.getAllByTitle('Adjust stock');
    fireEvent.click(adjustButtons[0]);
    
    // Modal opens showing current stock
    await waitFor(() => {
      expect(screen.getByText('Adjust Stock')).toBeInTheDocument();
      expect(screen.getByText(/Current Stock/i)).toBeInTheDocument();
    });
    
    // Component supports add/remove operations
    expect(screen.getByText(/➕ Add Stock \(Restock\)/i)).toBeInTheDocument();
    expect(screen.getByText(/➖ Remove Stock/i)).toBeInTheDocument();
  });

  test('should filter inventory by category', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      const categoryFilter = screen.getByLabelText(/Category/i);
      fireEvent.change(categoryFilter, { target: { value: 'Lumber' } });
    });
    
    await waitFor(() => {
      expect(screen.getByText('2x4 Lumber')).toBeInTheDocument();
      expect(screen.queryByText('Drywall Screws')).not.toBeInTheDocument();
    });
  });

  test('should filter inventory by stock status', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      const stockFilter = screen.getByLabelText(/Stock Status/i);
      fireEvent.change(stockFilter, { target: { value: 'low' } });
    });
    
    await waitFor(() => {
      // Should show low and out of stock items when filtering by 'low'
      expect(screen.getByText('Drywall Screws')).toBeInTheDocument();
      expect(screen.getByText('Paint Primer')).toBeInTheDocument();
      // Should not show Good Stock item
      expect(screen.queryByText('2x4 Lumber')).not.toBeInTheDocument();
    });
  });

  test('should search inventory by name or SKU', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/Search by name or SKU/i);
      fireEvent.change(searchInput, { target: { value: 'LUM' } });
    });
    
    await waitFor(() => {
      expect(screen.getByText('2x4 Lumber')).toBeInTheDocument();
      expect(screen.queryByText('Drywall Screws')).not.toBeInTheDocument();
    });
  });

  test('should toggle auto-reorder', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      expect(screen.getByText('2x4 Lumber')).toBeInTheDocument();
    });
    
    // Open edit modal
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    
    await waitFor(() => {
      const autoReorderCheckbox = screen.getByLabelText(/Enable Auto-Reorder/i);
      fireEvent.click(autoReorderCheckbox);
      
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);
    });
    
    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('item1'),
        expect.objectContaining({
          autoReorder: false // Was true, toggled to false
        }),
        expect.any(Object)
      );
    });
  });

  test('should update par level', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      expect(screen.getByText('2x4 Lumber')).toBeInTheDocument();
    });
    
    // Open edit modal
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    
    await waitFor(() => {
      // Use ID to get the specific input field for par level
      const parLevelInput = document.getElementById('par-level');
      fireEvent.change(parLevelInput, { target: { value: '75' } });
      
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);
    });
    
    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('item1'),
        expect.objectContaining({
          parLevel: 75
        }),
        expect.any(Object)
      );
    });
  });

  test('should show statistics for inventory', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      expect(screen.getByText('2x4 Lumber')).toBeInTheDocument();
    });
    
    // Check statistics are displayed
    await waitFor(() => {
      // Total Items
      expect(screen.getByText('3')).toBeInTheDocument();
      // Auto-Reorder count (2 items)
      const autoReorderStats = screen.getAllByText('2').filter(el => 
        el.className.includes('font-bold')
      );
      expect(autoReorderStats.length).toBeGreaterThan(0);
    });
  });

  test('should prevent negative stock', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Drywall Screws')).toBeInTheDocument();
    });
    
    // Open modal for item with 5 stock
    const adjustButtons = screen.getAllByTitle('Adjust stock');
    fireEvent.click(adjustButtons[1]); // Drywall Screws with 5 stock
    
    // Switch to Remove mode
    await waitFor(() => {
      const removeRadio = screen.getByLabelText(/Remove/i);
      fireEvent.click(removeRadio);
    });
    
    // Try to remove more than available
    await waitFor(() => {
      const quantityInput = screen.getByPlaceholderText(/Enter quantity/i);
      fireEvent.change(quantityInput, { target: { value: '10' } });
    });
    
    const removeButtons = screen.getAllByText(/➖ Remove Stock/i);
    const removeButton = removeButtons.find(btn => btn.tagName === 'BUTTON');
    fireEvent.click(removeButton);
    
    // Component should either prevent negative stock or show validation
    // The actual behavior depends on implementation
    await waitFor(() => {
      // If axios.put was called, stock should not be negative
      if (axios.put.mock.calls.length > 0) {
        const lastCall = axios.put.mock.calls[axios.put.mock.calls.length - 1];
        expect(lastCall[1].currentStock).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test('should show preferred supplier', async () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    await waitFor(() => {
      expect(screen.getByText(/Home Depot/i)).toBeInTheDocument();
      expect(screen.getByText(/Lowe's/i)).toBeInTheDocument();
    });
  });
});
