import { Camera, CameraOff, Eye } from 'lucide-react';

type Props = {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  cameraEnabled: boolean;
  onToggleCamera: () => void;
  faceDetected: boolean;
  eyeContact: number;
};

export function VideoFeed({ videoRef, canvasRef, cameraEnabled, onToggleCamera, faceDetected, eyeContact }: Props) {
  return (
    <div className="relative group w-full h-full min-h-[240px]">
      {cameraEnabled ? (
        <div className="relative aspect-video w-full h-full bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {/* MediaPipe face landmark overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>
      ) : (
        <div className="aspect-video flex items-center justify-center bg-gray-900/50">
          <div className="text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
              <CameraOff className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-500 text-sm font-medium">Camera Disabled</p>
          </div>
        </div>
      )}

      {/* Camera Toggle Button */}
      <button
        onClick={onToggleCamera}
        className={`absolute bottom-4 right-4 p-2 rounded-full ${
          cameraEnabled 
            ? 'bg-gray-600 hover:bg-gray-700' 
            : 'bg-red-600 hover:bg-red-700'
        } transition-colors`}
      >
        {cameraEnabled ? (
          <Camera className="w-5 h-5 text-white" />
        ) : (
          <CameraOff className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Recording Indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        <span className="text-white text-sm font-medium">Recording</span>
      </div>

      {/* AI Analysis Status */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-50 rounded-lg p-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${faceDetected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-white text-xs">
            {faceDetected ? 'AI Tracking' : 'No Face'}
          </span>
        </div>
      </div>

      {/* Eye Contact Indicator - shows on video */}
      {faceDetected && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <Eye className={`w-4 h-4 ${eyeContact >= 70 ? 'text-green-400' : eyeContact >= 40 ? 'text-yellow-400' : 'text-red-400'}`} />
          <span className={`text-sm font-medium ${eyeContact >= 70 ? 'text-green-400' : eyeContact >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
            {eyeContact}%
          </span>
        </div>
      )}
    </div>
  );
}