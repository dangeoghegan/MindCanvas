import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeftIcon, PlusIcon, TrashIcon, PlayIcon, SpeakerWaveIcon, SpinnerIcon, XMarkIcon, UserIcon } from './icons';
import { AutoDeleteRule, RetentionPeriod, VoiceName, VoiceOption } from '../types';
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
    { id: 'Fenrir', name: 'Marcus', description: 'Male, calm and steady voice.' },
];

const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-200 mb-4 pb-2 border-b border-gray-800">{title}</h2>
        <div className="space-y-4">{children}</div>
    </div>
);

const SettingsView: React.FC<SettingsViewProps> = ({
    masterPeopleList, onAddPerson, onRemovePerson, onClose, allTags, autoDeleteRules, onAddAutoDeleteRule, onRemoveAutoDeleteRule, selectedVoice, onSetSelectedVoice
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
        <div className="flex-1 bg-[#1C1C1C] text-white flex flex-col">
            <header className="sticky top-0 z-10 bg-[#1C1C1C] py-3 px-6 border-b border-gray-800 flex items-center">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800 mr-4">
                    <ArrowLeftIcon />
                </button>
                <h1 className="text-xl font-bold">Settings</h1>
            </header>

            <main className="flex-1 overflow-y-auto p-6 md:px-12">
                <div className="max-w-3xl mx-auto">
                    <SettingsSection title="Face Recognition">
                        <p className="text-gray-400 text-sm">Add photos of people to automatically tag them in your notes. All processing is done on your device for privacy.</p>
                        
                        {!modelsLoaded && <div className="text-center text-blue-400 p-4 bg-gray-800 rounded-lg">Loading recognition models...</div>}
                        
                        <div className="bg-gray-800/50 p-4 rounded-lg">
                            <div className="flex flex-col md:flex-row items-center gap-4">
                                <input
                                    type="text"
                                    value={faceNameToAdd}
                                    onChange={(e) => setFaceNameToAdd(e.target.value)}
                                    placeholder="Enter person's name"
                                    disabled={isProcessingFace || !modelsLoaded}
                                    className="flex-1 w-full bg-gray-900 border border-gray-700 rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <label className={`w-full md:w-auto flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${!faceNameToAdd.trim() || isProcessingFace || !modelsLoaded ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
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
                             {faceError && <p className="text-red-400 text-sm mt-2">{faceError}</p>}
                        </div>

                        <div className="space-y-2 mt-4">
                            {knownFaces.length > 0 ? knownFaces.map(person => (
                                <div key={person.name} className="flex items-center justify-between p-3 bg-gray-800 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <UserIcon className="w-5 h-5 text-gray-400"/>
                                        <span className="font-semibold text-gray-200">{person.name}</span>
                                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{person.descriptors.length} photo{person.descriptors.length > 1 ? 's' : ''}</span>
                                    </div>
                                    <button onClick={() => handleDeletePersonFaces(person.name)} className="text-gray-500 hover:text-red-400">
                                        <TrashIcon className="w-4 h-4"/>
                                    </button>
                                </div>
                            )) : (
                                <p className="text-sm text-gray-500 text-center py-4">No people have been registered for face recognition yet.</p>
                            )}
                        </div>
                    </SettingsSection>

                    <SettingsSection title="Voice Settings">
                        <p className="text-gray-400 text-sm">Choose the voice for conversational chat.</p>
                        <div className="space-y-3">
                            {VOICE_OPTIONS.map(voice => (
                                <div key={voice.id} className={`p-4 rounded-lg border-2 transition-colors ${selectedVoice === voice.id ? 'bg-blue-900/50 border-blue-500' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'}`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label htmlFor={`voice-${voice.id}`} className="font-semibold text-white">{voice.name}</label>
                                            <p className="text-sm text-gray-400">{voice.description}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={() => handlePreviewVoice(voice.id)} 
                                                className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700"
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
                                                className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-600 ring-offset-gray-800 focus:ring-2"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SettingsSection>

                    <SettingsSection title="People Tags">
                        <p className="text-gray-400 text-sm">Manage the list of people you can tag in notes manually.</p>
                        <form onSubmit={handleAddPerson} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newPersonName}
                                onChange={(e) => setNewPersonName(e.target.value)}
                                placeholder="Add a new person..."
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-md">
                                <PlusIcon />
                            </button>
                        </form>
                        <div className="flex flex-wrap gap-2">
                            {masterPeopleList.map(person => (
                                <span key={person} className="flex items-center gap-1.5 bg-green-800/50 text-green-300 text-sm font-medium pl-3 pr-1.5 py-1 rounded-full">
                                    {person}
                                    <button onClick={() => onRemovePerson(person)} className="hover:bg-green-700/50 rounded-full p-0.5">
                                        <XMarkIcon className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </SettingsSection>
                    
                    <SettingsSection title="Auto-Delete Rules">
                        <p className="text-gray-400 text-sm">Automatically delete notes with specific tags after a certain period. This action is irreversible.</p>
                        <div className="bg-gray-800/50 p-4 rounded-lg flex flex-col md:flex-row items-center gap-4">
                            <div className="w-full md:flex-1">
                                <label htmlFor="tag-select" className="block text-sm font-medium text-gray-300 mb-1">Tag</label>
                                <select
                                    id="tag-select"
                                    value={newRuleTag}
                                    onChange={(e) => setNewRuleTag(e.target.value)}
                                    className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                >
                                    <option value="">Select a tag</option>
                                    {allTags.filter(t => !autoDeleteRules.some(r => r.tag === t)).map(tag => (
                                        <option key={tag} value={tag}>{tag}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-full md:flex-1">
                                <label htmlFor="period-select" className="block text-sm font-medium text-gray-300 mb-1">Retention Period</label>
                                <select
                                    id="period-select"
                                    value={newRulePeriod}
                                    onChange={(e) => setNewRulePeriod(e.target.value as RetentionPeriod)}
                                    className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                >
                                    {RETENTION_PERIODS.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>
                            <button onClick={handleAddRule} className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-md self-end h-[42px]">
                                <PlusIcon />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {autoDeleteRules.map(rule => (
                                <div key={rule.tag} className="flex items-center justify-between p-3 bg-gray-800 rounded-md">
                                    <div>
                                        <span className="font-semibold text-gray-200">#{rule.tag}</span>
                                        <span className="text-gray-400 text-sm ml-2">-&gt; Delete after {RETENTION_PERIODS.find(p => p.value === rule.period)?.label}</span>
                                    </div>
                                    <button onClick={() => onRemoveAutoDeleteRule(rule.tag)} className="text-gray-500 hover:text-red-400">
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
