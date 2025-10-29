import React, { useState, useEffect, useRef } from 'react';
import { BookOpenIcon, ChatBubbleOvalLeftEllipsisIcon, PlusIcon, PhotoIcon, CogIcon, CalendarCheckIcon, VideoCameraIcon, MicrophoneIcon, LinkIcon } from './icons';
import { useLongPress } from '../hooks/useLongPress';

interface BottomNavBarProps {
  currentView: 'dashboard' | 'chat' | 'library' | 'media' | 'settings';
  onSetView: (view: 'dashboard' | 'chat' | 'library' | 'media' | 'settings') => void;
  onNewNote: () => void;
  onStartConversation: () => void;
  onShortcut: (action: 'photo' | 'video' | 'dictate' | 'embed') => void;
}

const NavItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  pressEvents?: object;
}> = ({ label, icon, isActive, pressEvents }) => (
  <button {...pressEvents} className="flex flex-col items-center justify-center gap-1.5 w-16 h-full transition-colors duration-200 group">
    <div className={isActive ? 'text-blue-400' : 'text-gray-400 group-hover:text-white'}>
        {icon}
    </div>
    <span className={`text-xs tracking-wide relative ${isActive ? 'text-blue-400 font-semibold' : 'text-gray-400 group-hover:text-white'}`}>
      {label}
      {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full h-[1.5px] bg-blue-400 rounded-full"></div>}
    </span>
  </button>
);

const speedDialActions = [
    { action: 'embed' as const, label: 'Embed Link', icon: <LinkIcon className="w-5 h-5" /> },
    { action: 'dictate' as const, label: 'Dictate', icon: <MicrophoneIcon className="w-5 h-5" /> },
    { action: 'video' as const, label: 'Record Video', icon: <VideoCameraIcon className="w-5 h-5" /> },
    { action: 'photo' as const, label: 'Take Photo', icon: <PhotoIcon className="w-5 h-5" /> },
];

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onSetView, onNewNote, onStartConversation, onShortcut }) => {
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const speedDialRef = useRef<HTMLDivElement>(null);

  const chatPressEvents = useLongPress(
    onStartConversation, // onLongPress
    () => onSetView('chat') // onClick
  );

  const fabPressEvents = useLongPress(
    () => setIsSpeedDialOpen(true),
    onNewNote
  );
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (speedDialRef.current && !speedDialRef.current.contains(event.target as Node)) {
        const fabButton = document.getElementById('fab-button');
        if (fabButton && !fabButton.contains(event.target as Node)) {
          setIsSpeedDialOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleShortcutClick = (action: 'photo' | 'video' | 'dictate' | 'embed') => {
    onShortcut(action);
    setIsSpeedDialOpen(false);
  };

  return (
      <div className="fixed bottom-0 left-0 right-0 h-48 bg-transparent z-40 pointer-events-none">
        {isSpeedDialOpen && (
            <div ref={speedDialRef} className="absolute bottom-40 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 pointer-events-auto">
                <div className="bg-[#1C1C1C]/90 backdrop-blur-xl border border-white/10 rounded-xl p-2 flex flex-col gap-1 shadow-2xl shadow-black/30">
                    {speedDialActions.map((item, index) => (
                        <button
                            key={item.action}
                            onClick={() => handleShortcutClick(item.action)}
                            className="flex items-center gap-3 w-full text-left p-3 rounded-md hover:bg-white/10 text-gray-200 transition-all duration-200 animate-fade-in"
                            style={{ animationDelay: `${(speedDialActions.length - index - 1) * 50}ms` }}
                        >
                            {item.icon}
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        )}

        <button
          id="fab-button"
          {...fabPressEvents}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/40 hover:bg-blue-600 transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-500/50 z-50 pointer-events-auto"
          aria-label="Create New Note (Long press for more options)"
        >
          <PlusIcon className="w-8 h-8" />
        </button>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm h-16 bg-[#1C1C1C]/80 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-around pointer-events-auto shadow-2xl shadow-black/30">
          <NavItem label="Library" icon={<BookOpenIcon className="w-6 h-6" />} isActive={currentView === 'library'} pressEvents={{ onClick: () => onSetView('library') }} />
          <NavItem label="Media" icon={<PhotoIcon className="w-6 h-6" />} isActive={currentView === 'media'} pressEvents={{ onClick: () => onSetView('media') }} />
          <NavItem label="Chat" icon={<ChatBubbleOvalLeftEllipsisIcon className="w-6 h-6" />} isActive={currentView === 'chat'} pressEvents={chatPressEvents} />
          <NavItem label="Review" icon={<CalendarCheckIcon className="w-6 h-6" />} isActive={currentView === 'dashboard'} pressEvents={{ onClick: () => onSetView('dashboard') }} />
          <NavItem label="Settings" icon={<CogIcon className="w-6 h-6" />} isActive={currentView === 'settings'} pressEvents={{ onClick: () => onSetView('settings') }} />
        </div>
      </div>
  );
};

export default BottomNavBar;
