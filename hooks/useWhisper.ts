// hooks/useWhisper.ts
import { useState, useCallback, useEffect } from 'react';
import { whisperService } from '../services/whisperTranscription';

type TranscriptionResult = { text: string; isFinal: boolean };

export const useWhisper = (onTranscription: (result: TranscriptionResult) => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      await whisperService.startRecording(onTranscription);
      setIsRecording(true);
    } catch (err: any) {
      setError(err.message || 'Failed to start recording.');
      setIsRecording(false);
    }
  }, [onTranscription]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;
    try {
      await whisperService.stopRecording();
    } catch (err: any) {
      setError(err.message || 'Failed to stop recording properly.');
    } finally {
      setIsRecording(false);
    }
  }, [isRecording]);

  useEffect(() => {
    return () => {
      // Ensure session is closed on unmount
      whisperService.stopRecording();
    };
  }, []);

  return {
    isRecording,
    error,
    startRecording,
    stopRecording,
  };
};