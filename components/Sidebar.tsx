import React from 'react';
import { Note } from '../types';
import { PlusIcon } from './icons';

interface SidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  isVisible: boolean;
  onSetView: (view: 'dashboard' | 'chat' | 'library' | 'media') => void;
  currentView: 'dashboard' | 'note' | 'chat' | 'library' | 'media';
}

const Sidebar: React.FC<SidebarProps> = ({ notes, activeNoteId, onSelectNote, onNewNote, isVisible }) => {
    if (!isVisible) {
      return null;
    }

    return (
      <aside className="bg-background text-foreground w-64 p-4 flex flex-col border-r border-border transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Notes</h2>
          <button onClick={onNewNote} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <PlusIcon />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <ul>
            {notes.map(note => (
              <li key={note.id}>
                <button
                  onClick={() => onSelectNote(note.id)}
                  className={`w-full text-left p-2 rounded-md truncate transition-colors ${
                    activeNoteId === note.id ? 'bg-secondary text-foreground' : 'hover:bg-secondary'
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