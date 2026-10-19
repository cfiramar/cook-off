import { useState } from 'react';
import { doc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../../firebase';
import type { Guest, Meal, EventInfo } from '../../../hooks/useFirebaseData';
import {
  X, Check, Trash2, KeyRound, RefreshCw, DollarSign,
  UtensilsCrossed, Plus, Link as LinkIcon, Unlink, CheckCircle2,
  HelpCircle, XCircle, Home, ChefHat, Upload, Loader2, Tag, FileText,
  AlertTriangle
} from 'lucide-react';
import { usePopup } from '../../../components/ui/PopupProvider';
import LabelInput from '../../../components/ui/LabelInput';
import { syncMemberToHouseholdMeals } from '../../../utils/mealChefSync';

interface Props {
  guest: Guest;
  eventId: string;
  meals: Meal[];
  eventInfo: EventInfo | null;
  allHouseholds: { id: string; name: string }[];
  availableLabels?: string[];
  onClose: () => void;
}

export default function GuestCardModal({
  guest,
  eventId,
  meals,
  eventInfo,
  allHouseholds,
  availableLabels = [],
  onClose
}: Props) {
  const { showAlert, showSuccess, showConfirm } = usePopup();

  // Guest details state
  const [name, setName] = useState(guest.name || '');
  const [pin, setPin] = useState(guest.pin || '');
  const [householdName, setHouseholdName] = useState(guest.householdName || '');
  const [householdId, setHouseholdId] = useState(guest.householdId || '');
  const [rsvpStatus, setRsvpStatus] = useState<'coming' | 'maybe' | 'not_coming'>(guest.rsvpStatus || 'maybe');
  const [paid, setPaid] = useState<boolean>(!!guest.paid);
  const [paidAlertDismissed, setPaidAlertDismissed] = useState<boolean>(!!guest.paidAlertDismissed);
  const [canVote, setCanVote] = useState<boolean>(guest.canVote !== false);
  const [shouldPayFee, setShouldPayFee] = useState<boolean>(
    guest.isHostingMember ? (guest.shouldPayFee ?? false) : (guest.shouldPayFee ?? true)
  );
  const [labels, setLabels] = useState<string[]>(guest.labels || []);
  const [notes, setNotes] = useState<string>(guest.notes || '');

  const [isSaving, setIsSaving] = useState(false);

  // Meal linking state
  const [selectedMealToLink, setSelectedMealToLink] = useState('');
  const [isAddingNewMeal, setIsAddingNewMeal] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [newMealDesc, setNewMealDesc] = useState('');
  const [newMealImageUrl, setNewMealImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Generate random 4-digit PIN
  const generateRandomPin = () => {
    const random = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(random);
  };

  // Helper to check if guest is chef either directly or through their household
  const isGuestChefOfMeal = (m: Meal) => {
    if (m.chefIds && m.chefIds.includes(guest.id)) return true;
    if (guest.householdId && m.householdChefIds && m.householdChefIds.includes(guest.householdId)) return true;
    return false;
  };

  // Linked meals to this guest
  const linkedMeals = meals.filter(isGuestChefOfMeal);
  const unlinkedMeals = meals.filter(m => !isGuestChefOfMeal(m));

  // Save labels immediately upon addition or removal
  const handleLabelsChange = async (newLabels: string[]) => {
    setLabels(newLabels);
    try {
      await updateDoc(doc(db, 'events', eventId, 'guests', guest.id), {
        labels: newLabels
      });
      showSuccess('תגיות עודכנו בהצלחה');
    } catch (err: any) {
      console.error('Error updating labels:', err);
      showAlert('שגיאה בשמירת התגיות');
    }
  };

  // Auto-save notes on blur
  const handleSaveNotes = async (newNotes: string) => {
    if (newNotes === (guest.notes || '')) return;
    try {
      await updateDoc(doc(db, 'events', eventId, 'guests', guest.id), {
        notes: newNotes.trim()
      });
      showSuccess('הערות האורח נשמרו');
    } catch (err: any) {
      console.error('Error updating notes:', err);
      showAlert('שגיאה בשמירת הערות');
    }
  };

  // Save guest basic information
  const handleSaveGuest = async () => {
    if (!name.trim()) {
      showAlert('יש להזין שם אורח');
      return;
    }
    if (pin.length !== 4) {
      showAlert('קוד PIN חייב להכיל בדיוק 4 ספרות');
      return;
    }

    setIsSaving(true);
    try {
      const targetHouseholdId = householdId || guest.householdId || `hh_${Date.now()}`;
      const isHouseholdChanged = targetHouseholdId !== guest.householdId;

      await updateDoc(doc(db, 'events', eventId, 'guests', guest.id), {
        name: name.trim(),
        pin,
        householdId: targetHouseholdId,
        householdName: householdName.trim() || name.trim(),
        rsvpStatus,
        paid,
        paidAlertDismissed,
        labels,
        notes: notes.trim(),
        canVote,
        shouldPayFee
      });

      if (isHouseholdChanged && meals && meals.length > 0) {
        await syncMemberToHouseholdMeals(eventId, guest.id, targetHouseholdId, meals);
      }

      showSuccess('פרטי האורח עודכנו בהצלחה');
      onClose();
    } catch (err: any) {
      console.error('Error updating guest:', err);
      showAlert('שגיאה בעדכון פרטי האורח');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete guest
  const handleDeleteGuest = () => {
    showConfirm(`האם למחוק את האורח "${guest.name}"?`, async () => {
      try {
        await deleteDoc(doc(db, 'events', eventId, 'guests', guest.id));

        // Also remove this guest from any linked meals
        for (const meal of linkedMeals) {
          const updatedChefs = meal.chefIds.filter(id => id !== guest.id);
          await updateDoc(doc(db, 'events', eventId, 'meals', meal.id), {
            chefIds: updatedChefs
          });
        }

        showSuccess('האורח נמחק');
        onClose();
      } catch (err: any) {
        console.error('Error deleting guest:', err);
        showAlert('שגיאה במחיקת האורח');
      }
    });
  };

  // Link guest to an existing meal
  const handleLinkMeal = async () => {
    if (!selectedMealToLink) return;
    try {
      const meal = meals.find(m => m.id === selectedMealToLink);
      if (!meal) return;
      const updatedChefs = [...(meal.chefIds || []), guest.id];
      const updates: any = { chefIds: updatedChefs };
      if (guest.isHostingMember) {
        updates.isNonParticipating = true;
      }
      await updateDoc(doc(db, 'events', eventId, 'meals', meal.id), updates);
      setSelectedMealToLink('');
      showSuccess(`האורח קושר למנה "${meal.name}" כשף`);
    } catch (err: any) {
      console.error('Error linking meal:', err);
      showAlert('שגיאה בקישור המנה');
    }
  };

  // Unlink guest from a meal
  const handleUnlinkMeal = (meal: Meal) => {
    showConfirm(`האם להסיר את השיוך של ${guest.name} מהמנה "${meal.name}"?`, async () => {
      try {
        const updatedChefs = (meal.chefIds || []).filter(id => id !== guest.id);
        const updatedHouseholdChefs = (meal.householdChefIds || []).filter(id => id !== guest.householdId);
        await updateDoc(doc(db, 'events', eventId, 'meals', meal.id), {
          chefIds: updatedChefs,
          householdChefIds: updatedHouseholdChefs
        });
        showSuccess('השיוך הוסר');
      } catch (err: any) {
        console.error('Error unlinking meal:', err);
        showAlert('שגיאה בהסרת שיוך המנה');
      }
    });
  };

  // Upload image to ImgBB
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showAlert('יש להעלות קובץ תמונה בלבד');
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setNewMealImageUrl(data.data.url);
      } else {
        showAlert('שגיאה בהעלאת התמונה');
      }
    } catch (err) {
      console.error('Upload error:', err);
      showAlert('שגיאה בהעלאת התמונה');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Create new meal for this guest
  const handleCreateMeal = async () => {
    if (!newMealName.trim()) {
      showAlert('יש להזין שם מנה');
      return;
    }
    try {
      await addDoc(collection(db, 'events', eventId, 'meals'), {
        name: newMealName.trim(),
        description: newMealDesc.trim(),
        imageUrl: newMealImageUrl.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80',
        chefIds: [guest.id],
        isNonParticipating: !!guest.isHostingMember
      });
      setNewMealName('');
      setNewMealDesc('');
      setNewMealImageUrl('');
      setIsAddingNewMeal(false);
      showSuccess('המנה נוצרה וקושרה לשף בהצלחה!');
    } catch (err: any) {
      console.error('Error creating meal:', err);
      showAlert('שגיאה ביצירת המנה');
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
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-500/20">
              {name.charAt(0) || 'א'}
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-gray-900">כרטיס אורח ושף</h3>
              <p className="text-xs text-gray-500">עריכת פרטי הגעה, תשלום, קוד כניסה ושיוך מנות</p>
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

          {/* Main Info (Name, PIN, Household) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">שם מלא</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="שם האורח..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-right"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-gray-700">קוד PIN (4 ספרות)</label>
                <button
                  type="button"
                  onClick={generateRandomPin}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                >
                  <RefreshCw size={12} />
                  צור אקראי
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                  maxLength={4}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 font-mono tracking-widest text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <KeyRound size={16} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">ניתן להשתמש בקוד של בן/בת הזוג.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Home size={15} className="text-blue-600" />
                משק בית
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  list="household-options"
                  value={householdName}
                  onChange={e => {
                    setHouseholdName(e.target.value);
                    const match = allHouseholds.find(h => h.name === e.target.value);
                    if (match) setHouseholdId(match.id);
                  }}
                  placeholder="לדוגמה: רון וענת, כהן..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-right"
                />
                <datalist id="household-options">
                  {allHouseholds.map(h => (
                    <option key={h.id} value={h.name} />
                  ))}
                </datalist>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">אורחים בעלי אותו שם משק בית יקובצו יחד בלוח הניהול.</p>
            </div>

            {/* Labels section */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Tag size={14} className="text-indigo-600" />
                תגיות וסיווגים (Labels)
              </label>
              <LabelInput
                labels={labels}
                onChange={handleLabelsChange}
                availableLabels={availableLabels}
                placeholder="הקלד תגית כגון: עבודה, תיכון, חברים..."
                helperText="תגיות נשמרות מיידית ועוזרות בחיפוש חכם ובסינון אורחים ומשקי בית."
              />
            </div>

            {/* Notes Section */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <FileText size={14} className="text-amber-600" />
                הערות חופשיות / דגשים לאורח
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={() => handleSaveNotes(notes)}
                placeholder="לדוגמה: צמחוני, רגישות לגלוטן, מביא יין, יגיע מאוחר..."
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-right resize-none shadow-sm"
              />
              <p className="text-[11px] text-gray-400 mt-1">ההערות נשמרות אוטומטית בעת עזיבת השדה או בלחיצה על שמירה.</p>
            </div>
          </div>

          {/* Hosting Member Settings if applicable */}
          {guest.isHostingMember && (
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 flex flex-col gap-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Home size={15} className="text-amber-600" />
                  הגדרות אחד המארחים
                </span>
                <span className="text-[10px] bg-amber-200/80 text-amber-900 font-black px-2 py-0.5 rounded-full border border-amber-300">
                  מארחים
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCanVote(!canVote)}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${canVote
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs'
                    : 'bg-white border-gray-200 text-gray-500 opacity-80'
                    }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>מורשה להצביע</span>
                  </span>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${canVote ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                    {canVote ? '✓' : '✗'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !shouldPayFee;
                    setShouldPayFee(next);
                    if (next) setPaid(true);
                  }}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${shouldPayFee
                    ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-2xs'
                    : 'bg-amber-100/70 border-amber-300 text-amber-900 shadow-2xs'
                    }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>{shouldPayFee ? 'מחויב בדמי כניסה' : 'פטור מתשלום (מארח)'}</span>
                  </span>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${shouldPayFee ? 'bg-purple-600 text-white' : 'bg-amber-600 text-white'
                    }`}>
                    {shouldPayFee ? '✓' : 'פ'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Status Controls: Arrival & Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">

            {/* Arrival Status */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
              <span className="block text-xs font-bold text-gray-700 mb-2">סטטוס הגעה (אישור הגעה)</span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setRsvpStatus('coming')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${rsvpStatus === 'coming'
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-green-50'
                    }`}
                >
                  <CheckCircle2 size={16} />
                  מגיע
                </button>

                <button
                  type="button"
                  onClick={() => setRsvpStatus('maybe')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${rsvpStatus === 'maybe'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-amber-50'
                    }`}
                >
                  <HelpCircle size={16} />
                  אולי
                </button>

                <button
                  type="button"
                  onClick={() => setRsvpStatus('not_coming')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${rsvpStatus === 'not_coming'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-red-50'
                    }`}
                >
                  <XCircle size={16} />
                  לא מגיע
                </button>
              </div>
            </div>

            {/* Paid Status */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="block text-xs font-bold text-gray-700">סטטוס תשלום</span>
                  {/* Fee Exemption Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !shouldPayFee;
                      setShouldPayFee(next);
                      if (!next) setPaid(false);
                    }}
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border transition-all ${!shouldPayFee
                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    title={shouldPayFee ? 'לחץ כדי להגדיר פטור מתשלום' : 'לחץ כדי לבטל את הפטור ולחייב בדמי כניסה'}
                  >
                    {!shouldPayFee ? 'פטור מתשלום ✓' : 'הגדר כפטור מתשלום'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mb-2">
                  {eventInfo?.isFree
                    ? 'האירוע מוגדר כאירוע ללא תשלום'
                    : !shouldPayFee
                      ? 'האורח מוגדר כפטור מתשלום דמי כניסה (ללא עלות)'
                      : `דמי כניסה לאירוע: ₪${entryFee}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!shouldPayFee ? (
                  <button
                    type="button"
                    onClick={() => setShouldPayFee(true)}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 transition-all cursor-pointer"
                    title="לחץ לביטול הפטור וחיוב בדמי כניסה"
                  >
                    <DollarSign size={16} className="text-amber-600" />
                    <span>פטור מתשלום (לחץ לביטול הפטור)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPaid(!paid)}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${paid
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <DollarSign size={16} />
                    {paid ? (entryFee > 0 ? `שולם (₪${entryFee})` : 'שולם ✓') : 'טרם שולם'}
                  </button>
                )}
              </div>

              {/* Paid but Not Coming Alert with Toggle */}
              {paid && rsvpStatus === 'not_coming' && (
                <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs flex flex-col gap-2 animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle size={15} className="text-red-600 flex-shrink-0 animate-pulse" />
                    <span>שילם אך לא מגיע!</span>
                  </div>
                  <p className="text-[11px] text-red-700 leading-relaxed">
                    ברירת המחדל מציגה התראה אדומה לאורח זה. אם הוסכם ביניכם שדמי ההשתתפות לא יוחזרו, סמן את התיבה למטה כדי לכבות את ההתראה.
                  </p>
                  <label className="flex items-center gap-2 mt-1 cursor-pointer select-none bg-white p-2 rounded-lg border border-red-200">
                    <input
                      type="checkbox"
                      checked={paidAlertDismissed}
                      onChange={e => setPaidAlertDismissed(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-800">
                      הוסכם ללא החזר (כבה התראה)
                    </span>
                  </label>
                </div>
              )}
            </div>

          </div>

          {/* Meals Section */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
                <ChefHat size={18} className="text-blue-600" />
                מנות מקושרות (שף)
              </h4>
              <button
                type="button"
                onClick={() => setIsAddingNewMeal(!isAddingNewMeal)}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors"
              >
                <Plus size={14} />
                {isAddingNewMeal ? 'סגור טופס מנה' : 'הוסף מנה חדשה לשף'}
              </button>
            </div>

            {/* Currently Linked Meals */}
            {linkedMeals.length > 0 ? (
              <div className="space-y-2 mb-4">
                {linkedMeals.map(meal => (
                  <div key={meal.id} className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      {meal.imageUrl ? (
                        <img src={meal.imageUrl} alt={meal.name} className="w-12 h-12 rounded-lg object-cover border border-blue-200" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-blue-200 text-blue-700 flex items-center justify-center">
                          <UtensilsCrossed size={20} />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                          {meal.name}
                          {guest.householdId && meal.householdChefIds?.includes(guest.householdId) && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Home size={10} />
                              דרך משק בית
                            </span>
                          )}
                          {meal.isNonParticipating && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                              מחוץ לתחרות
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-1">{meal.description || 'ללא תיאור'}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlinkMeal(meal)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                      title="הסר קישור למנה"
                    >
                      <Unlink size={16} />
                      <span className="hidden sm:inline">הסר שיוך</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-200 mb-4 text-center">
                אורח זה אינו משויך כרגע לאף מנה כשף.
              </div>
            )}

            {/* Link to existing meal */}
            {unlinkedMeals.length > 0 && (
              <div className="flex gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-200 mb-4">
                <select
                  value={selectedMealToLink}
                  onChange={e => setSelectedMealToLink(e.target.value)}
                  className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">בחר מנה קיימת לשיוך...</option>
                  {unlinkedMeals.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleLinkMeal}
                  disabled={!selectedMealToLink}
                  className="bg-gray-800 hover:bg-gray-900 disabled:opacity-40 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <LinkIcon size={14} />
                  שייך
                </button>
              </div>
            )}

            {/* Create new meal form */}
            {isAddingNewMeal && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
                <span className="block text-xs font-bold text-blue-900">יצירת מנה חדשה עבור {name}</span>
                <div>
                  <input
                    type="text"
                    value={newMealName}
                    onChange={e => setNewMealName(e.target.value)}
                    placeholder="שם המנה (לדוגמה: מרק דלעת מכושף)..."
                    className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <textarea
                    value={newMealDesc}
                    onChange={e => setNewMealDesc(e.target.value)}
                    rows={2}
                    placeholder="תיאור המנה ורכיבים..."
                    className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newMealImageUrl}
                    onChange={e => setNewMealImageUrl(e.target.value)}
                    placeholder="קישור לתמונה (URL)..."
                    className="flex-1 bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="cursor-pointer bg-white border border-blue-300 hover:bg-blue-100 text-blue-700 text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-1 transition-colors">
                    {isUploadingImage ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    <span>העלה קובץ</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewMeal(false)}
                    className="text-gray-500 hover:text-gray-700 text-xs px-3 py-1.5"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateMeal}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded-xl shadow-sm transition-all"
                  >
                    צור ושייך לשף
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDeleteGuest}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2.5 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
          >
            <Trash2 size={16} />
            <span>מחק אורח</span>
          </button>

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
              onClick={handleSaveGuest}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>שמור שינויים</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
