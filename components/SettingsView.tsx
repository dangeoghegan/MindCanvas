import React, { useState, useRef, useEffect } from 'react';
// FIX: Imported 'SparklesIcon' to resolve 'Cannot find name' errors.
import { ArrowLeftIcon, PlusIcon, TrashIcon, PlayIcon, SpeakerWaveIcon, SpinnerIcon, XMarkIcon, UserIcon, WifiIcon, LockClosedIcon, CreditCardIcon, BriefcaseIcon, KeyIcon, ClipboardIcon, SparklesIcon } from './icons';
import { AutoDeleteRule, RetentionPeriod, VoiceName, VoiceOption, Theme, UserProfile, DynamicCategory, CategoryIcon } from '../types';
import { generateVoicePreview } from '../services/geminiService';
import { faceRecognitionService, FaceDescriptor } from '../services/faceRecognitionService';


// --- Start of Audio Helper Functions ---
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
// --- End Audio Helper Functions ---


interface SettingsViewProps {
  masterPeopleList: string[];
  onAddPerson: (name: string) => void;
  onRemovePerson: (name: string) => void;
  onClose: () => void;
  allTags: string[];
  autoDeleteRules: AutoDeleteRule[];
  onAddAutoDeleteRule: (rule: AutoDeleteRule) => void;
  onRemoveAutoDeleteRule: (tag: string) => void;
  selectedVoice: VoiceName;
  onSetSelectedVoice: (voice: VoiceName) => void;
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
  userProfile: UserProfile;
  onSetUserProfile: (profile: UserProfile) => void;
  dynamicCategories: DynamicCategory[];
  onGenerateCategories: () => void;
  isGeneratingCategories: boolean;
}

const RETENTION_PERIODS: { value: RetentionPeriod; label: string }[] = [
    { value: '1-day', label: '1 Day' },
    { value: '3-days', label: '3 Days' },
    { value: '1-week', label: '1 Week' },
    { value: '1-month', label: '1 Month' },
    { value: '6-months', label: '6 Months' },
    { value: '1-year', label: '1 Year' },
];

const VOICE_OPTIONS: VoiceOption[] = [
    { id: 'Kore', name: 'Ava', description: 'Female, warm and friendly voice.' },
    { id: 'Zephyr', name: 'Zoe', description: 'Female, professional and clear voice.' },
    { id: 'Puck', name: 'Leo', description: 'Male, energetic and youthful voice.' },
    { id: 'Charon', name: 'James', description: 'Male, deep and authoritative voice.' },
];

const SettingsSection: React.FC<{ title: string; children: React.ReactNode, actions?: React.ReactNode }> = ({ title, children, actions }) => (
    <div className="mb-8">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        <div className="space-y-4">{children}</div>
    </div>
);

const getCategoryIcon = (iconName: CategoryIcon) => {
    switch (iconName) {
        case 'wifi': return <WifiIcon className="w-6 h-6" />;
        case 'lock': return <LockClosedIcon className="w-6 h-6" />;
        case 'credit-card': return <CreditCardIcon className="w-6 h-6" />;
        case 'briefcase': return <BriefcaseIcon className="w-6 h-6" />;
        case 'key': return <KeyIcon className="w-6 h-6" />;
        default: return <SparklesIcon className="w-6 h-6" />;
    }
};

const SettingsView: React.FC<SettingsViewProps> = ({
    masterPeopleList, onAddPerson, onRemovePerson, onClose, allTags, autoDeleteRules, onAddAutoDeleteRule, onRemoveAutoDeleteRule, selectedVoice, onSetSelectedVoice, theme, onSetTheme, userProfile, onSetUserProfile, dynamicCategories, onGenerateCategories, isGeneratingCategories
}) => {
    const [newPersonName, setNewPersonName] = useState('');
    const [newRuleTag, setNewRuleTag] = useState('');
    const [newRulePeriod, setNewRulePeriod] = useState<RetentionPeriod>('1-month');
    const [previewingVoice, setPreviewingVoice] = useState<VoiceName | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    
    // State for new face recognition
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [knownFaces, setKnownFaces] = useState<FaceDescriptor[]>([]);
    const [faceNameToAdd, setFaceNameToAdd] = useState('');
    const [isProcessingFace, setIsProcessingFace] = useState(false);
    const [faceError, setFaceError] = useState<string | null>(null);
    const faceFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        faceRecognitionService.loadModels().then(() => setModelsLoaded(true)).catch(console.error);
        setKnownFaces(faceRecognitionService.loadKnownFaces());
    }, []);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        // Maybe show a toast notification here in a real app
    };

    const handleAddPerson = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPersonName.trim()) {
            onAddPerson(newPersonName.trim());
            setNewPersonName('');
        }
    };

    const handleAddRule = () => {
        if (newRuleTag) {
            onAddAutoDeleteRule({ tag: newRuleTag, period: newRulePeriod });
            setNewRuleTag('');
        }
    };
    
    const handlePreviewVoice = async (voice: VoiceName) => {
        if (previewingVoice) return;
        setPreviewingVoice(voice);
        try {
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const base64Audio = await generateVoicePreview(voice);
            const audioContext = audioContextRef.current;
            if (!audioContext) return;

            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                audioContext,
                24000,
                1
            );
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();
        } catch (error) {
            console.error('Failed to preview voice:', error);
            alert('Could not play voice preview.');
        } finally {
            setPreviewingVoice(null);
        }
    };

    const handleAddFaceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !faceNameToAdd.trim()) {
            setFaceError('Please enter a name and select an image.');
            return;
        }

        setIsProcessingFace(true);
        setFaceError(null);

        try {
            await faceRecognitionService.addPersonFromFile(file, faceNameToAdd.trim());
            setKnownFaces(faceRecognitionService.loadKnownFaces());
            onAddPerson(faceNameToAdd.trim());
            setFaceNameToAdd('');
        } catch (err: any) {
            setFaceError(err.message || 'Error processing image. Please try again.');
            console.error(err);
        } finally {
            setIsProcessingFace(false);
            if (faceFileInputRef.current) faceFileInputRef.current.value = '';
        }
    };

    const handleDeletePersonFaces = (name: string) => {
        if (window.confirm(`Are you sure you want to delete all face recognition data for "${name}"? This person will still exist in your text-based list.`)) {
            faceRecognitionService.deletePerson(name);
            setKnownFaces(faceRecognitionService.loadKnownFaces());
        }
    };

    return (
        <div className="flex-1 bg-background text-foreground flex flex-col">
            <header className="sticky top-0 z-10 bg-background py-3 px-6 border-b border-border flex items-center">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary mr-4">
                    <ArrowLeftIcon />
                </button>
                <h1 className="text-xl font-bold">Settings</h1>
            </header>

            <main className="flex-1 overflow-y-auto p-6 md:px-12">
                <div className="max-w-3xl mx-auto">

                    <SettingsSection title="User Profile">
                         <div className="flex items-center gap-4 p-3 bg-secondary rounded-md">
                            <label htmlFor="user-name" className="font-semibold text-secondary-foreground">Name</label>
                            <input
                                id="user-name"
                                type="text"
                                value={userProfile.name}
                                onChange={(e) => onSetUserProfile({ ...userProfile, name: e.target.value })}
                                placeholder="Your Name"
                                className="flex-1 bg-background rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </SettingsSection>
                    
                    <SettingsSection 
                        title="Quick Access"
                        actions={
                             <button onClick={onGenerateCategories} disabled={isGeneratingCategories} className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-wait">
                                {isGeneratingCategories ? <SpinnerIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                <span>{isGeneratingCategories ? 'Refreshing...' : 'Refresh'}</span>
                            </button>
                        }
                    >
                        <p className="text-muted-foreground text-sm">Let AI find frequently used information in your notes for easy access. This is processed on-demand and stored on your device.</p>
                        {dynamicCategories.length > 0 ? (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {dynamicCategories.map((category, index) => (
                                    <div key={index} className="bg-secondary p-4 rounded-lg flex flex-col">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-primary">{getCategoryIcon(category.icon)}</span>
                                                <h4 className="font-bold text-foreground">{category.name}</h4>
                                            </div>
                                            <button onClick={() => handleCopy(category.content)} className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-accent-foreground" aria-label={`Copy ${category.name}`}>
                                                <ClipboardIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground bg-background p-3 rounded-md flex-1">{category.content}</pre>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                {isGeneratingCategories ? 'Searching your notes...' : 'No quick access items found. Tap "Refresh" to search your notes.'}
                            </p>
                        )}
                    </SettingsSection>

                    <SettingsSection title="Appearance">
                        <div className="flex items-center justify-between p-3 bg-secondary rounded-md">
                            <span className="font-semibold text-secondary-foreground">Theme</span>
                            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                                <button
                                    onClick={() => onSetTheme('light')}
                                    className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                                        theme === 'light' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    Light
                                </button>
                                <button
                                    onClick={() => onSetTheme('dark')}
                                    className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                                        theme === 'dark' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    }`}
                                >
                                    Dark
                                </button>
                            </div>
                        </div>
                    </SettingsSection>

                    <SettingsSection title="Face Recognition">
                        <p className="text-muted-foreground text-sm">Add photos of people to automatically tag them in your notes. All processing is done on your device for privacy.</p>
                        
                        {!modelsLoaded && <div className="text-center text-primary p-4 bg-secondary rounded-lg">Loading recognition models...</div>}
                        
                        <div className="bg-secondary p-4 rounded-lg">
                            <div className="flex flex-col md:flex-row items-center gap-4">
                                <input
                                    type="text"
                                    value={faceNameToAdd}
                                    onChange={(e) => setFaceNameToAdd(e.target.value)}
                                    placeholder="Enter person's name"
                                    disabled={isProcessingFace || !modelsLoaded}
                                    className="flex-1 w-full bg-background rounded-md p-2.5 focus:outline-none"
                                />
                                <label className={`w-full md:w-auto flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${!faceNameToAdd.trim() || isProcessingFace || !modelsLoaded ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}>
                                    {isProcessingFace ? <SpinnerIcon className="w-5 h-5"/> : <PlusIcon className="w-5 h-5"/>}
                                    <span>{isProcessingFace ? 'Processing...' : 'Add Photo'}</span>
                                    <input
                                        ref={faceFileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png"
                                        onChange={handleAddFaceImage}
                                        disabled={isProcessingFace || !faceNameToAdd.trim() || !modelsLoaded}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                             {faceError && <p className="text-destructive text-sm mt-2">{faceError}</p>}
                        </div>

                        <div className="space-y-2 mt-4">
                            {knownFaces.length > 0 ? knownFaces.map(person => (
                                <div key={person.name} className="flex items-center justify-between p-3 bg-secondary rounded-md">
                                    <div className="flex items-center gap-3">
                                        {person.thumbnail ? (
                                            <img src={person.thumbnail} alt={person.name} className="w-8 h-8 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                                <UserIcon className="w-5 h-5 text-muted-foreground"/>
                                            </div>
                                        )}
                                        <span className="font-semibold text-secondary-foreground">{person.name}</span>
                                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{person.descriptors.length} photo{person.descriptors.length > 1 ? 's' : ''}</span>
                                    </div>
                                    <button onClick={() => handleDeletePersonFaces(person.name)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete face data for ${person.name}`}>
                                        <TrashIcon className="w-4 h-4"/>
                                    </button>
                                </div>
                            )) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No people have been registered for face recognition yet.</p>
                            )}
                        </div>
                    </SettingsSection>

                    <SettingsSection title="Voice Settings">
                        <p className="text-muted-foreground text-sm">Choose the voice for conversational chat.</p>
                        <div className="space-y-3">
                            {VOICE_OPTIONS.map(voice => (
                                <div key={voice.id} className={`p-4 rounded-lg border-2 transition-colors ${selectedVoice === voice.id ? 'bg-primary/10 border-primary' : 'bg-secondary border-border hover:border-accent'}`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label htmlFor={`voice-${voice.id}`} className="font-semibold text-foreground">{voice.name}</label>
                                            <p className="text-sm text-muted-foreground">{voice.description}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={() => handlePreviewVoice(voice.id)} 
                                                className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent"
                                                disabled={previewingVoice !== null}
                                                aria-label={`Preview ${voice.name} voice`}
                                            >
                                                {previewingVoice === voice.id ? <SpinnerIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                                            </button>
                                            <input 
                                                id={`voice-${voice.id}`}
                                                type="radio"
                                                name="voice-option"
                                                value={voice.id}
                                                checked={selectedVoice === voice.id}
                                                onChange={() => onSetSelectedVoice(voice.id)}
                                                className="w-5 h-5 text-primary bg-background border-border focus:ring-primary ring-offset-secondary focus:ring-2"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SettingsSection>

                    <SettingsSection title="People Tags">
                        <p className="text-muted-foreground text-sm">Manage the list of people you can tag in notes manually. Deleting a person here will also remove their face recognition data.</p>
                        <form onSubmit={handleAddPerson} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newPersonName}
                                onChange={(e) => setNewPersonName(e.target.value)}
                                placeholder="Add a new person..."
                                className="flex-1 bg-secondary rounded-md p-2 focus:outline-none"
                            />
                            <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground p-2 rounded-md">
                                <PlusIcon />
                            </button>
                        </form>
                        <div className="flex flex-wrap gap-2">
                            {masterPeopleList.map(person => (
                                <span key={person} className="flex items-center gap-1.5 bg-success/20 text-success-foreground text-sm font-medium pl-3 pr-1.5 py-1 rounded-full">
                                    {person}
                                    <button onClick={() => onRemovePerson(person)} className="hover:bg-success/30 rounded-full p-0.5" aria-label={`Delete ${person}`}>
                                        <XMarkIcon className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </SettingsSection>
                    
                    <SettingsSection title="Auto-Delete Rules">
                        <p className="text-muted-foreground text-sm">Automatically delete notes with specific tags after a certain period. This action is irreversible.</p>
                        <div className="bg-secondary p-4 rounded-lg flex flex-col md:flex-row items-center gap-4">
                            <div className="w-full md:flex-1">
                                <label htmlFor="tag-select" className="block text-sm font-medium text-muted-foreground mb-1">Tag</label>
                                <select
                                    id="tag-select"
                                    value={newRuleTag}
                                    onChange={(e) => setNewRuleTag(e.target.value)}
                                    className="bg-background text-foreground text-sm rounded-lg focus:outline-none block w-full p-2.5"
                                >
                                    <option value="">Select a tag</option>
                                    {allTags.filter(t => !autoDeleteRules.some(r => r.tag === t)).map(tag => (
                                        <option key={tag} value={tag}>{tag}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-full md:flex-1">
                                <label htmlFor="period-select" className="block text-sm font-medium text-muted-foreground mb-1">Retention Period</label>
                                <select
                                    id="period-select"
                                    value={newRulePeriod}
                                    onChange={(e) => setNewRulePeriod(e.target.value as RetentionPeriod)}
                                    className="bg-background text-foreground text-sm rounded-lg focus:outline-none block w-full p-2.5"
                                >
                                    {RETENTION_PERIODS.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>
                            <button onClick={handleAddRule} className="bg-primary hover:bg-primary/90 text-primary-foreground p-2 rounded-md self-end h-[42px]">
                                <PlusIcon />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {autoDeleteRules.map(rule => (
                                <div key={rule.tag} className="flex items-center justify-between p-3 bg-secondary rounded-md">
                                    <div>
                                        <span className="font-semibold text-secondary-foreground">#{rule.tag}</span>
                                        <span className="text-muted-foreground text-sm ml-2">-&gt; Delete after {RETENTION_PERIODS.find(p => p.value === rule.period)?.label}</span>
                                    </div>
                                    <button onClick={() => onRemoveAutoDeleteRule(rule.tag)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete rule for tag ${rule.tag}`}>
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </SettingsSection>

                </div>
            </main>
        </div>
    );
};

export default SettingsView;