import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import type { EventInfo, Meal } from '../../../hooks/useFirebaseData';
import {
  X, User, KeyRound, RefreshCw, Home, CheckCircle2,
  HelpCircle, XCircle, Coins, Loader2, Tag, UserPlus
} from 'lucide-react';
import { usePopup } from '../../../components/ui/PopupProvider';
import LabelInput from '../../../components/ui/LabelInput';
import { syncMemberToHouseholdMeals } from '../../../utils/mealChefSync';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventInfo: EventInfo | null;
  existingHouseholds: { id: string; name: string }[];
  availableLabels?: string[];
  meals?: Meal[];
}

const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

export default function SingleGuestModal({
  isOpen,
  onClose,
  eventId,
  eventInfo,
  existingHouseholds = [],
  availableLabels = [],
  meals = []
}: Props) {
  const { showAlert, showSuccess } = usePopup();

  const [name, setName] = useState('');
  const [pin, setPin] = useState(generatePin());
  const [householdChoice, setHouseholdChoice] = useState<'new' | 'existing'>('new');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<'coming' | 'maybe' | 'not_coming'>('maybe');
  const [paid, setPaid] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const entryFee = eventInfo?.isFree ? 0 : (eventInfo?.entryFee || 0);

  const handleResetAndClose = () => {
    setName('');
    setPin(generatePin());
    setHouseholdChoice('new');
    setSelectedHouseholdId('');
    setRsvpStatus('maybe');
    setPaid(false);
    setLabels([]);
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert('יש להזין שם אורח');
      return;
    }
    if (pin.length !== 4) {
      showAlert('קוד ה-PIN חייב להכיל בדיוק 4 ספרות');
      return;
    }
    if (householdChoice === 'existing' && !selectedHouseholdId) {
      showAlert('יש לבחור משק בית קיים מהרשימה');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalHouseholdId = '';
      let finalHouseholdName = '';

      if (householdChoice === 'existing' && selectedHouseholdId) {
        const found = existingHouseholds.find(h => h.id === selectedHouseholdId);
        finalHouseholdId = selectedHouseholdId;
        finalHouseholdName = found ? found.name : name.trim();
      } else {
        finalHouseholdId = `hh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        finalHouseholdName = name.trim();
      }

      const newGuestRef = await addDoc(collection(db, 'events', eventId, 'guests'), {
        name: name.trim(),
        pin,
        householdId: finalHouseholdId,
        householdName: finalHouseholdName,
        rsvpStatus,
        paid,
        shouldPayFee: true,
        status: 'not_logged_in',
        labels: labels.length > 0 ? labels : []
      });

      if (householdChoice === 'existing' && selectedHouseholdId && meals && meals.length > 0) {
        await syncMemberToHouseholdMeals(eventId, newGuestRef.id, selectedHouseholdId, meals);
      }

      showSuccess(`האורח "${name.trim()}" נוסף בהצלחה`);
      handleResetAndClose();
    } catch (err: any) {
      console.error('Error adding single guest:', err);
      showAlert('שגיאה בהוספת האורח');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990] flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer" 
      dir="rtl"
      onClick={handleResetAndClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden relative border border-gray-100 animate-in zoom-in-95 duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/60 to-indigo-50/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <UserPlus size={24} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-gray-900">הוספת אורח בודד</h3>
              <p className="text-xs text-gray-500">הוספת אורח חדש, קביעת קוד PIN, שיוך למשק בית ותיוגים</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="text-gray-400 hover:text-gray-700 bg-white p-2 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 admin-scroll flex-1">

          {/* Guest Name */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <User size={15} className="text-blue-600" />
              שם האורח
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="לדוגמה: דניאל לוי, יובל כהן..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-right shadow-xs"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>

          {/* PIN */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <KeyRound size={15} className="text-blue-600" />
              קוד PIN (4 ספרות)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                className="w-32 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 font-mono text-center font-bold text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-xs"
                placeholder="1234"
              />
              <button
                type="button"
                onClick={() => setPin(generatePin())}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold bg-blue-50 px-3 py-2 rounded-xl hover:bg-blue-100 transition-colors shadow-2xs"
              >
                <RefreshCw size={13} />
                PIN אקראי
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">קוד זה ישמש את האורח להתחברות ולהצבעה באירוע (בני אותו משק בית יכולים להשתמש גם בקודים זה של זה).</p>
          </div>

          {/* Household Assignment */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Home size={15} className="text-blue-600" />
              שיוך למשק בית
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setHouseholdChoice('new')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                  householdChoice === 'new'
                    ? 'bg-blue-50/80 border-blue-300 text-blue-800 shadow-2xs'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                משק בית עצמאי
              </button>
              <button
                type="button"
                onClick={() => setHouseholdChoice('existing')}
                disabled={existingHouseholds.length === 0}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center disabled:opacity-40 ${
                  householdChoice === 'existing'
                    ? 'bg-blue-50/80 border-blue-300 text-blue-800 shadow-2xs'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                שיוך למשק בית קיים
              </button>
            </div>
            {householdChoice === 'existing' && (
              <select
                value={selectedHouseholdId}
                onChange={e => setSelectedHouseholdId(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              >
                <option value="">בחר משק בית קיים מהרשימה...</option>
                {existingHouseholds.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* RSVP Status */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">סטטוס הגעה</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRsvpStatus('coming')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  rsvpStatus === 'coming'
                    ? 'bg-green-600 text-white border-green-600 shadow-xs'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <CheckCircle2 size={14} />
                <span>מגיע/ה</span>
              </button>
              <button
                type="button"
                onClick={() => setRsvpStatus('maybe')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  rsvpStatus === 'maybe'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <HelpCircle size={14} />
                <span>אולי</span>
              </button>
              <button
                type="button"
                onClick={() => setRsvpStatus('not_coming')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  rsvpStatus === 'not_coming'
                    ? 'bg-red-600 text-white border-red-600 shadow-xs'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <XCircle size={14} />
                <span>לא מגיע/ה</span>
              </button>
            </div>
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">סטטוס תשלום</label>
            <button
              type="button"
              onClick={() => setPaid(!paid)}
              className={`w-full py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                paid
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Coins size={16} className={paid ? 'text-emerald-600' : 'text-gray-400'} />
                <span>{paid ? 'סומן כשולם / הוסדר תשלום' : 'טרם שילם'}</span>
              </div>
              {entryFee > 0 && (
                <span className="text-[11px] font-mono font-semibold">
                  (דמי כניסה: ₪{entryFee})
                </span>
              )}
            </button>
          </div>

          {/* Labels (Tags) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Tag size={15} className="text-indigo-600" />
              תגיות וסיווגים (Labels)
            </label>
            <LabelInput
              labels={labels}
              onChange={setLabels}
              availableLabels={availableLabels}
              placeholder="לדוגמה: עבודה, תיכון, חברים..."
              helperText="התגיות מסייעות בסינון ובחיפוש מהיר של אורחים."
            />
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetAndClose}
            className="px-5 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-200/60 rounded-xl transition-colors"
          >
            ביטול
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || !name.trim() || pin.length !== 4 || (householdChoice === 'existing' && !selectedHouseholdId)}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md shadow-blue-500/10 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>שומר אורח...</span>
              </>
            ) : (
              <span>הוסף אורח</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
