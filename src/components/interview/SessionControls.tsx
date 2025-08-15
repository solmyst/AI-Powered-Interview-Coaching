import React from 'react';
import { Mic, MicOff, Square, Pause, Play } from 'lucide-react';

type InterviewSession = {
  id: string;
  type: 'quick' | 'full' | 'technical' | 'behavioral';
  currentQuestion: number;
  questions: string[];
};

type Props = {
  session: InterviewSession;
  isRecording: boolean;
  micEnabled: boolean;
  onToggleMic: () => void;
  onStop: () => void;
};

export function SessionControls({ session, isRecording, micEnabled, onToggleMic, onStop }: Props) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Session Controls</h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-gray-300 text-sm">
            {isRecording ? 'Recording' : 'Stopped'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        {/* Microphone Toggle */}
        <button
          onClick={onToggleMic}
          className={`p-3 rounded-full ${
            micEnabled 
              ? 'bg-gray-600 hover:bg-gray-700' 
              : 'bg-red-600 hover:bg-red-700'
          } transition-colors`}
          title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {micEnabled ? (
            <Mic className="w-6 h-6 text-white" />
          ) : (
            <MicOff className="w-6 h-6 text-white" />
          )}
        </button>

        {/* Stop Interview */}
        <button
          onClick={onStop}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          title="End interview"
        >
          <Square className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Session Info */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Interview Type:</span>
            <p className="text-white font-medium capitalize">{session.type}</p>
          </div>
          <div>
            <span className="text-gray-400">Progress:</span>
            <p className="text-white font-medium">
              {session.currentQuestion + 1} / {session.questions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 flex gap-2">
        <button className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm">
          Skip Question
        </button>
        <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
          Repeat Question
        </button>
      </div>
    </div>
  );
}