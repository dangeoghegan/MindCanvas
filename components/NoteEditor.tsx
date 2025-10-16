import React, { useState, useRef, useEffect } from 'react';
import { Note, ContentBlock, ContentBlockType, ChecklistItem } from '../types';
import ContentBlockComponent from './ContentBlockComponent';
import { SparklesIcon, MicrophoneIcon, StopIcon, CameraIcon, ArrowLeftIcon, TrashIcon, PaperClipIcon, CodeBracketIcon } from './icons';
import { generateChecklistFromAudio, summarizeAudio, askQuestionAboutImage, summarizeVideo, generateImageDescription, generateTitle } from '../services/geminiService';
// FIX: Imported 'getMedia' to resolve 'Cannot find name' error.
import { saveMedia, deleteMedia, getMedia } from '../services/dbService';

interface NoteEditorProps {
  note: Note;
  updateNote: (updatedNote: Note) => void;
  deleteNote: (noteId: string) => void;
  onClose: () => void;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

const getNoteContentAsString = (note: Note): string => {
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
            default:
                return '';
        }
    }).filter(text => text.trim() !== '').join('\n\n');
};

const NoteEditor: React.FC<NoteEditorProps> = ({ note, updateNote, deleteNote, onClose }) => {
  const [isAiChecklistLoading, setIsAiChecklistLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSummarizing, setIsSummarizing] = useState(false);
  
  const [isRecordingForChecklist, setIsRecordingForChecklist] = useState(false);
  const [checklistRecordingTime, setChecklistRecordingTime] = useState(0);

  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [askingImageAIBlockId, setAskingImageAIBlockId] = useState<string | null>(null);
  const [isGeneratingNoteTitle, setIsGeneratingNoteTitle] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictatedBlockId, setDictatedBlockId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const isDictatingRef = useRef(false);
  const finalTranscriptRef = useRef('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);

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
    const handler = setTimeout(async () => {
        const hasMeaningfulContent = note.content.some(b => {
            if (b.type === ContentBlockType.TEXT || b.type === ContentBlockType.HEADER) return (b.content.text || '').length > 10;
            if (b.type === ContentBlockType.CHECKLIST) return (b.content.items || []).some((i: ChecklistItem) => (i.text || '').length > 0);
            return !!b.content.url || !!b.content.dbKey;
        });

        if (note.title === 'Untitled Note' && hasMeaningfulContent && !isGeneratingNoteTitle) {
            setIsGeneratingNoteTitle(true);
            try {
                const noteContext = getNoteContentAsString(note);
                if (noteContext.trim().length > 15) { // Only generate if there's enough context
                    const newTitle = await generateTitle(noteContext);
                    if (newTitle && noteRef.current.title === 'Untitled Note') {
                        updateNote({ ...noteRef.current, title: newTitle });
                    }
                }
            } catch (error) {
                console.error("Failed to generate note title:", error);
            } finally {
                setIsGeneratingNoteTitle(false);
            }
        }
    }, 2000);

    return () => clearTimeout(handler);
  }, [note.content, note.title, isGeneratingNoteTitle, updateNote]);


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
                
                const newAudioBlock = addBlock(ContentBlockType.AUDIO, { mimeType: 'audio/webm', dbKey: self.crypto.randomUUID() }, undefined, true) as ContentBlock;
                updateNote({ ...noteRef.current, content: [...noteRef.current.content, newAudioBlock]});
                await saveMedia(newAudioBlock.id, { url: dataUrl, mimeType: 'audio/webm' });

                setIsSummarizing(true);
                try {
                    const pureBase64 = dataUrl.split(',')[1];
                    const summary = await summarizeAudio(pureBase64, 'audio/webm');
                    
                    const headerBlock = addBlock(ContentBlockType.HEADER, { text: 'Audio Summary' }, undefined, true) as ContentBlock;
                    const summaryBlock = addBlock(ContentBlockType.TEXT, { text: summary }, undefined, true) as ContentBlock;

                    const currentNote = noteRef.current;
                    const newContent = [...currentNote.content];
                    const audioBlockIndex = newContent.findIndex(b => b.id === newAudioBlock.id);
                    if (audioBlockIndex !== -1) {
                        newContent.splice(audioBlockIndex + 1, 0, headerBlock, summaryBlock);
                    } else {
                         newContent.push(headerBlock, summaryBlock);
                    }
                    updateNote({ ...currentNote, content: newContent });

                } catch (error) {
                    console.error('Failed to summarize audio', error);
                    const errorBlock = addBlock(ContentBlockType.TEXT, { text: 'Failed to generate audio summary.' }, undefined, true) as ContentBlock;
                    updateNote({ ...noteRef.current, content: [...noteRef.current.content, errorBlock] });
                } finally {
                    setIsSummarizing(false);
                }
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
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a unique ID for the block and the DB entry
    const blockId = self.crypto.randomUUID();
    let dataUrl: string;

    try {
        dataUrl = await fileToDataUrl(file);
    } catch (error) {
        console.error("Failed to read file:", error);
        alert("There was an error reading the file.");
        return;
    }

    // Save the media to IndexedDB first.
    try {
        await saveMedia(blockId, { url: dataUrl, mimeType: file.type, name: file.name });
    } catch (error) {
        console.error("Failed to save media to IndexedDB:", error);
        alert("Could not save the file. The database might be full or corrupted.");
        return;
    }

    // Now that it's saved, create the block and update the note.
    const fileType = file.type;
    let blockType: ContentBlockType;
    
    if (fileType.startsWith('image/')) {
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
        content: {
            dbKey: blockId,
            mimeType: file.type,
            name: file.name,
        }
    };

    updateNote({ ...noteRef.current, content: [...noteRef.current.content, newBlock] });
    e.target.value = ''; // Reset the file input

    // --- Start background AI processing ---
    const base64data = dataUrl.split(',')[1];
    if (fileType.startsWith('image/')) {
        try {
            const description = await generateImageDescription(base64data, fileType);
            const currentNote = noteRef.current;
            const finalContent = currentNote.content.map(b => b.id === blockId ? { ...b, content: { ...b.content, description }} : b);
            updateNoteRef.current({ ...currentNote, content: finalContent });
        } catch(error) { console.error("Error generating image description:", error); }
    } else if (fileType.startsWith('video/')) {
        setIsProcessingVideo(true);
        try {
            const summary = await summarizeVideo(base64data, fileType);
            const currentNote = noteRef.current;
            const videoBlockIndex = currentNote.content.findIndex(b => b.id === blockId);
            const headerBlock = addBlock(ContentBlockType.HEADER, { text: 'Video Summary' }, videoBlockIndex + 1, true) as ContentBlock;
            const summaryBlock = addBlock(ContentBlockType.TEXT, { text: summary }, videoBlockIndex + 2, true) as ContentBlock;
            const finalContent = currentNote.content.map(b => b.id === blockId ? { ...b, content: { ...b.content, summary }} : b);
            
            const contentWithVideo = [...finalContent];
            if (videoBlockIndex !== -1) {
              contentWithVideo.splice(videoBlockIndex + 1, 0, headerBlock, summaryBlock);
            } else {
              contentWithVideo.push(headerBlock, summaryBlock);
            }
            updateNoteRef.current({ ...currentNote, content: contentWithVideo });
        } catch (error) {
            console.error("Error summarizing video:", error);
            addBlock(ContentBlockType.TEXT, { text: 'Failed to generate video summary.' });
        } finally {
            setIsProcessingVideo(false);
        }
    } else if (fileType.startsWith('audio/')) {
        setIsSummarizing(true);
        try {
            const summary = await summarizeAudio(base64data, fileType);
            const currentNote = noteRef.current;
            const audioBlockIndex = currentNote.content.findIndex(b => b.id === blockId);
            const headerBlock = addBlock(ContentBlockType.HEADER, { text: 'Audio Summary' }, audioBlockIndex + 1, true) as ContentBlock;
            const summaryBlock = addBlock(ContentBlockType.TEXT, { text: summary }, audioBlockIndex + 2, true) as ContentBlock;

            const newContent = [...currentNote.content];
            if (audioBlockIndex !== -1) {
                newContent.splice(audioBlockIndex + 1, 0, headerBlock, summaryBlock);
            } else {
                newContent.push(headerBlock, summaryBlock);
            }
            updateNoteRef.current({ ...currentNote, content: newContent });
        } catch (error) {
            console.error('Failed to summarize audio', error);
        } finally {
            setIsSummarizing(false);
        }
    }
  };

  const handleAskAIAboutImage = async (blockId: string, question: string) => {
    const imageBlock = note.content.find(b => b.id === blockId);
    if (!imageBlock || imageBlock.type !== ContentBlockType.IMAGE) return;

    setAskingImageAIBlockId(blockId);
    try {
        const media = await getMedia(imageBlock.content.dbKey);
        if (!media || !media.url) throw new Error("Media not found in DB");

        const base64data = media.url.split(',')[1];
        const answer = await askQuestionAboutImage(base64data, imageBlock.content.mimeType, question);
        
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

  const isAiBusy = isAiChecklistLoading || isSummarizing || isProcessingVideo || askingImageAIBlockId !== null || isGeneratingNoteTitle;

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
                {isGeneratingNoteTitle && (
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

            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <input type="file" accept="image/*,video/*" capture="environment" ref={captureInputRef} onChange={handleFileSelect} className="hidden" />
            
            <div className="mt-8 pt-6 border-t border-gray-800 flex items-center gap-2 text-gray-400 flex-wrap">
               <span className="text-sm font-semibold">ADD BLOCK:</span>
               <button onClick={() => addBlock(ContentBlockType.HEADER)} className="text-sm px-3 py-1 rounded-md hover:bg-gray-800 hover:text-white">Header</button>
               <button onClick={() => addBlock(ContentBlockType.TEXT)} className="text-sm px-3 py-1 rounded-md hover:bg-gray-800 hover:text-white">Text</button>
               <button onClick={() => addBlock(ContentBlockType.CHECKLIST)} className="text-sm px-3 py-1 rounded-md hover:bg-gray-800 hover:text-white">Checklist</button>
               <button onClick={() => addBlock(ContentBlockType.EMBED)} className="text-sm px-3 py-1 rounded-md hover:bg-gray-800 hover:text-white">Embed</button>
            </div>

            <div className="mt-4 flex items-center gap-4 flex-wrap">
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
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-gray-700 hover:bg-gray-600 text-gray-200"
                    disabled={isAiBusy || isRecording || isRecordingForChecklist || isDictating}
                >
                    <PaperClipIcon className="w-5 h-5" />
                    <span>File</span>
                </button>
                <button 
                    onClick={() => captureInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-gray-700 hover:bg-gray-600 text-gray-200"
                    disabled={isAiBusy || isRecording || isRecordingForChecklist || isDictating}
                >
                    <CameraIcon className="w-5 h-5" />
                    <span>Camera</span>
                </button>
                {isSummarizing && (
                    <div className="flex items-center gap-2 text-gray-400">
                        <span className="animate-spin text-lg">⚙️</span>
                        <span>Summarizing audio...</span>
                    </div>
                )}
                {isProcessingVideo && (
                    <div className="flex items-center gap-2 text-gray-400">
                        <span className="animate-spin text-lg">⚙️</span>
                        <span>Summarizing video...</span>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;