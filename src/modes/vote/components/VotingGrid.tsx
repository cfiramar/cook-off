import { useState, useEffect } from 'react';
import { collection, doc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import type { Guest, Meal, Vote, EventInfo } from '../../../hooks/useFirebaseData';
import { usePopup } from '../../../components/ui/PopupProvider';
import { Info, Clock, ArrowRight } from 'lucide-react';

interface Props {
  guest: Guest;
  meals: Meal[];
  existingVotes: Vote[];
  eventId: string;
  onLogout: () => void;
  eventInfo?: EventInfo | null;
}


export default function VotingGrid({ guest, meals, existingVotes, eventId, onLogout, eventInfo }: Props) {
  const [firstPlace, setFirstPlace] = useState<string | null>(null);
  const [secondPlace, setSecondPlace] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMeal, setInfoMeal] = useState<Meal | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const { showAlert } = usePopup();

  // Check if voting is open, including 2000ms grace period after timerEndTime
  const canCastVote = () => {
    if (!eventInfo) return false;
    if (eventInfo.timerStatus === 'running') {
      if (eventInfo.timerEndTime) {
        return Date.now() <= eventInfo.timerEndTime + 2000;
      }
      return true;
    }
    if (eventInfo.timerStatus === 'ended' && eventInfo.timerEndTime) {
      return Date.now() <= eventInfo.timerEndTime + 2000;
    }
    return false;
  };

  const isTimerRunning = eventInfo?.timerStatus === 'running';

  // Live timer countdown
  useEffect(() => {
    if (eventInfo?.timerStatus === 'running' && eventInfo.timerEndTime) {
      const updateTimer = () => {
        const remaining = Math.max(0, eventInfo.timerEndTime! - Date.now());
        setTimerRemaining(remaining);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setTimerRemaining(null);
    }
  }, [eventInfo?.timerStatus, eventInfo?.timerEndTime]);

  const formatTimer = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Close info modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInfoMeal(null);
      }
    };
    if (infoMeal) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [infoMeal]);

  // Initialize from existing votes
  useEffect(() => {
    let first: string | null = null;
    let second: string | null = null;
    existingVotes.forEach(v => {
      if (v.guestId === guest.id) {
        const targetMeal = meals.find(m => m.id === v.mealId);
        if (targetMeal && !targetMeal.isNonParticipating) {
          if (v.points === 3) first = v.mealId;
          if (v.points === 2) second = v.mealId;
        }
      }
    });
    setFirstPlace(first);
    setSecondPlace(second);
  }, [existingVotes, guest.id, meals]);

  const syncVotes = async (newFirst: string | null, newSecond: string | null) => {
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);

      // 1. Delete all existing votes for this guest in this event
      const q = query(collection(db, 'events', eventId, 'votes'), where('guestId', '==', guest.id));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((document) => {
        batch.delete(document.ref);
      });

      // 2. Add new votes
      if (newFirst) {
        const newVoteRef = doc(collection(db, 'events', eventId, 'votes'));
        batch.set(newVoteRef, {
          guestId: guest.id,
          mealId: newFirst,
          points: 3
        });
      }

      if (newSecond) {
        const newVoteRef = doc(collection(db, 'events', eventId, 'votes'));
        batch.set(newVoteRef, {
          guestId: guest.id,
          mealId: newSecond,
          points: 2
        });
      }

      // 3. Update guest status
      const selectedCount = (newFirst ? 1 : 0) + (newSecond ? 1 : 0);
      const isDone = selectedCount >= 2;
      const guestRef = doc(db, 'events', eventId, 'guests', guest.id);
      batch.update(guestRef, {
        status: isDone ? 'done' : 'voting'
      });

      await batch.commit();
    } catch (error) {
      console.error("Error submitting votes: ", error);
      showAlert('שגיאה בשליחת ההצבעה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMealClick = (mealId: string) => {
    if (isSubmitting) return; // Prevent spam clicks while syncing
    if (!canCastVote()) return;

    const clickedMeal = meals.find(m => m.id === mealId);
    if (clickedMeal?.isNonParticipating) {
      showAlert('מנה זו אינה משתתפת בתחרות ולא ניתן להצביע עבורה.');
      return;
    }

    let newFirst = firstPlace;
    let newSecond = secondPlace;

    if (firstPlace === mealId) {
      // Unselect first place -> promote second place
      newFirst = secondPlace;
      newSecond = null;
    } else if (secondPlace === mealId) {
      // Unselect second place
      newSecond = null;
    } else if (!firstPlace) {
      // Select as first place
      newFirst = mealId;
    } else if (!secondPlace) {
      // Select as second place
      newSecond = mealId;
    } else {
      // Both places are already selected
      showAlert('ניתן לבחור עד 2 מנות בלבד (מקום ראשון ושני). כדי לשנות בחירה, בטל תחילה אחת מהמנות שנבחרו.');
      return;
    }

    setFirstPlace(newFirst);
    setSecondPlace(newSecond);
    syncVotes(newFirst, newSecond);
  };

  const selectedCount = (firstPlace ? 1 : 0) + (secondPlace ? 1 : 0);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden relative">
      {/* Header */}
      <div className="shrink-0 p-4 bg-black/85 backdrop-blur-md border-b border-gray-800 flex justify-between items-center z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-theme-primary flex items-center justify-center text-theme-bg font-bold text-xl">
            {guest.name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg">{guest.name}</span>
            <button onClick={onLogout} className="text-xs text-gray-400 hover:text-white text-right underline opacity-80">
              החלף משתמש
            </button>
          </div>
        </div>
        <div className="flex flex-col items-end text-left">
          {isTimerRunning && timerRemaining !== null ? (
            <div className={`flex items-center gap-1.5 text-xs sm:text-sm font-black mb-0.5 ${timerRemaining <= 30000 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
              <Clock size={13} className="shrink-0" />
              <span className="font-mono tracking-wider">{formatTimer(timerRemaining)}</span>
            </div>
          ) : eventInfo?.timerStatus === 'ended' ? (
            <span className="text-[11px] text-gray-400 font-semibold mb-0.5">ההצבעה הסתיימה</span>
          ) : (
            <span className="text-[11px] text-gray-400 font-semibold mb-0.5">ממתין להפעלת הצבעה</span>
          )}
          <div className="text-xs sm:text-sm font-bold text-theme-primary">
            {isSubmitting
              ? 'שומר...'
              : selectedCount === 2
                ? 'נבחרו 2 מתוך 2 מנות ✓'
                : selectedCount === 1
                  ? 'נבחרה מנה 1 מתוך 2'
                  : 'בחר 2 מנות'}
          </div>
        </div>
      </div>

      {/* Content Area: Single Meal Details on Regular Background OR All Dishes Grid */}
      {infoMeal ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-3.5 sm:p-4 space-y-3 animate-fadeIn select-none" dir="rtl">
          {/* Top navigation row: Back button */}
          <div className="flex items-center justify-start shrink-0">
            <button
              type="button"
              onClick={() => setInfoMeal(null)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-bold transition-all active:scale-95 shadow-md cursor-pointer"
            >
              <ArrowRight size={16} />
              <span>חזרה לכל המנות</span>
            </button>
          </div>

          {/* Meal Image on Regular Background (No black box behind) */}
          <div className="w-full relative flex items-center justify-center shrink-0 max-h-[36vh] sm:max-h-[40vh] overflow-hidden">
            <img
              src={infoMeal.lowResImageUrl || infoMeal.imageUrl}
              alt={infoMeal.name}
              decoding="async"
              className="w-full h-full max-h-[36vh] sm:max-h-[40vh] object-contain rounded-2xl drop-shadow-[0_10px_25px_rgba(0,0,0,0.85)]"
            />

            {infoMeal.isNonParticipating && (
              <div className="absolute top-2.5 right-2.5 bg-amber-500 text-black font-black text-xs px-3 py-1.5 rounded-full shadow-lg z-20 flex items-center gap-1.5 border border-amber-300">
                <span>מחוץ לתחרות</span>
              </div>
            )}
          </div>

          {/* Meal Details Card (Glassmorphic subtle container on regular background) */}
          <div className="flex-1 min-h-0 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col overflow-hidden">
            <h2 className="text-xl sm:text-2xl font-black text-white mb-2 drop-shadow-md shrink-0 leading-tight">
              {infoMeal.name}
            </h2>

            {/* Scrollable Description only */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain text-gray-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap pr-1">
              {infoMeal.description?.trim() ? (
                infoMeal.description
              ) : (
                <p className="text-gray-400 italic text-sm">אין תיאור נוסף למנה זו.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain">
          {meals.map(meal => {
            const isMyMeal = (meal.chefIds && meal.chefIds.includes(guest.id)) ||
              (guest.householdId && meal.householdChefIds && meal.householdChefIds.includes(guest.householdId));
            const isNonParticipating = !!meal.isNonParticipating;
            const isVotable = !isMyMeal && !isNonParticipating;
            const isFirst = firstPlace === meal.id;
            const isSecond = secondPlace === meal.id;

            return (
              <div
                key={meal.id}
                className={`card relative overflow-hidden transition-all duration-300 ${isFirst
                    ? 'ring-4 ring-amber-400 border-amber-400 scale-[1.02]'
                    : isSecond
                      ? 'ring-4 ring-slate-300 border-slate-300 scale-[1.02]'
                      : ''
                  } ${!isTimerRunning ? 'cursor-pointer hover:scale-[1.01]' : !isVotable ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:scale-[1.01]'}`}
                onClick={() => {
                  if (!canCastVote()) {
                    // Voter can log in and see meals any time, but if voting is not active,
                    // clicking on a meal opens the info card instead of voting.
                    setInfoMeal(meal);
                    return;
                  }

                  if (isNonParticipating) {
                    showAlert('מנה זו אינה משתתפת בתחרות ולא ניתן להצביע עבורה.');
                    return;
                  }
                  if (!isMyMeal) handleMealClick(meal.id);
                }}
              >
                <div className="relative w-full h-40 bg-zinc-800 overflow-hidden">
                  <img
                    src={meal.lowResImageUrl || meal.imageUrl}
                    alt={meal.name}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-40 object-cover ${!isVotable ? 'opacity-40 grayscale' : 'opacity-80'}`}
                  />
                </div>

                {/* Info "i" button on top-left */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoMeal(meal);
                  }}
                  className="absolute top-2.5 left-2.5 z-20 w-8 h-8 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-md cursor-pointer"
                  title="מידע על המנה"
                  aria-label={`מידע על ${meal.name}`}
                >
                  <Info size={17} />
                </button>

                {/* Badge for Non-participating */}
                {isNonParticipating && (
                  <div className="absolute top-2.5 right-2.5 bg-amber-500 text-black font-black text-xs px-3 py-1 rounded-full shadow-lg z-10 flex items-center gap-1.5 border border-amber-300">
                    <span>מחוץ לתחרות</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent p-4 flex flex-col justify-end pointer-events-none">
                  <h3 className="font-bold text-xl drop-shadow-md text-white">{meal.name}</h3>
                  {isMyMeal && (
                    <p className="text-red-400 font-bold text-sm bg-black/70 inline-block px-2 py-0.5 rounded w-fit mt-1">
                      המנה שלך (לא ניתן להצביע)
                    </p>
                  )}
                  {!isMyMeal && isNonParticipating && (
                    <p className="text-amber-300 font-bold text-xs bg-black/70 inline-block px-2 py-0.5 rounded w-fit mt-1">
                      מנה זו לא משתתפת בתחרות
                    </p>
                  )}
                </div>

                {isVotable && isFirst && (
                  <img src="/medal_1st.png" alt="מקום 1" className="absolute top-2 right-2 w-20 h-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] z-10" />
                )}

                {isVotable && isSecond && (
                  <img src="/medal_2nd.png" alt="מקום 2" className="absolute top-2 right-2 w-20 h-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] z-10" />
                )}
              </div>
            );
          })}
          {/* Padding for scroll */}
          <div className="h-12"></div>
        </div>
      )}
    </div>
  );
}
