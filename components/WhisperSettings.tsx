// components/WhisperSettings.tsx
import React from 'react';

// FIX: The WhisperSettings component was based on a legacy OpenAI Whisper integration that required a user-provided API key.
// The application has been updated to use the Gemini API for transcription, which is configured centrally.
// This component is now obsolete. Its contents have been replaced with an informational message to avoid confusion
// and to fix all compilation errors related to the removed API key logic.
export const WhisperSettings: React.FC = () => {
  return (
    <div className="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <h3 className="text-lg font-bold text-gray-200">Dictation Settings</h3>
      <p className="text-gray-400 text-sm">
        This application now uses Google's Gemini API for high-accuracy dictation, which is configured centrally.
        There is no longer a need to provide a separate API key here.
      </p>
    </div>
  );
};
