import React from 'react';
import { Camera, CameraOff } from 'lucide-react';

type Props = {
  videoRef: React.RefObject<HTMLVideoElement>;
  cameraEnabled: boolean;
  onToggleCamera: () => void;
};

export function VideoFeed({ videoRef, cameraEnabled, onToggleCamera }: Props) {
  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden">
      {cameraEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-64 object-cover"
        />
      ) : (
        <div className="w-full h-64 flex items-center justify-center bg-gray-700">
          <div className="text-center">
            <CameraOff className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Camera is off</p>
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

      {/* AI Analysis Overlay */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-50 rounded-lg p-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-white text-xs">AI Analyzing</span>
        </div>
      </div>
    </div>
  );
}