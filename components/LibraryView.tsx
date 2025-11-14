// IMPROVED LibraryView.tsx with Media Thumbnail Frames
// Replace your existing LibraryView component with this version

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Note, ContentBlockType, ContentBlock } from '../types';
import { DocumentIcon, TagIcon, ChevronDownIcon, XMarkIcon, SearchIcon, UserIcon, TrashIcon, CogIcon, VideoCameraIcon } from './icons';
import { useLongPress } from '../hooks/useLongPress';
import { getMedia } from '../services/dbService';
import { faceRecognitionService, FaceDescriptor } from '../services/faceRecognitionService';

interface LibraryViewProps {
  notes: Note[];
  onSelectNote: (id: string) => void;
  masterPeopleList: string[];
  onSetView: (view: 'settings') => void;
  onDeleteNote: (id: string) => void;
}

const categoryColors = [
  '--cat-work',
  '--cat-home',
  '--cat-therapy',
  '--cat-personal',
];

const LibraryView: React.FC<LibraryViewProps> = ({ notes, onSelectNote, masterPeopleList, onSetView, onDeleteNote }) => {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  
  const [tagSearch, setTagSearch] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const [personSearch, setPersonSearch] = useState('');
  const [isPersonDropdownOpen, setIsPersonDropdownOpen] = useState(false);
  const personDropdownRef = useRef<HTMLDivElement>(null);
  
  const [knownFaces, setKnownFaces] = useState<FaceDescriptor[]>([]);
  useEffect(() => {
      setKnownFaces(faceRecognitionService.loadKnownFaces());
  }, []);

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
        case ContentBlockType.EMBED:
          textToAdd = block.content.summary || '';
          break;
      }

      if (textToAdd.trim()) {
        snippet += textToAdd.trim() + ' ';
      }
    }
    
    if (snippet.trim() === '') {
        const hasMedia = note.content.some(b => 
            b.type === ContentBlockType.IMAGE || 
            b.type === ContentBlockType.VIDEO || 
            b.type === ContentBlockType.AUDIO ||
            b.type === ContentBlockType.EMBED
        );
        if (hasMedia) return 'Note contains media or embedded content.';
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

  const NoteCard: React.FC<{ note: Note, index: number, knownFaces: FaceDescriptor[] }> = ({ note, index, knownFaces }) => {
    const [firstMedia, setFirstMedia] = useState<ContentBlock | null>(null);
    const [thumbnail, setThumbnail] = useState<{url: string, type: 'image' | 'video'} | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [mediaThumbnails, setMediaThumbnails] = useState<{url: string, type: 'image' | 'video'}[]>([]);

    useEffect(() => {
        const mediaBlocks = note.content.filter(b =>
            ((b.type === ContentBlockType.IMAGE || b.type === ContentBlockType.VIDEO) && b.content.dbKey) ||
            (b.type === ContentBlockType.EMBED && b.content.thumbnail)
        );
        setFirstMedia(mediaBlocks[0] || null);
        
        // Load thumbnails for up to 4 media items
        const loadThumbnails = async () => {
            const thumbs: {url: string, type: 'image' | 'video'}[] = [];
            const itemsToShow = mediaBlocks.slice(0, 4);
            
            for (const block of itemsToShow) {
                if (block.type === ContentBlockType.EMBED && block.content.thumbnail) {
                    thumbs.push({ url: block.content.thumbnail, type: 'image' });
                } else if (block.content.dbKey) {
                    const mediaData = await getMedia(block.content.dbKey);
                    if (mediaData) {
                        thumbs.push({ 
                            url: mediaData.url, 
                            type: block.type === ContentBlockType.VIDEO ? 'video' : 'image' 
                        });
                    }
                }
            }
            setMediaThumbnails(thumbs);
        };
        
        if (mediaBlocks.length > 0) {
            loadThumbnails();
        }
    }, [note]);

    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
        setThumbnail(null);

        if (firstMedia) {
            if (firstMedia.type === ContentBlockType.EMBED && firstMedia.content.thumbnail) {
                if (isMounted) {
                    setThumbnail({ url: firstMedia.content.thumbnail, type: 'image' });
                    setIsLoading(false);
                }
            } else if (firstMedia.content.dbKey) {
                getMedia(firstMedia.content.dbKey).then(mediaData => {
                    if (isMounted && mediaData) {
                        setThumbnail({ url: mediaData.url, type: firstMedia.type === ContentBlockType.VIDEO ? 'video' : 'image' });
                    }
                }).finally(() => {
                    if (isMounted) setIsLoading(false);
                });
            } else {
                 if (isMounted) setIsLoading(false);
            }
        } else {
            if (isMounted) setIsLoading(false);
        }
        return () => { isMounted = false; };
    }, [firstMedia]);

    const handleCardClick = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button[data-delete]')) {
        return;
      }
      onSelectNote(note.id);
    };
  
    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm(`Delete "${note.title || 'Untitled Note'}"?`)) {
        onDeleteNote(note.id);
      }
    };
  
    const bgColorVar = categoryColors[index % categoryColors.length];
  
    const renderCard = () => (
      <div 
        style={{ backgroundColor: `hsl(var(${bgColorVar}))` }}
        className="p-5 h-full flex flex-col justify-between"
      >
        <div className="flex-1 min-w-0 overflow-hidden">
          <h3 className="font-bold text-lg text-cat-foreground truncate mb-2">
            {note.title || 'Untitled Note'}
          </h3>
          <p 
            className="text-sm text-cat-foreground/70 break-words overflow-hidden" 
            style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
          >
            {getNoteSnippet(note)}
          </p>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-cat-foreground/70">
              {formatDate(note.createdAt)}
            </span>
            <DocumentIcon className="w-4 h-4 text-cat-foreground/70" />
          </div>

          {/* Media thumbnail frames - show up to 4 */}
          {mediaThumbnails.length > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {mediaThumbnails.map((media, idx) => (
                <div 
                  key={idx} 
                  className="relative w-10 h-14 rounded border-2 border-cat-foreground/30 overflow-hidden bg-cat-foreground/10"
                >
                  {media.type === 'video' ? (
                    <>
                      <video 
                        src={media.url} 
                        className="w-full h-full object-cover" 
                        muted 
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <VideoCameraIcon className="w-3 h-3 text-white/90 drop-shadow" />
                      </div>
                    </>
                  ) : (
                    <img 
                      src={media.url} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );

    const renderLoadingCard = () => (
        <div className="w-full h-full bg-secondary animate-pulse" />
    );

    return (
      <div 
        onClick={handleCardClick}
        className="relative h-48 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 group overflow-hidden bg-card"
      >
        {isLoading ? renderLoadingCard() : renderCard()}
        
        <button
          data-delete
          onClick={handleDelete}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
          type="button"
          aria-label="Delete note"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-background text-foreground p-6 md:p-12 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-foreground">Library</h1>
          
          <div className="flex flex-wrap gap-4 w-full sm:w-auto">
            {masterPeopleList.length > 0 && (
              <div className="relative w-full sm:w-52" ref={personDropdownRef}>
                <button
                  onClick={() => setIsPersonDropdownOpen(!isPersonDropdownOpen)}
                  className="appearance-none bg-secondary text-foreground text-sm rounded-lg focus:outline-none block w-full pl-4 pr-10 py-2.5 text-left flex items-center justify-between transition-colors"
                >
                  <span className="truncate">{selectedPerson || 'Filter by person'}</span>
                  {selectedPerson ? (
                     <button 
                       type="button" 
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         handlePersonSelect(null); 
                       }} 
                       className="p-1 rounded-full hover:bg-accent"
                       aria-label="Clear person filter"
                     >
                        <XMarkIcon className="w-4 h-4 text-muted-foreground" />
                     </button>
                  ) : (
                     <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {isPersonDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto animate-in fade-in">
                    <div className="p-2 sticky top-0 bg-popover">
                       <input
                          type="text" 
                          placeholder="Search people..." 
                          value={personSearch} 
                          onChange={(e) => setPersonSearch(e.target.value)}
                          className="w-full bg-background rounded-md py-2 pl-3 pr-2 text-sm focus:outline-none" 
                          autoFocus
                       />
                    </div>
                    <ul className="py-1">
                      <li 
                        onClick={() => handlePersonSelect(null)} 
                        className="text-foreground cursor-pointer select-none relative py-2 px-3 hover:bg-accent"
                      >
                        All People
                      </li>
                      {filteredPeople.map(person => (
                        <li 
                          key={person} 
                          onClick={() => handlePersonSelect(person)} 
                          className={`cursor-pointer select-none relative py-2 px-3 hover:bg-accent ${selectedPerson === person ? 'text-primary' : 'text-foreground'}`}
                        >
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
                  className="appearance-none bg-secondary text-foreground text-sm rounded-lg focus:outline-none block w-full pl-4 pr-10 py-2.5 text-left flex items-center justify-between transition-colors"
                >
                  <span className="truncate">{selectedTag ? `#${selectedTag}` : 'Filter by tag'}</span>
                  {selectedTag ? (
                     <button 
                       type="button" 
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         handleTagSelect(null); 
                       }} 
                       className="p-1 rounded-full hover:bg-accent"
                       aria-label="Clear tag filter"
                     >
                        <XMarkIcon className="w-4 h-4 text-muted-foreground" />
                     </button>
                  ) : (
                     <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {isTagDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto animate-in fade-in">
                    <div className="p-2 sticky top-0 bg-popover">
                       <input
                          type="text" 
                          placeholder="Search tags..." 
                          value={tagSearch} 
                          onChange={(e) => setTagSearch(e.target.value)}
                          className="w-full bg-background rounded-md py-2 pl-3 pr-2 text-sm focus:outline-none" 
                          autoFocus
                       />
                    </div>
                    <ul className="py-1">
                      <li 
                        onClick={() => handleTagSelect(null)} 
                        className="text-foreground cursor-pointer select-none relative py-2 px-3 hover:bg-accent"
                      >
                        All Tags
                      </li>
                      {filteredTags.map(tag => (
                        <li 
                          key={tag} 
                          onClick={() => handleTagSelect(tag)} 
                          className={`cursor-pointer select-none relative py-2 px-3 hover:bg-accent ${selectedTag === tag ? 'text-primary' : 'text-foreground'}`}
                        >
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
            {filteredNotes.map((note, index) => (
              <NoteCard key={note.id} note={note} index={index} knownFaces={knownFaces} />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground mt-16">
            {selectedTag || selectedPerson ? (
                <>
                    {selectedPerson ? <UserIcon className="w-12 h-12 mx-auto mb-4" /> : <TagIcon className="w-12 h-12 mx-auto mb-4" />}
                    <h2 className="text-xl font-semibold text-foreground">No Notes Found</h2>
                    <p className="mt-2">No notes match your current filter.</p>
                    <button 
                      onClick={() => { 
                        setSelectedTag(null); 
                        setSelectedPerson(null); 
                      }} 
                      className="mt-4 text-primary hover:underline"
                    >
                      Clear Filters
                    </button>
                </>
            ) : (
                <>
                    <DocumentIcon className="w-12 h-12 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-foreground">Your Library is Empty</h2>
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
