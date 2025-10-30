// components/WhisperSettings.tsx
import React from 'react';

// FIX: The WhisperSettings component was based on a legacy OpenAI Whisper integration that required a user-provided API key.
// The application has been updated to use the Gemini API for transcription, which is configured centrally.
// This component is now obsolete. Its contents have been replaced with an informational message to avoid confusion
// and to fix all compilation errors related to the removed API key logic.
export const WhisperSettings: React.FC = () => {
  return (
    <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border border-border">
      <h3 className="text-lg font-bold text-foreground">Dictation Settings</h3>
      <p className="text-muted-foreground text-sm">
        This application now uses Google's Gemini API for high-accuracy dictation, which is configured centrally.
        There is no longer a need to provide a separate API key here.
      </p>
    </div>
  );
};