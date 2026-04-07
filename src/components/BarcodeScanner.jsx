import { useState, useRef, useEffect } from 'react';

export default function BarcodeScanner({ onScan, onClose, title = "Scan Barcode" }) {
  const [stream, setStream] = useState(null);
  const [manualEntry, setManualEntry] = useState('');
  const [useManual, setUseManual] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const scanningRef = useRef(false);
  const detectTimeoutRef = useRef(null);

  useEffect(() => {
    // Check if Barcode Detection API is available
    if ('BarcodeDetector' in window) {
      console.log('✅ Barcode Detection API available');
    } else {
      console.log('⚠️ Barcode Detection API not available, using manual entry');
    }
  }, []);

  // Attach MediaStream after <video> mounts (setStream is async vs ref — without this, mobile shows a black box).
  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) return;
    video.srcObject = stream;
    void Promise.resolve(video.play?.()).catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera
      });
      
      setStream(mediaStream);

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

      // Keep detection state in a ref so the async loop doesn't read stale React state.
      setScanning(true);
      scanningRef.current = true;
      
      const detectBarcode = async () => {
        if (!scanningRef.current) return;
        if (!videoRef.current) {
          detectTimeoutRef.current = setTimeout(detectBarcode, 200);
          return;
        }

        // Wait until enough video data is available before attempting detection.
        if (videoRef.current.readyState < 2) {
          detectTimeoutRef.current = setTimeout(detectBarcode, 200);
          return;
        }

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

        if (scanningRef.current) {
          detectTimeoutRef.current = setTimeout(detectBarcode, 200); // Scan every 200ms
        }
      };

      detectBarcode();
    } catch (err) {
      console.error('Barcode detection error:', err);
    }
  };

  const stopCamera = () => {
    setScanning(false);
    scanningRef.current = false;
    if (detectTimeoutRef.current) {
      clearTimeout(detectTimeoutRef.current);
      detectTimeoutRef.current = null;
    }
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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-black/95 p-2 sm:p-4 py-4 sm:py-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[min(100dvh,100svh)] sm:max-h-[90vh] flex flex-col overflow-hidden my-auto min-h-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-300 p-4 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-black">{title}</h2>
          <button
            onClick={handleClose}
            className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Toggle Scanner/Manual */}
        <div className="bg-gray-50 border-b border-gray-300 p-3 flex justify-center gap-3 shrink-0">
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

        {/* Scrollable body: camera/manual + tips (avoids cut-off on small phones) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
        {!useManual ? (
          <div className="relative bg-black">
            {!stream ? (
              <div className="flex flex-col items-center justify-center min-h-[40vh] sm:min-h-[24rem] text-white p-8">
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
              <div className="relative w-full">
                {/* Sized box so mobile WebKit actually paints video frames */}
                <div className="relative w-full min-h-[220px] h-[min(55dvh,420px)] sm:h-[min(70vh,480px)] max-h-[70vh] bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {/* Scanning overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-4 border-blue-500 rounded-lg w-[min(16rem,72vw)] aspect-square max-h-[min(16rem,50vh)] relative">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 animate-pulse" />
                      <p className="absolute top-full left-0 right-0 mt-2 px-2 text-white text-center text-sm font-medium drop-shadow-md">
                        {scanning ? '🔍 Scanning...' : 'Position barcode in frame'}
                      </p>
                    </div>
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

        {/* Help Text (inside scroll region) */}
        <div className="bg-blue-50 border-t border-blue-200 p-3 text-sm text-gray-600 pb-6">
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
    </div>
  );
}

