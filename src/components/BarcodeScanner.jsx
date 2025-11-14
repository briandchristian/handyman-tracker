import { useState, useRef, useEffect } from 'react';

export default function BarcodeScanner({ onScan, onClose, title = "Scan Barcode" }) {
  const [stream, setStream] = useState(null);
  const [manualEntry, setManualEntry] = useState('');
  const [useManual, setUseManual] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    // Check if Barcode Detection API is available
    if ('BarcodeDetector' in window) {
      console.log('✅ Barcode Detection API available');
    } else {
      console.log('⚠️ Barcode Detection API not available, using manual entry');
    }
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Start scanning if API available
      if ('BarcodeDetector' in window) {
        startBarcodeDetection();
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('❌ Could not access camera. Please check permissions or use manual entry.');
      setUseManual(true);
    }
  };

  const startBarcodeDetection = async () => {
    if (!('BarcodeDetector' in window)) return;

    try {
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
      });

      setScanning(true);
      
      const detectBarcode = async () => {
        if (!videoRef.current || !scanning) return;

        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          
          if (barcodes.length > 0) {
            const barcode = barcodes[0];
            console.log('Barcode detected:', barcode.rawValue);
            handleBarcodeDetected(barcode.rawValue);
            return; // Stop scanning after detection
          }
        } catch (err) {
          // Ignore detection errors, keep trying
        }

        if (scanning) {
          setTimeout(detectBarcode, 200); // Scan every 200ms
        }
      };

      detectBarcode();
    } catch (err) {
      console.error('Barcode detection error:', err);
    }
  };

  const stopCamera = () => {
    setScanning(false);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleBarcodeDetected = (code) => {
    stopCamera();
    onScan(code);
    onClose();
  };

  const handleManualSubmit = () => {
    if (!manualEntry.trim()) {
      alert('Please enter a barcode or SKU');
      return;
    }
    onScan(manualEntry.trim());
    onClose();
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-300 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-black">{title}</h2>
          <button
            onClick={handleClose}
            className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Toggle Scanner/Manual */}
        <div className="bg-gray-50 border-b border-gray-300 p-3 flex justify-center gap-3">
          <button
            onClick={() => setUseManual(false)}
            className={`px-4 py-2 rounded font-medium ${
              !useManual 
                ? 'bg-blue-500 text-white' 
                : 'bg-white text-black border border-gray-300 hover:bg-gray-100'
            }`}
          >
            📷 Camera Scan
          </button>
          <button
            onClick={() => {
              setUseManual(true);
              stopCamera();
            }}
            className={`px-4 py-2 rounded font-medium ${
              useManual 
                ? 'bg-blue-500 text-white' 
                : 'bg-white text-black border border-gray-300 hover:bg-gray-100'
            }`}
          >
            ⌨️ Manual Entry
          </button>
        </div>

        {/* Content */}
        {!useManual ? (
          <div className="relative bg-black">
            {!stream ? (
              <div className="flex flex-col items-center justify-center h-96 text-white p-8">
                <p className="text-lg mb-4 text-center">
                  Point your camera at a barcode to scan
                </p>
                <button
                  onClick={startCamera}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 font-medium text-lg"
                >
                  📷 Start Camera
                </button>
                <p className="text-sm text-gray-400 mt-4 text-center">
                  Works with UPC, EAN, Code 128, and Code 39 barcodes
                </p>
              </div>
            ) : (
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-auto"
                />
                
                {/* Scanning Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-4 border-blue-500 rounded-lg w-64 h-64 relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 animate-pulse" />
                    <p className="absolute -bottom-10 left-0 right-0 text-white text-center font-medium">
                      {scanning ? '🔍 Scanning...' : 'Position barcode in frame'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : (
          <div className="p-8">
            <div className="mb-4">
              <label htmlFor="manual-barcode" className="block text-sm font-medium text-black mb-2">
                Enter Barcode or SKU
              </label>
              <input
                id="manual-barcode"
                name="manual-barcode"
                type="text"
                value={manualEntry}
                onChange={(e) => setManualEntry(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                className="w-full p-3 border-2 border-blue-400 rounded text-black bg-white text-lg"
                placeholder="Type or paste barcode here..."
                autoFocus
              />
              <p className="text-sm text-gray-600 mt-2">
                💡 Tip: You can paste from clipboard or type manually
              </p>
            </div>

            <button
              onClick={handleManualSubmit}
              className="w-full bg-blue-500 text-white py-3 rounded hover:bg-blue-600 font-medium text-lg"
            >
              ✓ Submit
            </button>
          </div>
        )}

        {/* Help Text */}
        <div className="bg-blue-50 border-t border-blue-200 p-3 text-sm text-gray-600">
          <p className="font-medium text-black mb-1">📱 Mobile Tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Allow camera permission when prompted</li>
            <li>Hold phone steady and close to barcode</li>
            <li>Ensure good lighting for best results</li>
            <li>Use manual entry if camera not working</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

