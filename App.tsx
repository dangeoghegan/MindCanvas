import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Note, ContentBlock, ContentBlockType, ChatMessage, ChecklistItem, ChatMessageSourceNote, AutoDeleteRule, RetentionPeriod, VoiceName, Theme, AITask } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import NoteEditor from './components/NoteEditor';
import ReviewView from './components/ReviewView';
import AIPromptBar from './components/AIPromptBar';
import ChatView from './components/ChatView';
import LibraryView from './components/LibraryView';
import MediaView from './components/MediaView';
import SettingsView from './components/SettingsView';
import BottomNavBar from './components/BottomNavBar';
import { ConversationModeOverlay } from './components/ConversationModeOverlay';
import { answerQuestionFromContext, generateTitle, generateImageDescription, summarizeVideo, summarizeAudio, generateTagsForNote, summarizePdf } from './services/geminiService';
import { initDB, saveMedia, getMedia, deleteMedia } from './services/dbService';
import { faceRecognitionService } from './services/faceRecognitionService';

const initialNotes: Note[] = [
    {
        id: 'welcome-note',
        title: 'Welcome to Granula',
        createdAt: new Date().toISOString(),
        content: [
            { id: 'h1', type: ContentBlockType.HEADER, content: { text: 'Start Here' }, createdAt: new Date().toISOString() },
            { id: 'p1', type: ContentBlockType.TEXT, content: { text: 'The best way to start is to have a purpose for it:' }, createdAt: new Date().toISOString() },
            { id: 'c1', type: ContentBlockType.CHECKLIST, content: { items: [
                {id: 'ci1', text: 'Taking notes on a book or video', checked: true},
                {id: 'ci2', text: 'Writing social content, articles, or video scripts', checked: false},
                {id: 'ci3', text: 'Creating templates, outlines, or client worksheets', checked: false},
            ]}, createdAt: new Date().toISOString()},
            { id: 'p2', type: ContentBlockType.TEXT, content: { text: 'Try asking a question about this note in the AI bar below!' }, createdAt: new Date().toISOString() },
        ],
        tags: ['welcome', 'getting-started', 'productivity'],
        people: ['Jane Doe', 'John Smith'],
    }
];

const getTextBlockAsString = (block: ContentBlock): string => {
    switch (block.type) {
        case ContentBlockType.HEADER:
        case ContentBlockType.TEXT:
            return block.content.text || '';
        case ContentBlockType.CHECKLIST:
            return (block.content.items || []).map((item: ChecklistItem) => `- [${item.checked ? 'x' : ' '}] ${item.text}`).join('\n');
        case ContentBlockType.IMAGE:
            return block.content.description ? `[Image: ${block.content.description}]` : '';
        case ContentBlockType.VIDEO:
             return block.content.summary ? `[Video Summary: ${block.content.summary}]` : (block.content.description ? `[Video: ${block.content.description}]` : '');
        default:
            return '';
    }
};

const getNoteContentAsStringForTitle = (note: Note): string => {
    return note.content.map(block => {
        switch (block.type) {
            case ContentBlockType.HEADER:
            case ContentBlockType.TEXT:
                return block.content.text || '';
            case ContentBlockType.CHECKLIST:
                return (block.content.items || []).map((item: ChecklistItem) => `- ${item.text}`).join('\n');
            case ContentBlockType.IMAGE:
                return block.content.description ? `[Image: ${block.content.description}]` : '';
            case ContentBlockType.VIDEO:
                 return block.content.summary ? `[Video Summary: ${block.content.summary}]` : (block.content.description ? `[Video: ${block.content.description}]` : '');
            case ContentBlockType.AUDIO:
                 return block.content.summary ? `[Audio Summary: ${block.content.summary}]` : '';
            case ContentBlockType.EMBED:
                 return block.content.title || block.content.summary ? `[Link: ${block.content.title} - ${block.content.summary}]` : '';
            default:
                return '';
        }
    }).filter(text => text.trim() !== '').join('\n\n');
};


function App() {
  const [notes, setNotes] = useLocalStorage<Note[]>('granula-notes', initialNotes);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'dashboard' | 'note' | 'chat' | 'library' | 'media' | 'settings'>('library');
  const [previousView, setPreviousView] = useState<'dashboard' | 'library' | 'media' | 'settings'>('library');

  const [chatMessages, setChatMessages] = useLocalStorage<ChatMessage[]>('granula-chat-history', []);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [masterPeopleList, setMasterPeopleList] = useLocalStorage<string[]>('granula-people', ['Jane Doe', 'John Smith']);
  const [autoDeleteRules, setAutoDeleteRules] = useLocalStorage<AutoDeleteRule[]>('granula-auto-delete-rules', []);
  const [selectedVoice, setSelectedVoice] = useLocalStorage<VoiceName>('granula-selected-voice', 'Kore');
  const [theme, setTheme] = useLocalStorage<Theme>('granula-theme', 'light');

  const [isConversationModeActive, setIsConversationModeActive] = useState(false);
  const [shortcutAction, setShortcutAction] = useState<{ noteId: string; action: 'photo' | 'video' | 'audio' | 'dictate' | 'embed' | 'ai-checklist' } | null>(null);

  // Background Task Queue
  const [taskQueue, setTaskQueue] = useLocalStorage<AITask[]>('granula-ai-task-queue', []);
  const [isTaskRunning, setIsTaskRunning] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const addPersonToMasterList = (name: string) => {
    const trimmedName = name.trim();
    if (trimmedName && !masterPeopleList.find(p => p.toLowerCase() === trimmedName.toLowerCase())) {
        setMasterPeopleList(prev => [...prev, trimmedName].sort());
    }
  };

  const removePersonFromMasterList = (nameToRemove: string) => {
      setMasterPeopleList(prev => prev.filter(p => p !== nameToRemove));
      // Also remove the person from all notes
      setNotes(prevNotes => prevNotes.map(note => ({
          ...note,
          people: (note.people || []).filter(p => p !== nameToRemove)
      })));
  };

  const addAutoDeleteRule = (rule: AutoDeleteRule) => {
    setAutoDeleteRules(prev => {
        const existing = prev.find(r => r.tag === rule.tag);
        if (existing) return prev;
        return [...prev, rule];
    });
  };

  const removeAutoDeleteRule = (tag: string) => {
    setAutoDeleteRules(prev => prev.filter(r => r.tag !== tag));
  };
  
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    notes.forEach(note => {
      if (note.tags) {
        note.tags.forEach(tag => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).sort();
  }, [notes]);


  useEffect(() => {
    initDB();
    faceRecognitionService.loadModels().catch(err => {
        console.error("Could not load face recognition models on startup:", err);
    });
  }, []);

  const handleNewNote = useCallback(() => {
    const newNote: Note = {
      id: self.crypto.randomUUID(),
      title: 'Untitled Note',
      createdAt: new Date().toISOString(),
      content: [{ id: self.crypto.randomUUID(), type: ContentBlockType.TEXT, content: { text: '' }, createdAt: new Date().toISOString() }],
    };
    setNotes(prevNotes => [newNote, ...prevNotes]);
    setActiveNoteId(newNote.id);
    setCurrentView('note');
  }, [setNotes, setActiveNoteId, setCurrentView]);

  const handleShortcut = useCallback((action: 'photo' | 'video' | 'audio' | 'dictate' | 'embed' | 'ai-checklist') => {
    let content: ContentBlock[] = [];
    if (action === 'embed') {
        content.push({ 
            id: self.crypto.randomUUID(), 
            type: ContentBlockType.EMBED, 
            content: {}, 
            createdAt: new Date().toISOString() 
        });
    }

    const newNote: Note = {
      id: self.crypto.randomUUID(),
      title: 'Untitled Note',
      createdAt: new Date().toISOString(),
      content: content,
    };
    setNotes(prev => [newNote, ...prev]);
    setShortcutAction({ noteId: newNote.id, action });
    setActiveNoteId(newNote.id);
    setCurrentView('note');
  }, [setNotes, setShortcutAction, setActiveNoteId, setCurrentView]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');

    if (action) {
      // Use a timeout to ensure the app is ready for the action
      setTimeout(() => {
        switch (action) {
          case 'new-note':
            handleNewNote();
            break;
          case 'take-photo':
            handleShortcut('photo');
            break;
          case 'record-video':
            handleShortcut('video');
            break;
          case 'record-audio':
            handleShortcut('audio');
            break;
          case 'conversation':
            setIsConversationModeActive(true);
            break;
          default:
            console.warn(`Unknown shortcut action: ${action}`);
        }
      }, 100); // Small delay to allow initial render to complete

      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [handleNewNote, handleShortcut, setIsConversationModeActive]);

  useEffect(() => {
    const runMigration = async () => {
        const migrationKey = 'granula-migration-v1-complete';
        if (localStorage.getItem(migrationKey)) {
            return;
        }

        console.log('Running data migration to IndexedDB...');
        await initDB();

        const notesFromStorage = localStorage.getItem('granula-notes');
        if (!notesFromStorage) {
            localStorage.setItem(migrationKey, 'true');
            return;
        }

        try {
            const currentNotes: Note[] = JSON.parse(notesFromStorage);
            let migrationOccurred = false;

            const updatedNotes = await Promise.all(currentNotes.map(async (note) => {
                const updatedContent = await Promise.all(note.content.map(async (block) => {
                    const mediaTypes = [ContentBlockType.IMAGE, ContentBlockType.VIDEO, ContentBlockType.AUDIO, ContentBlockType.FILE];
                    if (mediaTypes.includes(block.type) && block.content.url && block.content.url.startsWith('data:')) {
                        migrationOccurred = true;
                        try {
                            await saveMedia(block.id, {
                                url: block.content.url,
                                mimeType: block.content.mimeType || '',
                                name: block.content.name
                            });
                            const { url, ...restOfContent } = block.content;
                            return { ...block, content: { ...restOfContent, dbKey: block.id } };
                        } catch (error) {
                            console.error(`Failed to migrate block ${block.id}:`, error);
                            return block;
                        }
                    }
                    return block;
                }));
                return { ...note, content: updatedContent };
            }));

            if (migrationOccurred) {
                setNotes(updatedNotes); 
                console.log('Data migration complete.');
            }
            
            localStorage.setItem(migrationKey, 'true');
        } catch (error) {
            console.error('Error during data migration:', error);
            localStorage.setItem(migrationKey, 'true');
        }
    };
    
    runMigration();
  }, [setNotes]);

    // --- Start of Background Task Manager ---
    // Effect 1: Discover and queue new tasks
    useEffect(() => {
        const newTasks: AITask[] = [];
        const existingTaskIds = new Set(taskQueue.map(t => t.id));

        for (const note of notes) {
            // Task: Face Recognition
            for (const block of note.content) {
                if (block.type === ContentBlockType.IMAGE && block.content.dbKey && typeof block.content.faces === 'undefined' && !block.content.isRecognizingFaces) {
                    const taskId = `${note.id}-${block.id}-recognizeFaces`;
                    if (!existingTaskIds.has(taskId)) {
                        newTasks.push({ id: taskId, type: 'recognizeFaces', noteId: note.id, blockId: block.id });
                    }
                }
            }

            // Task: Media Processing (Summaries, Descriptions)
            for (const block of note.content) {
                if (block.content.dbKey) {
                    const isImage = block.type === ContentBlockType.IMAGE && !block.content.description && !block.content.isGeneratingDescription && !block.content.descriptionError && typeof block.content.faces !== 'undefined';
                    const isVideo = block.type === ContentBlockType.VIDEO && !block.content.summary && !block.content.isGeneratingSummary && !block.content.summaryError;
                    const isAudio = block.type === ContentBlockType.AUDIO && !block.content.summary && !block.content.isGeneratingSummary && !block.content.summaryError;
                    const isPdf = block.type === ContentBlockType.FILE && block.content.mimeType === 'application/pdf' && !block.content.summary && !block.content.isGeneratingSummary && !block.content.summaryError;

                    if (isImage) {
                        const taskId = `${note.id}-${block.id}-generateImageDescription`;
                        if (!existingTaskIds.has(taskId)) newTasks.push({ id: taskId, type: 'generateImageDescription', noteId: note.id, blockId: block.id });
                    }
                    if (isVideo) {
                        const taskId = `${note.id}-${block.id}-summarizeVideo`;
                        if (!existingTaskIds.has(taskId)) newTasks.push({ id: taskId, type: 'summarizeVideo', noteId: note.id, blockId: block.id });
                    }
                    if (isAudio) {
                        const taskId = `${note.id}-${block.id}-summarizeAudio`;
                        if (!existingTaskIds.has(taskId)) newTasks.push({ id: taskId, type: 'summarizeAudio', noteId: note.id, blockId: block.id });
                    }
                    if (isPdf) {
                        const taskId = `${note.id}-${block.id}-summarizePdf`;
                        if (!existingTaskIds.has(taskId)) newTasks.push({ id: taskId, type: 'summarizePdf', noteId: note.id, blockId: block.id });
                    }
                }
            }

            // Task: Generate Title
            const hasMeaningfulContent = note.content.some(b => (b.content.text || '').length > 10 || b.content.dbKey || b.content.url);
            if (note.title === 'Untitled Note' && hasMeaningfulContent && !note.titleIsGenerating && !note.titleError) {
                const taskId = `${note.id}-note-generateTitle`;
                if (!existingTaskIds.has(taskId)) newTasks.push({ id: taskId, type: 'generateTitle', noteId: note.id });
            }

            // Task: Generate Tags
            if (!note.tags && !note.tagsAreGenerating && !note.tagsError && getNoteContentAsStringForTitle(note).trim().length > 20) {
                const taskId = `${note.id}-note-generateTags`;
                if (!existingTaskIds.has(taskId)) newTasks.push({ id: taskId, type: 'generateTags', noteId: note.id });
            }
        }

        if (newTasks.length > 0) {
            setTaskQueue(currentQueue => [...currentQueue, ...newTasks]);
        }
    }, [notes, taskQueue]);

    // Effect 2: Process the task queue
    useEffect(() => {
        if (isTaskRunning || taskQueue.length === 0) {
            return;
        }

        const runTask = async () => {
            setIsTaskRunning(true);
            const task = taskQueue[0];
            
            try {
                // Find the note and block for the task
                const note = notes.find(n => n.id === task.noteId);
                if (!note) throw new Error(`Note ${task.noteId} not found for task.`);
                const block = task.blockId ? note.content.find(b => b.id === task.blockId) : null;

                // --- Execute Task ---
                switch (task.type) {
                    case 'recognizeFaces':
                        if (block && block.content.dbKey) {
                            setNotes(currentNotes => currentNotes.map(n => n.id === note.id ? { ...n, content: n.content.map(b => b.id === block.id ? { ...b, content: { ...b.content, isRecognizingFaces: true, faceRecognitionError: null } } : b) } : n));
                            const media = await getMedia(block.content.dbKey);
                            if (media?.url) {
                                const knownFaces = faceRecognitionService.loadKnownFaces();
                                if(knownFaces.length > 0){
                                    const imageElement = await faceRecognitionService.createImageElement(media.url);
                                    const detectedFaces = await faceRecognitionService.recognizeFaces(imageElement, knownFaces);
                                    const detectedNames = detectedFaces.filter(f => f.name !== 'Unknown').map(f => f.name);
                                    setNotes(currentNotes => currentNotes.map(n => {
                                        if (n.id === note.id) {
                                            const existingPeople = new Set(n.people || []);
                                            detectedNames.forEach(name => existingPeople.add(name));
                                            return { ...n, people: Array.from(existingPeople).sort(), content: n.content.map(b => b.id === block.id ? { ...b, content: { ...b.content, isRecognizingFaces: false, faces: detectedFaces } } : b) };
                                        }
                                        return n;
                                    }));
                                } else {
                                     setNotes(currentNotes => currentNotes.map(n => n.id === note.id ? { ...n, content: n.content.map(b => b.id === block.id ? { ...b, content: { ...b.content, isRecognizingFaces: false, faces: [] } } : b) } : n));
                                }
                            }
                        }
                        break;

                    case 'generateImageDescription':
                    case 'summarizeVideo':
                    case 'summarizeAudio':
                    case 'summarizePdf':
                        if (block && block.content.dbKey) {
                            const isImage = task.type === 'generateImageDescription';
                            setNotes(currentNotes => currentNotes.map(n => n.id === note.id ? { ...n, content: n.content.map(b => b.id === block.id ? { ...b, content: { ...b.content, [isImage ? 'isGeneratingDescription' : 'isGeneratingSummary']: true } } : b) } : n));
                            const media = await getMedia(block.content.dbKey);
                            if (media?.url) {
                                let result = '';
                                const base64 = media.url.split(',')[1];
                                if (task.type === 'generateImageDescription') {
                                    const people = (block.content.faces || []).filter(f => f.name !== 'Unknown').map(f => f.name);
                                    result = await generateImageDescription(base64, media.mimeType, people);
                                } else if (task.type === 'summarizeVideo') result = await summarizeVideo(base64, media.mimeType);
                                else if (task.type === 'summarizeAudio') result = await summarizeAudio(base64, media.mimeType);
                                else if (task.type === 'summarizePdf') result = await summarizePdf(base64, media.mimeType);

                                setNotes(currentNotes => currentNotes.map(n => n.id === note.id ? { ...n, content: n.content.map(b => b.id === block.id ? { ...b, content: { ...b.content, [isImage ? 'description' : 'summary']: result, [isImage ? 'isGeneratingDescription' : 'isGeneratingSummary']: false } } : b) } : n));
                            }
                        }
                        break;

                    case 'generateTitle':
                        setNotes(currentNotes => currentNotes.map(n => n.id === note.id ? { ...n, titleIsGenerating: true, titleError: null } : n));
                        const titleContext = getNoteContentAsStringForTitle(note);
                        if(titleContext.trim().length > 15) {
                            const newTitle = await generateTitle(titleContext, note.people || []);
                            setNotes(currentNotes => currentNotes.map(n => n.id === note.id && n.title === 'Untitled Note' ? { ...n, title: newTitle, titleIsGenerating: false } : (n.id === note.id ? { ...n, titleIsGenerating: false } : n)));
                        } else {
                            setNotes(currentNotes => currentNotes.map(n => n.id === note.id ? { ...n, titleIsGenerating: false } : n));
                        }
                        break;
                    
                    case 'generateTags':
                        setNotes(currentNotes => currentNotes.map(n => n.id === note.id ? { ...n, tagsAreGenerating: true, tagsError: null } : n));
                        const tagsContext = getNoteContentAsStringForTitle(note);
                        const newTags = await generateTagsForNote(tagsContext);
                        setNotes(currentNotes => currentNotes.map(n => n.id === note.id ? { ...n, tags: newTags, tagsAreGenerating: false } : n ));
                        break;
                }
            } catch (error: any) {
                console.error(`Error processing task ${task.id}:`, error);
                const errorMessage = error.message || 'An unknown AI error occurred.';
                setNotes(currentNotes => {
                    return currentNotes.map(n => {
                        if (n.id !== task.noteId) return n;
                        
                        let updatedNote = { ...n };
                        if (task.type === 'generateTitle') updatedNote = { ...updatedNote, titleIsGenerating: false, titleError: errorMessage };
                        if (task.type === 'generateTags') updatedNote = { ...updatedNote, tagsAreGenerating: false, tagsError: errorMessage };
                        
                        if (task.blockId) {
                            updatedNote.content = updatedNote.content.map(b => {
                                if (b.id !== task.blockId) return b;
                                let updatedBlock = { ...b };
                                if (task.type === 'recognizeFaces') updatedBlock.content = { ...b.content, isRecognizingFaces: false, faceRecognitionError: errorMessage };
                                if (task.type === 'generateImageDescription') updatedBlock.content = { ...b.content, isGeneratingDescription: false, descriptionError: errorMessage };
                                if (['summarizeVideo', 'summarizeAudio', 'summarizePdf'].includes(task.type)) updatedBlock.content = { ...b.content, isGeneratingSummary: false, summaryError: errorMessage };
                                return updatedBlock;
                            });
                        }
                        return updatedNote;
                    });
                });
            } finally {
                setTaskQueue(currentQueue => currentQueue.slice(1));
                setIsTaskRunning(false);
            }
        };

        runTask();
    }, [taskQueue, isTaskRunning, notes]);
    // --- End of Background Task Manager ---

    useEffect(() => {
        const checkAutoDelete = async () => {
            if (autoDeleteRules.length === 0) return;

            const now = new Date();
            const expiredNoteIds = new Set<string>();

            const getDaysFromPeriod = (period: RetentionPeriod): number => {
                switch (period) {
                    case '1-day': return 1;
                    case '3-days': return 3;
                    case '1-week': return 7;
                    case '1-month': return 30;
                    case '6-months': return 180;
                    case '1-year': return 365;
                    default: return Infinity;
                }
            };

            for (const note of notes) {
                const noteTags = new Set(note.tags || []);
                if (noteTags.size === 0) continue;

                for (const rule of autoDeleteRules) {
                    if (noteTags.has(rule.tag)) {
                        const createdAt = new Date(note.createdAt);
                        const retentionDays = getDaysFromPeriod(rule.period);
                        const expiryDate = new Date(createdAt);
                        expiryDate.setDate(createdAt.getDate() + retentionDays);
                        
                        if (now > expiryDate) {
                            expiredNoteIds.add(note.id);
                            break; 
                        }
                    }
                }
            }

            if (expiredNoteIds.size > 0) {
                const notesToDelete = notes.filter(n => expiredNoteIds.has(n.id));
                for (const note of notesToDelete) {
                    for (const block of note.content) {
                        if (block.content.dbKey) {
                            try {
                                await deleteMedia(block.content.dbKey);
                            } catch (error) {
                                console.error(`Failed to delete media for block ${block.id} in note ${note.id}:`, error);
                            }
                        }
                    }
                }
                setNotes(currentNotes => currentNotes.filter(n => !expiredNoteIds.has(n.id)));
            }
        };

        const timer = setTimeout(checkAutoDelete, 2000); // Run check shortly after app load
        return () => clearTimeout(timer);
    }, [notes, autoDeleteRules, setNotes]);

  const activeNote = notes.find(note => note.id === activeNoteId) || null;
  
  const handleUpdateNote = (updatedNote: Note) => {
    setNotes(prevNotes => 
        prevNotes.map(note => (note.id === updatedNote.id ? updatedNote : note))
    );
  };

  const handleDeleteNote = async (noteId: string) => {
    const noteToDelete = notes.find(note => note.id === noteId);
    if (noteToDelete) {
        for (const block of noteToDelete.content) {
            if (block.content.dbKey) {
                try {
                    await deleteMedia(block.content.dbKey);
                } catch (error) {
                    console.error(`Failed to delete media for block ${block.id}:`, error);
                }
            }
        }
    }
    
    const noteIsActive = activeNoteId === noteId;
    
    setNotes(currentNotes => currentNotes.filter(note => note.id !== noteId));

    if (noteIsActive) {
        setActiveNoteId(null);
        setCurrentView(previousView);
    }
  };

  const handleCloseNote = () => {
    if (activeNoteId) {
        const noteToClose = notes.find(n => n.id === activeNoteId);

        if (noteToClose) {
            const isTitleEmpty = noteToClose.title === 'Untitled Note';
            const isContentEmpty = 
                noteToClose.content.length === 0 || 
                (noteToClose.content.length === 1 &&
                 noteToClose.content[0].type === ContentBlockType.TEXT &&
                 !noteToClose.content[0].content.text?.trim());
            const hasNoTags = !noteToClose.tags || noteToClose.tags.length === 0;
            const hasNoPeople = !noteToClose.people || noteToClose.people.length === 0;

            const isProcessing = noteToClose.titleIsGenerating ||
                                 noteToClose.tagsAreGenerating ||
                                 noteToClose.isAiChecklistGenerating ||
                                 noteToClose.content.some(b => 
                                     b.content.isGeneratingDescription ||
                                     b.content.isGeneratingSummary ||
                                     b.content.isRecognizingFaces
                                 );

            if (isTitleEmpty && isContentEmpty && hasNoTags && hasNoPeople && !isProcessing) {
                handleDeleteNote(noteToClose.id);
                return;
            }
        }
    }

    setActiveNoteId(null);
    setCurrentView(previousView);
  };

  const handleSelectNote = (id: string) => {
    if (currentView !== 'chat' && currentView !== 'note') {
        setPreviousView(currentView as 'dashboard' | 'library' | 'media' | 'settings');
    }
    setActiveNoteId(id);
    setCurrentView('note');
  };

  const handleSetView = (view: 'dashboard' | 'chat' | 'library' | 'media' | 'settings') => {
      setCurrentView(view);
      setActiveNoteId(null);
  }
  
  const handleAskAI = async (prompt: string) => {
    if (!activeNote) {
        setAiResponse("Please select a note to ask questions about.");
        return;
    }
    setIsLoadingAI(true);
    setAiResponse(null);
    
    const context = activeNote.content
        .map(getTextBlockAsString)
        .filter(text => text.trim() !== '')
        .join('\n');

    const { answer } = await answerQuestionFromContext(prompt, context);
    setAiResponse(answer);
    setIsLoadingAI(false);
  };

  const handleSendChatMessage = async (prompt: string) => {
      const userMessage: ChatMessage = { id: self.crypto.randomUUID(), role: 'user', text: prompt };
      const updatedMessagesWithUser = [...chatMessages, userMessage];
      setChatMessages(updatedMessagesWithUser);
      setIsChatLoading(true);

      try {
        const context = notes.map(note => {
            const contentText = note.content
                .map(getTextBlockAsString)
                .filter(text => text.trim() !== '')
                .join('\n');
            
            if (!contentText.trim()) {
                return '';
            }
            return `## Note: ${note.title || 'Untitled Note'}\n\n${contentText}`;
        })
        .filter(noteText => noteText.trim() !== '')
        .join('\n\n---\n\n');
        
        const { answer, sources } = await answerQuestionFromContext(prompt, context);
        
        const processedSources = sources
          .map(source => {
            const foundNote = notes.find(note => (note.title || 'Untitled Note') === source.noteTitle);
            return foundNote ? { type: 'note' as const, noteId: foundNote.id, noteTitle: foundNote.title || 'Untitled Note' } : null;
          })
          .filter((source): source is ChatMessageSourceNote => source !== null);
        
        const modelMessage: ChatMessage = { 
            id: self.crypto.randomUUID(), 
            role: 'model', 
            text: answer,
            sources: processedSources.length > 0 ? processedSources : undefined,
        };
        setChatMessages([...updatedMessagesWithUser, modelMessage]);
      } catch (error) {
          console.error("Error sending chat message:", error);
          const errorMessage: ChatMessage = { id: self.crypto.randomUUID(), role: 'model', text: "Sorry, I encountered an error. Please try again." };
          setChatMessages([...updatedMessagesWithUser, errorMessage]);
      } finally {
          setIsChatLoading(false);
      }
  };

  const renderView = () => {
    if (currentView === 'note' && activeNote) {
      return <NoteEditor note={activeNote} updateNote={handleUpdateNote} deleteNote={handleDeleteNote} onClose={handleCloseNote} masterPeopleList={masterPeopleList} onAddPersonToMasterList={addPersonToMasterList} shortcutAction={shortcutAction} onShortcutHandled={() => setShortcutAction(null)} />;
    }
    switch (currentView) {
      case 'chat':
        return <ChatView messages={chatMessages} onSendMessage={handleSendChatMessage} isLoading={isChatLoading} onSelectNote={handleSelectNote} notes={notes} selectedVoice={selectedVoice} onStartConversation={() => setIsConversationModeActive(true)} />;
      case 'library':
        return <LibraryView notes={notes} onSelectNote={handleSelectNote} masterPeopleList={masterPeopleList} onSetView={handleSetView as (view: 'settings') => void} onDeleteNote={handleDeleteNote} />;
      case 'media':
        return <MediaView notes={notes} onSelectNote={handleSelectNote} />;
      case 'settings':
        return <SettingsView 
            masterPeopleList={masterPeopleList}
            onAddPerson={addPersonToMasterList}
            onRemovePerson={removePersonFromMasterList}
            onClose={() => setCurrentView('library')}
            allTags={allTags}
            autoDeleteRules={autoDeleteRules}
            onAddAutoDeleteRule={addAutoDeleteRule}
            onRemoveAutoDeleteRule={removeAutoDeleteRule}
            selectedVoice={selectedVoice}
            onSetSelectedVoice={setSelectedVoice}
            theme={theme}
            onSetTheme={setTheme}
        />;
      case 'dashboard':
      default:
        return <ReviewView notes={notes} onNewNote={handleNewNote} />;
    }
  };
  
  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col font-sans">
      {/* ⬇️ Top buffer band + subtle bottom hairline */}
      <div className="shrink-0 relative">
        <div className="h-6" /> {/* adjust to change buffer height */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
      </div>

      <main className="flex-1 flex flex-col overflow-y-auto pb-24">
        {renderView()}
      </main>
      {currentView === 'note' && activeNote ? (
        <AIPromptBar onAskAI={handleAskAI} isLoading={isLoadingAI} aiResponse={aiResponse} clearResponse={() => setAiResponse(null)} />
      ) : (
        <BottomNavBar
            currentView={currentView as 'dashboard' | 'chat' | 'library' | 'media' | 'settings'}
            onSetView={handleSetView}
            onNewNote={handleNewNote}
            onStartConversation={() => setIsConversationModeActive(true)}
            onShortcut={handleShortcut}
        />
      )}
      {isConversationModeActive && <ConversationModeOverlay notes={notes} selectedVoice={selectedVoice} onClose={() => setIsConversationModeActive(false)} />}
    </div>
  );
}

export default App;
