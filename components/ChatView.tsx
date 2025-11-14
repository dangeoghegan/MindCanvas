import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, Note, ContentBlockType, ChecklistItem, VoiceName } from '../types';
import { PaperAirplaneIcon, SparklesIcon, MicrophoneIcon, StopIcon, ConversationIcon, SpinnerIcon } from './icons';
import { useWhisper } from '../hooks/useWhisper';

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
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const handleTranscription = useCallback((result: { text: string; isFinal: boolean }) => {
    setInput(result.text);
  }, []);

  const { isRecording: isDictating, startRecording: startDictation, stopRecording: stopDictation } = useWhisper(handleTranscription);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(scrollToBottom, [messages, isLoading]);

  const handleToggleDictation = () => {
    if (isDictating) {
      stopDictation();
    } else {
      setInput('');
      startDictation();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      if (isDictating) {
        stopDictation();
      }
      onSendMessage(input);
      setInput('');
    }
  };
  
  const renderTextInputUI = () => (
    <div className="p-4 border-t border-border bg-background">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-secondary rounded-lg p-2 flex items-center gap-2 transition-shadow">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={isDictating ? "Listening..." : "Send a message..."}
              className="flex-1 bg-transparent focus:outline-none px-2 text-foreground placeholder-muted-foreground" disabled={isLoading} />
            <button type="button" onClick={handleToggleDictation} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors" aria-label="Dictate text">
                <MicrophoneIcon className={`w-5 h-5 ${isDictating ? 'text-destructive' : ''}`} />
            </button>
            <button type="submit" disabled={isLoading || !input.trim()} className="p-2 text-primary-foreground bg-primary rounded-md disabled:bg-muted disabled:cursor-not-allowed hover:bg-primary/90 transition-colors" aria-label="Send message">
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </form>
        </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-background text-foreground overflow-hidden">
        <header className="p-6 md:px-12">
            <h1 className="text-3xl font-bold text-foreground">Chat</h1>
        </header>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-6 h-full">
          {messages.length === 0 ? (
             <div className="text-center text-muted-foreground flex flex-col items-center justify-center h-full pb-16">
                <SparklesIcon className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h2 className="text-2xl font-semibold text-foreground">Chat with your Notes</h2>
                <p className="mt-2 mb-8">Tap the conversation icon for a voice chat.</p>
                 <button
                    type="button"
                    onClick={onStartConversation}
                    disabled={isLoading}
                    className="conversation-button w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-primary border-2 border-border text-white hover:bg-primary/90 focus-visible:ring-primary/50"
                    aria-label="Start voice conversation"
                    >
                    <ConversationIcon className="w-12 h-12" />
                </button>
             </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                  {msg.role === 'user' ? ( <p className="whitespace-pre-wrap">{msg.text}</p> ) : (
                      <div className="prose prose-invert prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-li:marker:text-primary"
                          dangerouslySetInnerHTML={formatChatMessage(msg.text)} />
                  )}
                  {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">Sources:</h4>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((source, index) => (
                             <button key={source.noteId + index} onClick={() => onSelectNote(source.noteId)}
                                className="bg-accent hover:bg-accent/80 text-accent-foreground text-xs py-1 px-2 rounded-md transition-colors flex items-center gap-1.5">
                                <span>📝</span> <span>{source.noteTitle}</span>
                              </button>
                         ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {isLoading && messages.length > 0 && (
            <div className="flex justify-start">
               <div className="max-w-xl p-3 rounded-lg bg-secondary">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"></div>
                    </div>
               </div>
            </div>
          )}
           <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="pb-16">{renderTextInputUI()}</div>
    </div>
  );
};

export default ChatView;