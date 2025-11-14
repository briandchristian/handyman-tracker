/**
 * Comprehensive Tests for Camera Capture Component - Phase 2E (Mobile)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CameraCapture from '../CameraCapture';

describe('CameraCapture Component - Phase 2E Mobile Features', () => {
  const mockOnCapture = jest.fn();
  const mockOnClose = jest.fn();
  const mockGetUserMedia = jest.fn();
  const mockStop = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
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

  afterEach(() => {
    mockStop.mockClear();
  });

  test('should render camera capture component', () => {
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    expect(screen.getByText(/Take Photo/i)).toBeInTheDocument();
  });

  test('should show start camera button initially', () => {
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    expect(screen.getByText(/📷 Start Camera/i)).toBeInTheDocument();
  });

  test('should request camera permissions when start clicked', async () => {
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'environment' }
      });
    });
  });

  test('should show error when camera access denied', async () => {
    global.alert = jest.fn();
    mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
    
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Could not access camera')
      );
    });
  });

  test('should show video preview after camera starts', async () => {
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
    });
  });

  test('should capture photo when capture button clicked', async () => {
    // Mock canvas
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      drawImage: jest.fn()
    }));
    HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/jpeg;base64,fake');
    
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    // Start camera
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });
    
    // Wait for video to load
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
    });
    
    // Find capture button - it's a big round button with camera emoji
    const buttons = screen.getAllByRole('button');
    const cameraButton = buttons.find(btn => 
      btn.textContent.trim() === '📷' && 
      btn.className.includes('rounded-full')
    );
    
    if (cameraButton) {
      fireEvent.click(cameraButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Use Photo/i)).toBeInTheDocument();
        expect(screen.getByText(/Retake/i)).toBeInTheDocument();
      });
    } else {
      // If button not found, test should still verify structure
      expect(cameraButton).toBeTruthy();
    }
  });

  test('should show captured photo preview', async () => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      drawImage: jest.fn()
    }));
    HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/jpeg;base64,fake');
    
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    // Start camera
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
    });
    
    const buttons = screen.getAllByRole('button');
    const cameraButton = buttons.find(btn => 
      btn.textContent.trim() === '📷' && 
      btn.className.includes('rounded-full')
    );
    
    if (cameraButton) {
      fireEvent.click(cameraButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Retake/i)).toBeInTheDocument();
        expect(screen.getByText(/Use Photo/i)).toBeInTheDocument();
      });
    } else {
      expect(cameraButton).toBeTruthy();
    }
  });

  test('should allow retaking photo', async () => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      drawImage: jest.fn()
    }));
    HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/jpeg;base64,fake');
    
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    // Start camera and capture
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const cameraButton = buttons.find(btn => 
        btn.textContent === '📷' && 
        btn.className.includes('rounded-full')
      );
      
      if (cameraButton) {
        fireEvent.click(cameraButton);
      }
    });
    
    // Wait for video
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
    });
    
    // Click retake
    await waitFor(() => {
      const retakeButton = screen.getByText(/Retake/i);
      fireEvent.click(retakeButton);
    });
    
    // Should show start camera again
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledTimes(2); // Once for initial, once for retake
    });
  });

  test('should confirm and use captured photo', async () => {
    const fakeImage = 'data:image/jpeg;base64,fakeimagedata';
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      drawImage: jest.fn()
    }));
    HTMLCanvasElement.prototype.toDataURL = jest.fn(() => fakeImage);
    
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    // Start camera
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
    });
    
    // Capture photo
    const buttons = screen.getAllByRole('button');
    const cameraButton = buttons.find(btn => 
      btn.textContent.trim() === '📷' && 
      btn.className.includes('rounded-full')
    );
    
    if (cameraButton) {
      fireEvent.click(cameraButton);
      
      // Confirm photo
      await waitFor(() => {
        const useButton = screen.getByText(/Use Photo/i);
        fireEvent.click(useButton);
      });
      
      expect(mockOnCapture).toHaveBeenCalledWith(fakeImage);
      expect(mockOnClose).toHaveBeenCalled();
    } else {
      expect(cameraButton).toBeTruthy();
    }
  });

  test('should close camera and stop stream', async () => {
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });
    
    // Wait for video to be set up
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
    });
    
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    
    await waitFor(() => {
      expect(mockStop).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  test('should cleanup on unmount', async () => {
    const { unmount } = render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });
    
    // Wait for video to be set up
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
    });
    
    unmount();
    
    await waitFor(() => {
      expect(mockStop).toHaveBeenCalled();
    });
  });

  test('should show cancel button when no photo captured', () => {
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
  });

  test('should allow custom title', () => {
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} title="Custom Camera" />);
    
    expect(screen.getByText('Custom Camera')).toBeInTheDocument();
  });

  test('should request back camera (environment) by default', async () => {
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'environment' }
      });
    });
  });

  test('should handle camera errors gracefully', async () => {
    global.alert = jest.fn();
    mockGetUserMedia.mockRejectedValueOnce(new Error('Camera not found'));
    
    render(<CameraCapture onCapture={mockOnCapture} onClose={mockOnClose} />);
    
    const startButton = screen.getByText(/📷 Start Camera/i);
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalled();
    });
  });
});
