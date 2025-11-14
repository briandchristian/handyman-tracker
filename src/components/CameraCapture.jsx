import { useState, useRef, useEffect } from 'react';

export default function CameraCapture({ onCapture, onClose, title = "Take Photo" }) {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      
      setStream(mediaStream);
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('❌ Could not access camera. Please check permissions.');
    }
  };

  // Effect to set video srcObject when stream is available
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);
    stopCamera();
  };

  const retake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      stopCamera();
      onClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  // Cleanup effect to stop camera when component unmounts or stream changes
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
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

        {/* Camera View */}
        <div className="relative bg-black">
          {!stream && !capturedImage && (
            <div className="flex items-center justify-center h-96 text-white">
              <button
                onClick={startCamera}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 font-medium text-lg"
              >
                📷 Start Camera
              </button>
            </div>
          )}

          {stream && !capturedImage && (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto"
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 bg-white rounded-full border-4 border-blue-500 hover:bg-gray-100 flex items-center justify-center text-3xl"
                >
                  📷
                </button>
              </div>
            </div>
          )}

          {capturedImage && (
            <div className="relative">
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-auto"
              />
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 border-t border-gray-300 p-4 flex justify-center gap-3">
          {capturedImage ? (
            <>
              <button
                onClick={retake}
                className="px-6 py-3 border border-gray-300 rounded text-black bg-white hover:bg-gray-100 font-medium"
              >
                🔄 Retake
              </button>
              <button
                onClick={confirm}
                className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600 font-medium"
              >
                ✓ Use Photo
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="px-6 py-3 border border-gray-300 rounded text-black bg-white hover:bg-gray-100 font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

