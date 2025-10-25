import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Note, ContentBlock, ContentBlockType, ChecklistItem } from '../types';
import { TrashIcon, SparklesIcon, PaperAirplaneIcon, StopIcon, PaperClipIcon, LinkIcon, ChevronDownIcon, ChevronUpIcon, UserIcon, FileTextIcon, MessageSquareIcon, ExternalLinkIcon, SpinnerIcon, XMarkIcon } from './icons';
import { getMedia } from '../services/dbService';
import { generateWebsiteSummary, summarizeGoogleWorkspaceDoc, extractYouTubeVideoId, getYouTubeThumbnail, getWebsiteThumbnail, generateEnhancedSummary, askQuestionAboutEmbeddedContent, getYouTubeVideoInfo, generateYouTubeSummaryFromTitle, answerQuestionAboutYouTubeVideo } from '../services/geminiService';

interface ContentBlockProps {
  block: ContentBlock;
  note: Note;
  updateNote: (updatedNote: Note) => void;
  updateBlock: (updatedBlock: ContentBlock) => void;
  deleteBlock: (blockId: string) => void;
  onAskAIAboutImage: (blockId: string, question: string) => void;
  askingImageAIBlockId: string | null;
  onInputFocus: (element: HTMLTextAreaElement | HTMLInputElement, blockId: string, itemId?: string) => void;
}

const TextBlock: React.FC<{
  block: ContentBlock;
  updateBlock: (b: ContentBlock) => void;
  isHeader: boolean;
  onFocus: (element: HTMLTextAreaElement, blockId: string) => void;
}> = ({ block, updateBlock, isHeader, onFocus }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(block.content.text || '');

  useEffect(() => {
    // This effect synchronizes the local state with the block prop.
    // This is crucial for updates that happen outside this component,
    // such as real-time dictation, where the parent component updates the block content.
    if (block.content.text !== text) {
      setText(block.content.text || '');
    }
  }, [block.content.text]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Live update for smoother experience
    updateBlock({ ...block, content: { text: e.target.value } });
  };
  
  const className = isHeader
    ? "text-2xl font-bold bg-transparent focus:outline-none w-full resize-none overflow-hidden"
    : "text-base bg-transparent focus:outline-none w-full resize-none overflow-hidden leading-relaxed";
    
  return (
    <textarea
      ref={textareaRef}
      value={text}
      onChange={handleChange}
      onFocus={(e) => onFocus(e.target, block.id)}
      placeholder={isHeader ? "Header" : "Type something..."}
      className={className}
      rows={1}
    />
  );
};


const ChecklistBlock: React.FC<{
    block: ContentBlock;
    updateBlock: (b: ContentBlock) => void;
    onFocus: (element: HTMLInputElement, blockId: string, itemId: string) => void;
}> = ({ block, updateBlock, onFocus }) => {
    const items = block.content.items || [];

    const handleUpdateItem = (itemId: string, newText: string) => {
        const newItems = items.map((item: ChecklistItem) =>
            item.id === itemId ? { ...item, text: newText } : item
        );
        updateBlock({ ...block, content: { ...block.content, items: newItems } });
    };

    const handleToggleCheck = (itemId: string) => {
        const newItems = items.map((item: ChecklistItem) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        updateBlock({ ...block, content: { ...block.content, items: newItems } });
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, itemId: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const currentIndex = items.findIndex((item: ChecklistItem) => item.id === itemId);
            const newItem: ChecklistItem = { id: self.crypto.randomUUID(), text: '', checked: false };
            const newItems = [...items];
            newItems.splice(currentIndex + 1, 0, newItem);
            updateBlock({ ...block, content: { ...block.content, items: newItems } });
            
            setTimeout(() => {
                const nextInput = document.querySelector(`[data-item-id="${newItem.id}"]`) as HTMLInputElement;
                nextInput?.focus();
            }, 0);
        } else if (e.key === 'Backspace' && (e.target as HTMLInputElement).value === '') {
            e.preventDefault();
            const newItems = items.filter((item: ChecklistItem) => item.id !== itemId);
            if (newItems.length === 0) {
                 newItems.push({ id: self.crypto.randomUUID(), text: '', checked: false });
            }
            updateBlock({ ...block, content: { ...block.content, items: newItems } });
        }
    };

    return (
        <div className="space-y-2">
            {items.map((item: ChecklistItem) => (
                <div key={item.id} className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleToggleCheck(item.id)}
                        className="w-5 h-5 bg-gray-700 border-gray-600 rounded text-blue-500 focus:ring-blue-600"
                    />
                    <input
                        type="text"
                        data-item-id={item.id}
                        value={item.text}
                        onChange={(e) => handleUpdateItem(item.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, item.id)}
                        onFocus={(e) => onFocus(e.target, block.id, item.id)}
                        placeholder="To-do item..."
                        className={`flex-1 bg-transparent focus:outline-none ${item.checked ? 'line-through text-gray-500' : ''}`}
                    />
                </div>
            ))}
        </div>
    );
};

const ImageBlock: React.FC<{
    block: ContentBlock;
    onAskAIAboutImage: (blockId: string, question: string) => void;
    askingImageAIBlockId: string | null;
}> = ({ block, onAskAIAboutImage, askingImageAIBlockId }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [question, setQuestion] = useState('');

    useEffect(() => {
        const fetchImage = async () => {
            if (block.content.dbKey) {
                const media = await getMedia(block.content.dbKey);
                if (media) setImageUrl(media.url);
            }
        };
        fetchImage();
    }, [block.content.dbKey]);

    const handleAsk = () => {
        if (question.trim()) {
            onAskAIAboutImage(block.id, question);
            setQuestion('');
        }
    };

    return (
        <div className="my-4">
            <div className="relative mx-auto max-w-full w-fit">
                {imageUrl ? (
                    <img src={imageUrl} alt={block.content.description || 'User uploaded image'} className="rounded-lg max-w-full h-auto" />
                ) : (
                    <div className="h-48 bg-gray-800 rounded-lg flex items-center justify-center">Loading image...</div>
                )}
            </div>
            <div className="text-center mt-2 space-y-1">
                {block.content.photoTakenAt && <p className="text-xs text-gray-500">Taken: {new Date(block.content.photoTakenAt).toLocaleString()}</p>}
                {block.content.description && <p className="text-sm text-gray-400 italic">{block.content.description}</p>}
                {block.content.isGeneratingDescription && <p className="text-sm text-blue-400 italic">AI is generating a description...</p>}
                {block.content.descriptionError && <p className="text-sm text-red-400 italic">Description Error: {block.content.descriptionError}</p>}
                {block.content.isRecognizingFaces && (
                    <p className="text-sm text-purple-400 italic flex items-center justify-center gap-2">
                        <UserIcon className="w-4 h-4 animate-pulse" />
                        <span>Scanning for known faces...</span>
                    </p>
                )}
                {block.content.faceRecognitionError && <p className="text-sm text-red-400 italic">Face Recognition Error: {block.content.faceRecognitionError}</p>}
            </div>
            
            <div className="mt-2 flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
                <SparklesIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <input 
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about this image..."
                    className="flex-1 bg-transparent focus:outline-none text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                    disabled={askingImageAIBlockId === block.id}
                />
                <button onClick={handleAsk} disabled={askingImageAIBlockId === block.id || !question.trim()}>
                    {askingImageAIBlockId === block.id 
                        ? <StopIcon className="w-5 h-5 text-gray-500" /> 
                        : <PaperAirplaneIcon className="w-5 h-5 text-gray-400 hover:text-white" />}
                </button>
            </div>
        </div>
    );
};

const AudioBlock: React.FC<{ block: ContentBlock }> = ({ block }) => {
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchAudio = async () => {
            if (block.content.dbKey) {
                const media = await getMedia(block.content.dbKey);
                if (media) setAudioUrl(media.url);
            }
        };
        fetchAudio();
    }, [block.content.dbKey]);

    return (
        <div className="my-4 p-4 bg-gray-800/50 rounded-lg">
            {audioUrl ? (
                <audio controls src={audioUrl} className="w-full"></audio>
            ) : (
                <div className="h-14 bg-gray-800 rounded-lg flex items-center justify-center text-sm text-gray-400">Loading audio...</div>
            )}
            {block.content.summary && <p className="text-sm text-gray-400 italic mt-2">{block.content.summary}</p>}
            {block.content.isGeneratingSummary && <p className="text-sm text-blue-400 italic mt-2">AI is generating a summary...</p>}
            {block.content.summaryError && <p className="text-sm text-red-400 italic mt-2">Error: {block.content.summaryError}</p>}
        </div>
    );
};

const VideoBlock: React.FC<{ block: ContentBlock }> = ({ block }) => {
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchVideo = async () => {
            if (block.content.dbKey) {
                const media = await getMedia(block.content.dbKey);
                if (media) setVideoUrl(media.url);
            }
        };
        fetchVideo();
    }, [block.content.dbKey]);

    return (
        <div className="my-4">
            {videoUrl ? (
                <video controls src={videoUrl} className="rounded-lg w-full"></video>
            ) : (
                <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center text-sm text-gray-400">Loading video...</div>
            )}
            {block.content.summary && <p className="text-sm text-gray-400 italic mt-2">{block.content.summary}</p>}
            {block.content.isGeneratingSummary && <p className="text-sm text-blue-400 italic mt-2">AI is generating a summary...</p>}
            {block.content.summaryError && <p className="text-sm text-red-400 italic mt-2">Error: {block.content.summaryError}</p>}
        </div>
    );
};

const FileBlock: React.FC<{ block: ContentBlock }> = ({ block }) => {
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [pdfDoc, setPdfDoc] = useState<any | null>(null);
    const [pageNum, setPageNum] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [pdfError, setPdfError] = useState<string | null>(null);

    useEffect(() => {
        if (block.content.dbKey) {
            getMedia(block.content.dbKey).then(media => media && setFileUrl(media.url));
        }
    }, [block.content.dbKey]);
    
    const isPdf = block.content.mimeType === 'application/pdf';

    useEffect(() => {
        if (!fileUrl || !isPdf) {
            if (isPdf) setIsLoading(true); else setIsLoading(false);
            return;
        }

        let isCancelled = false;
        let attempt = 0;
        const maxAttempts = 50; // Wait up to 10 seconds

        const loadAndRenderPdf = async () => {
            if (isCancelled) return;

            const pdfjs = (window as any).pdfjsLib;

            if (pdfjs) {
                // Library is loaded, proceed.
                setPdfError(null);
                try {
                    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
                        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
                    }
                    
                    const base64 = fileUrl.substring(fileUrl.indexOf(',') + 1);
                    const pdfData = atob(base64);
                    const uint8Array = new Uint8Array(pdfData.length);
                    for (let i = 0; i < pdfData.length; i++) {
                        uint8Array[i] = pdfData.charCodeAt(i);
                    }

                    const doc = await pdfjs.getDocument({ data: uint8Array, worker: false }).promise;
                    if (isCancelled) return;
                    
                    setPdfDoc(doc);
                    setNumPages(doc.numPages);
                    // The rendering will be handled by the next useEffect, so we don't set loading to false here.
                } catch (error) {
                    console.error("Failed to load PDF:", error);
                    if (!isCancelled) {
                        setPdfError("Could not display PDF. The file might be corrupted or unsupported.");
                        setIsLoading(false);
                    }
                }
            } else {
                // Library not yet loaded, retry.
                attempt++;
                if (attempt < maxAttempts) {
                    setTimeout(loadAndRenderPdf, 200);
                } else {
                    if (!isCancelled) {
                        setPdfError("PDF viewer library failed to load. Please check your internet connection and refresh.");
                        setIsLoading(false);
                    }
                }
            }
        };

        setIsLoading(true);
        setPdfDoc(null);
        setPageNum(1);
        loadAndRenderPdf();

        return () => {
            isCancelled = true;
        };
    }, [fileUrl, isPdf]);


    useEffect(() => {
        if (!pdfDoc || !canvasRef.current) return;
        
        let isCancelled = false;
        setIsLoading(true); 
        
        const renderPage = async (num: number) => {
            try {
                const page = await pdfDoc.getPage(num);
                if (isCancelled) return;

                const canvas = canvasRef.current;
                if (!canvas) return;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                
                const viewport = page.getViewport({ scale: 1.5 });
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport,
                };
                await page.render(renderContext).promise;
            } catch (error) {
                console.error("Failed to render page", error);
                if (!isCancelled) setPdfError("Could not render this page.");
            } finally {
                 if (!isCancelled) setIsLoading(false);
            }
        };
        
        renderPage(pageNum);
        return () => { isCancelled = true; };
    }, [pdfDoc, pageNum]);

    const goToPrevPage = () => setPageNum(p => Math.max(1, p - 1));
    const goToNextPage = () => setPageNum(p => Math.min(numPages, p + 1));

    if (isPdf) {
        return (
            <div className="my-4">
                <div className="bg-gray-800/50 rounded-lg border border-gray-700">
                     <div className="p-2 flex justify-between items-center border-b border-gray-700 bg-gray-900/30 rounded-t-lg">
                        <span className="text-sm font-medium text-gray-300 truncate pl-2">{block.content.name || 'PDF Document'}</span>
                        {fileUrl && (
                            <a href={fileUrl} download={block.content.name} className="text-sm text-blue-400 hover:underline px-2 py-1 rounded-md hover:bg-gray-700">
                                Download
                            </a>
                        )}
                    </div>
                    
                    {pdfDoc && numPages > 1 && (
                        <div className="bg-gray-800 p-2 flex items-center justify-center">
                             <div className="flex items-center gap-4">
                                <button onClick={goToPrevPage} disabled={pageNum <= 1} className="p-1 rounded-full disabled:text-gray-600 text-gray-300 hover:bg-gray-700">
                                    <ChevronUpIcon className="w-5 h-5 rotate-[-90deg]" />
                                </button>
                                <span className="text-sm text-gray-400">Page {pageNum} of {numPages}</span>
                                <button onClick={goToNextPage} disabled={pageNum >= numPages} className="p-1 rounded-full disabled:text-gray-600 text-gray-300 hover:bg-gray-700">
                                    <ChevronDownIcon className="w-5 h-5 rotate-[-90deg]" />
                                </button>
                             </div>
                        </div>
                    )}

                    <div className="w-full bg-gray-900/50 flex justify-center p-4 min-h-[150px] items-center">
                        {isLoading && <div className="text-gray-400 p-4">Loading PDF...</div>}
                        {pdfError && <div className="text-red-400 p-4">{pdfError}</div>}
                        <canvas ref={canvasRef} className={`${(isLoading || pdfError) ? 'hidden' : ''}`}></canvas>
                    </div>
                    
                    {(block.content.summary || block.content.isGeneratingSummary || block.content.summaryError) && (
                        <div className="p-4 border-t border-gray-700">
                            {block.content.summary && (
                                <>
                                    <h4 className="font-semibold text-sm text-gray-200 mb-1">AI Summary</h4>
                                    <p className="text-sm text-gray-400 italic">{block.content.summary}</p>
                                </>
                            )}
                            {block.content.isGeneratingSummary && <p className="text-sm text-blue-400 italic">AI is generating a summary...</p>}
                            {block.content.summaryError && <p className="text-sm text-red-400 italic">Error: {block.content.summaryError}</p>}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="my-4 p-4 bg-gray-800/50 rounded-lg grid grid-cols-[auto,1fr,auto] items-center gap-x-4 gap-y-2">
            <PaperClipIcon className="w-5 h-5 text-gray-400"/>
            <span className="truncate text-sm font-medium">{block.content.name || 'Attached File'}</span>
            {fileUrl && <a href={fileUrl} download={block.content.name} className="text-sm text-blue-400 hover:underline justify-self-end">Download</a>}
            
            {(block.content.summary || block.content.isGeneratingSummary || block.content.summaryError) && (
                <div className="col-span-3">
                    {block.content.summary && <p className="text-sm text-gray-400 italic mt-2">{block.content.summary}</p>}
                    {block.content.isGeneratingSummary && <p className="text-sm text-blue-400 italic mt-2">AI is generating a summary...</p>}
                    {block.content.summaryError && <p className="text-sm text-red-400 italic mt-2">Error: {block.content.summaryError}</p>}
                </div>
            )}
        </div>
    );
};

const EmbedBlock: React.FC<{ block: ContentBlock; updateBlock: (b: ContentBlock) => void; note: Note; updateNote: (updatedNote: Note) => void; }> = ({ block, updateBlock, note, updateNote }) => {
    const [urlInput, setUrlInput] = useState(block.content.url || '');
    const [isEditing, setIsEditing] = useState(!block.content.url);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showEnhancedSummary, setShowEnhancedSummary] = useState(false);
    const [showQA, setShowQA] = useState(false);
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isAsking, setIsAsking] = useState(false);
    
    const noteRef = useRef(note);
    useEffect(() => {
        noteRef.current = note;
    }, [note]);

    const [isGeneratingVideoAnswer, setIsGeneratingVideoAnswer] = useState(false);
    const [showVideoQAPrompt, setShowVideoQAPrompt] = useState(false);
    const [videoQuestion, setVideoQuestion] = useState('');

    const handleAskQuestionAboutVideo = async (question: string) => {
        if (!question.trim() || !block.content.url) return;
        
        setIsGeneratingVideoAnswer(true);
        try {
            const answer = await answerQuestionAboutYouTubeVideo(block.content.url, question);
            
            const answerBlock: ContentBlock = {
                id: self.crypto.randomUUID(),
                type: ContentBlockType.TEXT,
                content: { text: `**Q: ${question}**\n\n${answer}` },
                createdAt: new Date().toISOString()
            };
            
            const videoBlockIndex = noteRef.current.content.findIndex(b => b.id === block.id);
            const newContent = [...noteRef.current.content];
            newContent.splice(videoBlockIndex + 1, 0, answerBlock);
            updateNote({ ...noteRef.current, content: newContent });
        } catch (error) {
            console.error('Error asking question about video:', error);
        } finally {
            setIsGeneratingVideoAnswer(false);
        }
    };

    const handleGeneratePreview = async () => {
        if (!urlInput.trim()) return;
        
        setIsLoading(true);
        setError(null);
        
        const isGoogleWorkspace = /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9-_]+)/.test(urlInput);
        const isYoutube = urlInput.includes('youtube.com') || urlInput.includes('youtu.be');

        let title = '';
        let summary = '';
        let embedUrl: string | null = null;
        let thumbnailUrl: string | null = null;

        try {
            if (isGoogleWorkspace) {
                const preview = await summarizeGoogleWorkspaceDoc(urlInput);
                title = preview.title;
                summary = preview.summary;
                const docIdMatch = urlInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
                const docTypeMatch = urlInput.match(/docs\.google\.com\/(document|spreadsheets|presentation)/);
                if (docIdMatch && docTypeMatch) {
                    embedUrl = `https://docs.google.com/${docTypeMatch[1]}/d/${docIdMatch[1]}/preview`;
                }
            } else if (isYoutube) {
                const videoId = extractYouTubeVideoId(urlInput);
                if (!videoId) throw new Error('Invalid YouTube URL. Please check the URL and try again.');
                
                thumbnailUrl = getYouTubeThumbnail(videoId);
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
                
                try {
                    const videoInfo = await getYouTubeVideoInfo(videoId);
                    title = videoInfo.title;
                    summary = await generateYouTubeSummaryFromTitle(videoInfo.title);
                } catch (e) {
                    console.warn("Falling back for YouTube summary:", e);
                    title = `YouTube Video (${videoId})`;
                    summary = 'Video embedded successfully. Click "Enhanced Summary" for more details.';
                }

            } else {
                try {
                    const preview = await generateWebsiteSummary(urlInput);
                    title = preview.title;
                    summary = preview.summary;
                } catch (e) {
                    title = new URL(urlInput).hostname;
                    summary = 'Summary not available.';
                }
                thumbnailUrl = getWebsiteThumbnail(urlInput);
            }
            
            updateBlock({
                ...block,
                content: { ...block.content, url: urlInput, title, summary, embedUrl, thumbnail: thumbnailUrl || undefined },
            });
            setIsEditing(false);
        } catch (err: any) {
            console.error("Failed to generate link preview", err);
            setError(err.message || 'Could not generate a preview for this link.');
            // Update with error state if you want to show it in the block itself
            updateBlock({
                ...block,
                content: { ...block.content, url: urlInput, title: 'Error', summary: err.message },
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleReset = () => {
        updateBlock({
            ...block,
            content: { url: '', title: '', summary: '', embedUrl: '', thumbnail: '' },
        });
        setIsEditing(true);
    };
    
    const handleEnhancedSummary = async () => {
        if (block.content.enhancedSummary) {
            setShowEnhancedSummary(!showEnhancedSummary);
            return;
        }
        updateBlock({ ...block, content: { ...block.content, isGeneratingEnhancedSummary: true, enhancedSummaryError: null } });

        try {
            const urlType = block.content.embedUrl ? 'doc' : (block.content.url?.includes('youtube') || block.content.url?.includes('youtu.be') ? 'youtube' : 'website');
            const summary = await generateEnhancedSummary(block.content.title!, urlType as any);
            updateBlock({ ...block, content: { ...block.content, enhancedSummary: summary, isGeneratingEnhancedSummary: false } });
            setShowEnhancedSummary(true);
        } catch (err: any) {
            updateBlock({ ...block, content: { ...block.content, isGeneratingEnhancedSummary: false, enhancedSummaryError: err.message || 'Failed to generate summary.' } });
        }
    };

    const handleAskQuestion = async () => {
        if (!currentQuestion.trim()) return;
        const newUserMessage = { role: 'user' as const, text: currentQuestion };
        setChatHistory(prev => [...prev, newUserMessage]);
        setIsAsking(true);
        setCurrentQuestion('');

        try {
            const answer = await askQuestionAboutEmbeddedContent(block.content, newUserMessage.text, chatHistory);
            const modelMessage = { role: 'model' as const, text: answer };
            setChatHistory(prev => [...prev, modelMessage]);
        } catch (err) {
            const errorMessage = { role: 'model' as const, text: 'Sorry, I had trouble answering that. Please try again.' };
            setChatHistory(prev => [...prev, errorMessage]);
        } finally {
            setIsAsking(false);
        }
    };
    
    const renderMarkdown = (text: string): { __html: string } => {
      let html = text
        .replace(/### (.*?)(\n|$)/g, '<h3 class="text-lg font-semibold mt-3 mb-2 text-gray-200">$1</h3>')
        .replace(/## (.*?)(\n|$)/g, '<h2 class="text-xl font-bold mt-4 mb-2 text-white">$1</h2>')
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
        .replace(/^- (.*?)$/gm, '<li class="ml-4">$1</li>')
        .replace(/\n\n/g, '<br/><br/>');
      html = html.replace(/(<li.*?<\/li>\n?)+/g, '<ul class="list-disc ml-4 my-2">$1</ul>');
      html = html.replace(/\n/g, '<br/>');
      return { __html: html };
    };

    if (isEditing || !block.content.url) {
        return (
            <div className="my-4">
                <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
                    <LinkIcon className="w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Paste a link..."
                        className="flex-1 bg-transparent focus:outline-none text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleGeneratePreview()}
                        disabled={isLoading}
                    />
                    <button onClick={handleGeneratePreview} disabled={isLoading || !urlInput.trim()}>
                        {isLoading ? <SpinnerIcon className="w-5 h-5 text-blue-400" /> : <PaperAirplaneIcon className="w-5 h-5 text-gray-400 hover:text-white" />}
                    </button>
                </div>
                {error && <p className="text-sm text-red-400 mt-2 px-2">{error}</p>}
            </div>
        );
    }
    
    const isYoutube = block.content.url?.includes('youtube') || block.content.url?.includes('youtu.be');

    const renderYoutubeEmbed = () => {
        const videoId = extractYouTubeVideoId(block.content.url!);
        if (!videoId) {
            return (
                <div className="aspect-video w-full bg-black flex items-center justify-center">
                    <p className="text-red-500">Invalid YouTube URL</p>
                </div>
            );
        }
        return (
            <div className="relative w-full" style={{ paddingBottom: '56.25%', height: 0 }}>
                <iframe
                    src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                    className="absolute top-0 left-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    title={block.content.title || 'YouTube video'}
                    frameBorder="0"
                    loading="lazy"
                />
            </div>
        );
    };

    return (
        <div className="my-4 bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden relative group/embed">
            {/* Preview Section */}
            {isYoutube ? renderYoutubeEmbed() 
              : block.content.embedUrl ? (
                 <div className="aspect-video w-full bg-white"><iframe src={block.content.embedUrl} title={block.content.title} className="w-full h-full" sandbox="allow-scripts allow-same-origin"></iframe></div>
              ) : (
                <a href={block.content.url} target="_blank" rel="noopener noreferrer" className="block relative group bg-gray-900">
                    <img src={block.content.thumbnail} alt={block.content.title} className="w-full h-48 object-cover opacity-60 group-hover:opacity-80 transition-opacity" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10">
                        <ExternalLinkIcon className="w-10 h-10 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
                    </div>
                </a>
            )}

            {/* Info & Actions Section */}
            <div className="p-4">
                <a href={block.content.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    <h3 className="font-semibold text-gray-200 truncate">{block.content.title}</h3>
                </a>
                {block.content.summary && <p className="text-sm text-gray-400 italic mt-1">{block.content.summary}</p>}

                {/* Action Buttons */}
                <div className="flex gap-3 mt-4">
                    <button onClick={handleEnhancedSummary} disabled={!!block.content.isGeneratingEnhancedSummary} className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
                        {block.content.isGeneratingEnhancedSummary ? <SpinnerIcon className="w-4 h-4" /> : <FileTextIcon className="w-4 h-4" />}
                        <span>Enhanced Summary</span>
                        {showEnhancedSummary ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                    </button>
                    {!isYoutube && (
                        <button onClick={() => setShowQA(!showQA)} className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all flex items-center justify-center gap-2 text-sm">
                            <MessageSquareIcon className="w-4 h-4" />
                            <span>Ask a Question</span>
                        </button>
                    )}
                </div>

                {/* Enhanced Summary Display */}
                {block.content.enhancedSummaryError && <p className="text-sm text-red-400 mt-2">{block.content.enhancedSummaryError}</p>}
                {showEnhancedSummary && block.content.enhancedSummary && (
                    <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={renderMarkdown(block.content.enhancedSummary)} />
                    </div>
                )}

                {/* Q&A Section */}
                {isYoutube ? (
                    <div className="mt-4 space-y-2">
                        {!showVideoQAPrompt && (
                        <button 
                            onClick={() => setShowVideoQAPrompt(true)}
                            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                        >
                            <SparklesIcon className="w-4 h-4" /> Ask question about this video
                        </button>
                        )}
                        
                        {showVideoQAPrompt && (
                        <form 
                            onSubmit={(e) => {
                            e.preventDefault();
                            handleAskQuestionAboutVideo(videoQuestion);
                            setVideoQuestion('');
                            setShowVideoQAPrompt(false);
                            }}
                            className="flex items-center gap-2 mt-2 bg-gray-800 p-2 rounded-lg"
                        >
                            <input
                            type="text"
                            value={videoQuestion}
                            onChange={(e) => setVideoQuestion(e.target.value)}
                            placeholder="e.g., What are the main points discussed?"
                            className="flex-1 bg-transparent focus:outline-none text-sm"
                            autoFocus
                            disabled={isGeneratingVideoAnswer}
                            />
                            <button 
                            type="submit" 
                            className="text-blue-400 p-1 rounded-md hover:bg-gray-700 disabled:opacity-50"
                            disabled={isGeneratingVideoAnswer || !videoQuestion.trim()}
                            >
                            {isGeneratingVideoAnswer ? (
                                <StopIcon className="w-5 h-5 animate-pulse" />
                            ) : (
                                <PaperAirplaneIcon className="w-5 h-5" />
                            )}
                            </button>
                        </form>
                        )}
                    </div>
                ) : (
                    showQA && (
                        <div className="mt-4 border-t border-gray-700 pt-4">
                            {chatHistory.length > 0 && (
                                <div className="mb-4 space-y-3 max-h-60 overflow-y-auto pr-2">
                                    {chatHistory.map((msg, idx) => (
                                        <div key={idx} className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-blue-900/50 ml-8' : 'bg-gray-700/50 mr-8'}`}>
                                            <p className="font-semibold mb-1">{msg.role === 'user' ? 'You' : 'MindCanvas'}</p>
                                            <p className="whitespace-pre-wrap">{msg.text}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2 items-center">
                                <input type="text" value={currentQuestion} onChange={(e) => setCurrentQuestion(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()} placeholder="Ask a follow-up..." disabled={isAsking}
                                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                                <button onClick={handleAskQuestion} disabled={isAsking || !currentQuestion.trim()} className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-600">
                                    {isAsking ? <SpinnerIcon className="w-5 h-5" /> : <PaperAirplaneIcon className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    )
                )}
            </div>
             <button
                onClick={handleReset}
                className="absolute -top-2 -right-2 p-1 bg-gray-800 rounded-full text-gray-500 hover:text-white opacity-0 group-hover/embed:opacity-100 transition-opacity"
            >
                <XMarkIcon className="w-4 h-4" />
            </button>
        </div>
    );
};


const ContentBlockComponent: React.FC<ContentBlockProps> = ({ note, updateNote, block, updateBlock, deleteBlock, onAskAIAboutImage, askingImageAIBlockId, onInputFocus }) => {
  const blockRef = useRef<HTMLDivElement>(null);
  
  const renderBlock = () => {
    switch (block.type) {
      case ContentBlockType.HEADER:
        return <TextBlock block={block} updateBlock={updateBlock} isHeader={true} onFocus={onInputFocus} />;
      case ContentBlockType.TEXT:
        return <TextBlock block={block} updateBlock={updateBlock} isHeader={false} onFocus={onInputFocus} />;
      case ContentBlockType.CHECKLIST:
        return <ChecklistBlock block={block} updateBlock={updateBlock} onFocus={onInputFocus} />;
      case ContentBlockType.IMAGE:
        return <ImageBlock block={block} onAskAIAboutImage={onAskAIAboutImage} askingImageAIBlockId={askingImageAIBlockId} />;
      case ContentBlockType.AUDIO:
          return <AudioBlock block={block} />;
      case ContentBlockType.VIDEO:
          return <VideoBlock block={block} />;
      case ContentBlockType.FILE:
          return <FileBlock block={block} />;
      case ContentBlockType.EMBED:
          return <EmbedBlock block={block} updateBlock={updateBlock} note={note} updateNote={updateNote} />;
      default:
        return <div className="text-red-500">Unsupported block type</div>;
    }
  };

  return (
    <div ref={blockRef} className="relative group">
        <div className="flex items-start gap-2">
            <div className="flex-1">
                {renderBlock()}
            </div>
            <button
                onClick={() => deleteBlock(block.id)}
                className="p-1.5 rounded-full text-gray-600 hover:bg-gray-800 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity absolute -right-8 top-1/2 -translate-y-1/2"
                title="Delete block"
            >
                <TrashIcon className="w-4 h-4" />
            </button>
        </div>
    </div>
  );
};

export default ContentBlockComponent;