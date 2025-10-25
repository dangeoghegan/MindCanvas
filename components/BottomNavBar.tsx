import React, { useState } from 'react';
import { BookOpenIcon, ChatBubbleOvalLeftEllipsisIcon, PlusIcon, CalendarDaysIcon, CogIcon, XMarkIcon, CameraIcon, VideoCameraIcon, MicrophoneIcon } from './icons';
import { useLongPress } from '../hooks/useLongPress';

interface BottomNavBarProps {
  currentView: 'dashboard' | 'chat' | 'library' | 'settings';
  onSetView: (view: 'dashboard' | 'chat' | 'library' | 'settings') => void;
  onNewNote: () => void;
  onStartConversation: () => void;
  onShortcut: (action: 'photo' | 'video' | 'audio') => void;
}

const NavItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  pressEvents?: object;
}> = ({ label, icon, isActive, pressEvents }) => (
  <button {...pressEvents} className="flex flex-col items-center justify-center gap-1 w-16 transition-colors duration-200">
    <div className={isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-white'}>
        {icon}
    </div>
    <span className={`text-xs ${isActive ? 'text-white font-semibold' : 'text-gray-500'}`}>{label}</span>
  </button>
);

const SpeedDial: React.FC<{
  onClose: () => void;
  onShortcut: (action: 'photo' | 'video' | 'audio') => void;
}> = ({ onClose, onShortcut }) => {
    const actions = [
        { id: 'photo', icon: <CameraIcon className="w-6 h-6"/>, label: 'Photo', style: { transform: 'translate(0, -70px)' } },
        { id: 'video', icon: <VideoCameraIcon className="w-6 h-6"/>, label: 'Video', style: { transform: 'translate(60px, -40px)' } },
        { id: 'audio', icon: <MicrophoneIcon className="w-6 h-6"/>, label: 'Audio', style: { transform: 'translate(-60px, -40px)' } },
    ] as const;

    const handleShortcut = (action: 'photo' | 'video' | 'audio') => {
        onShortcut(action);
        onClose();
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center">
                {actions.map(action => (
                     <button
                        key={action.id}
                        onClick={() => handleShortcut(action.id)}
                        className="absolute w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-gray-600 transition-all duration-200"
                        style={action.style}
                        aria-label={`Create new ${action.label}`}
                     >
                         {action.icon}
                     </button>
                ))}
            </div>
        </div>
    );
};

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onSetView, onNewNote, onStartConversation, onShortcut }) => {
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);

  const fabPressEvents = useLongPress(
    () => setIsSpeedDialOpen(true), // onLongPress
    onNewNote, // onClick
    { delay: 400 }
  );

  const chatPressEvents = useLongPress(
    onStartConversation, // onLongPress
    () => onSetView('chat') // onClick
  );
  
  return (
    <>
      {isSpeedDialOpen && <SpeedDial onClose={() => setIsSpeedDialOpen(false)} onShortcut={onShortcut} />}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-transparent z-50 flex justify-center">
        <div className="absolute bottom-4 w-[calc(100%-2rem)] max-w-sm h-16 bg-gray-900/80 backdrop-blur-lg border border-gray-700/80 rounded-2xl flex items-center justify-around">
          <NavItem label="Library" icon={<BookOpenIcon className="w-6 h-6" />} isActive={currentView === 'library'} pressEvents={{ onClick: () => onSetView('library') }} />
          <NavItem label="Chat" icon={<ChatBubbleOvalLeftEllipsisIcon />} isActive={currentView === 'chat'} pressEvents={chatPressEvents} />
          
          <div className="w-16" /> 

          <NavItem label="Review" icon={<CalendarDaysIcon className="w-6 h-6" />} isActive={currentView === 'dashboard'} pressEvents={{ onClick: () => onSetView('dashboard') }} />
          <NavItem label="Settings" icon={<CogIcon className="w-6 h-6" />} isActive={currentView === 'settings'} pressEvents={{ onClick: () => onSetView('settings') }} />
        </div>

        <button
          {...fabPressEvents}
          onClick={isSpeedDialOpen ? () => setIsSpeedDialOpen(false) : undefined}
          className="absolute -top-4 w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-500/50 z-50"
          aria-label={isSpeedDialOpen ? "Close actions" : "New Note"}
        >
          {isSpeedDialOpen ? <XMarkIcon className="w-8 h-8" /> : <PlusIcon className="w-8 h-8" />}
        </button>
      </div>
    </>
  );
};

export default BottomNavBar;