import { useState, useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import type { EventInfo } from '../../../hooks/useFirebaseData';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  eventInfo: EventInfo | null;
  eventId: string;
}

export default function EventSettings({ eventInfo, eventId }: Props) {
  const [formData, setFormData] = useState<EventInfo>(eventInfo || {
    title: '',
    subtitle: '',
    startButtonText: '',
    activeThemeId: 'default',
    themes: [],
    date: '',
    hostPin: '1234',
    timerStatus: 'idle',
    timerEndTime: null,
    revealState: 'none'
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (eventInfo) {
      setFormData(eventInfo);
    }
  }, [eventInfo]);

  const triggerSave = (dataToSave: EventInfo) => {
    setSaveStatus('saving');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'events', eventId), dataToSave);
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
        }, 3000);
      } catch (error: any) {
        console.error("Error saving event info: ", error);
        setSaveStatus('error');
      }
    }, 1500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newFormData = {
      ...formData,
      [name]: value
    };
    setFormData(newFormData);
    triggerSave(newFormData);
  };

  const handleFeeToggle = (isFree: boolean) => {
    const newFormData = {
      ...formData,
      isFree,
      entryFee: isFree ? 0 : (formData.entryFee || 50)
    };
    setFormData(newFormData);
    triggerSave(newFormData);
  };

  const handleEntryFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.slice(0, 4);
    const val = Math.min(9999, Math.max(0, parseInt(raw, 10) || 0));
    const newFormData = {
      ...formData,
      entryFee: val,
      isFree: val === 0
    };
    setFormData(newFormData);
    triggerSave(newFormData);
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 relative">
      <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-bold text-blue-600">הגדרות אירוע</h2>

        {/* Status Indicator */}
        <div className="flex items-center text-sm">
          {saveStatus === 'saving' && (
            <span className="flex items-center text-gray-500">
              <Loader2 size={16} className="animate-spin ml-2" />
              שומר...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center text-emerald-600 transition-opacity duration-300">
              <CheckCircle2 size={16} className="ml-1" />
              נשמר
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center text-red-500">
              <AlertCircle size={16} className="ml-1" />
              שגיאה בשמירה
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">כותרת האירוע</label>
          <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:border-gray-300" placeholder="לדוגמה: תחרות בישול שנתית" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">תת-כותרת</label>
          <textarea name="subtitle" value={formData.subtitle} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:border-gray-300" rows={2} placeholder="לדוגמה: מי יזכה בתואר השף הגדול?"></textarea>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">טקסט כפתור התחלה</label>
          <input type="text" name="startButtonText" value={formData.startButtonText} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:border-gray-300" placeholder="לדוגמה: היכנסו לאירוע" />
        </div>

        <div className="grid grid-cols-2 gap-6 pt-2">
          <div>
            <label className="block text-sm text-gray-700 mb-2 font-semibold">תאריך</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:border-gray-300" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-2 font-semibold">קוד PIN למארח (4 ספרות)</label>
            <input type="text" name="hostPin" value={formData.hostPin} onChange={handleChange} className="w-32 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:border-gray-300 text-center font-mono tracking-widest font-bold" maxLength={4} />
          </div>
        </div>

        {/* Entry Fee Settings */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleFeeToggle(!formData.isFree)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                !formData.isFree ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                  !formData.isFree ? '-translate-x-6' : '-translate-x-1'
                }`}
              />
            </button>

            <span
              onClick={() => handleFeeToggle(!formData.isFree)}
              className="text-sm font-bold text-gray-800 cursor-pointer select-none"
            >
              דמי כניסה / השתתפות
            </span>

            <span className="text-xs text-gray-500 font-medium">
              ({formData.isFree ? 'אירוע ללא תשלום' : 'אירוע בתשלום'})
            </span>

            {!formData.isFree && (
              <div className="flex items-center gap-2 mr-3">
                <div className="relative w-28">
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={formData.entryFee ?? 0}
                    onChange={handleEntryFeeChange}
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white rounded-xl pr-3 pl-8 py-1.5 text-gray-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs text-center"
                    placeholder="0"
                  />
                  <span className="absolute left-2.5 top-1.5 text-gray-400 font-bold text-xs pointer-events-none">₪</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
