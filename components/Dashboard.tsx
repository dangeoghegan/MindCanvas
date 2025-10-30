import React, { useState, useEffect, useMemo } from 'react';
import { Note, ContentBlockType, ChecklistItem } from '../types';
import { generateReviewSummary } from '../services/geminiService';

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
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            activePeriod === period
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
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
            const peopleInPeriod = Array.from(new Set<string>(filteredNotes.flatMap(n => n.people || [])));
            const result = await generateReviewSummary(notesContext, period, peopleInPeriod);
            setSummary(result);
            setIsLoading(false);
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [filteredNotes, period]);

    return (
        <div className="flex-1 bg-background text-foreground p-6 md:p-12 overflow-y-auto">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold text-foreground mb-4">Review</h1>
                <p className="text-muted-foreground mb-8">AI-powered highlights from your notes to help you reflect.</p>

                <div className="flex items-center gap-2 mb-8 bg-secondary p-1 rounded-xl">
                    <TabButton label="Week" period="weekly" activePeriod={period} setPeriod={setPeriod} />
                    <TabButton label="Month" period="monthly" activePeriod={period} setPeriod={setPeriod} />
                    <TabButton label="3-Month" period="quarterly" activePeriod={period} setPeriod={setPeriod} />
                    <TabButton label="6-Month" period="semi-annually" activePeriod={period} setPeriod={setPeriod} />
                    <TabButton label="1-Year" period="yearly" activePeriod={period} setPeriod={setPeriod} />
                </div>

                <div className="bg-card p-6 rounded-lg min-h-[300px]">
                    {isLoading ? (
                        <div className="space-y-4 animate-pulse">
                            <div className="h-4 bg-secondary rounded w-3/4"></div>
                            <div className="h-4 bg-secondary rounded w-full"></div>
                            <div className="h-4 bg-secondary rounded w-full"></div>
                            <div className="h-4 bg-secondary rounded w-1/2"></div>
                        </div>
                    ) : (
                        <div 
                            className="prose prose-xl prose-invert prose-p:text-muted-foreground prose-strong:text-foreground prose-strong:font-bold prose-strong:text-2xl prose-strong:block prose-strong:mt-8 prose-strong:mb-3 prose-em:text-muted-foreground prose-li:marker:text-primary"
                            dangerouslySetInnerHTML={formatRichText(summary)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;