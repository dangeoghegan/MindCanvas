import React, { useState, useRef, useEffect } from 'react';
import { Note, ContentBlockType, ChecklistItem, VoiceName } from '../types';
import { StopIcon, SpinnerIcon } from './icons';
// FIX: The 'LiveSession' type is not exported from '@google/genai'. It has been removed.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { getConversationalSystemInstruction } from '../services/geminiService';

// --- Start of Audio Helper Functions ---
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
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
// --- End of Audio Helper Functions ---

interface ConversationModeOverlayProps {
  notes: Note[];
  selectedVoice: VoiceName;
  onClose: () => void;
}

const getNoteContentAsString = (note: Note): string => {
    const contentText = note.content.map(block => {
        switch (block.type) {
            case ContentBlockType.HEADER:
            case ContentBlockType.TEXT: return block.content.text || '';
            case ContentBlockType.CHECKLIST: return (block.content.items || []).map((item: ChecklistItem) => `- ${item.text}`).join('\n');
            case ContentBlockType.IMAGE:
            case ContentBlockType.VIDEO: return block.content.description ? `[${block.type}: ${block.content.description}]` : '';
            default: return '';
        }
    }).filter(text => text.trim() !== '').join('\n');
    if (!contentText.trim()) return '';
    return `## Note: ${note.title || 'Untitled Note'}\n\n${contentText}`;
};

type ConversationState = 'idle' | 'connecting' | 'active';
type TranscriptionLogEntry = { id: string; role: 'user' | 'model'; text: string };

export const ConversationModeOverlay: React.FC<ConversationModeOverlayProps> = ({ notes, selectedVoice, onClose }) => {
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [liveTranscript, setLiveTranscript] = useState<TranscriptionLogEntry[]>([]);

  // FIX: The 'LiveSession' type is deprecated. Using 'any' to allow for successful compilation while maintaining runtime functionality.
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioResourcesRef = useRef<{
      stream: MediaStream | null, inputAudioContext: AudioContext | null, outputAudioContext: AudioContext | null,
      scriptProcessor: ScriptProcessorNode | null, sourceNode: MediaStreamAudioSourceNode | null, outputGainNode: GainNode | null,
      playbackSources: Set<AudioBufferSourceNode>, nextStartTime: number,
  }>({ stream: null, inputAudioContext: null, outputAudioContext: null, scriptProcessor: null, sourceNode: null, outputGainNode: null, playbackSources: new Set(), nextStartTime: 0 });
  const transcriptRefs = useRef({ currentInput: '', currentOutput: '' });

  const stopConversation = async () => {
    if (sessionPromiseRef.current) {
        try {
            const session = await sessionPromiseRef.current;
            session.close();
        } catch (e) {
            console.warn("Error closing session", e);
        } finally {
            sessionPromiseRef.current = null;
        }
    }
    const { stream, inputAudioContext, outputAudioContext, scriptProcessor, sourceNode, playbackSources } = audioResourcesRef.current;
    stream?.getTracks().forEach(track => track.stop());
    playbackSources.forEach(source => { try { source.stop(); } catch(e){} });
    scriptProcessor?.disconnect();
    sourceNode?.disconnect();
    if (inputAudioContext?.state !== 'closed') inputAudioContext.close();
    if (outputAudioContext?.state !== 'closed') outputAudioContext.close();
    audioResourcesRef.current = { stream: null, inputAudioContext: null, outputAudioContext: null, scriptProcessor: null, sourceNode: null, outputGainNode: null, playbackSources: new Set(), nextStartTime: 0 };
    setConversationState('idle');
    onClose();
  };

  useEffect(() => {
    const startConversation = async () => {
      setConversationState('connecting');
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioResourcesRef.current.stream = stream;

          const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          audioResourcesRef.current.inputAudioContext = inputAudioContext;
          audioResourcesRef.current.outputAudioContext = outputAudioContext;
          
          const outputGainNode = outputAudioContext.createGain();
          outputGainNode.connect(outputAudioContext.destination);
          audioResourcesRef.current.outputGainNode = outputGainNode;
          
          const notesContext = notes.map(getNoteContentAsString).join('\n\n---\n\n');
          const systemInstruction = getConversationalSystemInstruction(notesContext);

          sessionPromiseRef.current = ai.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-09-2025',
              config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
                  inputAudioTranscription: {},
                  outputAudioTranscription: {},
                  systemInstruction,
              },
              callbacks: {
                  onopen: () => {
                      setConversationState('active');
                      const source = inputAudioContext.createMediaStreamSource(stream);
                      const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                      audioResourcesRef.current.sourceNode = source;
                      audioResourcesRef.current.scriptProcessor = scriptProcessor;

                      scriptProcessor.onaudioprocess = (event) => {
                          const inputData = event.inputBuffer.getChannelData(0);
                          const pcmBlob = createBlob(inputData);
                          sessionPromiseRef.current?.then((session) => {
                              if (session) session.sendRealtimeInput({ media: pcmBlob });
                          });
                      };
                      source.connect(scriptProcessor);
                      scriptProcessor.connect(inputAudioContext.destination);
                  },
                  onmessage: async (message: LiveServerMessage) => {
                      if (message.serverContent?.interrupted) {
                          for (const source of audioResourcesRef.current.playbackSources) {
                              try { source.stop(); } catch (e) {}
                          }
                          audioResourcesRef.current.playbackSources.clear();
                          audioResourcesRef.current.nextStartTime = 0;
                      }

                      const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                      if (audioData) {
                          const { outputAudioContext, outputGainNode, playbackSources } = audioResourcesRef.current;
                          if (!outputAudioContext || !outputGainNode) return;
                          if (outputAudioContext.state === 'suspended') await outputAudioContext.resume();

                          let { nextStartTime } = audioResourcesRef.current;
                          nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);

                          const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
                          const source = outputAudioContext.createBufferSource();
                          source.buffer = audioBuffer;
                          source.connect(outputGainNode);
                          source.addEventListener('ended', () => playbackSources.delete(source));
                          source.start(nextStartTime);
                          audioResourcesRef.current.nextStartTime = nextStartTime + audioBuffer.duration;
                          playbackSources.add(source);
                      }

                      if (message.serverContent?.inputTranscription) {
                          transcriptRefs.current.currentInput += message.serverContent.inputTranscription.text;
                          setLiveTranscript(prev => {
                              const last = prev[prev.length - 1];
                              if (last && last.role === 'user') return [...prev.slice(0, -1), { ...last, text: transcriptRefs.current.currentInput }];
                              return [...prev, { id: self.crypto.randomUUID(), role: 'user', text: transcriptRefs.current.currentInput }];
                          });
                      }

                      if (message.serverContent?.outputTranscription) {
                          transcriptRefs.current.currentOutput += message.serverContent.outputTranscription.text;
                          setLiveTranscript(prev => {
                              const last = prev[prev.length - 1];
                              if (last && last.role === 'model') return [...prev.slice(0, -1), { ...last, text: transcriptRefs.current.currentOutput }];
                              return [...prev, { id: self.crypto.randomUUID(), role: 'model', text: transcriptRefs.current.currentOutput }];
                          });
                      }
                      
                      if (message.serverContent?.turnComplete) {
                          transcriptRefs.current = { currentInput: '', currentOutput: '' };
                      }
                  },
                  onerror: (e) => { console.error('Live session error:', e); stopConversation(); },
                  onclose: () => { stopConversation(); },
              },
          });
      } catch (err) {
          console.error("Error starting conversation:", err);
          alert("Microphone access might be denied. Please check your browser settings.");
          stopConversation();
      }
    };
    startConversation();
    return () => { stopConversation(); };
  }, [notes, selectedVoice, onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-end p-4 view-container-animation">
        <div className="w-full max-w-3xl flex-1 flex flex-col justify-end overflow-hidden pb-4">
            <div className="overflow-y-auto">
                {liveTranscript.length === 0 && conversationState === 'active' && (
                    <p className="text-center text-4xl font-light text-muted-foreground animate-pulse">Listening...</p>
                )}
                {liveTranscript.map((log) => (
                    <div key={log.id} className={`text-left text-2xl mb-4 font-light animate-fade-in ${log.role === 'user' ? 'text-foreground' : 'text-primary'}`}>
                        <span className="font-semibold">{log.role === 'user' ? 'You: ' : 'AI: '}</span>
                        <span>{log.text}</span>
                    </div>
                ))}
            </div>
        </div>
        
        <div className="relative flex items-center justify-center w-full h-40">
            {conversationState === 'active' && (
                <div className="absolute w-40 h-40">
                    <div className="ripple-1 w-full h-full"></div>
                    <div className="ripple-2 w-full h-full"></div>
                    <div className="ripple-3 w-full h-full"></div>
                </div>
            )}
            <button
                onClick={stopConversation}
                className="w-16 h-16 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground z-10 transform transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-destructive/50"
                aria-label="Stop conversation"
            >
                <StopIcon className="w-8 h-8" />
            </button>
        </div>
        <div className="h-12" />

        {conversationState === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                    <SpinnerIcon className="w-12 h-12 text-foreground mx-auto mb-4" />
                    <p className="text-xl text-muted-foreground">Connecting audio...</p>
                </div>
            </div>
        )}
    </div>
  );
};