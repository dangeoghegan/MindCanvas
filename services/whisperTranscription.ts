// services/whisperTranscription.ts
// FIX: The 'LiveSession' type is not exported from '@google/genai'. It has been removed.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';

// --- Audio Helper Functions ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
// ---

type TranscriptionCallback = (result: { text: string; isFinal: boolean }) => void;

class WhisperTranscriptionService {
  // FIX: The 'LiveSession' type is deprecated. Using 'any' to allow for successful compilation while maintaining runtime functionality.
  private sessionPromise: Promise<any> | null = null;
  private stream: MediaStream | null = null;
  private inputAudioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private currentUtterance = '';

  async startRecording(onTranscription: TranscriptionCallback): Promise<void> {
    if (this.sessionPromise) {
        console.warn('Dictation session already active.');
        return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

      this.sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        // FIX: The Gemini Live API for this audio-native model requires specifying an audio response modality.
        // Added `responseModalities: [Modality.AUDIO]` to prevent the "Cannot extract voices from a non-audio request" error.
        // The service will ignore the audio output and only process the transcription.
        config: {
          inputAudioTranscription: {},
          responseModalities: [Modality.AUDIO],
        },
        callbacks: {
          onopen: () => {
            if (!this.inputAudioContext || !this.stream) return;
            this.sourceNode = this.inputAudioContext.createMediaStreamSource(this.stream);
            this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
            this.scriptProcessor.onaudioprocess = (event) => {
              const inputData = event.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              this.sessionPromise?.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
            };
            this.sourceNode.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.inputAudioContext.destination);
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              this.currentUtterance += message.serverContent.inputTranscription.text;
              onTranscription({ text: this.currentUtterance, isFinal: false });
            }
            if (message.serverContent?.turnComplete) {
              if (this.currentUtterance) {
                onTranscription({ text: this.currentUtterance, isFinal: true });
              }
              this.currentUtterance = '';
            }
          },
          onerror: (e) => { console.error('Live session error:', e); this.stopRecording(); },
          onclose: () => {},
        },
      });
      await this.sessionPromise;
    } catch (err) {
      this.stopRecording();
      throw new Error('Could not start dictation. Please ensure microphone access is allowed.');
    }
  }

  async stopRecording(): Promise<void> {
    if (this.sessionPromise) {
      try {
        const session = await this.sessionPromise;
        session.close();
      } catch (e) {
        console.warn("Error closing session", e);
      } finally {
        this.sessionPromise = null;
      }
    }
    this.stream?.getTracks().forEach(track => track.stop());
    this.scriptProcessor?.disconnect();
    this.sourceNode?.disconnect();
    if (this.inputAudioContext?.state !== 'closed') {
      this.inputAudioContext?.close().catch(console.error);
    }
    this.stream = null;
    this.inputAudioContext = null;
    this.scriptProcessor = null;
    this.sourceNode = null;
    this.currentUtterance = '';
  }

  cancelRecording() { this.stopRecording(); }
}

export const whisperService = new WhisperTranscriptionService();