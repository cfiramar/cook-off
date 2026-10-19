import { useState } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import type { EventInfo, Guest } from '../../../hooks/useFirebaseData';
import {
  X, Check, Plus, Trash2, Home, Users, RefreshCw, KeyRound,
  DollarSign, CheckCircle2, HelpCircle, XCircle, Loader2, Tag, UserCheck
} from 'lucide-react';
import { usePopup } from '../../../components/ui/PopupProvider';
import LabelInput from '../../../components/ui/LabelInput';

interface Props {
  eventId: string;
  eventInfo: EventInfo | null;
  existingGuests?: Guest[];
  availableLabels?: string[];
  onClose: () => void;
}

interface MemberDraft {
  name: string;
  pin: string;
  rsvpStatus: 'coming' | 'maybe' | 'not_coming';
  paid: boolean;
}

const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

export default function HouseholdModal({
  eventId,
  eventInfo,
  existingGuests = [],
  availableLabels = [],
  onClose
}: Props) {
  const { showAlert, showSuccess } = usePopup();

  const [householdName, setHouseholdName] = useState('');
  const [labels, setLabels] = useState<string[]>([]);

  // New draft members
  const [members, setMembers] = useState<MemberDraft[]>([
    { name: '', pin: generatePin(), rsvpStatus: 'maybe', paid: false },
    { name: '', pin: generatePin(), rsvpStatus: 'maybe', paid: false }
  ]);

  // Existing guests selected to be moved into this household
  const [selectedExistingGuestIds, setSelectedExistingGuestIds] = useState<string[]>([]);
  const [selectedGuestToMove, setSelectedGuestToMove] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available existing guests not yet chosen
  const candidateExistingGuests = existingGuests.filter(
    g => !selectedExistingGuestIds.includes(g.id)
  );

  const handleAddMember = () => {
    setMembers(prev => [
      ...prev,
      { name: '', pin: generatePin(), rsvpStatus: 'maybe', paid: false }
    ]);
  };

  const handleRemoveMember = (index: number) => {
    if (members.length + selectedExistingGuestIds.length <= 1) {
      showAlert('משק בית חייב להכיל לפחות חבר אחד');
      return;
    }
    setMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateMember = (index: number, updates: Partial<MemberDraft>) => {
    setMembers(prev => prev.map((m, i) => i === index ? { ...m, ...updates } : m));
  };

  const handleRandomizeAllPins = () => {
    setMembers(prev => prev.map(m => ({ ...m, pin: generatePin() })));
  };

  const handleAddExistingGuest = () => {
    if (!selectedGuestToMove) return;
    setSelectedExistingGuestIds(prev => [...prev, selectedGuestToMove]);
    setSelectedGuestToMove('');
  };

  const handleRemoveExistingGuest = (id: string) => {
    setSelectedExistingGuestIds(prev => prev.filter(gid => gid !== id));
  };

  const handleSaveHousehold = async () => {
    if (!householdName.trim()) {
      showAlert('יש להזין שם משק בית (לדוגמה: רועי ומיה, כהן)');
      return;
    }

    const validNewMembers = members.filter(m => m.name.trim().length > 0);
    const totalMemberCount = validNewMembers.length + selectedExistingGuestIds.length;

    if (totalMemberCount === 0) {
      showAlert('יש להזין שם לפחות עבור נפש אחת או לצרף אורח קיים');
      return;
    }

    for (const m of validNewMembers) {
      if (m.pin.length !== 4) {
        showAlert(`קוד ה-PIN של ${m.name} חייב להכיל בדיוק 4 ספרות`);
        return;
      }
    }

    setIsSubmitting(true);
    const householdId = `hh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      // 1. Add new members
      for (const m of validNewMembers) {
        await addDoc(collection(db, 'events', eventId, 'guests'), {
          name: m.name.trim(),
          pin: m.pin,
          householdId,
          householdName: householdName.trim(),
          rsvpStatus: m.rsvpStatus,
          paid: m.paid,
          shouldPayFee: true,
          status: 'not_logged_in',
          labels: labels.length > 0 ? labels : []
        });
      }

      // 2. Move selected existing guests to this household
      for (const guestId of selectedExistingGuestIds) {
        const guestObj = existingGuests.find(g => g.id === guestId);
        const existingLabels = guestObj?.labels || [];
        const mergedLabels = Array.from(new Set([...existingLabels, ...labels]));

        await updateDoc(doc(db, 'events', eventId, 'guests', guestId), {
          householdId,
          householdName: householdName.trim(),
          labels: mergedLabels
        });
      }

      showSuccess(`משק הבית "${householdName}" עם ${totalMemberCount} אורחים נשמר בהצלחה!`);
      onClose();
    } catch (err: any) {
      console.error('Error adding household:', err);
      showAlert('שגיאה בהוספת משק הבית');
    } finally {
      setIsSubmitting(false);
    }
  };

  const entryFee = eventInfo?.isFree ? 0 : (eventInfo?.entryFee || 0);

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990] flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer" 
      dir="rtl"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden relative border border-gray-100 animate-in zoom-in-95 duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/60 to-indigo-50/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Home size={24} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-gray-900">הוספת משק בית</h3>
              <p className="text-xs text-gray-500">הוספת משק בית עם נפשות, תיוגים וצירוף אורחים קיימים</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 bg-white p-2 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 admin-scroll flex-1">

          {/* Household Name */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Home size={15} className="text-blue-600" />
              שם משק הבית
            </label>
            <input
              type="text"
              value={householdName}
              onChange={e => setHouseholdName(e.target.value)}
              placeholder="לדוגמה: רועי ומיה, כהן, או דן ושות'..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-right shadow-sm"
              autoFocus
            />
          </div>

          {/* Household Labels */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Tag size={15} className="text-indigo-600" />
              תגיות וסיווגים עבור משק הבית (Labels)
            </label>
            <LabelInput
              labels={labels}
              onChange={setLabels}
              availableLabels={availableLabels}
              placeholder="לדוגמה: עבודה, תיכון, חברים..."
              helperText="התגיות יחולו על כל חברי משק הבית ויסייעו בסינון מהיר."
            />
          </div>

          {/* Existing Guests to Move section */}
          {candidateExistingGuests.length > 0 && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <UserCheck size={16} className="text-indigo-600" />
                  צירוף או העברת אורח קיים למשק בית זה
                </span>
                <span className="text-[11px] text-indigo-600 font-semibold">אופציונלי</span>
              </div>
              <p className="text-[11px] text-indigo-800/80 mb-3">
                תוכל להעביר אורחים שכבר רשומים באירוע למשק בית חדש זה.
              </p>

              <div className="flex gap-2">
                <select
                  value={selectedGuestToMove}
                  onChange={e => setSelectedGuestToMove(e.target.value)}
                  className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">בחר אורח קיים להעברה...</option>
                  {candidateExistingGuests.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.householdName || 'אורח יחיד'}) {g.pin ? `[PIN: ${g.pin}]` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddExistingGuest}
                  disabled={!selectedGuestToMove}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm whitespace-nowrap"
                >
                  צרף אורח
                </button>
              </div>

              {/* Selected Existing Guests chips */}
              {selectedExistingGuestIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-indigo-100">
                  {selectedExistingGuestIds.map(gid => {
                    const guest = existingGuests.find(g => g.id === gid);
                    if (!guest) return null;
                    return (
                      <span
                        key={gid}
                        className="bg-white border border-indigo-200 text-indigo-900 text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5"
                      >
                        <UserCheck size={13} className="text-indigo-600" />
                        <span>{guest.name}</span>
                        <span className="text-[10px] text-gray-400 font-normal">({guest.householdName || 'יחיד'})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExistingGuest(gid)}
                          className="text-gray-400 hover:text-red-600 mr-1"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Members List Header */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-blue-600" />
                <h4 className="text-sm font-extrabold text-gray-800">
                  נפשות חדשות במשק הבית ({members.length})
                </h4>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRandomizeAllPins}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold bg-blue-50 px-2.5 py-1.5 rounded-xl hover:bg-blue-100 transition-colors"
                >
                  <RefreshCw size={13} />
                  PIN אקראי לכולם
                </button>
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="text-xs text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1 font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all"
                >
                  <Plus size={14} />
                  הוסף נפש
                </button>
              </div>
            </div>

            {/* Members Rows */}
            <div className="space-y-3">
              {members.map((member, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3 relative transition-all hover:border-blue-200"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={member.name}
                      onChange={e => handleUpdateMember(idx, { name: e.target.value })}
                      placeholder={`שם חבר ${idx + 1}...`}
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                    />
                  </div>

                  {/* PIN */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative w-24">
                      <input
                        type="text"
                        value={member.pin}
                        onChange={e => handleUpdateMember(idx, { pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                        placeholder="PIN"
                        maxLength={4}
                        className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-xs font-mono text-center font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <KeyRound size={13} className="absolute left-2 top-2.5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Arrival Buttons */}
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => handleUpdateMember(idx, { rsvpStatus: 'coming' })}
                      className={`p-1.5 rounded-lg text-xs transition-all ${member.rsvpStatus === 'coming' ? 'bg-green-600 text-white font-bold' : 'text-gray-400 hover:text-green-600'
                        }`}
                      title="מגיע"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateMember(idx, { rsvpStatus: 'maybe' })}
                      className={`p-1.5 rounded-lg text-xs transition-all ${member.rsvpStatus === 'maybe' ? 'bg-amber-500 text-white font-bold' : 'text-gray-400 hover:text-amber-500'
                        }`}
                      title="אולי"
                    >
                      <HelpCircle size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateMember(idx, { rsvpStatus: 'not_coming' })}
                      className={`p-1.5 rounded-lg text-xs transition-all ${member.rsvpStatus === 'not_coming' ? 'bg-red-600 text-white font-bold' : 'text-gray-400 hover:text-red-600'
                        }`}
                      title="לא מגיע"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>

                  {/* Paid Status Toggle */}
                  <button
                    type="button"
                    onClick={() => handleUpdateMember(idx, { paid: !member.paid })}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${member.paid
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                    title="סטטוס תשלום"
                  >
                    <DollarSign size={14} />
                    {member.paid ? (entryFee > 0 ? `שולם ₪${entryFee}` : 'שולם ✓') : 'לא שולם'}
                  </button>

                  {member.paid && member.rsvpStatus === 'not_coming' && (
                    <span className="text-[10px] text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-1 rounded-lg animate-in fade-in">
                      שילם ולא מגיע!
                    </span>
                  )}

                  {/* Remove Member */}
                  {(members.length + selectedExistingGuestIds.length > 1) && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      className="text-gray-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-colors"
                      title="הסר חבר זה"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {members.filter(m => m.name.trim()).length + selectedExistingGuestIds.length} נפשות יהיו במשק בית זה
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-bold px-5 py-2.5 rounded-xl transition-colors"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleSaveHousehold}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>הוסף משק בית</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
