import { Note, ContentBlock, ContentBlockType, ChecklistItem } from '../types';

const getNoteContentAsText = (note: Note): string => {
  return note.content.map(block => {
    switch (block.type) {
      case ContentBlockType.HEADER:
        return `# ${block.content.text || ''}`;
      case ContentBlockType.TEXT:
        return block.content.text || '';
      case ContentBlockType.CHECKLIST:
        return (block.content.items || [])
          .map((item: ChecklistItem) => `- ${item.checked ? '[x]' : '[ ]'} ${item.text}`)
          .join('\n');
      case ContentBlockType.IMAGE:
        return `[Image: ${block.content.description || block.content.name || 'Untitled Image'}]`;
      case ContentBlockType.VIDEO:
        return `[Video: ${block.content.summary || block.content.name || 'Untitled Video'}]`;
      case ContentBlockType.AUDIO:
        return `[Audio: ${block.content.summary || block.content.name || 'Untitled Audio'}]`;
      case ContentBlockType.FILE:
        return `[File: ${block.content.name || 'Untitled File'}]`;
      case ContentBlockType.EMBED:
        return `[Link: ${block.content.title || block.content.url}]\n${block.content.summary || ''}`;
      default:
        return '';
    }
  }).filter(text => text.trim() !== '').join('\n\n');
};

export const shareNote = async (note: Note) => {
  const contentAsText = getNoteContentAsText(note);
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: note.title || 'Untitled Note',
        text: contentAsText,
      });
      return { success: true };
    } catch (error: any) {
      if (error.name !== 'AbortError') { // User cancelled
        console.error('Error sharing:', error);
        return { success: false, error };
      }
      // if user cancelled, it's not an error we need to report
      return { success: true }; // Treat cancellation as a non-failure state for UI
    }
  }
  return { success: false, error: new Error('Web Share API not supported.') };
};
