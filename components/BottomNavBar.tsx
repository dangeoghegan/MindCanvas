import React, { useState, useEffect, useRef } from 'react';
import { BookOpenIcon, ChatIcon, PlusIcon, PhotoIcon, CogIcon, CalendarCheckIcon, VideoCameraIcon, MicrophoneIcon, LinkIcon, SparklesIcon } from './icons';
import { useLongPress } from '../hooks/useLongPress';

interface BottomNavBarProps {
  currentView: 'dashboard' | 'chat' | 'library' | 'media' | 'settings';
  onSetView: (view: 'dashboard' | 'chat' | 'library' | 'media' | 'settings') => void;
  onNewNote: () => void;
  onStartConversation: () => void;
  onShortcut: (action: 'photo' | 'video' | 'dictate' | 'embed' | 'ai-checklist') => void;
}

const NavItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  pressEvents?: object;
  className?: string;
}> = ({ label, icon, isActive, pressEvents, className }) => (
  <button {...pressEvents} className={`flex flex-col items-center justify-center gap-1.5 w-16 h-full transition-colors duration-200 group ${className || ''}`}>
    <div className={isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}>
        {icon}
    </div>
    <span className={`text-xs tracking-wide relative ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground group-hover:text-foreground'}`}>
      {label}
      {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full h-[1.5px] bg-primary rounded-full"></div>}
    </span>
  </button>
);

const speedDialActions = [
    { action: 'embed' as const, label: 'Embed Link', icon: <LinkIcon className="w-5 h-5" /> },
    { action: 'dictate' as const, label: 'Dictate', icon: <MicrophoneIcon className="w-5 h-5" /> },
    { action: 'video' as const, label: 'Record Video', icon: <VideoCameraIcon className="w-5 h-5" /> },
    { action: 'photo' as const, label: 'Take Photo', icon: <PhotoIcon className="w-5 h-5" /> },
    { action: 'ai-checklist' as const, label: 'AI Checklist', icon: <SparklesIcon className="w-5 h-5" /> },
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

  const handleShortcutClick = (action: 'photo' | 'video' | 'dictate' | 'embed' | 'ai-checklist') => {
    onShortcut(action);
    setIsSpeedDialOpen(false);
  };

  return (
      <div className="fixed bottom-0 left-0 right-0 h-48 bg-transparent z-40 pointer-events-none">
        {isSpeedDialOpen && (
            <div ref={speedDialRef} className="absolute bottom-40 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 pointer-events-auto">
                <div className="bg-popover/90 backdrop-blur-xl border border-border rounded-xl p-2 flex flex-col gap-1 shadow-2xl shadow-black/30">
                    {speedDialActions.map((item, index) => (
                        <button
                            key={item.action}
                            onClick={() => handleShortcutClick(item.action)}
                            className="flex items-center gap-3 w-full text-left p-3 rounded-md hover:bg-accent text-foreground transition-all duration-200 animate-fade-in"
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
          className="absolute bottom-24 left-1/2 -translate-x-1/2 w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/40 hover:bg-primary/90 transition-all duration-300 transform hover:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 z-50 pointer-events-auto"
          aria-label="Create New Note (Long press for more options)"
        >
          <PlusIcon className="w-8 h-8" />
        </button>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm h-16 bg-background/80 backdrop-blur-xl border border-border rounded-2xl flex items-center justify-around pointer-events-auto shadow-2xl shadow-black/30">
          <NavItem label="Library" icon={<BookOpenIcon className="w-6 h-6" />} isActive={currentView === 'library'} pressEvents={{ onClick: () => onSetView('library') }} />
          <NavItem label="Media" icon={<PhotoIcon className="w-6 h-6" />} isActive={currentView === 'media'} pressEvents={{ onClick: () => onSetView('media') }} />
          <NavItem label="Chat" icon={<ChatIcon className="w-6 h-6" />} isActive={currentView === 'chat'} pressEvents={chatPressEvents} className="chat-nav-item" />
          <NavItem label="Review" icon={<CalendarCheckIcon className="w-6 h-6" />} isActive={currentView === 'dashboard'} pressEvents={{ onClick: () => onSetView('dashboard') }} />
          <NavItem label="Settings" icon={<CogIcon className="w-6 h-6" />} isActive={currentView === 'settings'} pressEvents={{ onClick: () => onSetView('settings') }} />
        </div>
      </div>
  );
};

export default BottomNavBar;