import React, { useState, useRef, useEffect } from 'react';
import { Note, ContentBlockType, ChecklistItem, VoiceName, UserProfile } from '../types';
import { FunctionDeclaration, GoogleGenAI, LiveServerMessage, Modality, Blob, Type } from '@google/genai';
import { getConversationalSystemInstruction } from '../services/geminiService';

// --- Start of Audio Helper Functions ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
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
  onNewNote: (options?: { open?: boolean; title?: string; content?: string }) => void;
  onSelectNote: (noteId: string) => void;
  userProfile: UserProfile;
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

const makeNoteFunctionDeclaration: FunctionDeclaration = {
  name: 'makeNote',
  description: 'Creates a new note with a title and content. Use this when the user asks to "make a note about X", "create a note that...", or "note down that...". If the user just says "make a note", call this function without arguments.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "A short, descriptive title for the note, inferred from the user's request. Defaults to 'Untitled Note' if not provided."
      },
      content: {
        type: Type.STRING,
        description: "The main content or body of the note, taken from the user's request."
      }
    },
  },
};

type ConversationState = 'idle' | 'connecting' | 'active';
type TranscriptionLogEntry = { id: string; role: 'user' | 'model'; text: string };
const CONTEXT_CHAR_LIMIT = 32000;

export const ConversationModeOverlay: React.FC<ConversationModeOverlayProps> = ({ notes, selectedVoice, onClose, onNewNote, onSelectNote, userProfile }) => {
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [liveTranscript, setLiveTranscript] = useState<TranscriptionLogEntry[]>([]);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioResourcesRef = useRef<{
      stream: MediaStream | null, inputAudioContext: AudioContext | null, outputAudioContext: AudioContext | null,
      scriptProcessor: ScriptProcessorNode | null, sourceNode: MediaStreamAudioSourceNode | null, outputGainNode: GainNode | null,
      playbackSources: Set<AudioBufferSourceNode>, nextStartTime: number,
  }>({ stream: null, inputAudioContext: null, outputAudioContext: null, scriptProcessor: null, sourceNode: null, outputGainNode: null, playbackSources: new Set(), nextStartTime: 0 });
  const transcriptRefs = useRef({ currentInput: '', currentOutput: '' });
  const spiralsContainerRef = useRef<HTMLDivElement>(null);
  const conversationAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const createSpiralPattern = () => {
      const container = spiralsContainerRef.current;
      if (!container) return;

      const spiralContainer = document.createElement('div');
      spiralContainer.className = 'spiral-container';
      
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      spiralContainer.style.left = x + 'px';
      spiralContainer.style.top = y + 'px';
      
      const particleCount = 20 + Math.floor(Math.random() * 25);
      const maxRadius = 40 + Math.random() * 60;
      const colors = ['bright-navy', 'denim', 'egyptian-blue', 'white'];
      const sizes = ['tiny', 'small', 'medium'];
      
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'spiral-particle';
        
        const angle = (i / particleCount) * Math.PI * 4;
        const radius = (i / particleCount) * maxRadius;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        
        particle.style.left = px + 'px';
        particle.style.top = py + 'px';
        
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        particle.classList.add(color, size);
        
        const duration = 8 + Math.random() * 6;
        const delay = (i / particleCount) * 2;
        particle.style.animation = `spiral-develop ${duration}s ease-in-out ${delay}s`;
        
        spiralContainer.appendChild(particle);
      }
      
      container.appendChild(spiralContainer);
      
      const maxDuration = 16000;
      setTimeout(() => {
        if (container.contains(spiralContainer)) {
          container.removeChild(spiralContainer);
        }
      }, maxDuration);
    };

    for (let i = 0; i < 3; i++) {
      setTimeout(createSpiralPattern, i * 3000);
    }
    const intervalId = setInterval(createSpiralPattern, 5000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (conversationAreaRef.current) {
      conversationAreaRef.current.scrollTop = conversationAreaRef.current.scrollHeight;
    }
  }, [liveTranscript]);

  const stopConversation = async () => {
    if (sessionPromiseRef.current) {
        try {
            const session = await sessionPromiseRef.current;
            if (session) session.close();
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
    if (inputAudioContext && inputAudioContext.state !== 'closed') inputAudioContext.close().catch(console.error);
    if (outputAudioContext && outputAudioContext.state !== 'closed') outputAudioContext.close().catch(console.error);
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
          
          let notesContext = notes.map(getNoteContentAsString).join('\n\n---\n\n');
          if (notesContext.length > CONTEXT_CHAR_LIMIT) {
              notesContext = notesContext.substring(notesContext.length - CONTEXT_CHAR_LIMIT);
          }
          const systemInstruction = getConversationalSystemInstruction(notesContext, userProfile.name);

          sessionPromiseRef.current = ai.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-09-2025',
              config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
                  inputAudioTranscription: {},
                  outputAudioTranscription: {},
                  systemInstruction,
                  tools: [{ functionDeclarations: [makeNoteFunctionDeclaration] }],
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
                      if (message.toolCall) {
                          for (const fc of message.toolCall.functionCalls) {
                              if (fc.name === 'makeNote') {
                                  const { title, content } = fc.args;
                                  onNewNote({ open: false, title, content });
                                  sessionPromiseRef.current?.then((session) => {
                                    if (session) {
                                      session.sendToolResponse({
                                        functionResponses: {
                                          id: fc.id,
                                          name: fc.name,
                                          response: { result: "Note has been successfully created." },
                                        }
                                      });
                                    }
                                  });
                              }
                          }
                      }

                      if (message.serverContent?.interrupted) {
                          for (const source of audioResourcesRef.current.playbackSources) { try { source.stop(); } catch (e) {} }
                          audioResourcesRef.current.playbackSources.clear();
                          audioResourcesRef.current.nextStartTime = 0;
                      }

                      const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                      if (audioData) {
                          const { outputAudioContext, outputGainNode, playbackSources } = audioResourcesRef.current;
                          if (!outputAudioContext || !outputGainNode) return;
                          if (outputAudioContext.state === 'suspended') await outputAudioContext.resume();
                          
                          const isFirstChunk = playbackSources.size === 0;
                          let { nextStartTime } = audioResourcesRef.current;
                          nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);

                          if (isFirstChunk) {
                            nextStartTime += 2.0; // Add 2-second delay
                          }

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
                          const finalModelText = transcriptRefs.current.currentOutput.trim().toLowerCase();
                          if (finalModelText === 'noted.') {
                              setTimeout(() => {
                                  stopConversation();
                              }, 500);
                          }
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
  }, [notes, selectedVoice, onClose, onNewNote, userProfile]);
  
  const getStatusText = () => {
    switch (conversationState) {
        case 'connecting': return 'Connecting...';
        case 'active': return 'Recording in progress...';
        default: return 'Idle';
    }
  };

  const renderTranscriptWithLinks = (text: string) => {
    const relevantNotes = notes.slice(0, 200);
    const escapedTitles = relevantNotes
      .map(note => (note.title || 'Untitled Note').trim())
      .filter(title => title.length > 2)
      .map(title => title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));

    if (escapedTitles.length === 0) {
      return <div className="message-bubble">{text}</div>;
    }

    const regex = new RegExp(`(${escapedTitles.join('|')})`, 'gi');
    const parts = text.split(regex);

    return (
      <div className="message-bubble">
        {parts.map((part, index) => {
          const matchedNote = relevantNotes.find(note => (note.title || 'Untitled Note').toLowerCase() === part.toLowerCase());
          if (matchedNote) {
            return (
              <button
                key={`${matchedNote.id}-${index}`}
                className="font-semibold underline"
                style={{ color: '#0C3BAA' }}
                onClick={() => onSelectNote(matchedNote.id)}
              >
                {part}
              </button>
            );
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </div>
    );
  };

  return (
    <div className="sand-spirals-overlay">
      <div className="spirals-background" ref={spiralsContainerRef}></div>
      <div className="container">
        <div className="header">
          <h1>Conversation Mode</h1>
        </div>

        <div className="conversation-area" ref={conversationAreaRef}>
          <div className="conversation-content">
            {liveTranscript.length === 0 && conversationState === 'active' && (
                <div className="message ai">
                    <div className="message-label">AI</div>
                    <div className="message-bubble">
                        I'm listening. You can ask me questions about your notes or ask me to create a new one.
                    </div>
                </div>
            )}
            {liveTranscript.map((log) => (
              <div key={log.id} className={`message ${log.role === 'user' ? 'user' : 'ai'}`}>
                <div className="message-label">{log.role === 'user' ? 'You' : 'AI'}</div>
                {log.role === 'user' 
                    ? <div className="message-bubble">{log.text}</div>
                    : renderTranscriptWithLinks(log.text)
                }
              </div>
            ))}
          </div>
        </div>

        <div className="controls-container">
          <div className="controls">
            <div className="audio-visualizer">
              <div className="bar"></div>
              <div className="bar"></div>
              <div className="bar"></div>
              <div className="bar"></div>
              <div className="bar"></div>
            </div>
            <button className="record-button" onClick={stopConversation} aria-label="Stop conversation">
              <div className="stop-icon"></div>
            </button>
            <div className="status-text">{getStatusText()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};