import React from 'react';
import { MenuIcon, PlusIcon, SearchIcon } from './icons';

interface HeaderProps {
  onToggleSidebar: () => void;
  onNewNote: () => void;
  isSidebarVisible: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onNewNote, isSidebarVisible }) => {
  return (
    <header className="bg-background text-foreground p-3 flex items-center justify-between border-b border-border sticky top-0 z-20">
      <div className="flex items-center gap-2">
        <button onClick={onToggleSidebar} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <MenuIcon />
        </button>
        <div className="relative flex-1 max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="text-muted-foreground" />
            </div>
            <input
                type="text"
                placeholder="Search"
                className="bg-secondary rounded-md py-2 pl-10 pr-4 w-full focus:outline-none text-foreground placeholder:text-muted-foreground transition-colors"
            />
        </div>
      </div>
      <button onClick={onNewNote} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <PlusIcon />
      </button>
    </header>
  );
};

export default Header;