import React, { useState } from 'react';
import { Note } from '../types';
import { ChevronDownIcon, DocumentIcon, PlusIcon, PhotoIcon } from './icons';

interface SidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  isVisible: boolean;
  onSetView: (view: 'dashboard' | 'chat' | 'library' | 'media') => void;
  currentView: 'dashboard' | 'note' | 'chat' | 'library' | 'media';
}

const Sidebar: React.FC<SidebarProps> = ({ notes, activeNoteId, onSelectNote, onNewNote, isVisible, onSetView, currentView }) => {
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(true);
  const isNoteView = currentView === 'note';

  return (
    <aside className={`absolute md:relative z-30 h-full bg-[#111111] text-gray-300 flex-col flex-shrink-0 transition-all duration-300 ${isVisible ? 'w-72 flex' : 'w-0 hidden'}`}>
      <div className="flex-1 overflow-y-auto">
        <div className="h-16 flex items-center px-4">
          <button onClick={() => onSetView('dashboard')} className="text-xl font-bold text-white hover:text-gray-300 transition-colors text-left">
            MindCanvas
          </button>
        </div>

        <nav className="px-4 space-y-2">
          <button onClick={onNewNote} className="flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full text-left hover:bg-gray-800">
            <span>📝</span>
            <span>Capture</span>
          </button>
          <button onClick={() => onSetView('chat')} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full text-left hover:bg-gray-800 ${currentView === 'chat' ? 'bg-gray-800' : ''}`}>
            <span>💬</span>
            <span>Chats</span>
          </button>
          <button onClick={() => onSetView('library')} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full text-left hover:bg-gray-800 ${currentView === 'library' ? 'bg-gray-800' : ''}`}>
            <span>📚</span>
            <span>Library</span>
          </button>
          <button onClick={() => onSetView('media')} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full text-left hover:bg-gray-800 ${currentView === 'media' ? 'bg-gray-800' : ''}`}>
            <PhotoIcon />
            <span>Media</span>
          </button>
          
          <div className="pt-2">
            <button
              onClick={() => setIsDocumentsOpen(!isDocumentsOpen)}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm hover:bg-gray-800 ${isNoteView ? 'bg-gray-800' : ''}`}
            >
              <div className="flex items-center gap-3">
                <DocumentIcon />
                <span>Documents</span>
                <ChevronDownIcon className={`transition-transform ${isDocumentsOpen ? '' : '-rotate-90'}`} />
              </div>
              <button onClick={(e) => { e.stopPropagation(); onNewNote(); }} className="p-1 rounded hover:bg-gray-700">
                <PlusIcon className="w-4 h-4" />
              </button>
            </button>
            {isDocumentsOpen && (
              <div className="pl-6 mt-1 space-y-1">
                {notes.map((note) => (
                  <a
                    key={note.id}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectNote(note.id);
                    }}
                    className={`block truncate pl-5 pr-3 py-1.5 rounded-md text-sm border-l-2 ${activeNoteId === note.id ? 'border-blue-500 bg-gray-800 text-white' : 'border-gray-700 hover:bg-gray-800'}`}
                  >
                    {note.title || 'Untitled Note'}
                  </a>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;