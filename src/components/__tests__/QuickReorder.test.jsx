/**
 * Comprehensive Tests for Quick Reorder Component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuickReorder from '../QuickReorder';
import axios from 'axios';

// Mock axios
jest.mock('axios');

describe('QuickReorder Component - Phase 2A', () => {
  const mockInventoryData = [
    {
      _id: 'item1',
      name: '2x4 Lumber',
      sku: 'LUM-2X4',
      unit: 'each',
      currentStock: 5,
      parLevel: 20,
      preferredSupplier: { _id: 'sup1', name: 'Home Depot' }
    },
    {
      _id: 'item2',
      name: 'Drywall Screws',
      sku: 'HW-SCREW',
      unit: 'box',
      currentStock: 15,
      parLevel: 10,
      preferredSupplier: { _id: 'sup1', name: 'Home Depot' }
    }
  ];

  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    jest.clearAllMocks();
    
    // Mock API calls
    axios.get.mockImplementation((url) => {
      if (url.includes('lowStock=true')) {
        return Promise.resolve({ data: [mockInventoryData[0]] });
      }
      return Promise.resolve({ data: mockInventoryData });
    });
  });

  test('should render Quick Reorder panel', async () => {
    const mockOnCreatePO = jest.fn();
    render(<QuickReorder onCreatePO={mockOnCreatePO} />);
    
    await waitFor(() => {
      expect(screen.getByText('Quick Reorder')).toBeInTheDocument();
    });
  });

  test('should fetch and display low stock items', async () => {
    const mockOnCreatePO = jest.fn();
    render(<QuickReorder onCreatePO={mockOnCreatePO} />);
    
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('lowStock=true'),
        expect.any(Object)
      );
      expect(screen.getByText(/Low Stock/i)).toBeInTheDocument();
    });
  });

  test('should add item to cart with par level quantity', async () => {
    const mockOnCreatePO = jest.fn();
    render(<QuickReorder onCreatePO={mockOnCreatePO} />);
    
    await waitFor(() => {
      const lumberItems = screen.getAllByText('2x4 Lumber');
      expect(lumberItems.length).toBeGreaterThan(0);
    });
    
    const addButtons = screen.getAllByText('+ Add');
    fireEvent.click(addButtons[0]);
    
    await waitFor(() => {
      // Check for Cart heading
      expect(screen.getByText(/Cart \(/i)).toBeInTheDocument();
      // Should add with par level quantity (20)
      const quantityInputs = screen.getAllByRole('spinbutton');
      const cartQuantity = quantityInputs.find(input => input.value === '20');
      expect(cartQuantity).toBeInTheDocument();
    });
  });

  test('should update cart item quantity', async () => {
    const mockOnCreatePO = jest.fn();
    render(<QuickReorder onCreatePO={mockOnCreatePO} />);
    
    // Add item to cart
    await waitFor(() => {
      const addButton = screen.getAllByText('+ Add')[0];
      fireEvent.click(addButton);
    });
    
    await waitFor(() => {
      const quantityInputs = screen.getAllByRole('spinbutton');
      const cartQuantity = quantityInputs.find(input => input.value === '20');
      expect(cartQuantity).toBeInTheDocument();
      
      fireEvent.change(cartQuantity, { target: { value: '30' } });
    });
    
    await waitFor(() => {
      const quantityInputs = screen.getAllByRole('spinbutton');
      const updatedQuantity = quantityInputs.find(input => input.value === '30');
      expect(updatedQuantity).toBeInTheDocument();
    });
  });

  test('should remove item from cart', async () => {
    const mockOnCreatePO = jest.fn();
    render(<QuickReorder onCreatePO={mockOnCreatePO} />);
    
    // Add item
    await waitFor(() => {
      const addButton = screen.getAllByText('+ Add')[0];
      fireEvent.click(addButton);
    });
    
    // Remove item
    await waitFor(() => {
      const removeButton = screen.getByText('✕');
      fireEvent.click(removeButton);
    });
    
    // Cart should be empty
    await waitFor(() => {
      expect(screen.queryByText(/Cart \(/i)).not.toBeInTheDocument();
    });
  });

  test('should generate PO and group by supplier', async () => {
    const mockOnCreatePO = jest.fn();
    render(<QuickReorder onCreatePO={mockOnCreatePO} />);
    
    // Add item to cart
    await waitFor(() => {
      const addButton = screen.getAllByText('+ Add')[0];
      fireEvent.click(addButton);
    });
    
    // Generate PO - find the button (not the description text)
    await waitFor(() => {
      const generateButtons = screen.getAllByText(/Generate PO/i);
      // Click the actual button element (filter by role or just use the last one which is usually the button)
      const generateButton = generateButtons.find(el => el.tagName === 'BUTTON') || generateButtons[generateButtons.length - 1];
      fireEvent.click(generateButton);
      
      expect(mockOnCreatePO).toHaveBeenCalledTimes(1);
      const callArg = mockOnCreatePO.mock.calls[0][0];
      expect(callArg['sup1']).toBeDefined();
      expect(callArg['sup1'].items).toHaveLength(1);
    });
  });

  test('should clear entire cart', async () => {
    const mockOnCreatePO = jest.fn();
    render(<QuickReorder onCreatePO={mockOnCreatePO} />);
    
    // Add items
    await waitFor(() => {
      const addButtons = screen.getAllByText('+ Add');
      fireEvent.click(addButtons[0]);
    });
    
    // Clear cart
    await waitFor(() => {
      const clearButton = screen.getByText('Clear All');
      fireEvent.click(clearButton);
    });
    
    // Cart should be empty
    await waitFor(() => {
      expect(screen.queryByText(/Cart/i)).not.toBeInTheDocument();
    });
  });

  test('should show supplier name for items', async () => {
    const mockOnCreatePO = jest.fn();
    render(<QuickReorder onCreatePO={mockOnCreatePO} />);
    
    await waitFor(() => {
      const supplierNames = screen.getAllByText(/Home Depot/i);
      expect(supplierNames.length).toBeGreaterThan(0);
    });
  });

  test('should calculate total items in cart', async () => {
    const mockOnCreatePO = jest.fn();
    render(<QuickReorder onCreatePO={mockOnCreatePO} />);
    
    // Wait for items to load
    await waitFor(() => {
      const lumberItems = screen.getAllByText('2x4 Lumber');
      expect(lumberItems.length).toBeGreaterThan(0);
    });
    
    // Add item
    const addButtons = screen.getAllByText('+ Add');
    fireEvent.click(addButtons[0]); // Adds par level quantity (20)
    
    await waitFor(() => {
      // Should show count
      expect(screen.getByText(/Cart \(20 items\)/i)).toBeInTheDocument();
    });
  });
});
