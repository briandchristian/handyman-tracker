import { useState, useRef, useEffect, useCallback } from 'react';

/** Best-effort continuous / auto focus on devices that support constraint hints (often Android Chrome). */
async function tryApplyContinuousFocus(track) {
  if (!track?.applyConstraints) return;
  const attempts = [
    () => track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }),
    () => track.applyConstraints({ focusMode: 'continuous' }),
  ];
  for (const run of attempts) {
    try {
      await run();
      return;
    } catch {
      /* ignore — not supported on this browser/device */
    }
  }
}

/** Single-shot refocus (tap-to-focus style) when the device supports it. */
async function tryApplySingleShotFocus(track) {
  if (!track?.applyConstraints) return;
  const attempts = [
    () => track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] }),
    () => track.applyConstraints({ focusMode: 'single-shot' }),
  ];
  for (const run of attempts) {
    try {
      await run();
      return;
    } catch {
      /* ignore */
    }
  }
}

async function tryApplyCameraZoom(track, zoom, zoomCaps) {
  if (!track?.applyConstraints || zoomCaps == null || typeof zoom !== 'number') return;
  const z = Math.min(Math.max(zoom, zoomCaps.min), zoomCaps.max);
  try {
    await track.applyConstraints({ advanced: [{ zoom: z }] });
  } catch {
    try {
      await track.applyConstraints({ zoom: z });
    } catch {
      /* ignore */
    }
  }
}

function getVideoTrackFromStream(mediaStream) {
  if (!mediaStream) return null;
  if (typeof mediaStream.getVideoTracks === 'function') {
    return mediaStream.getVideoTracks()[0] ?? null;
  }
  if (typeof mediaStream.getTracks === 'function') {
    const tracks = mediaStream.getTracks();
    return tracks.find((t) => t.kind === 'video') ?? tracks[0] ?? null;
  }
  return null;
}

export default function BarcodeScanner({ onScan, onClose, title = "Scan Barcode" }) {
  const [stream, setStream] = useState(null);
  const [manualEntry, setManualEntry] = useState('');
  const [useManual, setUseManual] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const scanningRef = useRef(false);
  const detectTimeoutRef = useRef(null);
  const videoTrackRef = useRef(null);
  const detectionMagRef = useRef(1);

  /** 1 = full frame; larger = tighter center crop, scaled up for BarcodeDetector (helps tiny codes). */
  const [detectionMagnification, setDetectionMagnification] = useState(1);
  detectionMagRef.current = detectionMagnification;
  const [zoomCaps, setZoomCaps] = useState(null);
  const [cameraZoom, setCameraZoom] = useState(null);

  useEffect(() => {
    if ('BarcodeDetector' in window) {
      console.log('✅ Barcode Detection API available');
    } else {
      console.log('⚠️ Barcode Detection API not available, using manual entry');
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) return;
    video.srcObject = stream;
    void Promise.resolve(video.play?.()).catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    if (!stream) {
      videoTrackRef.current = null;
      setZoomCaps(null);
      setCameraZoom(null);
      return;
    }
    const track = getVideoTrackFromStream(stream);
    videoTrackRef.current = track || null;
    if (!track || typeof track.getCapabilities !== 'function') {
      setZoomCaps(null);
      setCameraZoom(null);
      return;
    }
    const caps = track.getCapabilities() || {};
    if (caps.zoom && typeof caps.zoom.min === 'number' && typeof caps.zoom.max === 'number') {
      setZoomCaps(caps.zoom);
      setCameraZoom((prev) => {
        if (prev != null) {
          return Math.min(Math.max(prev, caps.zoom.min), caps.zoom.max);
        }
        return caps.zoom.min;
      });
    } else {
      setZoomCaps(null);
      setCameraZoom(null);
    }
    void tryApplyContinuousFocus(track);
  }, [stream]);

  useEffect(() => {
    const track = videoTrackRef.current;
    if (!track || !zoomCaps || cameraZoom == null) return;
    void tryApplyCameraZoom(track, cameraZoom, zoomCaps);
  }, [stream, zoomCaps, cameraZoom]);

  const refocusCamera = useCallback(() => {
    const track = videoTrackRef.current;
    void tryApplySingleShotFocus(track);
    void tryApplyContinuousFocus(track);
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      setStream(mediaStream);

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
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
      });

      setScanning(true);
      scanningRef.current = true;

      const detectBarcode = async () => {
        if (!scanningRef.current) return;
        const video = videoRef.current;
        if (!video) {
          detectTimeoutRef.current = setTimeout(detectBarcode, 200);
          return;
        }

        if (video.readyState < 2) {
          detectTimeoutRef.current = setTimeout(detectBarcode, 200);
          return;
        }

        try {
          const canvas = canvasRef.current;
          const mag = detectionMagRef.current;
          let source = video;

          if (mag > 1 && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const cropW = vw / mag;
            const cropH = vh / mag;
            const sx = (vw - cropW) / 2;
            const sy = (vh - cropH) / 2;
            const maxSide = 1280;
            let outW = vw;
            let outH = vh;
            if (outW > maxSide) {
              outH = Math.round((maxSide / outW) * outH);
              outW = maxSide;
            }
            canvas.width = outW;
            canvas.height = outH;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, outW, outH);
              source = canvas;
            }
          }

          const barcodes = await barcodeDetector.detect(source);

          if (barcodes.length > 0) {
            const barcode = barcodes[0];
            console.log('Barcode detected:', barcode.rawValue);
            handleBarcodeDetected(barcode.rawValue);
            return;
          }
        } catch {
          /* keep trying */
        }

        if (scanningRef.current) {
          detectTimeoutRef.current = setTimeout(detectBarcode, 200);
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
      stream.getTracks().forEach((track) => track.stop());
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
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-black/95 p-2 sm:p-4 py-4 sm:py-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[min(100dvh,100svh)] sm:max-h-[90vh] flex flex-col overflow-hidden my-auto min-h-0">
        <div className="bg-white border-b border-gray-300 p-4 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-black">{title}</h2>
          <button
            onClick={handleClose}
            className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

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
                  <div className="relative w-full min-h-[220px] h-[min(55dvh,420px)] sm:h-[min(70vh,480px)] max-h-[70vh] bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="border-4 border-blue-500 rounded-lg w-[min(16rem,72vw)] aspect-square max-h-[min(16rem,50vh)] relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 animate-pulse" />
                        <p className="absolute top-full left-0 right-0 mt-2 px-2 text-white text-center text-sm font-medium drop-shadow-md">
                          {scanning ? '🔍 Scanning...' : 'Position barcode in frame'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900 text-white px-3 py-3 space-y-3 border-t border-gray-800">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-200" htmlFor="scan-zoom-range">
                        Scan zoom — magnify center for small barcodes
                      </label>
                      <input
                        id="scan-zoom-range"
                        aria-label="Scan zoom (magnify small barcodes)"
                        type="range"
                        min={1}
                        max={3}
                        step={0.5}
                        value={detectionMagnification}
                        onChange={(e) => setDetectionMagnification(parseFloat(e.target.value))}
                        className="w-full accent-blue-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {detectionMagnification}x on the center region for detection (preview unchanged)
                      </p>
                    </div>

                    {zoomCaps != null && cameraZoom != null && (
                      <div>
                        <label
                          className="block text-xs font-medium mb-1 text-gray-200"
                          htmlFor="camera-zoom-range"
                        >
                          Camera zoom (optical — when your device supports it)
                        </label>
                        <input
                          id="camera-zoom-range"
                          aria-label="Camera zoom (optical, when supported)"
                          type="range"
                          min={zoomCaps.min}
                          max={zoomCaps.max}
                          step={zoomCaps.step && zoomCaps.step > 0 ? zoomCaps.step : 0.1}
                          value={cameraZoom}
                          onChange={(e) => setCameraZoom(parseFloat(e.target.value))}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={refocusCamera}
                      className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                    >
                      Refocus camera
                    </button>
                    <p className="text-xs text-gray-500">
                      Refocus asks the device to adjust focus again (works on some Android phones; iOS may ignore).
                    </p>
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

          <div className="bg-blue-50 border-t border-blue-200 p-3 text-sm text-gray-600 pb-6">
            <p className="font-medium text-black mb-1">📱 Mobile Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Allow camera permission when prompted</li>
              <li>Hold phone steady and close to barcode</li>
              <li>Turn up Scan zoom for tiny labels; use Camera zoom if your phone offers it</li>
              <li>Tap Refocus if the image looks soft</li>
              <li>Use manual entry if camera not working</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
