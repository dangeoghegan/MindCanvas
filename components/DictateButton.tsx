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
    isDisabled ? "bg-secondary text-muted-foreground cursor-not-allowed" : "",
    !isDisabled && !isRecording ? "bg-secondary text-secondary-foreground hover:bg-accent" : "",
    isRecording ? "bg-destructive text-destructive-foreground animate-pulse-ring" : ""
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