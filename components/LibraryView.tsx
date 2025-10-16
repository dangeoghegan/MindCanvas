import React from 'react';
import { Note, ContentBlockType } from '../types';
import { DocumentIcon } from './icons';

interface LibraryViewProps {
  notes: Note[];
  onSelectNote: (id: string) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ notes, onSelectNote }) => {
  const getNoteSnippet = (note: Note): string => {
    const firstTextBlock = note.content.find(block => block.type === ContentBlockType.TEXT);
    if (firstTextBlock && firstTextBlock.content.text) {
      return firstTextBlock.content.text.substring(0, 100) + (firstTextBlock.content.text.length > 100 ? '...' : '');
    }
    return 'No additional text content.';
  };

  const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) {
          return 'Today';
      }
      if (date.toDateString() === yesterday.toDateString()) {
          return 'Yesterday';
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex-1 bg-[#1C1C1C] text-white p-6 md:p-12 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Library</h1>
        {notes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {notes.map(note => (
              <button
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className="bg-gray-900 hover:bg-gray-800 p-5 rounded-lg text-left transition-all duration-200 flex flex-col justify-between h-48 border-l-4 border-blue-500/50 hover:border-blue-500"
              >
                <div>
                  <h3 className="font-bold text-lg text-gray-100 truncate mb-2">{note.title || 'Untitled Note'}</h3>
                  <p className="text-sm text-gray-400 break-words overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {getNoteSnippet(note)}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-gray-500">
                    {formatDate(note.createdAt)}
                  </span>
                  <DocumentIcon className="w-4 h-4 text-gray-600" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-16">
            <DocumentIcon className="w-12 h-12 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-200">Your Library is Empty</h2>
            <p className="mt-2">Tap the '+' button to create your first note.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryView;