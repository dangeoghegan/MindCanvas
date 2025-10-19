import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Note, ContentBlockType } from '../types';
import { DocumentIcon, TagIcon, ChevronDownIcon, XMarkIcon, SearchIcon, UserIcon, TrashIcon } from './icons';

interface LibraryViewProps {
  notes: Note[];
  onSelectNote: (id: string) => void;
  masterPeopleList: string[];
  onSetView: (view: 'settings') => void;
  onDeleteNote: (id: string) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ notes, onSelectNote, masterPeopleList, onSetView, onDeleteNote }) => {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  
  const [tagSearch, setTagSearch] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const [personSearch, setPersonSearch] = useState('');
  const [isPersonDropdownOpen, setIsPersonDropdownOpen] = useState(false);
  const personDropdownRef = useRef<HTMLDivElement>(null);

  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    notes.forEach(note => {
      if (note.tags) {
        note.tags.forEach(tag => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).sort();
  }, [notes]);
  
  const filteredTags = useMemo(() => {
    if (!tagSearch) return allTags;
    return allTags.filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase()));
  }, [allTags, tagSearch]);

  const filteredPeople = useMemo(() => {
    if (!personSearch) return masterPeopleList;
    return masterPeopleList.filter(p => p.toLowerCase().includes(personSearch.toLowerCase()));
  }, [masterPeopleList, personSearch]);

  const filteredNotes = useMemo(() => {
    let tempNotes = notes;
    if (selectedTag) {
      tempNotes = tempNotes.filter(note => note.tags && note.tags.includes(selectedTag));
    }
    if (selectedPerson) {
      tempNotes = tempNotes.filter(note => note.people && note.people.includes(selectedPerson));
    }
    return tempNotes;
  }, [notes, selectedTag, selectedPerson]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
      }
      if (personDropdownRef.current && !personDropdownRef.current.contains(event.target as Node)) {
        setIsPersonDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleTagSelect = (tag: string | null) => {
    setSelectedTag(tag);
    setTagSearch('');
    setIsTagDropdownOpen(false);
  }

  const handlePersonSelect = (person: string | null) => {
    setSelectedPerson(person);
    setPersonSearch('');
    setIsPersonDropdownOpen(false);
  }

  const getNoteSnippet = (note: Note): string => {
    let snippet = '';
    const MAX_LENGTH = 100;

    for (const block of note.content) {
      if (snippet.length >= MAX_LENGTH) break;

      let textToAdd = '';
      switch (block.type) {
        case ContentBlockType.TEXT:
        case ContentBlockType.HEADER:
          textToAdd = block.content.text || '';
          break;
        case ContentBlockType.IMAGE:
          textToAdd = block.content.description || '';
          break;
        case ContentBlockType.VIDEO:
        case ContentBlockType.AUDIO:
          textToAdd = block.content.summary || '';
          break;
      }

      if (textToAdd.trim()) {
        snippet += textToAdd.trim() + ' ';
      }
    }
    
    if (snippet.trim() === '') {
        const hasMedia = note.content.some(b => b.type === ContentBlockType.IMAGE || b.type === ContentBlockType.VIDEO || b.type === ContentBlockType.AUDIO);
        if (hasMedia) return 'Note contains media.';
        return 'No text content.';
    }

    return snippet.substring(0, MAX_LENGTH).trim() + (snippet.length > MAX_LENGTH ? '...' : '');
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
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-white">Library</h1>
          </div>
          
          <div className="flex flex-wrap gap-4 w-full sm:w-auto">
            {masterPeopleList.length > 0 && (
              <div className="relative w-full sm:w-52" ref={personDropdownRef}>
                <button
                  onClick={() => setIsPersonDropdownOpen(!isPersonDropdownOpen)}
                  className="appearance-none bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full pl-4 pr-10 py-2.5 text-left flex items-center justify-between"
                >
                  <span className="truncate">{selectedPerson || 'Filter by person'}</span>
                  {selectedPerson ? (
                     <XMarkIcon onClick={(e) => { e.stopPropagation(); handlePersonSelect(null); }} className="w-4 h-4 text-gray-400 hover:text-white" />
                  ) : (
                     <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {isPersonDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2 sticky top-0 bg-gray-800">
                       <input
                          type="text" placeholder="Search people..." value={personSearch} onChange={(e) => setPersonSearch(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 pl-3 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus
                       />
                    </div>
                    <ul className="py-1">
                      <li onClick={() => handlePersonSelect(null)} className="text-gray-300 cursor-pointer select-none relative py-2 px-3 hover:bg-gray-700">All People</li>
                      {filteredPeople.map(person => (
                        <li key={person} onClick={() => handlePersonSelect(person)} className={`cursor-pointer select-none relative py-2 px-3 hover:bg-gray-700 ${selectedPerson === person ? 'text-blue-400' : 'text-gray-300'}`}>
                          {person}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {allTags.length > 0 && (
              <div className="relative w-full sm:w-52" ref={tagDropdownRef}>
                <button
                  onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                  className="appearance-none bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full pl-4 pr-10 py-2.5 text-left flex items-center justify-between"
                >
                  <span className="truncate">{selectedTag ? `#${selectedTag}` : 'Filter by tag'}</span>
                  {selectedTag ? (
                     <XMarkIcon onClick={(e) => { e.stopPropagation(); handleTagSelect(null); }} className="w-4 h-4 text-gray-400 hover:text-white" />
                  ) : (
                     <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {isTagDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2 sticky top-0 bg-gray-800">
                       <input
                          type="text" placeholder="Search tags..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 pl-3 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus
                       />
                    </div>
                    <ul className="py-1">
                      <li onClick={() => handleTagSelect(null)} className="text-gray-300 cursor-pointer select-none relative py-2 px-3 hover:bg-gray-700">All Tags</li>
                      {filteredTags.map(tag => (
                        <li key={tag} onClick={() => handleTagSelect(tag)} className={`cursor-pointer select-none relative py-2 px-3 hover:bg-gray-700 ${selectedTag === tag ? 'text-blue-400' : 'text-gray-300'}`}>
                          #{tag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {filteredNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNotes.map(note => (
              <div key={note.id} className="relative group">
                <button
                  onClick={() => onSelectNote(note.id)}
                  className="bg-gray-900 hover:bg-gray-800 p-5 rounded-lg text-left transition-all duration-200 flex flex-col justify-between h-48 border-l-4 border-blue-500/50 hover:border-blue-500 w-full"
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
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to permanently delete "${note.title || 'Untitled Note'}"? This action cannot be undone.`)) {
                            onDeleteNote(note.id);
                        }
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full text-gray-500 bg-gray-900/50 hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Delete Note"
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-16">
            {selectedTag || selectedPerson ? (
                <>
                    {selectedPerson ? <UserIcon className="w-12 h-12 mx-auto mb-4" /> : <TagIcon className="w-12 h-12 mx-auto mb-4" />}
                    <h2 className="text-xl font-semibold text-gray-200">No Notes Found</h2>
                    <p className="mt-2">No notes match your current filter.</p>
                    <button onClick={() => { setSelectedTag(null); setSelectedPerson(null); }} className="mt-4 text-blue-400 hover:underline">Clear Filters</button>
                </>
            ) : (
                <>
                    <DocumentIcon className="w-12 h-12 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-200">Your Library is Empty</h2>
                    <p className="mt-2">Tap the '+' button to create your first note.</p>
                </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryView;