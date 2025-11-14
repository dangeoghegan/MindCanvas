import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note, ContentBlock, ContentBlockType, ChecklistItem } from '../types';
import { getMedia } from '../services/dbService';
import { generateLinkPreview, extractYouTubeVideoId, getYouTubeThumbnail, getWebsiteThumbnail } from '../services/geminiService';
import {
  TrashIcon, SparklesIcon, PaperAirplaneIcon, LinkIcon, FileTextIcon,
  ExternalLinkIcon, SpinnerIcon, PhotoIcon, VideoCameraIcon,
  PlayIcon, SpeakerWaveIcon, XMarkIcon, UserIcon, CalendarDaysIcon, TranscriptIcon, MessageSquareIcon, MapPinIcon
} from './icons';


interface ContentBlockProps {
  block: ContentBlock;
  note: Note;
  updateNote: (updatedNote: Note) => void;
  updateBlock: (updatedBlock: ContentBlock) => void;
  deleteBlock: (blockId: string) => void;
  onAskAIAboutImage: (blockId: string, question: string) => void;
  askingImageAIBlockId: string | null;
  onInputFocus: (element: HTMLTextAreaElement | HTMLInputElement, blockId: string, itemId?: string) => void;
  onViewImage: (url: string, alt: string) => void;
}

const AutoResizingTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [props.value]);

  return <textarea ref={textareaRef} {...props} />;
};

const ContentBlockComponent: React.FC<ContentBlockProps> = ({
  block, note, updateNote, updateBlock, deleteBlock, onAskAIAboutImage, askingImageAIBlockId, onInputFocus, onViewImage
}) => {

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [embedUrlInput, setEmbedUrlInput] = useState('');
  
  const mediaTypes = [ContentBlockType.IMAGE, ContentBlockType.VIDEO, ContentBlockType.AUDIO, ContentBlockType.FILE];

  useEffect(() => {
    if (mediaTypes.includes(block.type) && block.content.dbKey) {
      setIsLoadingMedia(true);
      getMedia(block.content.dbKey)
        .then(media => { if (media) setMediaUrl(media.url); })
        .catch(console.error)
        .finally(() => setIsLoadingMedia(false));
    }
  }, [block.type, block.content.dbKey]);

  const handleEmbedUrlSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const url = embedUrlInput.trim();
    if (!url) return;

    updateBlock({ ...block, content: { ...block.content, url, isGeneratingSummary: true, summaryError: null } });
    try {
      const videoId = extractYouTubeVideoId(url);
      const thumbnail = videoId ? getYouTubeThumbnail(videoId) : getWebsiteThumbnail(url);
      
      const { title, summary, isEmbeddable } = await generateLinkPreview(url);
      updateBlock({ ...block, content: { ...block.content, url, title, summary, thumbnail, isGeneratingSummary: false, isEmbeddable } });
    } catch (error: any) {
      updateBlock({ ...block, content: { ...block.content, url, isGeneratingSummary: false, summaryError: error.message || 'Could not fetch preview.' } });
    }
    setEmbedUrlInput('');
  }, [embedUrlInput, block, updateBlock]);

  const renderBlock = () => {
    switch (block.type) {
      case ContentBlockType.HEADER:
        return (
          <div className="relative group">
            <input
              type="text"
              value={block.content.text || ''}
              onChange={(e) => updateBlock({ ...block, content: { ...block.content, text: e.target.value } })}
              onFocus={(e) => onInputFocus(e.target, block.id)}
              placeholder="Header"
              className="text-2xl font-bold bg-transparent focus:outline-none w-full text-foreground placeholder-muted-foreground pr-10"
            />
            <button
              onClick={() => deleteBlock(block.id)}
              className="absolute top-1/2 -translate-y-1/2 right-0 z-10 p-1.5 text-muted-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary focus:opacity-100"
              aria-label="Delete header"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        );
      case ContentBlockType.TEXT:
        return (
           <div className="flex items-start gap-2 group">
            <AutoResizingTextarea
              value={block.content.text || ''}
              onChange={(e) => updateBlock({ ...block, content: { ...block.content, text: e.target.value } })}
              onFocus={(e) => onInputFocus(e.target, block.id)}
              placeholder="Type something..."
              className="flex-1 bg-transparent focus:outline-none resize-none text-foreground placeholder-muted-foreground leading-relaxed"
              rows={1}
            />
            <button
              onClick={() => deleteBlock(block.id)}
              className="p-1.5 text-muted-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary focus:opacity-100"
              aria-label="Delete text block"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        );
      case ContentBlockType.CHECKLIST:
        return (
          <div className="flex items-baseline gap-2 group">
            <div className="space-y-2 flex-1">
              {(block.content.items || []).map((item, index) => (
                <div key={item.id} className="flex items-center gap-2 group/item">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => {
                      const newItems = [...(block.content.items || [])];
                      newItems[index] = { ...item, checked: !item.checked };
                      updateBlock({ ...block, content: { ...block.content, items: newItems } });
                    }}
                    className="w-5 h-5 rounded text-primary bg-secondary border-border focus:ring-primary focus:ring-2"
                  />
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => {
                      const newItems = [...(block.content.items || [])];
                      newItems[index] = { ...item, text: e.target.value };
                      updateBlock({ ...block, content: { ...block.content, items: newItems } });
                    }}
                    onFocus={(e) => onInputFocus(e.target, block.id, item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          const newItems = [...(block.content.items || [])];
                          newItems.splice(index + 1, 0, { id: self.crypto.randomUUID(), text: '', checked: false });
                          updateBlock({ ...block, content: { ...block.content, items: newItems } });
                      } else if (e.key === 'Backspace' && !item.text && block.content.items.length > 1) {
                          e.preventDefault();
                          const newItems = (block.content.items || []).filter(i => i.id !== item.id);
                          updateBlock({ ...block, content: { ...block.content, items: newItems } });
                      }
                    }}
                    placeholder="List item"
                    className={`flex-1 bg-transparent focus:outline-none ${item.checked ? 'line-through text-muted-foreground' : ''}`}
                  />
                </div>
              ))}
            </div>
             <button
              onClick={() => deleteBlock(block.id)}
              className="p-1.5 text-muted-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary focus:opacity-100"
              aria-label="Delete checklist"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        );
      case ContentBlockType.IMAGE:
        if (isLoadingMedia) return <div className="bg-secondary rounded-lg aspect-video animate-pulse"></div>;
        return (
          <div className="relative bg-card border border-border rounded-lg overflow-hidden group">
            <button
                onClick={() => deleteBlock(block.id)}
                className="absolute top-2 right-2 z-10 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 focus:opacity-100"
                aria-label="Delete image"
            >
                <TrashIcon className="w-4 h-4" />
            </button>
            {mediaUrl && (
              <img
                src={mediaUrl}
                alt={block.content.description || 'User uploaded image'}
                className="w-full h-auto cursor-zoom-in"
                onClick={() => onViewImage(mediaUrl, block.content.description || 'User uploaded image')}
              />
            )}
            <div className="p-4 space-y-3">
              {block.content.isRecognizingFaces && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                    <SpinnerIcon className="w-4 h-4 text-primary" />
                    <span>Recognizing faces...</span>
                  </div>
              )}
              {(block.content.isGeneratingDescription || block.content.description) && (
                  <div className="flex items-start gap-2 text-sm">
                    <SparklesIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${block.content.isGeneratingDescription ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                    <p className="text-muted-foreground italic">{block.content.isGeneratingDescription ? 'AI is writing a description...' : block.content.description}</p>
                  </div>
              )}
              {block.content.descriptionError && <p className="text-sm text-destructive">{block.content.descriptionError}</p>}
              
               <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {block.content.photoTakenAt && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDaysIcon className="w-3 h-3" />
                            <span>{new Date(block.content.photoTakenAt).toLocaleString()}</span>
                        </div>
                    )}
                    {block.content.location && (
                        <a
                            href={`https://www.google.com/maps/search/?api=1&query=${block.content.location.lat},${block.content.location.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                            title={`Lat: ${block.content.location.lat.toFixed(4)}, Lon: ${block.content.location.lon.toFixed(4)}`}
                        >
                            <MapPinIcon className="w-3 h-3" />
                            <span>View Location</span>
                        </a>
                    )}
                </div>

              {block.content.faces && block.content.faces.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <UserIcon className="w-5 h-5 text-muted-foreground" />
                  {block.content.faces.map(face => (
                    <span key={`${face.name}-${face.box.x}`} className="text-xs font-bold bg-success/10 text-success-foreground px-2 py-1 rounded-full">{face.name}</span>
                  ))}
                </div>
              )}
              {block.content.faceRecognitionError && <p className="text-sm text-destructive">{block.content.faceRecognitionError}</p>}
              
              <form onSubmit={(e) => { e.preventDefault(); onAskAIAboutImage(block.id, aiQuestion); setAiQuestion(''); }} className="flex items-center gap-2">
                <input type="text" value={aiQuestion} onChange={e => setAiQuestion(e.target.value)} placeholder="Ask about this image..." className="flex-1 bg-secondary rounded-md p-2 focus:outline-none text-sm"/>
                <button type="submit" disabled={!aiQuestion.trim() || askingImageAIBlockId === block.id} className="p-2 bg-primary rounded-md text-primary-foreground disabled:bg-muted">
                  {askingImageAIBlockId === block.id ? <SpinnerIcon className="w-5 h-5"/> : <PaperAirplaneIcon />}
                </button>
              </form>
            </div>
          </div>
        );
      case ContentBlockType.VIDEO:
      case ContentBlockType.AUDIO:
        const isVideo = block.type === ContentBlockType.VIDEO;
        if (isLoadingMedia) return <div className="bg-secondary rounded-lg aspect-video animate-pulse"></div>;
        return (
            <div className="relative bg-card border border-border rounded-lg overflow-hidden group">
                <button
                    onClick={() => deleteBlock(block.id)}
                    className="absolute top-2 right-2 z-10 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 focus:opacity-100"
                    aria-label={isVideo ? "Delete video" : "Delete audio"}
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
                {mediaUrl && (
                    isVideo ? <video src={mediaUrl} controls className="w-full" /> : <audio src={mediaUrl} controls className="w-full p-4" />
                )}
                <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        {isVideo ? <VideoCameraIcon className="w-5 h-5 text-muted-foreground"/> : <SpeakerWaveIcon className="w-5 h-5 text-muted-foreground"/>}
                        <span className="text-sm font-semibold text-foreground truncate">{block.content.name}</span>
                    </div>
                    {(block.content.isGeneratingSummary || block.content.summary) && (
                        <div className="flex items-start gap-2 text-sm">
                            <SparklesIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${block.content.isGeneratingSummary ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                            <p className="text-muted-foreground italic">{block.content.isGeneratingSummary ? 'AI is generating a summary...' : block.content.summary}</p>
                        </div>
                    )}
                    {block.content.summaryError && <p className="text-sm text-destructive">{block.content.summaryError}</p>}
                </div>
            </div>
        );
      case ContentBlockType.FILE:
         return (
            <div className="relative bg-card border border-border rounded-lg p-4 flex items-center justify-between group">
                <button
                    onClick={() => deleteBlock(block.id)}
                    className="absolute top-2 right-2 z-10 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 focus:opacity-100"
                    aria-label="Delete file"
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 min-w-0 pr-8">
                    <FileTextIcon className="w-6 h-6 text-muted-foreground flex-shrink-0"/>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{block.content.name}</p>
                         {(block.content.isGeneratingSummary || block.content.summary) && (
                            <p className="text-xs text-muted-foreground italic truncate">{block.content.isGeneratingSummary ? 'Summarizing...' : block.content.summary}</p>
                        )}
                        {block.content.summaryError && <p className="text-xs text-destructive truncate">{block.content.summaryError}</p>}
                    </div>
                </div>
                {mediaUrl && <a href={mediaUrl} download={block.content.name} className="text-primary text-sm font-semibold hover:underline">Download</a>}
            </div>
        );
      case ContentBlockType.EMBED:
        const videoId = block.content.url ? extractYouTubeVideoId(block.content.url) : null;
        if (!block.content.url) {
            return (
                <form onSubmit={handleEmbedUrlSubmit} className="flex items-center gap-2">
                    <LinkIcon className="w-5 h-5 text-muted-foreground"/>
                    <input type="url" value={embedUrlInput} onChange={e => setEmbedUrlInput(e.target.value)} placeholder="Paste a link..." className="flex-1 bg-secondary rounded-md p-2 focus:outline-none text-sm"/>
                    <button type="submit" className="p-2 bg-primary rounded-md text-primary-foreground"><PaperAirplaneIcon /></button>
                </form>
            );
        }
        if (block.content.isGeneratingSummary) {
            return <div className="bg-secondary rounded-lg p-4 animate-pulse flex items-center gap-2"><SpinnerIcon/><span>Fetching preview...</span></div>
        }
        if (block.content.summaryError) {
             return <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 text-sm">{block.content.summaryError}</div>
        }
        return (
            <div className="relative bg-card border border-border rounded-lg overflow-hidden group">
                <button
                    onClick={() => deleteBlock(block.id)}
                    className="absolute top-2 right-2 z-10 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 focus:opacity-100"
                    aria-label="Delete embed"
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
                {videoId && block.content.isEmbeddable ? (
                    <div className="aspect-video">
                        <iframe src={`https://www.youtube.com/embed/${videoId}`} title={block.content.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
                    </div>
                ) : (
                    block.content.thumbnail && <img src={block.content.thumbnail} alt="Website thumbnail" className="w-full h-auto object-cover max-h-64" />
                )}
                <div className="p-4 space-y-3">
                    <a href={block.content.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-foreground font-bold hover:underline">
                        <span>{block.content.title || 'Untitled'}</span><ExternalLinkIcon className="w-4 h-4" />
                    </a>
                    <p className="text-sm text-muted-foreground">{block.content.summary}</p>
                </div>
            </div>
        );
      default:
        return null;
    }
  };

  return (
     <div className="relative my-2">
        <div className="group/block">{renderBlock()}</div>
    </div>
  );
};

export default ContentBlockComponent;