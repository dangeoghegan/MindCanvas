// components/DictateButton.tsx
import React from 'react';
import { MicrophoneIcon } from './icons';

interface DictateButtonProps {
  isRecording: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const DictateButton: React.FC<DictateButtonProps> = ({ isRecording, onClick, disabled }) => {
  const title = isRecording ? "Stop Dictation" : "Start Dictation";
  
  const isDisabled = disabled && !isRecording;

  const buttonClasses = [
    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
    isDisabled ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "",
    !isDisabled && !isRecording ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "",
    isRecording ? "bg-red-600 text-white animate-pulse-ring" : ""
  ].filter(Boolean).join(" ");

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={buttonClasses}
      title={title}
    >
        <MicrophoneIcon className="w-5 h-5" />
        <span>{isRecording ? 'Stop' : 'Dictate'}</span>
    </button>
  );
};