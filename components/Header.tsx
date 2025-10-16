
import React from 'react';
import { MenuIcon, PlusIcon, SearchIcon } from './icons';

interface HeaderProps {
  onToggleSidebar: () => void;
  onNewNote: () => void;
  isSidebarVisible: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onNewNote, isSidebarVisible }) => {
  return (
    <header className="bg-gray-900 text-gray-300 p-3 flex items-center justify-between border-b border-gray-800 sticky top-0 z-20">
      <div className="flex items-center gap-2">
        <button onClick={onToggleSidebar} className="p-2 rounded-md hover:bg-gray-800">
          <MenuIcon />
        </button>
        <div className="relative flex-1 max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="text-gray-500" />
            </div>
            <input
                type="text"
                placeholder="Search"
                className="bg-gray-800 border border-gray-700 rounded-md py-2 pl-10 pr-4 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200"
            />
        </div>
      </div>
      <button onClick={onNewNote} className="p-2 rounded-md hover:bg-gray-800">
        <PlusIcon />
      </button>
    </header>
  );
};

export default Header;
