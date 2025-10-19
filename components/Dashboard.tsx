import React, { useState, useEffect, useMemo } from 'react';
import { Note, ContentBlockType, ChecklistItem } from '../types';
import { generateReviewSummary } from '../services/geminiService';
import { SparklesIcon } from './icons';

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
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex-1 ${
            activePeriod === period
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
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
      // Remove standalone asterisk lines that the model sometimes generates
      .replace(/^\s*\*\s*(\n|<br \/>)/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Handle bullet points by converting lines starting with '- ' to <li> and wrapping consecutive <li>s in <ul>
    html = html.replace(/^- (.*)/gm, '<li>$1</li>');
    html = html.replace(/(<\/li>\s*<li>)/g, '</li><li>'); // clean up whitespace
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    
    html = html.replace(/\n/g, '<br />');
    html = html.replace(/<br \/>(\s)*<ul>/g, '<ul>');
    html = html.replace(/<\/ul><br \/>/g, '</ul>');
    html = html.replace(/<\/li><br \/>/g, '</li>');

    return { __html: html };
}

const Dashboard: React.FC<{ notes: Note[] }> = ({ notes }) => {
    const [period, setPeriod] = useState<Period>('weekly');
    const [summary, setSummary] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

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
        setSummary('');

        const handler = setTimeout(async () => {
            const notesContext = filteredNotes.map(getNoteContentAsString).join('\n\n---\n\n');
            // FIX: The 'generateReviewSummary' function requires a 'people' argument, which was missing.
            // This fix gathers the people from the filtered notes and passes them to the function for a more contextual summary.
            // FIX: Explicitly set the type of the Set to <string> to fix a TypeScript inference issue where `peopleInPeriod` was incorrectly inferred as `unknown[]`.
            const peopleInPeriod = Array.from(new Set<string>(filteredNotes.flatMap(n => n.people || [])));
            const result = await generateReviewSummary(notesContext, period, peopleInPeriod);
            setSummary(result);
            setIsLoading(false);
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    // FIX: Added 'period' to the dependency array.
    // This ensures that the effect re-runs to fetch a new summary whenever the user selects a different time period (e.g., from 'weekly' to 'monthly').
    }, [filteredNotes, period]);

    return (
        <div className="flex-1 bg-[#1C1C1C] text-white p-6 md:p-12 overflow-y-auto">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-200 mb-4">Review</h1>
                <p className="text-gray-400 mb-8">AI-powered highlights from your notes to help you reflect.</p>

                <div className="flex items-center gap-2 mb-8 bg-gray-900 p-1 rounded-lg">
                    <TabButton label="Week" period="weekly" activePeriod={period} setPeriod={setPeriod} />
                    <TabButton label="Month" period="monthly" activePeriod={period} setPeriod={setPeriod} />
                    <TabButton label="3-Month" period="quarterly" activePeriod={period} setPeriod={setPeriod} />
                    <TabButton label="6-Month" period="semi-annually" activePeriod={period} setPeriod={setPeriod} />
                    <TabButton label="1-Year" period="yearly" activePeriod={period} setPeriod={setPeriod} />
                </div>

                <div className="bg-gray-800 p-6 rounded-lg min-h-[300px]">
                    {isLoading ? (
                        <div className="space-y-4 animate-pulse">
                            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-700 rounded w-full"></div>
                            <div className="h-4 bg-gray-700 rounded w-full"></div>
                            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                        </div>
                    ) : (
                        <div 
                            className="prose prose-xl prose-invert prose-p:text-gray-200 prose-strong:text-white prose-strong:font-bold prose-strong:text-2xl prose-strong:block prose-strong:mt-8 prose-strong:mb-3 prose-em:text-gray-200 prose-li:marker:text-blue-400"
                            dangerouslySetInnerHTML={formatRichText(summary)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
