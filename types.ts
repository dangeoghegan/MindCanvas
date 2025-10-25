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

export interface RecognizedFace {
  name: string;
  confidence: number;
  box: { x: number; y: number; width: number; height: number };
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
    descriptionError?: string | null;
    summary?: string;
    isGeneratingSummary?: boolean;
    summaryError?: string | null;
    url?: string;
    embedUrl?: string;
    title?: string;
    thumbnail?: string;
    photoTakenAt?: string;
    isRecognizingFaces?: boolean;
    faceRecognitionError?: string | null;
    faces?: RecognizedFace[];
    enhancedSummary?: string;
    isGeneratingEnhancedSummary?: boolean;
    enhancedSummaryError?: string | null;
  };
  createdAt: string;
}

export interface Note {
  id:string;
  title: string;
  createdAt: string;
  content: ContentBlock[];
  titleIsGenerating?: boolean;
  titleError?: string | null;
  tags?: string[];
  tagsAreGenerating?: boolean;
  tagsError?: string | null;
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

export type VoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
export interface VoiceOption {
  id: VoiceName;
  name: string;
  description: string;
}
