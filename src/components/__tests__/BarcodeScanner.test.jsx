/**
 * Comprehensive Tests for Barcode Scanner Component - Phase 2E (Mobile)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BarcodeScanner from '../BarcodeScanner';

// Mock BarcodeDetector API
const mockDetect = jest.fn().mockResolvedValue([]);
global.BarcodeDetector = jest.fn().mockImplementation(() => ({
  detect: mockDetect
}));

describe('BarcodeScanner Component - Phase 2E Mobile Features', () => {
  const mockOnScan = jest.fn();
  const mockOnClose = jest.fn();
  const mockGetUserMedia = jest.fn();
  const mockStop = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDetect.mockClear();
    
    // Mock video stream
    const mockStream = {
      getTracks: () => [{
        stop: mockStop
      }]
    };
    
    mockGetUserMedia.mockResolvedValue(mockStream);
    global.navigator.mediaDevices = {
      getUserMedia: mockGetUserMedia
    };
  });

  test('should render barcode scanner component', () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    expect(screen.getByText(/Scan Barcode/i)).toBeInTheDocument();
  });

  test('should show camera scan and manual entry toggle buttons', () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    expect(screen.getByText(/📷 Camera Scan/i)).toBeInTheDocument();
    expect(screen.getByText(/⌨️ Manual Entry/i)).toBeInTheDocument();
  });

  test('should show start camera button initially', () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    expect(screen.getByText(/📷 Start Camera/i)).toBeInTheDocument();
    expect(screen.getByText(/Point your camera at a barcode to scan/i)).toBeInTheDocument();
  });

  test('should start camera when button clicked', async () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'environment' }
      });
    });
  });

  test('should attach MediaStream to video element after mount (mobile black-screen fix)', async () => {
    let resolvedStream;
    mockGetUserMedia.mockImplementation(() => {
      resolvedStream = {
        getTracks: () => [{ stop: mockStop }],
      };
      return Promise.resolve(resolvedStream);
    });

    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText(/📷 Start Camera/i));

    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video.srcObject).toBe(resolvedStream);
    });
  });

  test('should run barcode detection loop after camera starts', async () => {
    const readyStateSpy = jest
      .spyOn(window.HTMLMediaElement.prototype, 'readyState', 'get')
      .mockReturnValue(4);

    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);

    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
      expect(global.BarcodeDetector).toHaveBeenCalled();
      expect(mockDetect).toHaveBeenCalled();
    });

    readyStateSpy.mockRestore();
  });

  test('should switch to manual entry mode', async () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    const manualButton = screen.getByText(/⌨️ Manual Entry/i);
    fireEvent.click(manualButton);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type or paste barcode here/i)).toBeInTheDocument();
    });
  });

  test('should submit manual barcode entry', async () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    // Switch to manual mode
    const manualButton = screen.getByText(/⌨️ Manual Entry/i);
    fireEvent.click(manualButton);
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Type or paste barcode here/i);
      fireEvent.change(input, { target: { value: '123456789012' } });
      
      const submitButton = screen.getByText(/✓ Submit/i);
      fireEvent.click(submitButton);
    });
    
    expect(mockOnScan).toHaveBeenCalledWith('123456789012');
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should prevent empty manual submission', async () => {
    global.alert = jest.fn();
    
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    // Switch to manual mode
    const manualButton = screen.getByText(/⌨️ Manual Entry/i);
    fireEvent.click(manualButton);
    
    await waitFor(() => {
      const submitButton = screen.getByText(/✓ Submit/i);
      fireEvent.click(submitButton);
    });
    
    expect(global.alert).toHaveBeenCalledWith('Please enter a barcode or SKU');
    expect(mockOnScan).not.toHaveBeenCalled();
  });

  test('should submit on Enter key in manual mode', async () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    // Switch to manual mode
    const manualButton = screen.getByText(/⌨️ Manual Entry/i);
    fireEvent.click(manualButton);
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Type or paste barcode here/i);
      expect(input).toBeInTheDocument();
    });
    
    const input = screen.getByPlaceholderText(/Type or paste barcode here/i);
    fireEvent.change(input, { target: { value: '999888777666' } });
    
    // Use keyDown instead of deprecated keyPress
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    
    await waitFor(() => {
      expect(mockOnScan).toHaveBeenCalledWith('999888777666');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  test('should close scanner when close button clicked', () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should stop camera stream on close', async () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    // Start camera
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });
    
    // Wait for stream to be initialized in state
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
    });
    
    // Close scanner
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    
    await waitFor(() => {
      expect(mockStop).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  test('should handle camera access error', async () => {
    global.alert = jest.fn();
    mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
    
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Could not access camera')
      );
    });
  });

  test('should show help text for mobile users', () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    expect(screen.getByText(/📱 Mobile Tips:/i)).toBeInTheDocument();
    expect(screen.getByText(/Allow camera permission when prompted/i)).toBeInTheDocument();
  });

  test('should show supported barcode formats', () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    expect(screen.getByText(/Works with UPC, EAN, Code 128, and Code 39 barcodes/i)).toBeInTheDocument();
  });

  test('should show manual entry tips', async () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    const manualButton = screen.getByText(/⌨️ Manual Entry/i);
    fireEvent.click(manualButton);
    
    await waitFor(() => {
      expect(screen.getByText(/💡 Tip: You can paste from clipboard or type manually/i)).toBeInTheDocument();
    });
  });

  test('should allow custom title', () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} title="Custom Scanner" />);
    
    expect(screen.getByText('Custom Scanner')).toBeInTheDocument();
  });

  test('should trim whitespace from manual entry', async () => {
    render(<BarcodeScanner onScan={mockOnScan} onClose={mockOnClose} />);
    
    // Switch to manual mode
    const manualButton = screen.getByText(/⌨️ Manual Entry/i);
    fireEvent.click(manualButton);
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Type or paste barcode here/i);
      fireEvent.change(input, { target: { value: '  12345  ' } });
      
      const submitButton = screen.getByText(/✓ Submit/i);
      fireEvent.click(submitButton);
    });
    
    expect(mockOnScan).toHaveBeenCalledWith('12345');
  });
});


