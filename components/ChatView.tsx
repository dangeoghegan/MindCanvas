import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { PaperAirplaneIcon, SparklesIcon, MicrophoneIcon } from './icons';

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onSelectNote: (noteId: string) => void;
}

const ChatView: React.FC<ChatViewProps> = ({ messages, onSendMessage, isLoading, onSelectNote }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  // Fix: Use 'any' for SpeechRecognition ref type as it's a browser-specific API not in standard TS types.
  const recognitionRef = useRef<any | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    // Fix: Cast window to 'any' to access non-standard SpeechRecognition properties.
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');
      setInput(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  const handleToggleListening = () => {
    if (!recognitionRef.current) {
        alert("Speech recognition is not supported by your browser.");
        return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInput('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) {
      recognitionRef.current?.stop();
    }
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

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
                <p className="mt-2">Ask any question and MindCanvas will answer based on the content of your documents.</p>
             </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500' : 'bg-gray-800'}`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">Sources:</h4>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, index) => (
                           <button
                              key={source.noteId + index}
                              onClick={() => onSelectNote(source.noteId)}
                              className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs py-1 px-2 rounded-md transition-colors flex items-center gap-1.5"
                            >
                              <span>📝</span>
                              <span>{source.noteTitle}</span>
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
      <div className="p-4 border-t border-gray-800 bg-[#1C1C1C]">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-lg p-2 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your notes..."
              className="flex-1 bg-transparent focus-outline-none px-2 text-gray-200 placeholder-gray-500"
              disabled={isLoading}
            />
            <button
                type="button"
                onClick={handleToggleListening}
                disabled={isLoading}
                className={`p-2 rounded-md transition-colors ${isListening ? 'text-red-500 bg-gray-700' : 'text-gray-400 hover:text-white'}`}
                aria-label={isListening ? 'Stop listening' : 'Start listening'}
            >
                <MicrophoneIcon className="w-5 h-5" />
            </button>
            <button type="submit" disabled={isLoading || !input.trim()} className="p-2 text-white bg-blue-500 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors">
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatView;