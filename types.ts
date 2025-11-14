import { FaceDescriptor } from './services/faceRecognitionService';

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
    location?: { lat: number; lon: number };
    isRecognizingFaces?: boolean;
    faceRecognitionError?: string | null;
    faces?: RecognizedFace[];
    enhancedSummary?: string;
    isGeneratingEnhancedSummary?: boolean;
    enhancedSummaryError?: string | null;
    isEmbeddable?: boolean;
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
  isAiChecklistGenerating?: boolean;
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

export type VoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore';
export type Theme = 'light' | 'dark';
export interface VoiceOption {
  id: VoiceName;
  name: string;
  description: string;
}

export type AITaskType = 
  | 'recognizeFaces'
  | 'generateImageDescription'
  | 'summarizeVideo'
  | 'summarizeAudio'
  | 'summarizePdf'
  | 'generateTitle'
  | 'generateTags'
  | 'summarizeYouTubeEmbed';

export interface AITask {
  id: string; // e.g., `${noteId}-${blockId || 'note'}-${type}`
  type: AITaskType;
  noteId: string;
  blockId?: string;
  // This could be expanded with context if needed, but for now, IDs are enough.
}

export interface UserProfile {
  name: string;
}

export type CategoryIcon = 'wifi' | 'lock' | 'credit-card' | 'briefcase' | 'key' | 'default';

export interface DynamicCategory {
  name: string;
  icon: CategoryIcon;
  content: string;
}
