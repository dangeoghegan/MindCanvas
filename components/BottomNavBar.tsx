import React from 'react';
import { HomeIcon, BookOpenIcon, ChatBubbleOvalLeftEllipsisIcon, PhotoIcon, PlusIcon } from './icons';

interface BottomNavBarProps {
  currentView: 'dashboard' | 'chat' | 'library' | 'media';
  onSetView: (view: 'dashboard' | 'chat' | 'library' | 'media') => void;
  onNewNote: () => void;
}

const NavItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center gap-1 w-16 transition-colors duration-200">
    <div className={isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-white'}>
        {icon}
    </div>
    <span className={`text-xs ${isActive ? 'text-white font-semibold' : 'text-gray-500'}`}>{label}</span>
  </button>
);

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onSetView, onNewNote }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-transparent z-50 flex justify-center">
      <div className="absolute bottom-4 w-[calc(100%-2rem)] max-w-sm h-16 bg-gray-900/80 backdrop-blur-lg border border-gray-700/80 rounded-2xl flex items-center justify-around">
        <NavItem label="Review" icon={<HomeIcon />} isActive={currentView === 'dashboard'} onClick={() => onSetView('dashboard')} />
        <NavItem label="Library" icon={<BookOpenIcon />} isActive={currentView === 'library'} onClick={() => onSetView('library')} />
        
        {/* FAB Placeholder */}
        <div className="w-16" /> 

        <NavItem label="Chat" icon={<ChatBubbleOvalLeftEllipsisIcon />} isActive={currentView === 'chat'} onClick={() => onSetView('chat')} />
        <NavItem label="Media" icon={<PhotoIcon />} isActive={currentView === 'media'} onClick={() => onSetView('media')} />
      </div>

      <button
        onClick={onNewNote}
        className="absolute -top-4 w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
        aria-label="New Note"
      >
        <PlusIcon className="w-8 h-8" />
      </button>
    </div>
  );
};

export default BottomNavBar;
