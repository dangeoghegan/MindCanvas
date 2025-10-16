// Content / Notes

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export enum ContentBlockType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  CHECKLIST = 'CHECKLIST',
  HEADER = 'HEADER',
  FILE = 'FILE',
  EMBED = 'EMBED',
}

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  content: any;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  createdAt: string;
  content: ContentBlock[];
}

// Chat

export interface ChatMessageSourceNote {
  type: 'note';
  noteId: string;
  noteTitle: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources?: ChatMessageSourceNote[];
}

// App navigation/views

// ✅ Include 'note' so setActiveView('note') is valid
export type View = 'dashboard' | 'chat' | 'library' | 'media' | 'note';

// (Optional helpers)
export const ALL_VIEWS: View[] = ['dashboard', 'chat', 'library', 'media', 'note'];
export type TabId = View;
