import React, { useState, useEffect, useMemo } from 'react';
import { Note, ContentBlockType, ChecklistItem } from '../types';
import { generateReviewSummary } from '../services/geminiService';
import { CalendarDaysIcon } from './icons';

type Period = 'weekly' | 'monthly' | 'quarterly' | 'semi-annually' | 'yearly';

interface TabButtonProps {
    label: string;
    period: Period;
    activePeriod: Period;
    setPeriod: (period: Period) => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, period, activePeriod, setPeriod }) => (
    <button
        onClick={() => setPeriod(period)}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex-1 ${
            activePeriod === period
                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`}
    >
        {label}
    </button>
);

const getNoteContentAsString = (note: Note): string => {
    const contentText = note.content.map(block => {
        switch (block.type) {
            case ContentBlockType.HEADER:
            case ContentBlockType.TEXT:
                return block.content.text || '';
            case ContentBlockType.CHECKLIST:
                return block.content.items.map((item: ChecklistItem) => `- ${item.text}`).join('\n');
            case ContentBlockType.IMAGE:
            case ContentBlockType.VIDEO:
                return block.content.description ? `[${block.type}: ${block.content.description}]` : '';
            default:
                return '';
        }
    }).filter(text => text.trim() !== '').join('\n');

    if (!contentText.trim()) return '';
    return `## Note: ${note.title || 'Untitled Note'}\n\n${contentText}`;
};

const formatRichText = (text: string): { __html: string } => {
    let html = text
      .replace(/^\s*\*\s*(\n|<br \/>)/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    html = html.replace(/^- (.*)/gm, '<li>$1</li>');
    html = html.replace(/(<\/li>\s*<li>)/g, '</li><li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    
    html = html.replace(/\n/g, '<br />');
    html = html.replace(/<br \/>(\s)*<ul>/g, '<ul>');
    html = html.replace(/<\/ul><br \/>/g, '</ul>');
    html = html.replace(/<\/li><br \/>/g, '</li>');

    return { __html: html };
}

const LoadingSkeleton = () => (
    <div className="relative p-6 rounded-lg bg-gray-900 overflow-hidden space-y-4">
        <div className="space-y-4">
            <div className="h-6 bg-gray-800 rounded w-3/4"></div>
            <div className="h-4 bg-gray-800 rounded w-full"></div>
            <div className="h-4 bg-gray-800 rounded w-full"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
            <div className="h-4 bg-gray-800 rounded w-5/6 mt-4"></div>
            <div className="h-4 bg-gray-800 rounded w-full"></div>
        </div>
        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-gray-700/30 to-transparent -translate-x-full animate-shimmer" />
    </div>
);

const EmptyState: React.FC<{onNewNote: () => void}> = ({ onNewNote }) => (
    <div className="text-center bg-gray-900 p-8 rounded-lg">
        <CalendarDaysIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h2 className="text-xl font-bold text-white mb-2">No Notes This Period</h2>
        <p className="text-gray-400 mb-6">Capture some thoughts to see your AI-powered review here.</p>
        <button
            onClick={onNewNote}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
            Create a New Note
        </button>
    </div>
);

const ReviewView: React.FC<{ notes: Note[]; onNewNote: () => void; }> = ({ notes, onNewNote }) => {
    const [period, setPeriod] = useState<Period>('weekly');
    const [summary, setSummary] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isEmpty, setIsEmpty] = useState(false);

    const filteredNotes = useMemo(() => {
        const now = new Date();
        let daysToSubtract = 7;
        switch (period) {
            case 'monthly': daysToSubtract = 30; break;
            case 'quarterly': daysToSubtract = 90; break;
            case 'semi-annually': daysToSubtract = 180; break;
            case 'yearly': daysToSubtract = 365; break;
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(new Date().getDate() - daysToSubtract);
        return notes.filter(note => new Date(note.createdAt) >= cutoffDate);
    }, [notes, period]);

    useEffect(() => {
        setIsLoading(true);
        setIsEmpty(false);
        setSummary('');

        // Debounce the API call to prevent rate-limiting errors when switching tabs quickly.
        const handler = setTimeout(async () => {
            const notesContext = filteredNotes.map(getNoteContentAsString).join('\n\n---\n\n');
            const result = await generateReviewSummary(notesContext);
            
            if (result === "You didn't have any notes in this period. Capture some thoughts and come back later to reflect!") {
                setIsEmpty(true);
            } else {
                setSummary(result);
            }
            setIsLoading(false);
        }, 500); // 500ms delay

        return () => {
            clearTimeout(handler);
        };
    }, [filteredNotes]);

    return (
        <div className="flex-1 bg-[#1C1C1C] text-white p-6 md:p-12 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <header className="mb-10">
                    <h1 className="text-3xl font-bold text-white mb-2">Review</h1>
                    <p className="text-lg text-gray-400">AI-powered highlights from your notes to help you reflect.</p>
                </header>
                
                <div className="flex items-center gap-2 mb-8 bg-gray-900 p-1.5 rounded-xl">
                    <TabButton label="Week" period="weekly" activePeriod={period} setPeriod={setPeriod} />
                    <TabButton label="Month" period="monthly" activePeriod={period} setPeriod={setPeriod} />
                    <TabButton label="3-Month" period="quarterly" activePeriod={period} setPeriod={setPeriod} />
                    <TabButton label="6-Month" period="semi-annually" activePeriod={period} setPeriod={setPeriod} />
                    <TabButton label="1-Year" period="yearly" activePeriod={period} setPeriod={setPeriod} />
                </div>

                <div className="min-h-[400px]">
                    {isLoading ? (
                        <LoadingSkeleton />
                    ) : isEmpty ? (
                        <EmptyState onNewNote={onNewNote} />
                    ) : (
                        <div 
                            className="bg-gray-900 p-6 sm:p-8 rounded-lg prose prose-xl prose-invert prose-p:text-gray-300 prose-strong:text-white prose-strong:font-bold prose-strong:text-2xl prose-strong:block prose-strong:mt-8 prose-strong:mb-3 prose-em:text-gray-300 prose-li:marker:text-blue-400"
                            dangerouslySetInnerHTML={formatRichText(summary)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReviewView;