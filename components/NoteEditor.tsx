import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Note, ContentBlock, ContentBlockType, ChecklistItem } from '../types';
import ContentBlockComponent from './ContentBlockComponent';
import { SparklesIcon, MicrophoneIcon, StopIcon, PaperClipIcon, ArrowLeftIcon, TrashIcon, TagIcon, UserIcon, XMarkIcon } from './icons';
import { generateChecklistFromAudio, askQuestionAboutImage } from '../services/geminiService';
// FIX: Imported 'getMedia' to resolve 'Cannot find name' error.
import { saveMedia, deleteMedia, getMedia } from '../services/dbService';

interface NoteEditorProps {
  note: Note;
  updateNote: (updatedNote: Note) => void;
  deleteNote: (noteId: string) => void;
  onClose: () => void;
  masterPeopleList: string[];
  onAddPersonToMasterList: (name: string) => void;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

const getExifDateTime = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
        const EXIF = (window as any).EXIF;
        if (!EXIF) {
            console.warn("EXIF.js library not found.");
            return resolve(null);
        }

        EXIF.getData(file, function(this: any) {
            const dateTime = EXIF.getTag(this, "DateTimeOriginal");
            if (dateTime) {
                try {
                    const parts = dateTime.split(' ');
                    const dateParts = parts[0].split(':');
                    const timeParts = parts.length > 1 ? parts[1].split(':') : ['00', '00', '00'];
                    
                    const isoDate = new Date(
                        parseInt(dateParts[0], 10),
                        parseInt(dateParts[1], 10) - 1,
                        parseInt(dateParts[2], 10),
                        parseInt(timeParts[0], 10),
                        parseInt(timeParts[1], 10),
                        parseInt(timeParts[2], 10)
                    ).toISOString();
                    resolve(isoDate);
                } catch(e) {
                    console.error("Error parsing EXIF date:", e);
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        });
    });
};


const NoteEditor: React.FC<NoteEditorProps> = ({ note, updateNote, deleteNote, onClose, masterPeopleList, onAddPersonToMasterList }) => {
  const [isAiChecklistLoading, setIsAiChecklistLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const [isRecordingForChecklist, setIsRecordingForChecklist] = useState(false);
  const [checklistRecordingTime, setChecklistRecordingTime] = useState(0);

  const [askingImageAIBlockId, setAskingImageAIBlockId] = useState<string | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const [dictatedBlockId, setDictatedBlockId] = useState<string | null>(null);

  const [personInput, setPersonInput] = useState('');
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);
  const personInputRef = useRef<HTMLInputElement>(null);


  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const isDictatingRef = useRef(false);
  const finalTranscriptRef = useRef('');
  
  const genericFileInputRef = useRef<HTMLInputElement>(null);


  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  const updateNoteRef = useRef(updateNote);
  useEffect(() => {
    updateNoteRef.current = updateNote;
  }, [updateNote]);

  const dictatedBlockIdRef = useRef(dictatedBlockId);
  useEffect(() => {
    dictatedBlockIdRef.current = dictatedBlockId;
  }, [dictatedBlockId]);


  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    const resetSilenceTimeout = () => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = window.setTimeout(() => {
            if (isDictatingRef.current) {
               handleToggleDictation(); // This will stop the dictation
            }
        }, 15000);
    };
    
    recognition.onstart = () => {
        resetSilenceTimeout();
    };

    recognition.onresult = (event: any) => {
        resetSilenceTimeout();
        const blockId = dictatedBlockIdRef.current;
        if (!blockId) return;

        let final_transcript = '';
        let interim_transcript = '';

        for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final_transcript += event.results[i][0].transcript;
            } else {
                interim_transcript += event.results[i][0].transcript;
            }
        }
    
        finalTranscriptRef.current = final_transcript.trim();
        const fullTranscript = (final_transcript + interim_transcript).trim();

        const currentNote = noteRef.current;
        const newContent = currentNote.content.map(b => 
            b.id === blockId ? { ...b, content: { text: fullTranscript || 'Listening...' } } : b
        );
        updateNoteRef.current({ ...currentNote, content: newContent });
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      const fatalErrors = ['not-allowed', 'service-not-allowed'];
      if (fatalErrors.includes(event.error)) {
        isDictatingRef.current = false;
        setIsDictating(false);
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      }
    };
    
    recognition.onend = () => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

        if (isDictatingRef.current) {
            setTimeout(() => {
                if (isDictatingRef.current && recognitionRef.current) {
                    try {
                        recognitionRef.current.start();
                    } catch(e) {
                        console.error("Error restarting recognition:", e);
                        isDictatingRef.current = false;
                        setIsDictating(false);
                    }
                }
            }, 100);
            return;
        }

        const currentNote = noteRef.current;
        const blockId = dictatedBlockIdRef.current;
        if (blockId && currentNote) {
            const finalSpokenText = finalTranscriptRef.current.trim();
            const finalContent = currentNote.content.map(b => {
                if (b.id === blockId) {
                    if (finalSpokenText === '' || finalSpokenText === 'Listening...') {
                        return null; 
                    }
                    return { ...b, content: { text: finalSpokenText } };
                }
                return b;
            }).filter((b): b is ContentBlock => b !== null);
            
            updateNoteRef.current({ ...currentNote, content: finalContent });
        }
        setDictatedBlockId(null);
        finalTranscriptRef.current = '';
    };

    return () => {
      if (recognitionRef.current) {
        isDictatingRef.current = false; 
        recognitionRef.current.stop();
      }
      if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

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
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                setIsAiChecklistLoading(true);
                try {
                    const pureBase64 = base64data.split(',')[1];
                    const items = await generateChecklistFromAudio(pureBase64, 'audio/webm');
                    if (items.length > 0) {
                        addBlock(ContentBlockType.CHECKLIST, { items });
                    }
                } catch (error) {
                    console.error('Failed to generate checklist from audio', error);
                    addBlock(ContentBlockType.TEXT, { text: 'Failed to generate checklist from audio.' });
                } finally {
                    setIsAiChecklistLoading(false);
                }
            };
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecordingForChecklist(true);
        timerIntervalRef.current = window.setInterval(() => {
          setChecklistRecordingTime(prev => prev + 1);
        }, 1000);

    } catch (err) {
        console.error("Error starting recording:", err);
        alert("Microphone access was denied. Please allow microphone access in your browser settings to record audio.");
    }
  };

  const handleStopChecklistRecording = () => {
      if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          setIsRecordingForChecklist(false);
          if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setChecklistRecordingTime(0);
      }
  };


  const handleStartRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const dataUrl = reader.result as string;
                const blockId = self.crypto.randomUUID();
                
                await saveMedia(blockId, { url: dataUrl, mimeType: 'audio/webm' });
                const newAudioBlock = addBlock(ContentBlockType.AUDIO, { dbKey: blockId, mimeType: 'audio/webm' }, undefined, true) as ContentBlock;
                updateNote({ ...noteRef.current, content: [...noteRef.current.content, newAudioBlock]});
            };
            stream.getTracks().forEach(track => track.stop());
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
      if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setRecordingTime(0);
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
                const photoTakenAt = await getExifDateTime(file);
                if (photoTakenAt) {
                    content.photoTakenAt = photoTakenAt;
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
        const answer = await askQuestionAboutImage(base64data, imageBlock.content.mimeType || '', question);
        
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

  const handleToggleDictation = () => {
    if (!recognitionRef.current) {
        alert("Speech recognition is not supported by your browser.");
        return;
    }
    
    const currentlyDictating = !isDictating;
    isDictatingRef.current = currentlyDictating;
    setIsDictating(currentlyDictating);

    if (currentlyDictating) {
        finalTranscriptRef.current = '';
        const newBlock = addBlock(ContentBlockType.TEXT, { text: 'Listening...' }, undefined, true) as ContentBlock;
        updateNote({ ...noteRef.current, content: [...noteRef.current.content, newBlock] });
        setDictatedBlockId(newBlock.id);
        recognitionRef.current.start();
    } else {
        recognitionRef.current.stop();
    }
  };

  const handleAddPerson = (personName: string) => {
    const name = personName.trim();
    if (name && !(note.people || []).includes(name)) {
        const updatedPeople = [...(note.people || []), name];
        updateNote({ ...note, people: updatedPeople });
        onAddPersonToMasterList(name);
    }
    setPersonInput('');
    setShowPersonSuggestions(false);
  };

  const handleRemovePerson = (personToRemove: string) => {
      const updatedPeople = (note.people || []).filter(p => p !== personToRemove);
      updateNote({ ...note, people: updatedPeople });
  };

  const handlePersonInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setPersonInput(e.target.value);
      setShowPersonSuggestions(true);
  };

  const handlePersonInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && personInput) {
          e.preventDefault();
          handleAddPerson(personInput);
      }
  };

  const filteredPersonSuggestions = useMemo(() => {
    const availablePeople = masterPeopleList.filter(
        p => !(note.people || []).includes(p)
    );
    if (!personInput) {
        return availablePeople;
    }
    return availablePeople.filter(
        p => p.toLowerCase().includes(personInput.toLowerCase())
    );
  }, [personInput, masterPeopleList, note.people]);

  const isAiBusy = isAiChecklistLoading || askingImageAIBlockId !== null || note.titleIsGenerating || note.tagsAreGenerating;

  return (
    <div className="flex-1 bg-[#1C1C1C] text-white flex flex-col">
       <div className="sticky top-0 z-10 bg-[#1C1C1C] py-3 px-6 border-b border-gray-800 flex items-center justify-between">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800">
                <ArrowLeftIcon />
            </button>
            <button onClick={() => deleteNote(note.id)} className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-red-400">
                <TrashIcon />
            </button>
        </div>
      <div className="flex-1 overflow-y-auto p-6 md:px-12">
        <div className="max-w-3xl mx-auto">
            <div className="relative mb-8">
                <input
                  type="text"
                  value={note.title}
                  onChange={handleTitleChange}
                  placeholder="Untitled Note"
                  className="text-3xl font-bold bg-transparent focus:outline-none w-full text-white placeholder-gray-600"
                />
                {note.titleIsGenerating && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2" title="AI is generating a title for this note">
                        <SparklesIcon className="w-6 h-6 text-blue-400 animate-pulse" />
                    </div>
                )}
            </div>
            
            <div className="space-y-4">
              {note.content.map(block => (
                <ContentBlockComponent 
                    key={block.id} 
                    block={block} 
                    updateBlock={updateBlock} 
                    deleteBlock={deleteBlock}
                    onAskAIAboutImage={handleAskAIAboutImage}
                    askingImageAIBlockId={askingImageAIBlockId}
                />
              ))}
            </div>

            <input type="file" ref={genericFileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/plain" multiple />
            
            <div className="mt-8 pt-6 border-t border-gray-800 space-y-6">
                {(note.tagsAreGenerating || (note.tags && note.tags.length > 0)) && (
                    <div className="flex items-start gap-3 flex-wrap">
                        <TagIcon className="w-5 h-5 text-gray-500 flex-shrink-0 mt-1.5" />
                        <div className="flex flex-wrap gap-2">
                          {note.tagsAreGenerating && (
                              <div className="flex items-center gap-2 text-sm text-gray-500 italic">
                                  <SparklesIcon className="w-4 h-4 animate-pulse" />
                                  <span>AI is generating tags...</span>
                              </div>
                          )}
                          {note.tags && note.tags.map(tag => (
                              <span key={tag} className="bg-gray-800 text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full">
                                  #{tag}
                              </span>
                          ))}
                        </div>
                    </div>
                )}

                <div className="flex items-start gap-3 flex-wrap">
                    <UserIcon className="w-5 h-5 text-gray-500 flex-shrink-0 mt-1.5" />
                    <div className="flex-1 relative">
                        <div className="flex flex-wrap gap-2 items-center">
                            {(note.people || []).map(person => (
                                <span key={person} className="flex items-center gap-1.5 bg-green-800/50 text-green-300 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full">
                                    {person}
                                    <button onClick={() => handleRemovePerson(person)} className="hover:bg-green-700/50 rounded-full p-0.5">
                                        <XMarkIcon className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            <div className="relative flex-1 min-w-[120px]">
                                <input
                                    ref={personInputRef}
                                    type="text"
                                    value={personInput}
                                    onChange={handlePersonInputChange}
                                    onKeyDown={handlePersonInputKeyDown}
                                    onFocus={() => setShowPersonSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 200)}
                                    placeholder="Add person..."
                                    className="bg-transparent text-sm placeholder-gray-500 focus:outline-none py-1"
                                />
                                {showPersonSuggestions && filteredPersonSuggestions.length > 0 && (
                                    <div className="absolute z-10 bottom-full mb-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                        <ul className="py-1">
                                            {filteredPersonSuggestions.map(suggestion => (
                                                <li
                                                    key={suggestion}
                                                    onMouseDown={() => handleAddPerson(suggestion)}
                                                    className="text-gray-300 cursor-pointer select-none relative py-2 px-3 hover:bg-gray-700"
                                                >
                                                    {suggestion}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 text-gray-400 flex-wrap">
                   <span className="text-sm font-semibold">ADD BLOCK:</span>
                   <button onClick={() => addBlock(ContentBlockType.HEADER)} className="text-sm px-3 py-1 rounded-md hover:bg-gray-800 hover:text-white">Header</button>
                   <button onClick={() => addBlock(ContentBlockType.TEXT)} className="text-sm px-3 py-1 rounded-md hover:bg-gray-800 hover:text-white">Text</button>
                   <button onClick={() => addBlock(ContentBlockType.CHECKLIST)} className="text-sm px-3 py-1 rounded-md hover:bg-gray-800 hover:text-white">Checklist</button>
                   <button onClick={() => addBlock(ContentBlockType.EMBED)} className="text-sm px-3 py-1 rounded-md hover:bg-gray-800 hover:text-white">Embed</button>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                    <button 
                      onClick={isRecordingForChecklist ? handleStopChecklistRecording : handleStartChecklistRecording} 
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isRecordingForChecklist ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                      disabled={isRecording || isAiBusy || isDictating}
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
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isRecording ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
                        disabled={isRecordingForChecklist || isAiBusy || isDictating}
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
                     <button 
                        onClick={handleToggleDictation} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isDictating ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
                        disabled={isRecording || isRecordingForChecklist || isAiBusy}
                    >
                        {isDictating ? (
                            <>
                                <StopIcon className="w-5 h-5" />
                                <span>Stop Dictation</span>
                            </>
                        ) : (
                            <>
                                <MicrophoneIcon className="w-5 h-5" />
                                <span>Dictate</span>
                            </>
                        )}
                    </button>
                    <button 
                        onClick={handleGenericFileClick}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-gray-700 hover:bg-gray-600 text-gray-200"
                        disabled={isAiBusy || isRecording || isRecordingForChecklist || isDictating}
                    >
                        <PaperClipIcon className="w-5 h-5" />
                        <span>Attach File</span>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;