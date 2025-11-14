import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Note, ContentBlock, ContentBlockType, ChecklistItem } from '../types';
// FIX: Changed import to a default import to match the export type in ContentBlockComponent.
import ContentBlockComponent from './ContentBlockComponent';
import { SparklesIcon, MicrophoneIcon, StopIcon, AttachFileIcon, ArrowLeftIcon, TrashIcon, XMarkIcon, CameraIcon, PhotoIcon, VideoCameraIcon, LinkIcon, ShareIcon, CalendarDaysIcon } from './icons';
// FIX: Renamed function to match export from geminiService.
import { generateChecklistFromAudio, answerQuestionAboutImage } from '../services/geminiService';
// FIX: Imported 'getMedia' to resolve 'Cannot find name' error.
import { saveMedia, deleteMedia, getMedia } from '../services/dbService';
import { DictateButton } from './DictateButton';
import { useWhisper } from '../hooks/useWhisper';
import { shareNote } from '../services/shareService';

interface NoteEditorProps {
  note: Note;
  updateNote: (updatedNote: Note) => void;
  deleteNote: (noteId: string) => void;
  onClose: () => void;
  shortcutAction: { noteId: string; action: 'photo' | 'video' | 'audio' | 'dictate' | 'embed' | 'ai-checklist' | 'camera-menu' } | null;
  onShortcutHandled: () => void;
  onViewImage: (url: string, alt: string) => void;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

const dmsToDecimal = (dms: number[], ref: string): number => {
    if (!dms || dms.length !== 3) return 0;
    const [degrees, minutes, seconds] = dms;
    let dd = degrees + minutes / 60 + seconds / 3600;
    if (ref === 'S' || ref === 'W') {
        dd *= -1;
    }
    return dd;
};

const getExifData = (file: File): Promise<{ photoTakenAt: string | null; location: { lat: number; lon: number } | null }> => {
    return new Promise((resolve) => {
        const EXIF = (window as any).EXIF;
        if (!EXIF) {
            console.warn("EXIF.js library not found.");
            return resolve({ photoTakenAt: null, location: null });
        }

        EXIF.getData(file, function(this: any) {
            const dateTime = EXIF.getTag(this, "DateTimeOriginal");
            let isoDate: string | null = null;
            if (dateTime) {
                try {
                    const parts = dateTime.split(' ');
                    const dateParts = parts[0].split(':');
                    const timeParts = parts.length > 1 ? parts[1].split(':') : ['00', '00', '00'];
                    isoDate = new Date(
                        parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10),
                        parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), parseInt(timeParts[2], 10)
                    ).toISOString();
                } catch(e) {
                    console.error("Error parsing EXIF date:", e);
                }
            }

            const lat = EXIF.getTag(this, "GPSLatitude");
            const lon = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef");
            const lonRef = EXIF.getTag(this, "GPSLongitudeRef");
            let location: { lat: number; lon: number } | null = null;

            if (lat && lon && latRef && lonRef) {
                try {
                    const latitude = dmsToDecimal(lat, latRef);
                    const longitude = dmsToDecimal(lon, lonRef);
                    if (latitude !== 0 || longitude !== 0) {
                        location = { lat: latitude, lon: longitude };
                    }
                } catch (e) {
                    console.error("Error parsing EXIF GPS data:", e);
                }
            }
            
            resolve({ photoTakenAt: isoDate, location });
        });
    });
};


const NoteEditor: React.FC<NoteEditorProps> = ({ note, updateNote, deleteNote, onClose, shortcutAction, onShortcutHandled, onViewImage }) => {
  const [isAiChecklistLoading, setIsAiChecklistLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const [isRecordingForChecklist, setIsRecordingForChecklist] = useState(false);
  const [checklistRecordingTime, setChecklistRecordingTime] = useState(0);

  const [askingImageAIBlockId, setAskingImageAIBlockId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  
  const genericFileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const activeInputRef = useRef<{ blockId: string; itemId?: string; element: HTMLTextAreaElement | HTMLInputElement } | null>(null);

  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  const [isCameraMenuOpen, setIsCameraMenuOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const [dictationState, setDictationState] = useState<{
    blockId: string;
    itemId?: string;
    startPos: number;
    initialValue: string;
  } | null>(null);

  const handleTranscription = useCallback((result: { text: string; isFinal: boolean }) => {
    setDictationState(currentDictationState => {
        if (!currentDictationState) return null;

        const { blockId, itemId, startPos, initialValue } = currentDictationState;
        
        const space = initialValue.length > 0 && startPos > 0 && initialValue[startPos - 1] !== ' ' && initialValue[startPos - 1] !== '\n' ? ' ' : '';
        const textToInsert = space + result.text;
        const newValue = initialValue.substring(0, startPos) + textToInsert + initialValue.substring(startPos);

        const newContent = noteRef.current.content.map(b => {
            if (b.id === blockId) {
                if (b.type === ContentBlockType.CHECKLIST && itemId) {
                    const newItems = b.content.items?.map(i => i.id === itemId ? { ...i, text: newValue } : i);
                    return { ...b, content: { ...b.content, items: newItems } };
                } else {
                    return { ...b, content: { ...b.content, text: newValue } };
                }
            }
            return b;
        });
        updateNote({ ...noteRef.current, content: newContent });

        setTimeout(() => {
            const { current: activeInput } = activeInputRef;
            if (activeInput?.element && activeInput.blockId === blockId && activeInput.itemId === itemId) {
                const newCursorPos = startPos + textToInsert.length;
                activeInput.element.focus();
                activeInput.element.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);

        if (result.isFinal) {
            return {
                blockId,
                itemId,
                startPos: startPos + textToInsert.length,
                initialValue: newValue,
            };
        } else {
            return currentDictationState;
        }
    });
  }, [updateNote]);

  const { isRecording: isDictating, startRecording: startDictation, stopRecording: stopDictation } = useWhisper(handleTranscription);

  useEffect(() => {
    if (shortcutAction && shortcutAction.noteId === note.id) {
      setTimeout(() => {
        switch (shortcutAction.action) {
          case 'audio':
            handleStartRecording();
            break;
          case 'photo':
            photoInputRef.current?.click();
            break;
          case 'video':
            videoInputRef.current?.click();
            break;
          case 'camera-menu':
            setIsCameraMenuOpen(true);
            break;
          case 'dictate':
            handleToggleDictation();
            break;
          case 'ai-checklist':
            handleStartChecklistRecording();
            break;
        }
        onShortcutHandled();
      }, 100);
    }
  }, [shortcutAction, note.id]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNote({ ...note, title: e.target.value });
  };

  const addBlock = (type: ContentBlockType, content?: any, atIndex?: number, returnBlock?: boolean): ContentBlock | void => {
    let newBlock: ContentBlock;
    const baseBlock = { id: self.crypto.randomUUID(), createdAt: new Date().toISOString() };

    switch (type) {
      case ContentBlockType.HEADER:
        newBlock = { ...baseBlock, type, content: content || { text: '' } };
        break;
      case ContentBlockType.IMAGE:
      case ContentBlockType.AUDIO:
      case ContentBlockType.VIDEO:
      case ContentBlockType.FILE:
        newBlock = { ...baseBlock, type, content: content || {} };
        break;
      case ContentBlockType.EMBED:
        newBlock = { ...baseBlock, type, content: content || { url: '', summary: null } };
        break;
      case ContentBlockType.CHECKLIST:
        newBlock = { ...baseBlock, type, content: content || { items: [{ id: self.crypto.randomUUID(), text: '', checked: false }] } };
        break;
      default:
        newBlock = { ...baseBlock, type: ContentBlockType.TEXT, content: content || { text: '' } };
    }

    if (returnBlock) {
        return newBlock;
    }
    
    const newContent = [...note.content];
    if (atIndex !== undefined) {
        newContent.splice(atIndex, 0, newBlock);
    } else {
        newContent.push(newBlock);
    }
    updateNote({ ...note, content: newContent });
  };
  
  const handleStartChecklistRecording = async () => {
    if (mediaRecorderRef.current) return;
    updateNote({ ...note, isAiChecklistGenerating: true });
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const options = { mimeType: 'audio/webm' };
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                setIsAiChecklistLoading(true);
                try {
                    const pureBase64 = base64data.split(',')[1];
                    const items = await generateChecklistFromAudio(pureBase64, options.mimeType);
                    const currentNote = noteRef.current;
                    let newContent = currentNote.content;

                    if (items.length > 0) {
                        const newBlock = addBlock(ContentBlockType.CHECKLIST, { items }, undefined, true) as ContentBlock;
                        newContent = [...currentNote.content, newBlock];
                    }
                    updateNote({ ...currentNote, content: newContent, isAiChecklistGenerating: false });

                } catch (error) {
                    console.error('Failed to generate checklist from audio', error);
                    const errorBlock = addBlock(ContentBlockType.TEXT, { text: 'Failed to generate checklist from audio.' }, undefined, true) as ContentBlock;
                    updateNote({ ...noteRef.current, content: [...noteRef.current.content, errorBlock], isAiChecklistGenerating: false });
                } finally {
                    setIsAiChecklistLoading(false);
                    // Cleanup logic moved here to ensure it runs after async operations
                    stream.getTracks().forEach(track => track.stop());
                    setIsRecordingForChecklist(false);
                    if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                    setChecklistRecordingTime(0);
                    mediaRecorderRef.current = null;
                }
            };
        };

        mediaRecorder.start();
        setIsRecordingForChecklist(true);
        timerIntervalRef.current = window.setInterval(() => {
          setChecklistRecordingTime(prev => prev + 1);
        }, 1000);

    } catch (err) {
        console.error("Error starting recording:", err);
        alert("Microphone access was denied. Please allow microphone access in your browser settings to record audio.");
        updateNote({ ...note, isAiChecklistGenerating: false });
    }
  };

  const handleStopChecklistRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
      }
  };


  const handleStartRecording = async () => {
    if (mediaRecorderRef.current) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const options = { mimeType: 'audio/webm' };
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const dataUrl = reader.result as string;
                const blockId = self.crypto.randomUUID();
                
                await saveMedia(blockId, { url: dataUrl, mimeType: options.mimeType });
                const newAudioBlock = addBlock(ContentBlockType.AUDIO, { dbKey: blockId, mimeType: options.mimeType }, undefined, true) as ContentBlock;
                updateNote({ ...noteRef.current, content: [...noteRef.current.content, newAudioBlock]});
            };
            // Cleanup logic now inside onstop handler
            stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            setRecordingTime(0);
            mediaRecorderRef.current = null;
        };

        mediaRecorder.start();
        setIsRecording(true);
        timerIntervalRef.current = window.setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);

    } catch (err) {
        console.error("Error starting recording:", err);
        alert("Microphone access was denied. Please allow microphone access in your browser settings to record audio.");
    }
  };

  const handleStopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
      }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newBlocks: ContentBlock[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const blockId = self.crypto.randomUUID();
        let dataUrl: string;

        try {
            dataUrl = await fileToDataUrl(file);
        } catch (error) {
            console.error("Failed to read file:", error);
            continue;
        }

        try {
            await saveMedia(blockId, { url: dataUrl, mimeType: file.type, name: file.name });
        } catch (error) {
            console.error("Failed to save media to IndexedDB:", error);
            continue;
        }

        const fileType = file.type;
        let blockType: ContentBlockType;
        const content: ContentBlock['content'] = {
            dbKey: blockId,
            mimeType: file.type,
            name: file.name,
        };
        
        if (fileType.startsWith('image/jpeg') || fileType.startsWith('image/tiff')) {
            blockType = ContentBlockType.IMAGE;
            try {
                const { photoTakenAt, location } = await getExifData(file);
                if (photoTakenAt) {
                    content.photoTakenAt = photoTakenAt;
                }
                if (location) {
                    content.location = location;
                }
            } catch (exifError) {
                console.warn("Could not read EXIF data for image:", exifError);
            }
        } else if (fileType.startsWith('image/')) {
            blockType = ContentBlockType.IMAGE;
        } else if (fileType.startsWith('video/')) {
            blockType = ContentBlockType.VIDEO;
        } else if (fileType.startsWith('audio/')) {
            blockType = ContentBlockType.AUDIO;
        } else {
            blockType = ContentBlockType.FILE;
        }

        const newBlock: ContentBlock = {
            id: blockId,
            type: blockType,
            createdAt: new Date().toISOString(),
            content: content
        };
        newBlocks.push(newBlock);
    }
    
    if (newBlocks.length > 0) {
      updateNote({ ...noteRef.current, content: [...noteRef.current.content, ...newBlocks] });
    }
    
    e.target.value = '';
  };
    
    const handleGenericFileClick = () => {
        if (genericFileInputRef.current) {
            genericFileInputRef.current.click();
        }
    };

  const handleAskAIAboutImage = async (blockId: string, question: string) => {
    const imageBlock = note.content.find(b => b.id === blockId);
    if (!imageBlock || imageBlock.type !== ContentBlockType.IMAGE) return;

    setAskingImageAIBlockId(blockId);
    try {
        if (!imageBlock.content.dbKey) throw new Error("Media not found in DB");
        const media = await getMedia(imageBlock.content.dbKey);
        if (!media || !media.url) throw new Error("Media not found in DB");

        const base64data = media.url.split(',')[1];
        const answer = await answerQuestionAboutImage(base64data, imageBlock.content.mimeType || '', question);
        
        const imageBlockIndex = noteRef.current.content.findIndex(b => b.id === blockId);
        const answerBlock = addBlock(ContentBlockType.TEXT, { text: answer }, undefined, true) as ContentBlock;

        const finalContent = [...noteRef.current.content];
        finalContent.splice(imageBlockIndex + 1, 0, answerBlock);
        updateNote({ ...noteRef.current, content: finalContent });
        
    } catch (error) {
        console.error("Error asking AI about image:", error);
    } finally {
        setAskingImageAIBlockId(null);
    }
  };

  const updateBlock = (updatedBlock: ContentBlock) => {
    const newContent = note.content.map(block => block.id === updatedBlock.id ? updatedBlock : block);
    updateNote({ ...note, content: newContent });
  };
  
  const deleteBlock = async (blockId: string) => {
    const blockToDelete = note.content.find(b => b.id === blockId);
    const mediaTypes = [ContentBlockType.IMAGE, ContentBlockType.AUDIO, ContentBlockType.VIDEO, ContentBlockType.FILE];
    
    if (blockToDelete && mediaTypes.includes(blockToDelete.type)) {
      try {
        await deleteMedia(blockId);
      } catch (error) {
        console.error("Failed to delete media from IndexedDB:", error);
      }
    }

    const newContent = note.content.filter(block => block.id !== blockId);
    updateNote({ ...note, content: newContent });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  const handleInputFocus = (element: HTMLTextAreaElement | HTMLInputElement, blockId: string, itemId?: string) => {
    activeInputRef.current = { element, blockId, itemId };
  };
  
  const handleToggleDictation = () => {
    if (isDictating) {
      stopDictation();
      setDictationState(null);
    } else {
      const { current: activeInput } = activeInputRef;
      if (activeInput) {
        setDictationState({
          blockId: activeInput.blockId,
          itemId: activeInput.itemId,
          startPos: activeInput.element.selectionStart || 0,
          initialValue: activeInput.element.value,
        });
        startDictation();
      } else {
        const newBlock = addBlock(ContentBlockType.TEXT, { text: '' }, note.content.length, true) as ContentBlock;
        updateNote({ ...note, content: [...note.content, newBlock] });
        
        setTimeout(() => {
          const newElement = document.querySelector(`[placeholder="Type something..."]`) as HTMLTextAreaElement;
          if (newElement) {
            newElement.focus();
            activeInputRef.current = { element: newElement, blockId: newBlock.id };
            setDictationState({
              blockId: newBlock.id,
              startPos: 0,
              initialValue: '',
            });
            startDictation();
          }
        }, 100);
      }
    }
  };

    const handleDateSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateValue = e.target.value; // Format: "YYYY-MM-DD"
        if (!dateValue) return;

        // Create a date object respecting the local timezone from the YYYY-MM-DD string
        const date = new Date(dateValue + 'T00:00:00');

        const dateString = date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        if (activeInputRef.current) {
            const { element, blockId, itemId } = activeInputRef.current;
            const { value, selectionStart, selectionEnd } = element;
            if (selectionStart === null) return;
            
            const end = selectionEnd === null ? selectionStart : selectionEnd;

            const newValue = value.substring(0, selectionStart) + dateString + value.substring(end);
            
            const newContent = noteRef.current.content.map(b => {
                if (b.id === blockId) {
                    if (b.type === ContentBlockType.CHECKLIST && itemId) {
                        const newItems = b.content.items?.map(i => i.id === itemId ? { ...i, text: newValue } : i);
                        return { ...b, content: { ...b.content, items: newItems } };
                    } else {
                        return { ...b, content: { ...b.content, text: newValue } };
                    }
                }
                return b;
            });
            updateNote({ ...noteRef.current, content: newContent });

            setTimeout(() => {
                const newCursorPos = selectionStart + dateString.length;
                if (document.body.contains(element)) {
                    element.focus();
                    element.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 0);
        } else {
            addBlock(ContentBlockType.TEXT, { text: dateString });
        }
    };

    const handleDateButtonClick = () => {
        if (dateInputRef.current) {
            try {
                dateInputRef.current.showPicker();
            } catch (error) {
                console.warn("showPicker() is not supported, falling back to click().", error);
                dateInputRef.current.click();
            }
        }
    };

  const isAiBusy = isAiChecklistLoading || askingImageAIBlockId !== null || note.titleIsGenerating || note.tagsAreGenerating || note.isAiChecklistGenerating;

  const handleShareNote = async () => {
    const result = await shareNote(note);
    if (result && !result.success) {
        if (result.error && result.error.message.includes('not supported')) {
            alert('Sharing is not available on this browser.');
        } else if (result.error) {
            console.error('Sharing failed:', result.error);
            alert('An error occurred while trying to share the note.');
        }
    }
  };

  const handleDeleteNote = () => {
    if (window.confirm(`Are you sure you want to delete "${note.title || 'Untitled Note'}"? This action cannot be undone.`)) {
        deleteNote(note.id);
    }
  };

  return (
    <div className="flex-1 bg-background text-foreground flex flex-col">
       <div className="sticky top-0 z-10 bg-background py-3 px-6 border-b border-border flex items-center justify-between">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary" aria-label="Close note">
                <ArrowLeftIcon />
            </button>
            <div className="flex items-center gap-1">
                <button onClick={handleShareNote} className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground" aria-label="Share note">
                    <ShareIcon className="w-5 h-5" />
                </button>
                <button onClick={handleDeleteNote} className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-destructive" aria-label="Delete note">
                    <TrashIcon />
                </button>
            </div>
        </div>
      <div className="flex-1 overflow-y-auto p-6 md:px-12">
        <div className="max-w-3xl mx-auto">
            <div className="relative mb-8">
                <input
                  type="text"
                  value={note.title}
                  onChange={handleTitleChange}
                  placeholder="Untitled Note"
                  className="text-3xl font-bold bg-transparent focus:outline-none w-full text-foreground placeholder-muted-foreground"
                />
                {note.titleIsGenerating && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2" title="AI is generating a title for this note">
                        <SparklesIcon className="w-6 h-6 text-primary animate-pulse" />
                    </div>
                )}
                {note.titleError && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2" title={`Error: ${note.titleError}`}>
                        <span className="text-destructive text-xs font-bold">!</span>
                    </div>
                )}
            </div>
            
            <div className="space-y-4">
              {note.content.map(block => (
                <ContentBlockComponent 
                    key={block.id} 
                    block={block} 
                    note={note}
                    updateNote={updateNote}
                    updateBlock={updateBlock} 
                    deleteBlock={deleteBlock}
                    onAskAIAboutImage={handleAskAIAboutImage}
                    askingImageAIBlockId={askingImageAIBlockId}
                    onInputFocus={handleInputFocus}
                    onViewImage={onViewImage}
                />
              ))}
            </div>

            <input type="file" ref={photoInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" capture />
            <input type="file" ref={videoInputRef} onChange={handleFileSelect} className="hidden" accept="video/*" capture />
            <input type="file" ref={genericFileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/plain" multiple />
            <input
              type="date"
              ref={dateInputRef}
              onChange={handleDateSelected}
              className="hidden"
              defaultValue={new Date().toISOString().split('T')[0]}
            />
            
            <div className="mt-8 pt-6 border-t border-border space-y-6">
                <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
                   <span className="text-sm font-semibold uppercase tracking-wider">ADD:</span>
                   <button onClick={() => addBlock(ContentBlockType.HEADER)} className="text-sm px-3 py-1 rounded-md hover:bg-secondary hover:text-secondary-foreground">Header</button>
                   <button onClick={() => addBlock(ContentBlockType.TEXT)} className="text-sm px-3 py-1 rounded-md hover:bg-secondary hover:text-secondary-foreground">Text</button>
                   <button onClick={() => addBlock(ContentBlockType.CHECKLIST)} className="text-sm px-3 py-1 rounded-md hover:bg-secondary hover:text-secondary-foreground">Checklist</button>
                   <button onClick={() => addBlock(ContentBlockType.EMBED)} className="text-sm px-3 py-1 rounded-md hover:bg-secondary hover:text-secondary-foreground">Embed</button>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                    <button 
                      onClick={isRecordingForChecklist ? handleStopChecklistRecording : handleStartChecklistRecording} 
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isRecordingForChecklist ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
                      disabled={isRecording || isDictating || (isAiBusy && !isRecordingForChecklist)}
                    >
                        {isRecordingForChecklist ? (
                            <>
                                <StopIcon className="w-5 h-5"/>
                                <span>Stop ({formatTime(checklistRecordingTime)})</span>
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-5 h-5"/>
                                <span>AI Checklist</span>
                            </>
                        )}
                         {isAiChecklistLoading && <span className="animate-spin text-lg">⚙️</span>}
                    </button>
                    <button 
                        onClick={isRecording ? handleStopRecording : handleStartRecording} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isRecording ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-secondary hover:bg-accent text-secondary-foreground'}`}
                        disabled={isRecordingForChecklist || isDictating || isAiBusy}
                    >
                        {isRecording ? (
                            <>
                                <StopIcon className="w-5 h-5" />
                                <span>Stop Recording ({formatTime(recordingTime)})</span>
                            </>
                        ) : (
                            <>
                                <MicrophoneIcon className="w-5 h-5" />
                                <span>Record Audio</span>
                            </>
                        )}
                    </button>
                    <DictateButton 
                        isRecording={isDictating}
                        onClick={handleToggleDictation}
                        disabled={isRecording || isRecordingForChecklist || isAiBusy} 
                    />
                    <button
                        onClick={() => setIsCameraMenuOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-secondary hover:bg-accent text-secondary-foreground"
                        disabled={isAiBusy || isRecording || isRecordingForChecklist || isDictating}
                    >
                        <CameraIcon className="w-5 h-5" />
                        <span>Camera</span>
                    </button>
                    <button 
                        onClick={handleGenericFileClick}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-secondary hover:bg-accent text-secondary-foreground"
                        disabled={isAiBusy || isRecording || isRecordingForChecklist || isDictating}
                    >
                        <AttachFileIcon className="w-5 h-5" />
                        <span>Attach File</span>
                    </button>
                    <button 
                        onClick={handleDateButtonClick}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-secondary hover:bg-accent text-secondary-foreground"
                        disabled={isAiBusy || isRecording || isRecordingForChecklist || isDictating}
                    >
                        <CalendarDaysIcon className="w-5 h-5" />
                        <span>Date</span>
                    </button>
                </div>
            </div>
        </div>
      </div>
      {isCameraMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsCameraMenuOpen(false)}
        >
            <div
                className="bg-popover rounded-2xl shadow-xl p-6 w-full max-w-xs border border-border"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-popover-foreground">Capture Media</h3>
                    <button onClick={() => setIsCameraMenuOpen(false)} className="p-1 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="space-y-4">
                    <button
                        onClick={() => {
                            photoInputRef.current?.click();
                            setIsCameraMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 text-lg text-popover-foreground hover:bg-accent rounded-xl transition-colors"
                    >
                        <PhotoIcon className="w-8 h-8 text-primary" />
                        <span className="font-medium">Take Photo</span>
                    </button>
                    <button
                        onClick={() => {
                            videoInputRef.current?.click();
                            setIsCameraMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 text-lg text-popover-foreground hover:bg-accent rounded-xl transition-colors"
                    >
                        <VideoCameraIcon className="w-8 h-8 text-primary" />
                        <span className="font-medium">Record Video</span>
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default NoteEditor;