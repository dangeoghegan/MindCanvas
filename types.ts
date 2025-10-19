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
  content: {
    text?: string;
    items?: ChecklistItem[];
    dbKey?: string;
    mimeType?: string;
    name?: string;
    description?: string;
    isGeneratingDescription?: boolean;
    summary?: string;
    isGeneratingSummary?: boolean;
    url?: string;
    embedUrl?: string;
    title?: string;
    photoTakenAt?: string;
  };
  createdAt: string;
}

export interface Note {
  id:string;
  title: string;
  createdAt: string;
  content: ContentBlock[];
  titleIsGenerating?: boolean;
  tags?: string[];
  tagsAreGenerating?: boolean;
  people?: string[];
}

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

export type RetentionPeriod = '1-day' | '3-days' | '1-week' | '1-month' | '6-months' | '1-year';

export interface AutoDeleteRule {
  tag: string;
  period: RetentionPeriod;
}