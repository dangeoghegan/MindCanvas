

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
    <div className="bg-[#111111] p-3 border-t border-gray-800 fixed bottom-0 left-0 right-0 z-40">
      <div className="max-w-3xl mx-auto">
        {aiResponse && (
          <div className="bg-gray-800 p-3 rounded-lg mb-3 relative">
            <p className="text-gray-300 whitespace-pre-wrap">{aiResponse}</p>
            <button onClick={clearResponse} className="absolute top-2 right-2 text-gray-500 hover:text-white">
                <XMarkIcon className="w-5 h-5"/>
            </button>
          </div>
        )}
        {isLoading && (
            <div className="text-center text-gray-400 mb-2">
                <p>Granula is thinking...</p>
            </div>
        )}
        <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center">
          <button type="submit" className="p-1 text-blue-400 hover:text-blue-300">
            <SparklesIcon />
          </button>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask AI anything about this note..."
            className="flex-1 bg-transparent focus:outline-none px-3 text-gray-200 placeholder-gray-500"
            disabled={isLoading}
          />
          <button type="button" className="p-1 text-gray-400 hover:text-white">
            <MicrophoneIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIPromptBar;