import React, { useState } from 'react';
import { SparklesIcon, MicrophoneIcon, XMarkIcon } from './icons';

interface AIPromptBarProps {
  onAskAI: (prompt: string) => void;
  isLoading: boolean;
  aiResponse: string | null;
  clearResponse: () => void;
}

const AIPromptBar: React.FC<AIPromptBarProps> = ({ onAskAI, isLoading, aiResponse, clearResponse }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onAskAI(prompt);
      setPrompt('');
    }
  };

  return (
    <div className="bg-background/80 backdrop-blur-sm p-3 border-t border-border fixed bottom-0 left-0 right-0 z-40">
      <div className="max-w-3xl mx-auto">
        {aiResponse && (
          <div className="bg-secondary p-3 rounded-lg mb-3 relative">
            <p className="text-muted-foreground whitespace-pre-wrap">{aiResponse}</p>
            <button onClick={clearResponse} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors">
                <XMarkIcon className="w-5 h-5"/>
            </button>
          </div>
        )}
        {isLoading && (
            <div className="text-center text-muted-foreground mb-2">
                <p>Granula is thinking...</p>
            </div>
        )}
        <form onSubmit={handleSubmit} className="bg-secondary rounded-lg p-3 flex items-center transition-shadow">
          <button type="submit" className="p-1 text-primary hover:text-primary/80 transition-colors">
            <SparklesIcon />
          </button>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask AI anything about this note..."
            className="flex-1 bg-transparent focus:outline-none px-3 text-foreground placeholder-muted-foreground"
            disabled={isLoading}
          />
          <button type="button" className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <MicrophoneIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIPromptBar;
