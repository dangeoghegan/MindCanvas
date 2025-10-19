import React, { useState, useEffect, useRef, KeyboardEvent, useMemo } from 'react';
import { ContentBlock, ContentBlockType, ChecklistItem } from '../types';
import { TrashIcon, SparklesIcon, PaperAirplaneIcon, StopIcon, PaperClipIcon, LinkIcon, XMarkIcon } from './icons';
import { getMedia } from '../services/dbService';
import { generateLinkPreview, generateVideoSummaryFromUrl } from '../services/geminiService';

interface ContentBlockProps {
  block: ContentBlock;
  updateBlock: (updatedBlock: ContentBlock) => void;
  deleteBlock: (blockId: string) => void;
  onAskAIAboutImage: (blockId: string, question: string) => void;
  askingImageAIBlockId: string | null;
}

const TextBlock: React.FC<{
  block: ContentBlock;
  updateBlock: (b: ContentBlock) => void;
  isHeader: boolean;
}> = ({ block, updateBlock, isHeader }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(block.content.text || '');

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
      placeholder={isHeader ? "Header" : "Type something..."}
      className={className}
      rows={1}
    />
  );
};


const ChecklistBlock: React.FC<{
    block: ContentBlock;
    updateBlock: (b: ContentBlock) => void;
}> = ({ block, updateBlock }) => {
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
                        value={item.text}
                        onChange={(e) => handleUpdateItem(item.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, item.id)}
                        data-item-id={item.id}
                        placeholder="List item"
                        className={`flex-1 bg-transparent focus:outline-none ${item.checked ? 'line-through text-gray-500' : ''}`}
                    />
                </div>
            ))}
        </div>
    );
};


const MediaBlock: React.FC<{ block: ContentBlock, onAskAIAboutImage: (blockId: string, question: string) => void, askingImageAIBlockId: string | null }> = ({ block, onAskAIAboutImage, askingImageAIBlockId }) => {
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showAiPrompt, setShowAiPrompt] = useState(false);
    const [aiQuestion, setAiQuestion] = useState('');

    useEffect(() => {
        const fetchMedia = async () => {
            if (!block.content.dbKey) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                const mediaData = await getMedia(block.content.dbKey);
                setMediaUrl(mediaData?.url || null);
            } catch (error) {
                console.error("Error fetching media:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMedia();
    }, [block.content.dbKey]);

    const summaryText = block.content.description || block.content.summary;
    const [transcription, summary] = useMemo(() => {
        if (!summaryText) return [null, null];
        if (block.type === ContentBlockType.IMAGE) {
            return [null, summaryText];
        }
        const parts = summaryText.split('---');
        if (parts.length > 1 && parts[0].trim() !== '') {
            return [parts[0].trim(), parts.slice(1).join('---').trim()];
        }
        // If there's no separator, or if the part before it is empty, treat the whole thing as a summary.
        return [null, summaryText];
    }, [summaryText, block.type]);

    const formattedPhotoDate = useMemo(() => {
        if (block.type === ContentBlockType.IMAGE && block.content.photoTakenAt) {
            try {
                return new Date(block.content.photoTakenAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } catch (e) {
                console.error("Invalid photoTakenAt date:", block.content.photoTakenAt);
                return null;
            }
        }
        return null;
    }, [block.content.photoTakenAt, block.type]);

    const handleAskAiSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (aiQuestion.trim()) {
            onAskAIAboutImage(block.id, aiQuestion);
            setAiQuestion('');
            setShowAiPrompt(false);
        }
    };
    
    if (isLoading) return <div className="bg-gray-800 rounded-lg animate-pulse w-full h-48"></div>;
    if (!mediaUrl) return <div className="text-red-400">Media not found.</div>;

    const isAskingThisBlock = askingImageAIBlockId === block.id;
    const isGenerating = block.content.isGeneratingDescription || block.content.isGeneratingSummary;
    
    const renderMedia = () => {
        switch (block.type) {
            case ContentBlockType.IMAGE:
                return <img src={mediaUrl} alt={block.content.description || 'User uploaded image'} className="max-w-full rounded-lg" />;
            case ContentBlockType.VIDEO:
                return <video src={mediaUrl} controls className="max-w-full rounded-lg max-h-[60vh]" />;
            case ContentBlockType.AUDIO:
                return <audio src={mediaUrl} controls className="w-full" />;
            default:
                return null;
        }
    };

    return (
        <div>
            {renderMedia()}
            {formattedPhotoDate && (
                <p className="text-xs text-gray-500 mt-2 italic text-right">
                    Photo taken on {formattedPhotoDate}
                </p>
            )}
            {(summary || transcription) && !isGenerating && (
                <div className="text-sm text-gray-400 mt-2 p-3 bg-gray-900/50 rounded-md space-y-3">
                    {transcription && (
                        <div>
                            <h4 className="text-xs font-semibold text-gray-300 mb-1 tracking-wider uppercase not-italic">Transcription</h4>
                            <p className="not-italic whitespace-pre-wrap font-mono text-xs text-gray-300">{transcription}</p>
                        </div>
                    )}
                    {summary && (
                         <div>
                            <h4 className="text-xs font-semibold text-gray-300 mb-1 tracking-wider uppercase not-italic">
                                {block.type === ContentBlockType.IMAGE ? 'AI Description' : 'AI Summary'}
                            </h4>
                            <p className="not-italic whitespace-pre-wrap">{summary}</p>
                        </div>
                    )}
                </div>
            )}
            {isGenerating && (
                <div className="text-sm text-gray-400 mt-2 p-3 bg-gray-900/50 rounded-md flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4 text-blue-400 animate-pulse" />
                    <span>AI is generating a summary...</span>
                </div>
            )}
            {block.type === ContentBlockType.IMAGE && (
                <div className="mt-2">
                    {!showAiPrompt && (
                        <button onClick={() => setShowAiPrompt(true)} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                           <SparklesIcon className="w-4 h-4" /> Ask AI about this image
                        </button>
                    )}
                    {showAiPrompt && (
                        <form onSubmit={handleAskAiSubmit} className="flex items-center gap-2 mt-2 bg-gray-800 p-2 rounded-lg">
                            <input
                                type="text"
                                value={aiQuestion}
                                onChange={(e) => setAiQuestion(e.target.value)}
                                placeholder="e.g., What color is the car?"
                                className="flex-1 bg-transparent focus:outline-none text-sm"
                                autoFocus
                                disabled={isAskingThisBlock}
                            />
                            <button type="submit" className="text-blue-400 p-1 rounded-md hover:bg-gray-700" disabled={isAskingThisBlock}>
                                {isAskingThisBlock ? <StopIcon className="w-5 h-5 animate-pulse" /> : <PaperAirplaneIcon className="w-5 h-5" />}
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
};

const FileBlock: React.FC<{block: ContentBlock}> = ({block}) => {
    const mimeType = block.content.mimeType || '';
    const isOfficeDoc = mimeType.includes('presentationml') || mimeType.includes('wordprocessingml') || mimeType.includes('spreadsheetml') || mimeType.includes('pdf');

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
             <div className="flex items-center gap-3">
                <PaperClipIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-200 font-medium truncate">{block.content.name || 'Attached File'}</span>
             </div>
             {isOfficeDoc && (
                <div className="mt-3 text-sm text-gray-400 bg-gray-900/50 p-3 rounded-md">
                    <p><strong className="text-gray-300">AI Summary Unavailable:</strong> To generate a summary, please copy the text from this document and paste it into a new text block below.</p>
                </div>
             )}
        </div>
    );
}

const getEmbedUrl = (url: string): string | null => {
    try {
        const urlObject = new URL(url);
        const hostname = urlObject.hostname.toLowerCase();
        const pathname = urlObject.pathname;

        if (hostname.includes('youtube.com')) {
            const videoId = urlObject.searchParams.get('v');
            if (videoId) return `https://www.youtube.com/embed/${videoId}`;
        }
        if (hostname.includes('youtu.be')) {
            const videoId = pathname.substring(1);
            if (videoId) return `https://www.youtube.com/embed/${videoId}`;
        }
        if (hostname.includes('vimeo.com')) {
            const videoId = pathname.substring(1);
            if (videoId && /^\d+$/.test(videoId)) {
                return `https://player.vimeo.com/video/${videoId}`;
            }
        }
    } catch (e) {
        return null;
    }
    return null;
};

const EmbedBlock: React.FC<{block: ContentBlock, updateBlock: (b: ContentBlock) => void}> = ({ block, updateBlock }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [localUrl, setLocalUrl] = useState(block.content.url || '');

    const isValidUrl = (urlString: string) => {
        try {
            new URL(urlString);
            return true;
        } catch (_) {
            return false;
        }
    };

    const triggerProcessing = async (url: string) => {
        if (!isValidUrl(url) || isGenerating) return;

        setIsGenerating(true);
        const embedUrl = getEmbedUrl(url);

        if (embedUrl) {
            try {
                const { summary } = await generateVideoSummaryFromUrl(url);
                updateBlock({ ...block, content: { url, embedUrl, title: null, summary } });
            } catch (error: any) {
                console.error("Error generating video summary:", error);
                let summaryMessage = 'AI summary could not be generated.';
                if (error.message && error.message.includes('RESOURCE_EXHAUSTED')) {
                    summaryMessage = 'AI summary failed: Rate limit exceeded. Please try again later.';
                }
                updateBlock({ ...block, content: { ...block.content, url, embedUrl, title: null, summary: summaryMessage } });
            }
        } else {
            try {
                const { title, summary } = await generateLinkPreview(url);
                updateBlock({ ...block, content: { ...block.content, url, embedUrl: null, title, summary } });
            } catch (error: any) {
                console.error("Error generating link preview:", error);
                 let summaryMessage = 'There was an issue processing this link.';
                if (error.message && error.message.includes('RESOURCE_EXHAUSTED')) {
                    summaryMessage = 'AI preview failed: Rate limit exceeded. Please try again later.';
                }
                updateBlock({ ...block, content: { ...block.content, url, embedUrl: null, title: 'Could not generate preview', summary: summaryMessage } });
            }
        }
        setIsGenerating(false);
    };

    useEffect(() => {
        if (block.content.url && !block.content.title && !block.content.embedUrl && !isGenerating) {
            triggerProcessing(block.content.url);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [block.content.url, block.content.title, block.content.embedUrl]);

    const handleProcessUrl = () => {
        const newUrl = localUrl.trim();
        if (newUrl && isValidUrl(newUrl) && newUrl !== block.content.url) {
            triggerProcessing(newUrl);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleProcessUrl();
            (e.target as HTMLInputElement).blur();
        }
    };
    
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = e.clipboardData.getData('text');
        if (isValidUrl(pastedText)) {
            setLocalUrl(pastedText);
            triggerProcessing(pastedText);
        }
    };

    const handleReset = () => {
        setLocalUrl('');
        updateBlock({ ...block, content: { url: '', title: null, summary: null, embedUrl: null } });
    };

    if (isGenerating || (block.content.url && !block.content.title && !block.content.embedUrl)) {
        return (
             <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="relative overflow-hidden">
                    <div className="animate-pulse space-y-3">
                        <div className="h-5 bg-gray-700 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-700 rounded w-full"></div>
                        <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-gray-700/30 to-transparent -translate-x-full animate-shimmer" />
                </div>
            </div>
        );
    }
    
    if (block.content.embedUrl) {
        return (
            <div className="relative group/embed bg-gray-900 rounded-lg border border-gray-700">
                <div className="relative aspect-video">
                    <iframe
                        src={block.content.embedUrl}
                        className="absolute top-0 left-0 w-full h-full rounded-t-lg"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="Embedded Content"
                    ></iframe>
                </div>
                {block.content.summary && (
                    <div className="p-4">
                        <h4 className="text-xs font-semibold text-gray-400 mb-1 tracking-wider uppercase">AI Summary</h4>
                        <p className="text-sm text-gray-300">{block.content.summary}</p>
                    </div>
                )}
                <button onClick={handleReset} className="absolute -top-2 -right-2 p-1 bg-gray-800 rounded-full text-gray-500 hover:text-white opacity-0 group-hover/embed:opacity-100 transition-opacity">
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>
        );
    }

    if (block.content.title) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 relative group/embed">
                <div className="font-semibold text-white mb-2">{block.content.title}</div>
                <p className="text-sm text-gray-400 mb-3">{block.content.summary}</p>
                <a href={block.content.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-400 hover:underline truncate">
                    <LinkIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{block.content.url}</span>
                </a>
                <button onClick={handleReset} className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white opacity-0 group-hover/embed:opacity-100 transition-opacity">
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>
        );
    }
    
    return (
        <input 
            type="text"
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleProcessUrl}
            onPaste={handlePaste}
            placeholder="Paste a link, then press Enter or click away..."
            className="bg-gray-800 border border-gray-700 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
    );
};

const ContentBlockComponent: React.FC<ContentBlockProps> = ({ block, updateBlock, deleteBlock, onAskAIAboutImage, askingImageAIBlockId }) => {
  const renderBlock = () => {
    switch (block.type) {
      case ContentBlockType.HEADER:
        return <TextBlock block={block} updateBlock={updateBlock} isHeader={true} />;
      case ContentBlockType.TEXT:
        return <TextBlock block={block} updateBlock={updateBlock} isHeader={false} />;
      case ContentBlockType.CHECKLIST:
        return <ChecklistBlock block={block} updateBlock={updateBlock} />;
      case ContentBlockType.IMAGE:
      case ContentBlockType.VIDEO:
      case ContentBlockType.AUDIO:
        return <MediaBlock block={block} onAskAIAboutImage={onAskAIAboutImage} askingImageAIBlockId={askingImageAIBlockId} />;
      case ContentBlockType.FILE:
        return <FileBlock block={block} />;
      case ContentBlockType.EMBED:
        return <EmbedBlock block={block} updateBlock={updateBlock} />;
      default:
        return <div className="text-red-500">Unsupported block type: {block.type}</div>;
    }
  };

  return (
    <div className="relative group py-1">
      {renderBlock()}
      <button
        onClick={() => deleteBlock(block.id)}
        className="absolute -left-8 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-600 hover:bg-gray-800 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete Block"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

export default ContentBlockComponent;