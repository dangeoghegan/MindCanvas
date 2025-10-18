import React, { useState, useEffect } from 'react';
import { Note, ContentBlock, ContentBlockType, ChatMessage, ChecklistItem, ChatMessageSourceNote } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import NoteEditor from './components/NoteEditor';
import ReviewView from './components/ReviewView';
import AIPromptBar from './components/AIPromptBar';
import ChatView from './components/ChatView';
import LibraryView from './components/LibraryView';
import MediaView from './components/MediaView';
import BottomNavBar from './components/BottomNavBar';
import { answerQuestionFromContext } from './services/geminiService';
import { initDB, saveMedia } from './services/dbService';

const initialNotes: Note[] = [
    {
        id: 'welcome-note',
        title: 'Welcome to MindCanvas',
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
        ]
    }
];

const getTextBlockAsString = (block: ContentBlock): string => {
    switch (block.type) {
        case ContentBlockType.HEADER:
        case ContentBlockType.TEXT:
            return block.content.text || '';
        case ContentBlockType.CHECKLIST:
            return block.content.items.map((item: ChecklistItem) => `- [${item.checked ? 'x' : ' '}] ${item.text}`).join('\n');
        case ContentBlockType.IMAGE:
        case ContentBlockType.VIDEO:
            return block.content.description ? `[${block.type}: ${block.content.description}]` : '';
        default:
            return '';
    }
};

function App() {
  const [notes, setNotes] = useLocalStorage<Note[]>('mind-canvas-notes', initialNotes);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'dashboard' | 'note' | 'chat' | 'library' | 'media'>('library');
  const [previousView, setPreviousView] = useState<'dashboard' | 'library' | 'media'>('library');

  const [chatMessages, setChatMessages] = useLocalStorage<ChatMessage[]>('mind-canvas-chat-history', []);
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    const runMigration = async () => {
        const migrationKey = 'mind-canvas-migration-v2-complete';
        if (localStorage.getItem(migrationKey)) {
            return;
        }

        console.log('Running data migration to IndexedDB...');
        await initDB();

        const notesFromStorage = localStorage.getItem('mind-canvas-notes');
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
                                mimeType: block.content.mimeType,
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
    
    initDB();
    runMigration();
  }, [setNotes]);

  const activeNote = notes.find(note => note.id === activeNoteId) || null;

  const handleNewNote = () => {
    const newNote: Note = {
      id: self.crypto.randomUUID(),
      title: 'Untitled Note',
      createdAt: new Date().toISOString(),
      content: [{ id: self.crypto.randomUUID(), type: ContentBlockType.TEXT, content: { text: '' }, createdAt: new Date().toISOString() }],
    };
    setNotes([newNote, ...notes]);
    setActiveNoteId(newNote.id);
    setCurrentView('note');
  };
  
  const handleUpdateNote = (updatedNote: Note) => {
    setNotes(prevNotes => 
        prevNotes.map(note => (note.id === updatedNote.id ? updatedNote : note))
    );
  };

  const handleCloseNote = () => {
    setActiveNoteId(null);
    setCurrentView(previousView);
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes(notes.filter(note => note.id !== noteId));
    if (activeNoteId === noteId) {
        handleCloseNote();
    }
  }

  const handleSelectNote = (id: string) => {
    if (currentView !== 'chat' && currentView !== 'note') {
        setPreviousView(currentView as 'dashboard' | 'library' | 'media');
    }
    setActiveNoteId(id);
    setCurrentView('note');
  };

  const handleSetView = (view: 'dashboard' | 'chat' | 'library' | 'media') => {
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
      return <NoteEditor note={activeNote} updateNote={handleUpdateNote} deleteNote={handleDeleteNote} onClose={handleCloseNote} />;
    }
    switch (currentView) {
      case 'chat':
        return <ChatView messages={chatMessages} onSendMessage={handleSendChatMessage} isLoading={isChatLoading} onSelectNote={handleSelectNote} />;
      case 'library':
        return <LibraryView notes={notes} onSelectNote={handleSelectNote} />;
      case 'media':
        return <MediaView notes={notes} onSelectNote={handleSelectNote} />;
      case 'dashboard':
      default:
        return <ReviewView notes={notes} onNewNote={handleNewNote} />;
    }
  };
  
  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col font-sans">
      <main className="flex-1 flex flex-col overflow-y-auto pb-24">
        {renderView()}
      </main>
      {currentView === 'note' && activeNote ? (
        <AIPromptBar onAskAI={handleAskAI} isLoading={isLoadingAI} aiResponse={aiResponse} clearResponse={() => setAiResponse(null)} />
      ) : (
        <BottomNavBar
            currentView={currentView}
            onSetView={handleSetView}
            onNewNote={handleNewNote}
        />
      )}
    </div>
  );
}

export default App;