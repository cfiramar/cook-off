import { useState } from 'react';
import { doc, updateDoc, writeBatch, collection, addDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import type { Guest, Meal, EventInfo } from '../../../hooks/useFirebaseData';
import {
  X, Check, Trash2, Home, Users, Plus, Edit2, Tag, FileText,
  DollarSign, CheckCircle2, HelpCircle, XCircle, ArrowUp, ArrowDown,
  UserCheck, ChefHat, ExternalLink, AlertTriangle
} from 'lucide-react';
import Fuse from 'fuse.js';
import { usePopup } from '../../../components/ui/PopupProvider';
import LabelInput from '../../../components/ui/LabelInput';
import { syncMemberToHouseholdMeals } from '../../../utils/mealChefSync';

interface HouseholdGroup {
  id: string;
  name: string;
  members: Guest[];
  allNotComing: boolean;
  hasComing: boolean;
  paidCount: number;
  comingCount?: number;
  comingPaidCount?: number;
  hasPaidNotComingAlert?: boolean;
  labels: string[];
  notes?: string;
}

interface Props {
  household: HouseholdGroup;
  eventId: string;
  eventInfo: EventInfo | null;
  allGuests: Guest[];
  meals?: Meal[];
  availableLabels?: string[];
  onClose: () => void;
  onOpenGuestModal: (guest: Guest) => void;
}

export default function HouseholdCardModal({
  household,
  eventId,
  eventInfo,
  allGuests,
  meals = [],
  availableLabels = [],
  onClose,
  onOpenGuestModal
}: Props) {
  const { showAlert, showSuccess, showConfirm } = usePopup();

  // Basic household states
  const [householdName, setHouseholdName] = useState(household.name);
  const [isEditingName, setIsEditingName] = useState(false);
  const [labels, setLabels] = useState<string[]>(household.labels || []);
  const [notes, setNotes] = useState<string>(household.notes || household.members[0]?.householdNotes || '');

  // Add / Move member states (Unified with fuzzy search)
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPin, setNewMemberPin] = useState(Math.floor(1000 + Math.random() * 9000).toString());
  const [candidateMatches, setCandidateMatches] = useState<Guest[]>([]);

  // Map of guestId -> meals (accounting for direct chefIds and householdChefIds)
  const guestToMealsMap = new Map<string, Meal[]>();
  meals.forEach(m => {
    (m.chefIds || []).forEach(cId => {
      if (!guestToMealsMap.has(cId)) guestToMealsMap.set(cId, []);
      if (!guestToMealsMap.get(cId)!.some(existing => existing.id === m.id)) {
        guestToMealsMap.get(cId)!.push(m);
      }
    });
    if (m.householdChefIds && m.householdChefIds.length > 0) {
      allGuests.forEach(g => {
        if (g.householdId && m.householdChefIds!.includes(g.householdId)) {
          if (!guestToMealsMap.has(g.id)) guestToMealsMap.set(g.id, []);
          if (!guestToMealsMap.get(g.id)!.some(existing => existing.id === m.id)) {
            guestToMealsMap.get(g.id)!.push(m);
          }
        }
      });
    }
  });

  // Calculate fees & coming counts
  const entryFee = eventInfo?.isFree ? 0 : (eventInfo?.entryFee || 0);
  const totalPaidAmount = household.paidCount * entryFee;

  const comingMembers = household.members.filter(m => m.rsvpStatus === 'coming');
  const comingPaidCount = comingMembers.filter(m => m.paid).length;
  const allComingPaid = comingMembers.length > 0 && comingPaidCount === comingMembers.length;
  const hasPaidNotComingAlert = household.members.some(m => m.paid && m.rsvpStatus === 'not_coming' && !m.paidAlertDismissed);

  // Meals where this entire household is assigned as chef
  const householdMeals = meals.filter(m => m.householdChefIds && m.householdChefIds.includes(household.id));

  // Potential guests from other households to move in
  const moveableGuests = allGuests.filter(
    g => (g.householdId || `ind_${g.id}`) !== household.id
  );

  // Real-time fuzzy search on typing member name
  const handleMemberNameInput = (val: string) => {
    setNewMemberName(val);
    if (!val.trim()) {
      setCandidateMatches([]);
      return;
    }
    const fuse = new Fuse(moveableGuests, {
      keys: ['name', 'householdName', 'pin'],
      threshold: 0.35,
    });
    const results = fuse.search(val).map(r => r.item).slice(0, 5);
    setCandidateMatches(results);
  };

  // Save Household Name
  const handleSaveName = async () => {
    if (!householdName.trim()) {
      showAlert('יש להזין שם למשק הבית');
      return;
    }
    try {
      const batch = writeBatch(db);
      household.members.forEach(m => {
        batch.update(doc(db, 'events', eventId, 'guests', m.id), {
          householdName: householdName.trim()
        });
      });
      await batch.commit();
      setIsEditingName(false);
      showSuccess('שם משק הבית עודכן');
    } catch (err) {
      console.error('Error updating household name:', err);
      showAlert('שגיאה בעדכון שם משק הבית');
    }
  };

  // Save Labels immediately
  const handleLabelsChange = async (newLabels: string[]) => {
    setLabels(newLabels);
    try {
      const batch = writeBatch(db);
      household.members.forEach(m => {
        batch.update(doc(db, 'events', eventId, 'guests', m.id), {
          labels: newLabels
        });
      });
      await batch.commit();
      showSuccess('תגיות משק הבית נשמרו');
    } catch (err) {
      console.error('Error updating labels:', err);
      showAlert('שגיאה בעדכון תגיות');
    }
  };

  // Save Notes on blur or button
  const handleSaveNotes = async (newNotes: string) => {
    try {
      const batch = writeBatch(db);
      household.members.forEach(m => {
        batch.update(doc(db, 'events', eventId, 'guests', m.id), {
          householdNotes: newNotes.trim()
        });
      });
      await batch.commit();
      showSuccess('הערות משק הבית נשמרו');
    } catch (err) {
      console.error('Error updating notes:', err);
      showAlert('שגיאה בשמירת הערות');
    }
  };

  // Reorder Members inside household
  const handleReorderMember = async (guestId: string, direction: 'up' | 'down') => {
    const list = [...household.members];
    const currentIndex = list.findIndex(m => m.id === guestId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Swap positions
    const [moved] = list.splice(currentIndex, 1);
    list.splice(targetIndex, 0, moved);

    try {
      const batch = writeBatch(db);
      list.forEach((m, idx) => {
        batch.update(doc(db, 'events', eventId, 'guests', m.id), {
          order: idx
        });
      });
      await batch.commit();
      showSuccess('סדר הנפשות עודכן בהצלחה');
    } catch (err) {
      console.error('Error reordering members:', err);
      showAlert('שגיאה בעדכון סדר הנפשות');
    }
  };

  // Add new member
  const handleAddNewMember = async () => {
    if (!newMemberName.trim()) {
      showAlert('יש להזין שם נפש');
      return;
    }
    if (newMemberPin.length !== 4) {
      showAlert('PIN חייב להכיל בדיוק 4 ספרות');
      return;
    }

    try {
      const nextOrder = household.members.length;
      const newGuestRef = await addDoc(collection(db, 'events', eventId, 'guests'), {
        name: newMemberName.trim(),
        pin: newMemberPin,
        householdId: household.id,
        householdName: householdName.trim() || household.name,
        rsvpStatus: 'maybe',
        paid: false,
        shouldPayFee: true,
        status: 'not_logged_in',
        labels: labels,
        householdNotes: notes.trim(),
        order: nextOrder
      });

      if (meals && meals.length > 0) {
        await syncMemberToHouseholdMeals(eventId, newGuestRef.id, household.id, meals);
      }

      setNewMemberName('');
      setCandidateMatches([]);
      setNewMemberPin(Math.floor(1000 + Math.random() * 9000).toString());
      setIsAddingMember(false);
      showSuccess('נפש נוספה למשק הבית');
    } catch (err) {
      console.error('Error adding member:', err);
      showAlert('שגיאה בהוספת נפש');
    }
  };

  // Move existing guest into this household
  const handleMoveExistingGuest = async (targetGuestId: string) => {
    const targetGuest = allGuests.find(g => g.id === targetGuestId);
    if (!targetGuest) return;

    try {
      const nextOrder = household.members.length;
      await updateDoc(doc(db, 'events', eventId, 'guests', targetGuestId), {
        householdId: household.id,
        householdName: householdName.trim() || household.name,
        householdNotes: notes.trim(),
        order: nextOrder
      });

      if (meals && meals.length > 0) {
        await syncMemberToHouseholdMeals(eventId, targetGuestId, household.id, meals);
      }

      setNewMemberName('');
      setCandidateMatches([]);
      setIsAddingMember(false);
      showSuccess(`האורח "${targetGuest.name}" הועבר למשק בית זה`);
    } catch (err) {
      console.error('Error moving guest:', err);
      showAlert('שגיאה בהעברת אורח');
    }
  };

  // Toggle paid alert dismissed status
  const handleTogglePaidAlert = async (memberId: string, dismissed: boolean) => {
    try {
      await updateDoc(doc(db, 'events', eventId, 'guests', memberId), {
        paidAlertDismissed: dismissed
      });
      showSuccess(dismissed ? 'ההתראה כובתה (סוכם ללא החזר)' : 'ההתראה הופעלה מחדש');
    } catch (err) {
      console.error('Error toggling paid alert:', err);
      showAlert('שגיאה בעדכון התראה');
    }
  };

  // Toggle RSVP for a member
  const handleMemberRSVP = async (memberId: string, status: 'coming' | 'maybe' | 'not_coming') => {
    try {
      await updateDoc(doc(db, 'events', eventId, 'guests', memberId), {
        rsvpStatus: status
      });
    } catch (err) {
      console.error('Error updating RSVP:', err);
    }
  };

  // Toggle Paid for a member
  const handleToggleMemberPaid = async (member: Guest) => {
    try {
      await updateDoc(doc(db, 'events', eventId, 'guests', member.id), {
        paid: !member.paid
      });
    } catch (err) {
      console.error('Error toggling paid:', err);
    }
  };

  const handleToggleMemberExemption = (member: Guest) => {
    showConfirm(
      `האורח "${member.name}" מוגדר כפטור מתשלום. האם לבטל את הפטור ולחייבו בדמי כניסה?`,
      async () => {
        try {
          await updateDoc(doc(db, 'events', eventId, 'guests', member.id), {
            shouldPayFee: true,
            paid: false
          });
          showSuccess(`הפטור בוטל. "${member.name}" מחויב כעת בדמי כניסה.`);
        } catch (err) {
          console.error('Error toggling exemption:', err);
          showAlert('שגיאה בעדכון חיוב האורח');
        }
      }
    );
  };

  // Delete entire household
  const handleDeleteHousehold = () => {
    showConfirm(
      `האם למחוק את משק הבית "${household.name}" ואת כל ${household.members.length} הנפשות שבו?`,
      async () => {
        try {
          const batch = writeBatch(db);
          household.members.forEach(m => {
            batch.delete(doc(db, 'events', eventId, 'guests', m.id));
          });
          await batch.commit();
          showSuccess('משק הבית נמחק בהצלחה');
          onClose();
        } catch (err) {
          console.error('Error deleting household:', err);
          showAlert('שגיאה במחיקת משק הבית');
        }
      }
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990] flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer" 
      dir="rtl"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden relative border border-gray-100 animate-in zoom-in-95 duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-purple-50/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
              <Home size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={householdName}
                      onChange={e => setHouseholdName(e.target.value)}
                      className="bg-white border border-blue-400 rounded-lg px-2.5 py-1 text-sm font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    />
                    <button
                      onClick={handleSaveName}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                      title="שמור שם"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setHouseholdName(household.name);
                        setIsEditingName(false);
                      }}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                      title="בטל"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-xl font-black text-gray-900">{householdName}</h3>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-gray-400 hover:text-blue-600 p-1 rounded-lg hover:bg-blue-50 transition-colors"
                      title="ערוך שם משק בית"
                    >
                      <Edit2 size={14} />
                    </button>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">כרטיס ניהול משק בית, נפשות, תגיות והערות</p>
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

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-3 text-center">
              <span className="block text-[11px] text-gray-500 font-bold mb-1">סה"כ נפשות</span>
              <span className="text-lg font-black text-gray-900">{household.members.length}</span>
            </div>

            <div className="bg-green-50 border border-green-200/80 rounded-2xl p-3 text-center">
              <span className="block text-[11px] text-green-700 font-bold mb-1">אישרו הגעה</span>
              <span className="text-lg font-black text-green-800">
                {comingMembers.length}
              </span>
            </div>

            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 text-center">
              <span className="block text-[11px] text-amber-700 font-bold mb-1">טרם השיבו</span>
              <span className="text-lg font-black text-amber-800">
                {household.members.filter(m => m.rsvpStatus === 'maybe' || !m.rsvpStatus).length}
              </span>
            </div>

            {/* Paid KPI: Green if all coming members paid! */}
            <div className={`border rounded-2xl p-3 text-center transition-all ${
              allComingPaid
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : comingMembers.length > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : household.paidCount > 0
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}>
              <span className="block text-[11px] font-bold mb-1">
                {comingMembers.length > 0 ? 'מגיעים ששילמו' : 'שילמו'}
              </span>
              <span className="text-lg font-black">
                {comingMembers.length > 0
                  ? `${comingPaidCount}/${comingMembers.length}`
                  : `${household.paidCount}/${household.members.length}`}
                {entryFee > 0 && ` (₪${totalPaidAmount})`}
              </span>
            </div>
          </div>

          {/* Paid but Not Coming Alert Banner */}
          {hasPaidNotComingAlert && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-red-800 text-xs animate-in fade-in">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
                <span>ישנם בני בית ששילמו אך אינם מגיעים! ניתן להסדיר או לכבות את ההתראה ברשימה למטה.</span>
              </div>
            </div>
          )}

          {/* Household Labels Section */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Tag size={14} className="text-indigo-600" />
              תגיות משק הבית (נשמר מיד לכל הנפשות)
            </label>
            <LabelInput
              labels={labels}
              onChange={handleLabelsChange}
              availableLabels={availableLabels}
              placeholder="הקלד תגית כגון: עבודה, תיכון, חברים..."
              helperText="התגיות חלות על כל חברי משק הבית ומשמשות לסינון ולחיפוש מהיר."
            />
          </div>

          {/* Household Free-Text Notes Section */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <FileText size={14} className="text-amber-600" />
              הערות חופשיות / דגשים למשק הבית
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => handleSaveNotes(notes)}
              placeholder="לדוגמה: יגיעו עם עגלה, לשבת קרוב למזגן, להכין מנה לילדים..."
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-right resize-none shadow-sm"
            />
            <p className="text-[11px] text-gray-400">נשמר אוטומטית בעת עזיבת השדה.</p>
          </div>

          {/* Household Chef Meals Banner */}
          {householdMeals.length > 0 && (
            <div className="bg-purple-50/90 border border-purple-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <ChefHat size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-purple-900">משק בית זה מוגדר כצוות שפים עבור:</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {householdMeals.map(m => (
                      <span key={m.id} className="text-xs font-bold bg-white text-purple-800 border border-purple-200 px-2 py-0.5 rounded-lg shadow-2xs">
                        🍳 {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Members List with Reordering */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                <h4 className="text-sm font-extrabold text-gray-900">
                  נפשות במשק הבית ({household.members.length})
                </h4>
              </div>

              <button
                onClick={() => setIsAddingMember(!isAddingMember)}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-blue-200 transition-colors flex items-center gap-1 shadow-sm"
              >
                <Plus size={14} />
                <span>הוסף / העבר נפש</span>
              </button>
            </div>

            {/* Add / Move Member inline block (Unified with Fuzzy Search) */}
            {isAddingMember && (
              <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Users size={14} className="text-blue-600" />
                    הוספת נפש ל-{household.name} (הקלד שם חדש או בחר אורח קיים להעברה):
                  </span>
                  <button
                    onClick={() => {
                      setIsAddingMember(false);
                      setNewMemberName('');
                      setCandidateMatches([]);
                    }}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 relative">
                  <div className="relative flex-1 w-full">
                    <input
                      type="text"
                      value={newMemberName}
                      onChange={e => handleMemberNameInput(e.target.value)}
                      placeholder="שם הנפש (או הקלד שם אורח קיים להעברה)..."
                      className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleAddNewMember();
                        }
                      }}
                    />

                    {/* Fuzzy search results dropdown */}
                    {candidateMatches.length > 0 && (
                      <div className="absolute top-full mt-1 right-0 left-0 bg-white border border-indigo-200 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in space-y-1">
                        <div className="text-[10px] text-indigo-700 font-bold px-2 py-0.5 flex items-center gap-1 border-b border-indigo-50 pb-1">
                          <UserCheck size={11} />
                          <span>נמצא אורח קיים - לחץ להעברתו למשק בית זה:</span>
                        </div>
                        {candidateMatches.map(g => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => handleMoveExistingGuest(g.id)}
                            className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs hover:bg-indigo-50 flex items-center justify-between transition-colors border border-transparent hover:border-indigo-200"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">{g.name}</span>
                              <span className="text-[11px] text-gray-500 font-medium">
                                (במשק בית: {g.householdName || 'אורח יחיד'})
                              </span>
                            </div>
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                              <UserCheck size={10} />
                              העבר לכאן
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    value={newMemberPin}
                    onChange={e => setNewMemberPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="PIN"
                    maxLength={4}
                    className="w-20 bg-white border border-blue-300 rounded-xl px-2 py-2 text-xs font-mono text-center font-bold"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleAddNewMember();
                      }
                    }}
                  />

                  <button
                    type="button"
                    onClick={handleAddNewMember}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm whitespace-nowrap"
                  >
                    הוסף כאורח חדש
                  </button>
                </div>
              </div>
            )}

            {/* Members ordered list */}
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden shadow-sm">
              {household.members.map((member, index) => {
                const isNotComing = member.rsvpStatus === 'not_coming';
                const guestMeals = guestToMealsMap.get(member.id) || [];
                const isFirst = index === 0;
                const isLast = index === household.members.length - 1;

                return (
                  <div
                    key={member.id}
                    className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/70 transition-all ${isNotComing ? 'opacity-50 grayscale line-through bg-gray-50/40 text-gray-400' : ''
                      }`}
                  >
                    {/* Reorder buttons & Member info */}
                    <div className="flex items-center gap-2.5">
                      {/* Up / Down Reorder buttons */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleReorderMember(member.id, 'up')}
                          className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                          title="הזז למעלה"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleReorderMember(member.id, 'down')}
                          className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                          title="הזז למטה"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>

                      {/* Initial Avatar */}
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
                        {member.name.charAt(0) || 'א'}
                      </div>

                      {/* Name, PIN & Details */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">{member.name}</span>
                          <span className="bg-gray-100 text-gray-600 font-mono text-[11px] px-2 py-0.5 rounded-md font-bold">
                            {member.pin || 'אין PIN'}
                          </span>
                          {member.isHostingMember && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-1.5 py-0.5 rounded-md">
                              מארח
                            </span>
                          )}
                          {member.canVote === false && (
                            <span className="bg-gray-100 text-gray-600 border border-gray-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                              לא מצביע
                            </span>
                          )}

                          {/* Paid but Not Coming Alert with Dismiss Option */}
                          {member.paid && member.rsvpStatus === 'not_coming' && (
                            <div className="flex items-center gap-1">
                              {!member.paidAlertDismissed ? (
                                <span className="bg-red-100 border border-red-300 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs animate-in fade-in">
                                  <AlertTriangle size={11} className="text-red-600 animate-pulse" />
                                  <span>שילם ולא מגיע!</span>
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePaidAlert(member.id, true)}
                                    className="mr-1 text-[9px] bg-red-200 hover:bg-red-300 text-red-900 px-1.5 py-0.5 rounded font-bold underline transition-colors"
                                    title="סמן שהוסכם ביניכם שדמי ההשתתפות לא יוחזרו וכבה התראה זו"
                                  >
                                    הוסכם ללא החזר
                                  </button>
                                </span>
                              ) : (
                                <span className="bg-gray-100 border border-gray-200 text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1" title="הוסכם שהתשלום לא יוחזר (ההתראה כבויה)">
                                  <span>ללא החזר</span>
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePaidAlert(member.id, false)}
                                    className="text-[9px] text-gray-400 hover:text-red-600 underline"
                                    title="הפעל מחדש את ההתראה"
                                  >
                                    (בטל)
                                  </button>
                                </span>
                              )}
                            </div>
                          )}

                          {member.notes && (
                            <span
                              className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium"
                              title={member.notes}
                            >
                              <FileText size={10} className="text-amber-600" />
                              {member.notes.length > 20 ? `${member.notes.slice(0, 20)}...` : member.notes}
                            </span>
                          )}
                        </div>

                        {guestMeals.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <ChefHat size={11} />
                              שף: {guestMeals.map(m => m.name).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Member Controls: RSVP, Paid, and Card */}
                    <div className="flex items-center gap-2 justify-end">
                      {/* RSVP Buttons */}
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-0.5 shadow-sm">
                        <button
                          type="button"
                          onClick={() => handleMemberRSVP(member.id, 'not_coming')}
                          className={`p-1 rounded-lg transition-all ${member.rsvpStatus === 'not_coming'
                            ? 'bg-red-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                          title="לא מגיע"
                        >
                          <XCircle size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMemberRSVP(member.id, 'maybe')}
                          className={`p-1 rounded-lg transition-all ${member.rsvpStatus === 'maybe' || !member.rsvpStatus
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                            }`}
                          title="אולי"
                        >
                          <HelpCircle size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMemberRSVP(member.id, 'coming')}
                          className={`p-1 rounded-lg transition-all ${member.rsvpStatus === 'coming'
                            ? 'bg-green-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                          title="מגיע"
                        >
                          <CheckCircle2 size={15} />
                        </button>
                      </div>

                      {/* Paid Toggle / Exempt Status */}
                      {member.shouldPayFee === false ? (
                        <button
                          type="button"
                          onClick={() => handleToggleMemberExemption(member)}
                          className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all cursor-pointer"
                          title="פטור מתשלום (לחץ לביטול הפטור וחיוב בדמי כניסה)"
                        >
                          <DollarSign size={12} className="text-amber-600" />
                          <span>פטור</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleMemberPaid(member)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-sm ${member.paid
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                            }`}
                          title="סטטוס תשלום"
                        >
                          <DollarSign size={12} />
                          <span>{member.paid ? 'שולם' : 'לא'}</span>
                        </button>
                      )}

                      {/* Open Full Guest Modal */}
                      <button
                        type="button"
                        onClick={() => {
                          onOpenGuestModal(member);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="פתח כרטיס אורח מלא"
                      >
                        <ExternalLink size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/70">
          <button
            type="button"
            onClick={handleDeleteHousehold}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={15} />
            <span>מחק משק בית זה</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-gray-900 hover:bg-black text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition-all"
          >
            סגור כרטיס
          </button>
        </div>

      </div>
    </div>
  );
}
