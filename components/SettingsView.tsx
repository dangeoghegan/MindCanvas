import React, { useState } from 'react';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from './icons';
import { AutoDeleteRule, RetentionPeriod } from '../types';

interface SettingsViewProps {
  masterPeopleList: string[];
  onAddPerson: (name: string) => void;
  onRemovePerson: (name: string) => void;
  onClose: () => void;
  allTags: string[];
  autoDeleteRules: AutoDeleteRule[];
  onAddAutoDeleteRule: (rule: AutoDeleteRule) => void;
  onRemoveAutoDeleteRule: (tag: string) => void;
}

const RETENTION_PERIODS: { value: RetentionPeriod; label: string }[] = [
    { value: '1-day', label: '1 Day' },
    { value: '3-days', label: '3 Days' },
    { value: '1-week', label: '1 Week' },
    { value: '1-month', label: '1 Month' },
    { value: '6-months', label: '6 Months' },
    { value: '1-year', label: '1 Year' },
];

const SettingsView: React.FC<SettingsViewProps> = ({ masterPeopleList, onAddPerson, onRemovePerson, onClose, allTags, autoDeleteRules, onAddAutoDeleteRule, onRemoveAutoDeleteRule }) => {
  const [newPersonName, setNewPersonName] = useState('');
  const [newRuleTag, setNewRuleTag] = useState('');
  const [newRulePeriod, setNewRulePeriod] = useState<RetentionPeriod>('1-week');

  const handleAddPerson = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newPersonName.trim();
    if (trimmedName) {
      onAddPerson(trimmedName);
      setNewPersonName('');
    }
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRuleTag && newRulePeriod) {
        onAddAutoDeleteRule({ tag: newRuleTag, period: newRulePeriod });
        setNewRuleTag('');
        setNewRulePeriod('1-week');
    }
  };

  const availableTagsForRule = allTags.filter(tag => !autoDeleteRules.some(rule => rule.tag === tag));

  return (
    <div className="flex-1 bg-[#1C1C1C] text-white flex flex-col view-container-animation">
      <header className="sticky top-0 z-10 bg-[#1C1C1C] py-3 px-6 border-b border-gray-800 flex items-center">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800">
          <ArrowLeftIcon />
        </button>
        <h1 className="text-xl font-bold ml-4">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-6 md:p-12">
        <div className="max-w-3xl mx-auto">
          <div>
            <h2 className="text-2xl font-bold text-gray-200 mb-2">Manage People</h2>
            <p className="text-gray-400 mb-6">Add or remove people to use them as tags in your notes.</p>

            <form onSubmit={handleAddPerson} className="flex items-center gap-3 mb-8">
              <input
                type="text"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="Enter a new name"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-600"
                disabled={!newPersonName.trim()}
              >
                <PlusIcon className="w-5 h-5" />
                <span>Add</span>
              </button>
            </form>

            <div className="space-y-3">
              {masterPeopleList.length > 0 ? (
                masterPeopleList.map(person => (
                  <div key={person} className="bg-gray-900 p-3 rounded-lg flex justify-between items-center">
                    <span className="text-gray-200">{person}</span>
                    <button
                      onClick={() => onRemovePerson(person)}
                      className="p-1 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-full"
                      title={`Remove ${person}`}
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No people added yet.</p>
              )}
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-gray-800">
            <h2 className="text-2xl font-bold text-gray-200 mb-2">Automatic Note Deletion</h2>
            <p className="text-gray-400 mb-6">Set rules to automatically delete notes with specific tags after a certain period.</p>
            
            <form onSubmit={handleAddRule} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 items-center bg-gray-900 p-4 rounded-lg">
                <select 
                    value={newRuleTag}
                    onChange={(e) => setNewRuleTag(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="" disabled>Select a tag...</option>
                    {availableTagsForRule.map(tag => (
                        <option key={tag} value={tag}>#{tag}</option>
                    ))}
                </select>
                <select
                    value={newRulePeriod}
                    onChange={(e) => setNewRulePeriod(e.target.value as RetentionPeriod)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {RETENTION_PERIODS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>
                 <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                    disabled={!newRuleTag}
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>Add Rule</span>
                </button>
            </form>

            <div className="space-y-3">
              {autoDeleteRules.length > 0 ? (
                autoDeleteRules.map(rule => (
                  <div key={rule.tag} className="bg-gray-900 p-3 rounded-lg flex justify-between items-center">
                    <div>
                        <span className="font-mono bg-gray-800 text-gray-300 text-xs font-medium px-2 py-1 rounded">#{rule.tag}</span>
                        <span className="text-gray-400 mx-2">→</span>
                        <span className="text-gray-200">Delete after {RETENTION_PERIODS.find(p => p.value === rule.period)?.label}</span>
                    </div>
                    <button
                      onClick={() => onRemoveAutoDeleteRule(rule.tag)}
                      className="p-1 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-full"
                      title={`Remove rule for #${rule.tag}`}
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No auto-delete rules set.</p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;