import React from 'react';
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

// The original component implementation was lost due to file corruption.
// Providing a minimal valid component to fix the syntax error in this file.
const Sidebar: React.FC<SidebarProps> = ({ notes, activeNoteId, onSelectNote, onNewNote, isVisible }) => {
    if (!isVisible) {
      return null;
    }

    return (
      <aside className="bg-gray-900 text-gray-300 w-64 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Notes</h2>
          <button onClick={onNewNote} className="p-2 rounded-md hover:bg-gray-800">
            <PlusIcon />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <ul>
            {notes.map(note => (
              <li key={note.id}>
                <button
                  onClick={() => onSelectNote(note.id)}
                  className={`w-full text-left p-2 rounded-md truncate ${
                    activeNoteId === note.id ? 'bg-gray-800' : 'hover:bg-gray-800'
                  }`}
                >
                  {note.title || 'Untitled Note'}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    );
};

export default Sidebar;
