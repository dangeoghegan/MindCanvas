import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Note, ContentBlock, ContentBlockType } from '../types';
import { VideoCameraIcon, PhotoIcon, UserIcon, TagIcon, ChevronDownIcon, XMarkIcon, SpeakerWaveIcon, FileTextIcon } from './icons';
import { getMedia } from '../services/dbService';

interface MediaViewProps {
  notes: Note[];
  onSelectNote: (id: string) => void;
  masterPeopleList: string[];
}

interface MediaItem {
  noteId: string;
  block: ContentBlock;
}

const MediaItemThumbnail: React.FC<{ item: MediaItem; onSelectNote: (noteId: string) => void }> = ({ item, onSelectNote }) => {
    const { noteId, block } = item;
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchMedia = async () => {
            if (block.content.dbKey) {
                setIsLoading(true);
                try {
                    const mediaData = await getMedia(block.content.dbKey);
                    if (mediaData) setMediaUrl(mediaData.url);
                } catch (error) {
                    console.error("Error fetching media for thumbnail:", error);
                } finally {
                    setIsLoading(false);
                }
            } else if (block.content.url) {
                 setMediaUrl(block.content.url);
                 setIsLoading(false);
            } else {
                setIsLoading(false);
            }
        };

        fetchMedia();
    }, [block.content.dbKey, block.content.url]);

    if (isLoading) {
        return <div className="relative aspect-square bg-secondary rounded-lg animate-pulse"></div>;
    }

    if (block.type === ContentBlockType.IMAGE || block.type === ContentBlockType.VIDEO) {
        if (!mediaUrl) return null;
        return (
            <button
                onClick={() => onSelectNote(noteId)}
                className="relative aspect-square bg-secondary rounded-lg overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                {block.type === ContentBlockType.IMAGE && (
                    <img src={mediaUrl} alt="Media content" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                )}
                {block.type === ContentBlockType.VIDEO && (
                    <video src={mediaUrl} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" playsInline muted />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300" />
                {block.type === ContentBlockType.VIDEO && (
                    <div className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full">
                        <VideoCameraIcon className="w-5 h-5 text-white" />
                    </div>
                )}
            </button>
        );
    }

    if (block.type === ContentBlockType.AUDIO || block.type === ContentBlockType.FILE) {
        const isAudio = block.type === ContentBlockType.AUDIO;
        const Icon = isAudio ? SpeakerWaveIcon : FileTextIcon;

        return (
            <button
                onClick={() => onSelectNote(noteId)}
                className="relative aspect-square bg-secondary rounded-lg overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background p-3 flex flex-col items-center justify-center text-center transition-colors hover:bg-accent/10"
            >
                <Icon className="w-1/3 h-1/3 text-muted-foreground mb-2 flex-shrink-0" />
                <p className="text-xs font-semibold text-foreground break-all line-clamp-2">
                    {block.content.name || (isAudio ? 'Audio Clip' : 'File')}
                </p>
            </button>
        );
    }
    
    return null;
};


const MediaView: React.FC<MediaViewProps> = ({ notes, onSelectNote, masterPeopleList }) => {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  
  const [tagSearch, setTagSearch] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const [personSearch, setPersonSearch] = useState('');
  const [isPersonDropdownOpen, setIsPersonDropdownOpen] = useState(false);
  const personDropdownRef = useRef<HTMLDivElement>(null);
  
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

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

  const filteredMediaItems = useMemo(() => {
    let relevantNotes = notes;

    if (selectedPerson) {
      relevantNotes = relevantNotes.filter(note => note.people && note.people.includes(selectedPerson));
    }
    if (selectedTag) {
      relevantNotes = relevantNotes.filter(note => note.tags && note.tags.includes(selectedTag));
    }

    let mediaItems = relevantNotes.flatMap(note =>
      note.content
        .filter(block => 
          (block.type === ContentBlockType.IMAGE || block.type === ContentBlockType.VIDEO || block.type === ContentBlockType.AUDIO || block.type === ContentBlockType.FILE) && 
          (block.content.url || block.content.dbKey)
        )
        .map(block => ({ noteId: note.id, block }))
    );
    
    if (selectedType) {
        mediaItems = mediaItems.filter(item => {
            switch (selectedType) {
                case 'Image': return item.block.type === ContentBlockType.IMAGE;
                case 'Video': return item.block.type === ContentBlockType.VIDEO;
                case 'Audio': return item.block.type === ContentBlockType.AUDIO;
                case 'Document': return item.block.type === ContentBlockType.FILE;
                default: return false;
            }
        });
    }

    return mediaItems;
  }, [notes, selectedPerson, selectedTag, selectedType]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) setIsTagDropdownOpen(false);
      if (personDropdownRef.current && !personDropdownRef.current.contains(event.target as Node)) setIsPersonDropdownOpen(false);
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) setIsTypeDropdownOpen(false);
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
  
  const handleTypeSelect = (type: string | null) => {
    setSelectedType(type);
    setIsTypeDropdownOpen(false);
  }
  
  const MEDIA_TYPES = ['Image', 'Video', 'Audio', 'Document'];

  return (
    <div className="flex-1 bg-background text-foreground p-6 md:p-12 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-foreground">Media</h1>
          <div className="flex flex-wrap gap-4 w-full sm:w-auto">
            
            <div className="relative w-full sm:w-52" ref={typeDropdownRef}>
              <button onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)} className="appearance-none bg-secondary text-foreground text-sm rounded-lg focus:outline-none block w-full pl-4 pr-10 py-2.5 text-left flex items-center justify-between transition-colors">
                <span className="truncate">{selectedType || 'Filter by type'}</span>
                {selectedType ? (
                   <button type="button" onClick={(e) => { e.stopPropagation(); handleTypeSelect(null); }} className="p-1 rounded-full hover:bg-accent" aria-label="Clear type filter"><XMarkIcon className="w-4 h-4 text-muted-foreground" /></button>
                ) : ( <ChevronDownIcon className="w-4 h-4 text-muted-foreground" /> )}
              </button>
              {isTypeDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto animate-in fade-in">
                  <ul className="py-1">
                    <li onClick={() => handleTypeSelect(null)} className="text-foreground cursor-pointer select-none relative py-2 px-3 hover:bg-accent">All Media</li>
                    {MEDIA_TYPES.map(type => ( <li key={type} onClick={() => handleTypeSelect(type)} className={`cursor-pointer select-none relative py-2 px-3 hover:bg-accent ${selectedType === type ? 'text-primary' : 'text-foreground'}`}>{type}</li> ))}
                  </ul>
                </div>
              )}
            </div>

            {masterPeopleList.length > 0 && (
              <div className="relative w-full sm:w-52" ref={personDropdownRef}>
                <button onClick={() => setIsPersonDropdownOpen(!isPersonDropdownOpen)} className="appearance-none bg-secondary text-foreground text-sm rounded-lg focus:outline-none block w-full pl-4 pr-10 py-2.5 text-left flex items-center justify-between transition-colors">
                  <span className="truncate">{selectedPerson || 'Filter by person'}</span>
                  {selectedPerson ? (
                     <button type="button" onClick={(e) => { e.stopPropagation(); handlePersonSelect(null); }} className="p-1 rounded-full hover:bg-accent" aria-label="Clear person filter"><XMarkIcon className="w-4 h-4 text-muted-foreground" /></button>
                  ) : ( <ChevronDownIcon className="w-4 h-4 text-muted-foreground" /> )}
                </button>
                {isPersonDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto animate-in fade-in">
                    <div className="p-2 sticky top-0 bg-popover"><input type="text" placeholder="Search people..." value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} className="w-full bg-background rounded-md py-2 pl-3 pr-2 text-sm focus:outline-none" autoFocus /></div>
                    <ul className="py-1">
                      <li onClick={() => handlePersonSelect(null)} className="text-foreground cursor-pointer select-none relative py-2 px-3 hover:bg-accent">All People</li>
                      {filteredPeople.map(person => ( <li key={person} onClick={() => handlePersonSelect(person)} className={`cursor-pointer select-none relative py-2 px-3 hover:bg-accent ${selectedPerson === person ? 'text-primary' : 'text-foreground'}`}>{person}</li> ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {allTags.length > 0 && (
              <div className="relative w-full sm:w-52" ref={tagDropdownRef}>
                <button onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)} className="appearance-none bg-secondary text-foreground text-sm rounded-lg focus:outline-none block w-full pl-4 pr-10 py-2.5 text-left flex items-center justify-between transition-colors">
                  <span className="truncate">{selectedTag ? `#${selectedTag}` : 'Filter by tag'}</span>
                  {selectedTag ? (
                     <button type="button" onClick={(e) => { e.stopPropagation(); handleTagSelect(null); }} className="p-1 rounded-full hover:bg-accent" aria-label="Clear tag filter"><XMarkIcon className="w-4 h-4 text-muted-foreground" /></button>
                  ) : ( <ChevronDownIcon className="w-4 h-4 text-muted-foreground" /> )}
                </button>
                {isTagDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto animate-in fade-in">
                    <div className="p-2 sticky top-0 bg-popover"><input type="text" placeholder="Search tags..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} className="w-full bg-background rounded-md py-2 pl-3 pr-2 text-sm focus:outline-none" autoFocus /></div>
                    <ul className="py-1">
                      <li onClick={() => handleTagSelect(null)} className="text-foreground cursor-pointer select-none relative py-2 px-3 hover:bg-accent">All Tags</li>
                      {filteredTags.map(tag => ( <li key={tag} onClick={() => handleTagSelect(tag)} className={`cursor-pointer select-none relative py-2 px-3 hover:bg-accent ${selectedTag === tag ? 'text-primary' : 'text-foreground'}`}>#{tag}</li> ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {filteredMediaItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredMediaItems.map((item) => (
              <MediaItemThumbnail key={item.block.id} item={item} onSelectNote={onSelectNote} />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground mt-16">
             {selectedTag || selectedPerson || selectedType ? (
                <>
                    <PhotoIcon className="w-12 h-12 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-foreground">No Media Found</h2>
                    <p className="mt-2">No media items match your current filter.</p>
                    <button onClick={() => { setSelectedTag(null); setSelectedPerson(null); setSelectedType(null); }} className="mt-4 text-primary hover:underline">Clear Filters</button>
                </>
            ) : (
                <>
                    <PhotoIcon className="w-12 h-12 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-foreground">No Media Found</h2>
                    <p className="mt-2">Add images, videos, audio, or documents to your notes to see them here.</p>
                </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaView;