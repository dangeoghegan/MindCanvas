import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Note, ContentBlockType, ChecklistItem, VoiceName } from '../types';
import { PaperAirplaneIcon, SparklesIcon, MicrophoneIcon, StopIcon, ConversationIcon, SpinnerIcon } from './icons';

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onSelectNote: (noteId: string) => void;
  notes: Note[];
  selectedVoice: VoiceName;
  onStartConversation: () => void;
}

const formatChatMessage = (text: string): { __html: string } => {
    const lines = text.trim().split('\n');
    let html = '';
    let inList = false;
    let paragraphBuffer: string[] = [];

    const flushParagraph = () => {
        if (paragraphBuffer.length > 0) {
            let pContent = paragraphBuffer.join('<br />');
            pContent = pContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html += `<p>${pContent}</p>`;
            paragraphBuffer = [];
        }
    };

    for (const line of lines) {
        if (line.startsWith('#')) {
            flushParagraph();
            if (inList) { html += '</ul>'; inList = false; }
            let headingContent = line.replace(/^#+\s*/, '');
            headingContent = headingContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            if (line.startsWith('### ')) html += `<h3>${headingContent}</h3>`;
            else if (line.startsWith('## ')) html += `<h2>${headingContent}</h2>`;
            else if (line.startsWith('# ')) html += `<h1>${headingContent}</h1>`;
            continue;
        }

        if (line.match(/^[-*]\s/)) {
            flushParagraph();
            if (!inList) { html += '<ul>'; inList = true; }
            let listItemContent = line.replace(/^[-*]\s/, '').trim();
            listItemContent = listItemContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html += `<li>${listItemContent}</li>`;
            continue;
        }

        if (inList) { html += '</ul>'; inList = false; }
        if (line.trim() === '') { flushParagraph(); } 
        else { paragraphBuffer.push(line); }
    }
    
    flushParagraph();
    if (inList) { html += '</ul>'; }

    return { __html: html };
};

const ChatView: React.FC<ChatViewProps> = ({ messages, onSendMessage, isLoading, onSelectNote, notes, selectedVoice, onStartConversation }) => {
  const [input, setInput] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isDictatingRef = useRef(false);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(scrollToBottom, [messages, isLoading]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current && isDictatingRef.current) {
          isDictatingRef.current = false;
          recognitionRef.current.stop();
      }
    };
  }, []);

  // Setup Speech Recognition for dictation
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    
    recognition.onresult = (event: any) => {
        let interim_transcript = '';
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final_transcript += event.results[i][0].transcript;
            } else {
                interim_transcript += event.results[i][0].transcript;
            }
        }
        setInput(final_transcript + interim_transcript);
    };

    recognition.onend = () => {
        if (isDictatingRef.current) {
            // Restart if it stops prematurely
            try { recognition.start(); } catch (e) { console.error(e); }
        }
    };
    recognition.onerror = (event: any) => console.error('Speech recognition error:', event.error);
  }, []);
  
  const handleToggleDictation = () => {
      if (isDictating) {
          isDictatingRef.current = false;
          recognitionRef.current?.stop();
      } else {
          isDictatingRef.current = true;
          recognitionRef.current?.start();
      }
      setIsDictating(!isDictating);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      if (isDictating) handleToggleDictation();
      onSendMessage(input);
      setInput('');
    }
  };
  
  const renderTextInputUI = () => (
    <div className="p-4 border-t border-gray-800 bg-[#1C1C1C]">
        <div className="max-w-3xl mx-auto">
            <div className="flex justify-center mb-4">
            <button
              type="button"
              onClick={onStartConversation}
              disabled={isLoading}
              className="w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-[#1C1C1C] bg-gray-800 border-2 border-gray-700 text-gray-200 hover:bg-gray-700 focus:ring-orange-500/50"
              aria-label="Start voice conversation"
            >
              <ConversationIcon className="w-12 h-12" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-lg p-2 flex items-center gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={isDictating ? "Listening..." : "Ask a question about your notes..."}
              className="flex-1 bg-transparent focus:outline-none px-2 text-gray-200 placeholder-gray-500" disabled={isLoading} />
            <button type="button" onClick={handleToggleDictation} className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors" aria-label="Dictate text">
                <MicrophoneIcon className={`w-5 h-5 ${isDictating ? 'text-red-500' : ''}`} />
            </button>
            <button type="submit" disabled={isLoading || !input.trim()} className="p-2 text-white bg-blue-500 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors" aria-label="Send message">
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </form>
        </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-[#1C1C1C] text-white overflow-hidden">
        <header className="p-6 md:px-12">
            <h1 className="text-3xl font-bold text-white">Chat</h1>
        </header>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
             <div className="text-center text-gray-400 mt-16">
                <SparklesIcon className="w-12 h-12 mx-auto mb-4 text-blue-400" />
                <h2 className="text-2xl font-semibold text-gray-200">Chat with your Notes</h2>
                <p className="mt-2">Ask a question, or tap the conversation icon for a voice chat.</p>
             </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500' : 'bg-gray-800'}`}>
                {msg.role === 'user' ? ( <p className="whitespace-pre-wrap">{msg.text}</p> ) : (
                    <div className="prose prose-invert prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-li:marker:text-blue-400"
                        dangerouslySetInnerHTML={formatChatMessage(msg.text)} />
                )}
                {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">Sources:</h4>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, index) => (
                           <button key={source.noteId + index} onClick={() => onSelectNote(source.noteId)}
                              className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs py-1 px-2 rounded-md transition-colors flex items-center gap-1.5">
                              <span>📝</span> <span>{source.noteTitle}</span>
                            </button>
                       ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
               <div className="max-w-xl p-3 rounded-lg bg-gray-800">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                    </div>
               </div>
            </div>
          )}
           <div ref={messagesEndRef} />
        </div>
      </div>
      {renderTextInputUI()}
    </div>
  );
};

export default ChatView;