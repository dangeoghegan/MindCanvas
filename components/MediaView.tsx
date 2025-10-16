import React, { useState, useEffect } from 'react';
import { Note, ContentBlock, ContentBlockType } from '../types';
import { VideoCameraIcon, PhotoIcon } from './icons';
import { getMedia } from '../services/dbService';

interface MediaViewProps {
  notes: Note[];
  onSelectNote: (id: string) => void;
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
            // Prefer dbKey for new/migrated data
            if (block.content.dbKey) {
                setIsLoading(true);
                try {
                    const mediaData = await getMedia(block.content.dbKey);
                    if (mediaData) {
                        setMediaUrl(mediaData.url);
                    }
                } catch (error) {
                    console.error("Error fetching media for thumbnail:", error);
                } finally {
                    setIsLoading(false);
                }
            } else if (block.content.url) { // Fallback for any non-migrated data
                 setMediaUrl(block.content.url);
                 setIsLoading(false);
            } else {
                setIsLoading(false);
            }
        };

        fetchMedia();
    }, [block.content.dbKey, block.content.url]);

    if (isLoading) {
        return <div className="relative aspect-square bg-gray-800 rounded-lg animate-pulse"></div>;
    }

    if (!mediaUrl) {
        return null; // Don't render if media can't be loaded or doesn't exist
    }

    return (
        <button
            onClick={() => onSelectNote(noteId)}
            className="relative aspect-square bg-gray-800 rounded-lg overflow-hidden group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
            {block.type === ContentBlockType.IMAGE && (
                <img
                    src={mediaUrl}
                    alt="Media content"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
            )}
            {block.type === ContentBlockType.VIDEO && (
                <video
                    src={mediaUrl}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    playsInline
                    muted
                />
            )}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300" />
            {block.type === ContentBlockType.VIDEO && (
                <div className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-50 rounded-full">
                    <VideoCameraIcon className="w-5 h-5 text-white" />
                </div>
            )}
        </button>
    );
};


const MediaView: React.FC<MediaViewProps> = ({ notes, onSelectNote }) => {
  const mediaItems: MediaItem[] = notes.flatMap(note =>
    note.content
      .filter(block => 
        (block.type === ContentBlockType.IMAGE || block.type === ContentBlockType.VIDEO) && 
        (block.content.url || block.content.dbKey)
      )
      .map(block => ({ noteId: note.id, block }))
  );

  return (
    <div className="flex-1 bg-[#1C1C1C] text-white p-6 md:p-12 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Media</h1>
        {mediaItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {mediaItems.map((item) => (
              <MediaItemThumbnail key={item.block.id} item={item} onSelectNote={onSelectNote} />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-16">
            <PhotoIcon className="w-12 h-12 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-200">No Media Found</h2>
            <p className="mt-2">Add images or videos to your notes to see them here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaView;