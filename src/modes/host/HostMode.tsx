import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useFirebaseData, useAllEvents, type Meal, type Guest, type Vote } from '../../hooks/useFirebaseData';
import { doc, updateDoc, writeBatch, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Play,
  Square,
  Clock,
  Users,
  Trophy,
  RotateCcw,
  Copy,
  Share2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Minus,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Search,
  ChevronRight,
  Flame,
  ChefHat,
  Sliders,
  Eye,
  EyeOff,
  ArrowLeftRight,
  ArrowLeft,
  Calendar,
  Fingerprint,
  Sun,
  Moon,
  KeyRound,
  RefreshCw,
  Edit3,
  Trash2,
  UserPlus,
  UtensilsCrossed,
  X
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePopup } from '../../components/ui/PopupProvider';
import PinPad from '../../components/ui/PinPad';
import { getOrderedChefNamesForMeal } from '../../utils/mealChefOrder';
import { DeviceBiometricService } from '../../utils/deviceBiometricsAuth';
import AppUpdateModal, { APP_CURRENT_VERSION } from '../../components/ui/AppUpdateModal';

type TabType = 'cockpit' | 'voters' | 'results' | 'tools';
type VoterFilterType = 'all' | 'pending' | 'done';

export interface ShowStageDef {
  id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
  name: string;
  sub: string;
  icon: string;
  isAutomatic?: boolean;
}

export const SHOW_STAGES: ShowStageDef[] = [
  { id: 'A', name: 'גלריית מנות', sub: 'הצגת מנות ללא טיימר', icon: '🖼️' },
  { id: 'B', name: 'הצבעה פעילה וטיימר', sub: 'טיימר הצבעה רץ + גלריה', icon: '⏱️' },
  { id: 'C', name: 'ספירה לאחור', sub: '10 שניות אחרונות (אוטומטי)', icon: '⚡', isAutomatic: true },
  { id: 'D', name: 'סיום הזמן', sub: 'זמן ההצבעה הסתיים (אוטומטי)', icon: '🛑', isAutomatic: true },
  { id: 'E', name: 'סמל ומשפטי אווירה', sub: 'סמל 3D ליצירת מתח', icon: '✨' },
  { id: 'F', name: 'פתיחת מסך תוצאות', sub: 'הכרזה רשמית ופתיחת התוצאות', icon: '📜' },
  { id: 'G', name: 'חשיפת מקום שלישי', sub: 'חשיפת מקום 3 בטלוויזיה', icon: '🥉' },
  { id: 'H', name: 'חשיפת מקום שני', sub: 'חשיפת מקום 2 בטלוויזיה', icon: '🥈' },
  { id: 'I', name: 'הכרזת המנצח (מקום 1)', sub: 'מקום 1 + חגיגת קונפטי', icon: '🥇' },
  { id: 'J', name: 'רקע אווירה וסיום', sub: 'רקע חגיגי / סיום המופע', icon: '🌌' },
];

/**
 * Event selection screen for the host when no specific event is selected,
 * or when the host chooses to switch events.
 */
function HostEventSelector({ isDarkMode, onToggleTheme }: { isDarkMode: boolean; onToggleTheme: () => void }) {
  const { events, loading, error } = useAllEvents();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'לא נקבע תאריך';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].substring(2)}`;
    return dateStr;
  };

  const filtered = events.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (e.title || '').toLowerCase().includes(q) || (e.subtitle || '').toLowerCase().includes(q);
  });

  return (
    <div className={`flex-1 flex flex-col w-full min-h-screen relative font-sans p-4 max-w-lg mx-auto select-none transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}>
      {/* Ambient background glows */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[40%] rounded-full blur-[100px] pointer-events-none ${isDarkMode ? 'bg-blue-600/15' : 'bg-blue-400/20'
        }`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[40%] rounded-full blur-[100px] pointer-events-none ${isDarkMode ? 'bg-emerald-600/15' : 'bg-emerald-400/20'
        }`} />

      {/* Top action row */}
      <div className="flex justify-between items-center z-10 pt-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <ChefHat size={18} />
          </div>
          <span className="font-extrabold text-sm tracking-wide">Cook-Off Host</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsUpdateModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all transform hover:scale-105 active:scale-95 cursor-pointer ${isDarkMode
              ? 'bg-slate-900 border-slate-800 text-slate-200 hover:text-white hover:border-slate-700'
              : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 shadow-xs'
              }`}
            title="עדכון אפליקציה"
          >
            <RefreshCw size={14} className="text-blue-500 animate-pulse" />
            <span>עדכן אפליקציה</span>
          </button>

          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-xl border transition-colors ${isDarkMode
              ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs'
              }`}
            title={isDarkMode ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      <div className="text-center my-6 z-10">
        <h1 className="text-3xl font-black tracking-tight mb-1">פאנל שליטה למארח</h1>
        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          בחר את האירוע שברצונך לנהל
        </p>
      </div>

      <div className="relative mb-5 z-10">
        <Search size={16} className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש אירוע לפי שם..."
          className={`w-full rounded-2xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isDarkMode
            ? 'bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 shadow-inner'
            : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400 shadow-xs'
            }`}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            נקה
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-sm z-10">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>טוען רשימת אירועים...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center text-red-500 text-sm z-10">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className={`p-8 text-center rounded-3xl border text-sm space-y-3 z-10 ${isDarkMode ? 'bg-slate-900/50 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500 shadow-sm'
          }`}>
          <p>לא נמצאו אירועים זמינים.</p>
          <button
            onClick={() => navigate('/planning')}
            className="inline-block py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            פתח לוח תכנון אירועים
          </button>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto pb-8 z-10">
          {filtered.map(evt => (
            <div
              key={evt.id}
              onClick={() => navigate(`/host/${evt.id}`)}
              className={`rounded-3xl p-4.5 border transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.98] group ${isDarkMode
                ? 'bg-slate-900/80 hover:bg-slate-850 border-slate-800 hover:border-blue-500/40 shadow-lg'
                : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-blue-300 shadow-xs hover:shadow-sm'
                }`}
            >
              <div className="overflow-hidden">
                <h3 className="font-extrabold text-base leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                  {evt.title}
                </h3>
                <div className={`flex items-center gap-2 text-xs mt-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Calendar size={13} className="text-blue-500" />
                  <span>{formatDate(evt.date)}</span>
                </div>
                {evt.subtitle && (
                  <p className={`text-xs mt-1 line-clamp-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {evt.subtitle}
                  </p>
                )}
              </div>

              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${isDarkMode
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:bg-blue-500/20'
                : 'bg-blue-50 text-blue-600 border border-blue-100 group-hover:bg-blue-100'
                }`}>
                <ChevronRight size={18} className="rotate-180" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* App Update Modal */}
      <AppUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        title="עדכון אפליקציית המארח"
        currentVersion={APP_CURRENT_VERSION}
        apkDownloadUrl="https://github.com/cfiramar/cook-off/releases/latest/download/CookOff-Host-Mobile.apk"
        apkName="CookOff-Host-Mobile.apk"
        apkTitle="הורדת קובץ התקנה"
        apkDescription="מוריד את קובץ העדכון למכשיר."
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

export default function HostMode() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  // Neutral Theme state (Light / Dark mode toggle)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('host_theme_mode');
    return saved === 'dark';
  });

  const toggleThemeMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('host_theme_mode', next ? 'dark' : 'light');
      return next;
    });
  };

  // If no eventId is in the URL, render the Event Selection screen
  if (!eventId) {
    return <HostEventSelector isDarkMode={isDarkMode} onToggleTheme={toggleThemeMode} />;
  }

  return <HostModeWithEvent eventId={eventId} navigate={navigate} isDarkMode={isDarkMode} onToggleTheme={toggleThemeMode} />;
}

function HostModeWithEvent({
  eventId,
  navigate,
  isDarkMode,
  onToggleTheme
}: {
  eventId: string;
  navigate: ReturnType<typeof useNavigate>;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}) {
  const { eventInfo, guests, meals, votes, loading, error } = useFirebaseData(eventId);

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem(`host_authed_${eventId}`) === 'true';
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showPinFallback, setShowPinFallback] = useState(false);
  const [pin, setPin] = useState('');
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Navigation & View states
  const [currentTab, setCurrentTab] = useState<TabType>('cockpit');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Modals for Participants, Meals and Results
  const [isAddVoterModalOpen, setIsAddVoterModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [isManageMealsModalOpen, setIsManageMealsModalOpen] = useState(false);
  const [selectedMealForVotes, setSelectedMealForVotes] = useState<(Meal & { score: number; chefs: string[]; votesCount: number }) | null>(null);

  // Timer states
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Voters tab states
  const [voterFilter, setVoterFilter] = useState<VoterFilterType>('all');
  const [voterSearch, setVoterSearch] = useState('');

  const { showAlert, showSuccess, showConfirm } = usePopup();



  // Pure Native Device Authentication (Fingerprint / FaceID / Device Lock)
  const handleDeviceAuth = useCallback(async (resetKey: boolean = false) => {
    if (resetKey) {
      DeviceBiometricService.clearStoredCredential();
    }
    setIsAuthenticating(true);
    setAuthError(null);
    const res = await DeviceBiometricService.authenticate();
    setIsAuthenticating(false);
    if (res.success) {
      setIsAuthenticated(true);
      sessionStorage.setItem(`host_authed_${eventId}`, 'true');
    } else {
      setAuthError(res.error || 'האימות נכשל');
    }
  }, [eventId]);

  const [isPinError, setIsPinError] = useState(false);

  // Fallback PIN Handler
  const handlePinComplete = (completedPin: string) => {
    if (!eventInfo) return;
    if (completedPin === eventInfo.hostPin) {
      setIsAuthenticated(true);
      sessionStorage.setItem(`host_authed_${eventId}`, 'true');
    } else {
      setIsPinError(true);
      showAlert('קוד PIN שגוי');
      setTimeout(() => {
        setPin('');
        setIsPinError(false);
      }, 550);
    }
  };

  // Timer synchronization effect
  useEffect(() => {
    if (!eventInfo) return;

    let interval: ReturnType<typeof setInterval>;
    if (eventInfo.timerStatus === 'running' && eventInfo.timerEndTime) {
      interval = setInterval(() => {
        const remaining = Math.max(0, eventInfo.timerEndTime! - Date.now());
        setTimeRemaining(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
          handleStopTimer();
        }
      }, 1000);
    } else {
      setTimeRemaining(null);
    }

    return () => clearInterval(interval);
  }, [eventInfo?.timerStatus, eventInfo?.timerEndTime]);

  // Back button handling for full-screen modals
  useEffect(() => {
    const handlePopState = () => {
      setIsResetConfirmOpen(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Timer actions
  const handleStartTimer = async () => {
    if (!eventInfo || !eventId) return;
    const duration = timerMinutes * 60 * 1000;
    const endTime = Date.now() + duration;
    try {
      await updateDoc(doc(db, 'events', eventId), {
        timerStatus: 'running',
        timerEndTime: endTime,
        timerDuration: duration,
        showStage: 'B'
      });
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בהפעלת הטיימר');
    }
  };

  // Note: if user wants to end the timer, go to the 10 seconds countdown (Stage C) instead of ending right away
  const handleStopTimer = async () => {
    if (!eventInfo || !eventId) return;
    try {
      await handleSetStage('C');
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בעצירת הטיימר');
    }
  };

  const handleExtendTimer = async (minutes: number) => {
    if (!eventInfo || eventInfo.timerStatus !== 'running' || !eventInfo.timerEndTime || !eventId) return;
    const additionalMs = minutes * 60 * 1000;
    const currentDuration = eventInfo.timerDuration || Math.max(0, eventInfo.timerEndTime - Date.now());
    try {
      await updateDoc(doc(db, 'events', eventId), {
        timerEndTime: eventInfo.timerEndTime + additionalMs,
        timerDuration: currentDuration + additionalMs
      });
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בהארכת הזמן');
    }
  };

  // TV Meals Carousel Toggle (Independent of Timer)
  const handleToggleMealsCarousel = async () => {
    if (!eventInfo || !eventId) return;
    const nextState = eventInfo.showMealsCarousel !== false ? false : true;
    try {
      await updateDoc(doc(db, 'events', eventId), {
        showMealsCarousel: nextState
      });
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בעדכון הגדרת גלריית המנות');
    }
  };

  // Show Stage computation (A to J)
  const getCurrentStageId = (): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' => {
    if (!eventInfo) return 'A';
    if (eventInfo.revealState === 'background' || eventInfo.showStage === 'J') return 'J';
    if (eventInfo.revealState === '1st' || eventInfo.showStage === 'I') return 'I';
    if (eventInfo.revealState === '2nd' || eventInfo.showStage === 'H') return 'H';
    if (eventInfo.revealState === '3rd' || eventInfo.showStage === 'G') return 'G';
    if (eventInfo.revealState === 'results' || eventInfo.showStage === 'F') return 'F';
    if (eventInfo.revealState === 'emblem' || eventInfo.showStage === 'E') return 'E';

    // Automatic dramatic countdown on last 10s of running timer
    if (eventInfo.timerStatus === 'running' && timeRemaining !== null && timeRemaining <= 10000 && timeRemaining > 0) {
      return 'C';
    }

    if (eventInfo.showStage === 'D') return 'D';
    if (eventInfo.showStage === 'C') return 'C';
    if (eventInfo.showStage === 'B') return 'B';

    if (eventInfo.timerStatus === 'running') {
      return 'B';
    }

    if (eventInfo.timerStatus === 'ended') {
      if (eventInfo.showMealsCarousel === true) return 'A';
      return 'E';
    }

    if (eventInfo.showStage) return eventInfo.showStage;

    return 'A';
  };

  const handleSetStage = async (stageId: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J') => {
    if (!eventId || !eventInfo) return;
    try {
      const updatePayload: Record<string, any> = {
        showStage: stageId,
      };

      switch (stageId) {
        case 'A':
          updatePayload.revealState = 'none';
          updatePayload.showMealsCarousel = true;
          if (eventInfo.timerStatus === 'running') {
            updatePayload.timerStatus = 'idle';
            updatePayload.timerEndTime = null;
          }
          break;

        case 'B':
          updatePayload.revealState = 'none';
          updatePayload.showMealsCarousel = true;
          // Do not start timer automatically. Host sets and starts it explicitly.
          break;

        case 'C':
          updatePayload.revealState = 'none';
          updatePayload.showMealsCarousel = false;
          updatePayload.timerStatus = 'running';
          updatePayload.timerEndTime = Date.now() + 10000;
          break;

        case 'D':
          updatePayload.revealState = 'none';
          updatePayload.timerStatus = 'ended';
          updatePayload.timerEndTime = Date.now();
          updatePayload.showMealsCarousel = false;
          break;

        case 'E':
          updatePayload.revealState = 'emblem';
          updatePayload.showMealsCarousel = false;
          if (eventInfo.timerStatus === 'running') {
            updatePayload.timerStatus = 'ended';
          }
          break;

        case 'F':
          updatePayload.revealState = 'results';
          updatePayload.showMealsCarousel = false;
          break;

        case 'G':
          updatePayload.revealState = '3rd';
          updatePayload.showMealsCarousel = false;
          break;

        case 'H':
          updatePayload.revealState = '2nd';
          updatePayload.showMealsCarousel = false;
          break;

        case 'I':
          updatePayload.revealState = '1st';
          updatePayload.showMealsCarousel = false;
          break;

        case 'J':
          updatePayload.revealState = 'background';
          updatePayload.showMealsCarousel = false;
          break;
      }

      await updateDoc(doc(db, 'events', eventId), updatePayload);
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בעדכון שלב התחרות');
    }
  };

  const getNextStageId = (current: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | null => {
    switch (current) {
      case 'A': return 'B';
      case 'B': return eventInfo?.timerStatus === 'running' ? 'C' : 'E';
      case 'C': return 'E';
      case 'D': return 'E';
      case 'E': return 'F';
      case 'F': return 'G';
      case 'G': return 'H';
      case 'H': return 'I';
      case 'I': return 'J';
      case 'J': return null;
    }
  };

  const getPrevStageId = (current: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | null => {
    switch (current) {
      case 'A': return null;
      case 'B': return 'A';
      case 'C': return 'B';
      case 'D': return 'B';
      case 'E': return 'B';
      case 'F': return 'E';
      case 'G': return 'F';
      case 'H': return 'G';
      case 'I': return 'H';
      case 'J': return 'I';
    }
  };

  // Event Reset Action
  const handleReset = async () => {
    if (!eventId) return;
    try {
      const batch = writeBatch(db);

      const votesRef = collection(db, 'events', eventId, 'votes');
      const votesSnapshot = await getDocs(votesRef);
      votesSnapshot.forEach((voteDoc) => {
        batch.delete(voteDoc.ref);
      });

      const guestsRef = collection(db, 'events', eventId, 'guests');
      const guestsSnapshot = await getDocs(guestsRef);
      guestsSnapshot.forEach((guestDoc) => {
        batch.update(guestDoc.ref, { status: 'not_logged_in' });
      });

      const eventRef = doc(db, 'events', eventId);
      batch.update(eventRef, {
        timerStatus: 'idle',
        timerEndTime: null,
        revealState: 'none'
      });

      await batch.commit();
      setIsResetConfirmOpen(false);
      showSuccess('האירוע אופס בהצלחה!');
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בעת איפוס האירוע');
    }
  };

  // Find which meal a guest is linked to as a chef (accounting for direct chefIds, householdChefIds, and out-of-contest meals)
  const getGuestLinkedMeal = (guest: Guest): Meal | undefined => {
    return meals.find(
      (m) =>
        (m.chefIds && m.chefIds.includes(guest.id)) ||
        (guest.householdId && m.householdChefIds && m.householdChefIds.includes(guest.householdId))
    );
  };

  // Add new guest
  const handleAddGuest = async (name: string, pin: string, householdName?: string, targetMealId?: string) => {
    if (!eventId || !name.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'events', eventId, 'guests'), {
        name: name.trim(),
        pin: pin.trim() || Math.floor(1000 + Math.random() * 9000).toString(),
        status: 'not_logged_in',
        rsvpStatus: 'coming',
        canVote: true,
        householdId: `hh_${Date.now()}`,
        householdName: householdName?.trim() || name.trim(),
        createdAt: Date.now()
      });

      if (targetMealId) {
        const targetMeal = meals.find((m) => m.id === targetMealId);
        if (targetMeal) {
          const nextChefs = Array.from(new Set([...(targetMeal.chefIds || []), docRef.id]));
          await updateDoc(doc(db, 'events', eventId, 'meals', targetMealId), {
            chefIds: nextChefs
          });
        }
      }

      showSuccess(`המשתתף "${name}" נוסף בהצלחה!`);
      setIsAddVoterModalOpen(false);
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בהוספת המשתתף');
    }
  };

  // Update guest details (Name, PIN, linked meal)
  const handleUpdateGuest = async (guestId: string, newName: string, newPin: string, targetMealId?: string | null) => {
    if (!eventId) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'events', eventId, 'guests', guestId), {
        name: newName.trim(),
        pin: newPin.trim()
      });

      if (targetMealId !== undefined) {
        // Remove guest from any other meals
        meals.forEach((m) => {
          if (m.chefIds && m.chefIds.includes(guestId) && m.id !== targetMealId) {
            batch.update(doc(db, 'events', eventId, 'meals', m.id), {
              chefIds: m.chefIds.filter((id) => id !== guestId)
            });
          }
        });
        // Add to target meal
        if (targetMealId) {
          const targetMeal = meals.find((m) => m.id === targetMealId);
          if (targetMeal) {
            const nextChefs = Array.from(new Set([...(targetMeal.chefIds || []), guestId]));
            batch.update(doc(db, 'events', eventId, 'meals', targetMealId), {
              chefIds: nextChefs
            });
          }
        }
      }

      await batch.commit();
      showSuccess('פרטי המשתתף עודכנו בהצלחה!');
      setEditingGuest(null);
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בעדכון פרטי המשתתף');
    }
  };

  // Delete guest
  const handleDeleteGuest = async (guest: Guest) => {
    if (!eventId) return;
    showConfirm(
      `האם למחוק את המשתתף "${guest.name}"? כל שיוכיו יוסרו.`,
      async () => {
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'events', eventId, 'guests', guest.id));
          meals.forEach((m) => {
            if (m.chefIds && m.chefIds.includes(guest.id)) {
              batch.update(doc(db, 'events', eventId, 'meals', m.id), {
                chefIds: m.chefIds.filter((id) => id !== guest.id)
              });
            }
          });
          await batch.commit();
          showSuccess(`המשתתף "${guest.name}" נמחק`);
          setEditingGuest(null);
        } catch (err) {
          console.error(err);
          showAlert('שגיאה במחיקת המשתתף');
        }
      },
      'מחיקת משתתף'
    );
  };

  // Remove meal
  const handleRemoveMeal = async (meal: Meal) => {
    if (!eventId) return;
    showConfirm(
      `האם להסיר את המנה "${meal.name}"? המנה תוסר מיידית מהטלוויזיה וממסכי ההצבעה.`,
      async () => {
        try {
          await deleteDoc(doc(db, 'events', eventId, 'meals', meal.id));
          showSuccess(`המנה "${meal.name}" הוסרה בהצלחה`);
        } catch (err) {
          console.error(err);
          showAlert('שגיאה בהסרת המנה');
        }
      },
      'הסרת מנה מהתחרות'
    );
  };

  // Calculate accurate status derived from votes
  const getGuestStatus = (guest: { id: string; status: string }) => {
    const guestVotesCount = votes.filter(v => v.guestId === guest.id).length;
    if (guestVotesCount >= 2) return 'done';
    if (guestVotesCount === 1) return 'voting';
    return guest.status || 'not_logged_in';
  };

  const activeGuests = useMemo(() => {
    return guests.filter(g => g.rsvpStatus !== 'not_coming');
  }, [guests]);

  const totalGuests = activeGuests.length;
  const doneGuests = useMemo(() => {
    return activeGuests.filter(g => getGuestStatus(g) === 'done').length;
  }, [activeGuests, votes]);

  const votingGuests = useMemo(() => {
    return activeGuests.filter(g => getGuestStatus(g) === 'voting').length;
  }, [activeGuests, votes]);

  const pendingGuests = totalGuests - doneGuests;
  const progressPercent = totalGuests > 0 ? Math.round((doneGuests / totalGuests) * 100) : 0;

  // Filtered & sorted guests for the Voters tab
  const filteredGuests = useMemo(() => {
    return activeGuests
      .filter(g => {
        const status = getGuestStatus(g);
        if (voterFilter === 'done' && status !== 'done') return false;
        if (voterFilter === 'pending' && status === 'done') return false;
        if (voterSearch.trim()) {
          const q = voterSearch.toLowerCase().trim();
          const nameMatch = g.name.toLowerCase().includes(q);
          const hhMatch = g.householdName ? g.householdName.toLowerCase().includes(q) : false;
          return nameMatch || hhMatch;
        }
        return true;
      })
      .sort((a, b) => {
        const statusA = getGuestStatus(a);
        const statusB = getGuestStatus(b);
        const priority = (s: string) => (s === 'voting' ? 1 : s === 'not_logged_in' ? 2 : 3);
        if (priority(statusA) !== priority(statusB)) {
          return priority(statusA) - priority(statusB);
        }
        return a.name.localeCompare(b.name, 'he');
      });
  }, [activeGuests, voterFilter, voterSearch, votes]);

  // Grouped by household for clean, non-cluttered display without dead-space
  const householdGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; members: Guest[] }>();
    for (const guest of filteredGuests) {
      const hId = guest.householdId || `ind_${guest.id}`;
      const hName = guest.householdName?.trim() || guest.name;
      if (!map.has(hId)) {
        map.set(hId, { id: hId, name: hName, members: [] });
      }
      map.get(hId)!.members.push(guest);
    }
    return Array.from(map.values());
  }, [filteredGuests]);

  // Chef names resolver for meals: sorted by household name (a-z) and inner order
  const getChefNamesForMeal = (meal: Meal): string[] => {
    return getOrderedChefNamesForMeal(meal, guests);
  };

  // Meal Scores & Standings (Host confidential preview)
  const mealScores = useMemo(() => {
    return meals
      .filter(meal => !meal.isNonParticipating)
      .map(meal => {
        const mealVotes = votes.filter(v => v.mealId === meal.id);
        const score = mealVotes.reduce((sum, vote) => sum + vote.points, 0) + (meal.pointsAdjustment || 0);
        const chefs = getChefNamesForMeal(meal);
        return { ...meal, score, chefs, votesCount: mealVotes.length };
      })
      .sort((a, b) => b.score - a.score);
  }, [meals, votes, guests]);

  const top3 = mealScores.slice(0, 3);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const voterLink = `${window.location.origin}/${eventId}`;
  const tvLink = `${window.location.origin}/view/${eventId}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showSuccess(`${label} הועתק ללוח!`);
  };

  const shareViaWhatsApp = () => {
    const text = `היי כולם! היכנסו עכשיו להצביע למנות בתחרות הבישול:\n${voterLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center min-h-screen p-6 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'
        }`}>
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">טוען נתוני אירוע...</p>
      </div>
    );
  }

  if (error || !eventInfo) {
    return (
      <div className={`flex-1 flex flex-col justify-center items-center min-h-screen p-6 text-center ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
        }`}>
        <AlertTriangle size={52} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">{error || "אירוע לא נמצא"}</h2>
        <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          האירוע המבוקש אינו קיים במערכת
        </p>
        <button
          onClick={() => navigate('/host')}
          className="py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
        >
          <ArrowLeftRight size={16} />
          <span>בחירת אירוע אחר לניהול</span>
        </button>
      </div>
    );
  }

  // Pure Native Authentication Screen (Fingerprint / FaceID / Device Lock with PIN fallback)
  if (!isAuthenticated) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-6 w-full min-h-screen relative overflow-hidden select-none transition-colors ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
        }`}>
        {/* Ambient background glows */}
        <div className={`absolute top-[-15%] left-[-10%] w-[55%] h-[45%] rounded-full blur-[110px] pointer-events-none ${isDarkMode ? 'bg-blue-600/15' : 'bg-blue-400/25'
          }`} />
        <div className={`absolute bottom-[-15%] right-[-10%] w-[55%] h-[45%] rounded-full blur-[110px] pointer-events-none ${isDarkMode ? 'bg-purple-600/15' : 'bg-purple-400/25'
          }`} />

        <div className="relative z-10 flex flex-col items-center w-full max-w-[340px]">
          {/* Header icon */}
          <div className={`w-18 h-18 rounded-3xl flex items-center justify-center mb-5 shadow-lg border transition-all ${isDarkMode
            ? 'bg-slate-900 border-slate-800 text-blue-400 shadow-blue-950/40'
            : 'bg-white border-slate-200 text-blue-600 shadow-slate-200'
            }`}>
            <Fingerprint size={38} className="animate-pulse" />
          </div>

          <h1 className="text-3xl font-black text-center mb-1 tracking-tight">
            כניסת מארח
          </h1>
          <p className={`text-xs text-center mb-6 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {eventInfo.title} • אימות מכשיר מאובטח
          </p>

          {!showPinFallback ? (
            <div className="w-full space-y-4">
              <button
                onClick={() => handleDeviceAuth(false)}
                disabled={isAuthenticating}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-base flex items-center justify-center gap-3 shadow-lg shadow-blue-600/25 active:scale-95 transition-all disabled:opacity-50"
              >
                <Fingerprint size={22} />
                <span>{isAuthenticating ? 'ממתין לאישור המכשיר...' : 'אימות בטביעת אצבע / מכשיר'}</span>
              </button>

              {authError && (
                <div className="space-y-2">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs text-center font-medium">
                    {authError}
                  </div>
                  {DeviceBiometricService.hasStoredCredential() && (
                    <button
                      type="button"
                      onClick={() => handleDeviceAuth(true)}
                      className={`w-full text-center text-xs underline py-1 transition-colors ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                        }`}
                    >
                      איפוס מפתח ורישום מחדש בטביעת אצבע
                    </button>
                  )}
                </div>
              )}

              <div className="text-center pt-2">
                <button
                  onClick={() => setShowPinFallback(true)}
                  className={`text-xs flex items-center justify-center gap-1.5 mx-auto font-semibold transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <KeyRound size={14} />
                  <span>הזן קוד PIN של האירוע במקום</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <PinPad
                pin={pin}
                onPinChange={setPin}
                onComplete={handlePinComplete}
                isError={isPinError}
              />
              <div className="text-center pt-2">
                <button
                  onClick={() => setShowPinFallback(false)}
                  className={`text-xs flex items-center justify-center gap-1.5 mx-auto font-semibold transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <Fingerprint size={14} />
                  <span>חזרה לאימות בטביעת אצבע / מכשיר</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
            <button
              onClick={() => setIsUpdateModalOpen(true)}
              className={`text-xs flex items-center gap-1.5 py-2 px-3 rounded-xl border transition-colors cursor-pointer ${isDarkMode
                ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs'
                }`}
              title="עדכון אפליקציה"
            >
              <RefreshCw size={13} className="text-blue-500 animate-pulse" />
              <span>עדכן אפליקציה</span>
            </button>

            <button
              onClick={() => navigate('/host')}
              className={`text-xs flex items-center gap-1.5 py-2 px-3 rounded-xl border transition-colors cursor-pointer ${isDarkMode
                ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs'
                }`}
            >
              <ArrowLeftRight size={13} />
              <span>החלף אירוע</span>
            </button>

            <button
              onClick={onToggleTheme}
              className={`text-xs flex items-center gap-1.5 py-2 px-3 rounded-xl border transition-colors cursor-pointer ${isDarkMode
                ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs'
                }`}
            >
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
              <span>{isDarkMode ? 'מצב בהיר' : 'מצב כהה'}</span>
            </button>
          </div>
        </div>

        {/* App Update Modal */}
        <AppUpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          title="עדכון אפליקציית המארח"
          currentVersion={APP_CURRENT_VERSION}
          apkDownloadUrl="https://github.com/cfiramar/cook-off/releases/latest/download/CookOff-Host-Mobile.apk"
          apkName="CookOff-Host-Mobile.apk"
          apkTitle="הורדת קובץ התקנה למכשיר"
          apkDescription="מוריד את קובץ העדכון למכשיר."
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  // Active status badge description
  const currentStageId = getCurrentStageId();
  const currentStageDef = SHOW_STAGES.find((s) => s.id === currentStageId) || SHOW_STAGES[0];
  const isCarouselActive = eventInfo.showMealsCarousel !== false;

  return (
    <div className={`flex-1 flex flex-col w-full min-h-screen relative overflow-x-hidden font-sans select-none transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}>
      {/* Soft Ambient Background Glows */}
      <div className={`fixed top-[-10%] left-[-10%] w-[50%] h-[40%] rounded-full blur-[110px] pointer-events-none ${isDarkMode ? 'bg-blue-600/15' : 'bg-blue-400/20'
        }`} />
      <div className={`fixed bottom-[-10%] right-[-10%] w-[50%] h-[40%] rounded-full blur-[110px] pointer-events-none ${isDarkMode ? 'bg-emerald-600/15' : 'bg-emerald-400/20'
        }`} />

      {/* Main Container */}
      <div className="relative z-10 flex flex-col flex-1 w-full max-w-lg mx-auto pb-24">

        {/* --- STICKY MOBILE TOP BAR --- */}
        <header className={`sticky top-0 z-30 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between transition-colors ${isDarkMode ? 'bg-slate-950/85 border-slate-800' : 'bg-white/85 border-slate-200 shadow-xs'
          }`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
              <ChefHat size={20} />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-base font-extrabold truncate leading-tight">
                {eventInfo.title}
              </h1>
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>מארח מחובר</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Switch Event */}
            <button
              onClick={() => navigate('/host')}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors ${isDarkMode
                ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              title="החלף אירוע"
            >
              <ArrowLeftRight size={16} />
              <span className="hidden sm:inline">החלף אירוע</span>
            </button>

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={onToggleTheme}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${isDarkMode
                ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              title={isDarkMode ? 'מצב בהיר' : 'מצב כהה'}
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>



        {/* --- TAB CONTENT AREA --- */}
        <main className="flex-1 p-4 space-y-4 overflow-y-auto">

          {/* ==================================================== */}
          {/* TAB 1: COCKPIT (קונטרול מהיר)                        */}
          {/* ==================================================== */}
          {currentTab === 'cockpit' && (() => {
            const nextStageId = getNextStageId(currentStageId);
            const nextStageDef = nextStageId ? SHOW_STAGES.find((s) => s.id === nextStageId) : null;
            const prevStageId = getPrevStageId(currentStageId);
            const prevStageDef = prevStageId ? SHOW_STAGES.find((s) => s.id === prevStageId) : null;

            return (
              <div className="space-y-3.5 animate-in fade-in duration-200">
                {/* 1. COMPACT STAGE DIRECTOR HEADER */}
                <div className={`rounded-2xl p-4 border transition-all ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-xl shrink-0">{currentStageDef.icon}</span>
                      <div className="overflow-hidden">
                        <div className="text-[11px] font-bold text-slate-400">שלב נוכחי בטלוויזיה:</div>
                        <h2 className="text-base font-extrabold text-blue-600 dark:text-blue-400 truncate leading-tight">
                          {currentStageDef.name}
                        </h2>
                      </div>
                    </div>
                    {currentStageDef.isAutomatic && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-500/25 font-bold shrink-0">
                        אוטומטי ⚡
                      </span>
                    )}
                  </div>

                  {/* Primary Next Stage Action Button */}
                  {nextStageDef ? (
                    <button
                      onClick={() => handleSetStage(nextStageDef.id)}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <span>המשך לשלב הבא: {nextStageDef.name}</span>
                      <ArrowLeft size={16} />
                    </button>
                  ) : (
                    <div className="text-center py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      הגעת לשלב הסיום של האירוע ✓
                    </div>
                  )}

                  {prevStageDef && (
                    <button
                      onClick={() => handleSetStage(prevStageDef.id)}
                      className={`w-full mt-2 py-1.5 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${isDarkMode
                        ? 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      <ArrowRight size={13} />
                      <span>חזרה לשלב קודם: {prevStageDef.name}</span>
                    </button>
                  )}
                </div>

                {/* 2. STAGE SPECIFIC CONTROLS */}

                {/* STAGE A ACTIONS: Gallery Toggle + WhatsApp & Share */}
                {currentStageId === 'A' && (
                  <div className="space-y-2.5">
                    <div className={`rounded-2xl p-3.5 border flex items-center justify-between gap-3 ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {isCarouselActive ? <Eye size={18} className="text-emerald-500 shrink-0" /> : <EyeOff size={18} className="text-slate-400 shrink-0" />}
                        <div className="overflow-hidden">
                          <h3 className="font-bold text-sm truncate">גלריית מנות בטלוויזיה</h3>
                          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {isCarouselActive ? 'הגלריה רצה במסך' : 'הגלריה מוסתרת'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleToggleMealsCarousel}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer shrink-0 ${isCarouselActive
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                          : isDarkMode
                            ? 'bg-slate-800 text-slate-300 border-slate-700'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                      >
                        {isCarouselActive ? 'הסתר גלריה' : 'הצג גלריה'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={shareViaWhatsApp}
                        className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <Share2 size={15} />
                        <span>שליחה בוואטסאפ</span>
                      </button>
                      <button
                        onClick={() => copyToClipboard(voterLink, 'קישור ההצבעה')}
                        className={`py-2.5 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer ${isDarkMode
                          ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-white'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                          }`}
                      >
                        <Copy size={15} />
                        <span>העתק קישור</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STAGE B ACTIONS: Set/Start/Extend/Stop Timer + Live Pulse */}
                {currentStageId === 'B' && (
                  <div className="space-y-3">
                    {/* Timer Card */}
                    <div className={`rounded-2xl p-4 border relative overflow-hidden transition-all ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock size={18} className="text-blue-500" />
                          <span className="font-extrabold text-sm">טיימר הצבעה</span>
                        </div>

                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${eventInfo.timerStatus === 'running'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse'
                          : eventInfo.timerStatus === 'ended'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            : isDarkMode
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                          {eventInfo.timerStatus === 'running' ? 'פועל עכשיו' : eventInfo.timerStatus === 'ended' ? 'הסתיים' : 'ממתין להפעלה'}
                        </span>
                      </div>

                      {/* If timer running: countdown + extend + stop (to 10s countdown) */}
                      {eventInfo.timerStatus === 'running' ? (
                        <div className="flex flex-col items-center">
                          <span className={`text-5xl font-black font-mono tracking-tight drop-shadow-sm my-1 ${timeRemaining !== null && timeRemaining < 60000 ? 'text-red-500 animate-pulse' : 'text-blue-600 dark:text-blue-400'
                            }`}>
                            {timeRemaining !== null ? formatTime(timeRemaining) : '00:00'}
                          </span>

                          {/* Quick Extend Buttons */}
                          <div className="grid grid-cols-2 gap-2.5 w-full my-3">
                            <button
                              onClick={() => handleExtendTimer(1)}
                              className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer ${isDarkMode
                                ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-white'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                                }`}
                            >
                              <Plus size={14} className="text-blue-500" />
                              <span>דקה (+1)</span>
                            </button>
                            <button
                              onClick={() => handleExtendTimer(5)}
                              className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer ${isDarkMode
                                ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-white'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                                }`}
                            >
                              <Plus size={14} className="text-blue-500" />
                              <span>5 דקות (+5)</span>
                            </button>
                          </div>

                          {/* Stop Timer Button (starts 10s countdown) */}
                          <button
                            onClick={handleStopTimer}
                            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                          >
                            <Square size={14} fill="currentColor" />
                            <span>סיים טיימר (10 שניות לסיום)</span>
                          </button>
                        </div>
                      ) : (
                        /* Timer idle / ended: stepper + presets + start */
                        <div className="space-y-3">
                          <div className={`flex items-center justify-between rounded-xl p-2 border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                            }`}>
                            <button
                              onClick={() => setTimerMinutes((m) => Math.max(1, m - 1))}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-95 transition-all border cursor-pointer ${isDarkMode
                                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-xs'
                                }`}
                            >
                              <Minus size={18} />
                            </button>

                            <div className="flex flex-col items-center">
                              <span className="text-3xl font-black font-mono leading-none">{timerMinutes}</span>
                              <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>דקות</span>
                            </div>

                            <button
                              onClick={() => setTimerMinutes((m) => m + 1)}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-95 transition-all border cursor-pointer ${isDarkMode
                                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-xs'
                                }`}
                            >
                              <Plus size={18} />
                            </button>
                          </div>

                          <div className="grid grid-cols-4 gap-1.5">
                            {[3, 5, 10, 15].map((preset) => (
                              <button
                                key={preset}
                                onClick={() => setTimerMinutes(preset)}
                                className={`py-1.5 rounded-lg font-bold text-xs transition-all border cursor-pointer ${timerMinutes === preset
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : isDarkMode
                                    ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                              >
                                {preset} דק'
                              </button>
                            ))}
                          </div>

                          <button
                            onClick={handleStartTimer}
                            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
                          >
                            <Play size={18} fill="currentColor" />
                            <span>הפעל טיימר הצבעה</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Compact Live Voting Pulse */}
                    <div className={`rounded-2xl p-3.5 border ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-emerald-500" />
                          <span className="font-bold text-sm">התקדמות הצבעה</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {doneGuests} / {totalGuests} ({progressPercent}%)
                        </span>
                      </div>

                      <div className={`w-full h-2 rounded-full border overflow-hidden p-0.5 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-center text-xs">
                        <div>
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>סיימו: </span>
                          <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{doneGuests}</strong>
                        </div>
                        <div>
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>מצביעים: </span>
                          <strong className="text-amber-500 font-mono">{votingGuests}</strong>
                        </div>
                        <div>
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>ממתינים: </span>
                          <strong className={isDarkMode ? 'text-slate-300 font-mono' : 'text-slate-600 font-mono'}>{pendingGuests}</strong>
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp & Copy Link */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={shareViaWhatsApp}
                        className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <Share2 size={15} />
                        <span>שליחה בוואטסאפ</span>
                      </button>
                      <button
                        onClick={() => copyToClipboard(voterLink, 'קישור ההצבעה')}
                        className={`py-2.5 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer ${isDarkMode
                          ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-white'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                          }`}
                      >
                        <Copy size={15} />
                        <span>העתק קישור</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STAGE C & D: Automatic Stages (Clean compact banner) */}
                {(currentStageId === 'C' || currentStageId === 'D') && (
                  <div className={`rounded-2xl p-4 border flex items-center gap-3.5 ${isDarkMode ? 'bg-slate-900/80 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0 text-xl">
                      {currentStageDef.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">
                        {currentStageId === 'C' ? '10 שניות אחרונות לסיום ההצבעה' : 'זמן ההצבעה הסתיים (00:00)'}
                      </h3>
                      <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {currentStageId === 'C'
                          ? 'בטלוויזיה מוצג שעון ענק וספירה לאחור דרמטית עם רעד מסך.'
                          : 'בטלוויזיה מוצגת הודעת סיום הזמן. ההצבעות נסגרו.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* STAGE E: Emblem + Atmosphere */}
                {currentStageId === 'E' && (
                  <div className={`rounded-2xl p-4 border flex items-center gap-3.5 ${isDarkMode ? 'bg-slate-900/80 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 text-xl">
                      ✨
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">סמל התחרות ומשפטי אווירה</h3>
                      <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        סמל 3D ומשפטי אווירה מוצגים כעת בטלוויזיה ליצירת מתח וציפייה לתוצאות.
                      </p>
                    </div>
                  </div>
                )}

                {/* STAGE F: Opening Results */}
                {currentStageId === 'F' && (
                  <div className={`rounded-2xl p-4 border flex items-center gap-3.5 ${isDarkMode ? 'bg-slate-900/80 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0 text-xl">
                      📜
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">מסך פתיחת התוצאות</h3>
                      <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        הכרזה רשמית ופתיחת מסך התוצאות בטלוויזיה לקראת חשיפת הפודיום.
                      </p>
                    </div>
                  </div>
                )}

                {/* STAGE G: 3rd Place Reveal */}
                {currentStageId === 'G' && (
                  <div className={`rounded-2xl p-4 border flex items-center gap-3.5 ${isDarkMode ? 'bg-slate-900/80 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0 text-xl">
                      🥉
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-sm font-bold">חשיפת מקום שלישי</h3>
                      <p className={`text-xs mt-0.5 truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        מוצגת כעת: <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{top3[2]?.name || 'מנה'}</strong>
                        {top3[2]?.chefs.length ? ` (${top3[2].chefs.join(', ')})` : ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* STAGE H: 2nd Place Reveal */}
                {currentStageId === 'H' && (
                  <div className={`rounded-2xl p-4 border flex items-center gap-3.5 ${isDarkMode ? 'bg-slate-900/80 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0 text-xl">
                      🥈
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-sm font-bold">חשיפת מקום שני</h3>
                      <p className={`text-xs mt-0.5 truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        מוצגת כעת: <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{top3[1]?.name || 'מנה'}</strong>
                        {top3[1]?.chefs.length ? ` (${top3[1].chefs.join(', ')})` : ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* STAGE I: 1st Place Winner Announcement */}
                {currentStageId === 'I' && (
                  <div className={`rounded-2xl p-4 border flex items-center gap-3.5 ${isDarkMode ? 'bg-slate-900/80 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0 text-xl">
                      🥇
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-sm font-bold">הכרזת המנצח (מקום 1) 🎉</h3>
                      <p className={`text-xs mt-0.5 truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        המנצח הגדול: <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{top3[0]?.name || 'מנה'}</strong>
                        {top3[0]?.chefs.length ? ` (${top3[0].chefs.join(', ')})` : ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* STAGE J: Background & Wrap-Up */}
                {currentStageId === 'J' && (
                  <div className="space-y-2.5">
                    <div className={`rounded-2xl p-4 border flex items-center gap-3.5 ${isDarkMode ? 'bg-slate-900/80 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 text-xl">
                        🌌
                      </div>
                      <div>
                        <h3 className="text-sm font-bold">רקע אווירה וסיום המופע</h3>
                        <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          בטלוויזיה מוצגת תמונת רקע נקייה לסיום האירוע.
                        </p>
                      </div>
                    </div>

                    <div className={`rounded-2xl p-3.5 border flex items-center justify-between gap-3 ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {isCarouselActive ? <Eye size={18} className="text-emerald-500 shrink-0" /> : <EyeOff size={18} className="text-slate-400 shrink-0" />}
                        <div className="overflow-hidden">
                          <h3 className="font-bold text-sm truncate">גלריית מנות על רקע מוחשך</h3>
                          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {isCarouselActive ? 'הגלריה מוצגת מעל הרקע' : 'הרקע מוצג נקי'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleToggleMealsCarousel}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer shrink-0 ${isCarouselActive
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                          : isDarkMode
                            ? 'bg-slate-800 text-slate-300 border-slate-700'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                      >
                        {isCarouselActive ? 'הסתר גלריה' : 'הצג גלריה'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. NEAT TIME-LINE OF ALL STAGES AT END OF SCREEN */}
                <div className={`rounded-2xl p-4 border space-y-2.5 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-400">ציר זמן שלבי האירוע:</div>
                    <span className="text-[11px] text-slate-400">לחץ למעבר ישיר</span>
                  </div>

                  <div className="relative pr-1.5">
                    {/* Vertical Connecting Track Line in RTL */}
                    <div className={`absolute right-[19px] top-3 bottom-3 w-0.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />

                    <div className="space-y-1 relative">
                      {SHOW_STAGES.map((stage, idx) => {
                        const isCurrent = stage.id === currentStageDef.id;
                        const currentIdx = SHOW_STAGES.findIndex(s => s.id === currentStageDef.id);
                        const isCompleted = idx < currentIdx;
                        const isAuto = !!stage.isAutomatic;

                        return (
                          <button
                            key={stage.id}
                            onClick={() => handleSetStage(stage.id)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-right transition-all cursor-pointer ${
                              isCurrent
                                ? isDarkMode
                                  ? 'bg-blue-600/20 border border-blue-500/40 text-blue-300 shadow-xs font-bold'
                                  : 'bg-blue-50 border border-blue-200 text-blue-900 shadow-xs font-bold'
                                : isAuto
                                  ? isDarkMode
                                    ? 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/30 opacity-60'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 opacity-60'
                                  : isDarkMode
                                    ? 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                                    : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3 relative z-10 overflow-hidden">
                              {/* Step circle node */}
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold ${
                                isCurrent
                                  ? 'bg-blue-600 text-white ring-4 ring-blue-500/20'
                                  : isCompleted
                                    ? 'bg-emerald-500 text-white'
                                    : isAuto
                                      ? isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-500' : 'bg-slate-100 border border-slate-300 text-slate-400'
                                      : isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-slate-100 border border-slate-300 text-slate-600'
                              }`}>
                                {isCompleted ? '✓' : idx + 1}
                              </div>

                              <div className="flex items-center gap-1.5 overflow-hidden">
                                <span className="text-xs shrink-0">{stage.icon}</span>
                                <span className={`text-xs truncate ${isCurrent ? 'font-black' : isAuto ? 'font-normal italic' : 'font-semibold'}`}>
                                  {stage.name}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-mono mr-2">
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[10px] font-bold">
                                  כעת
                                </span>
                              )}
                              {isAuto && (
                                <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  (אוטומטי)
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ==================================================== */}
          {/* TAB 2: PARTICIPANTS & DISHES (משתתפים ומנות)        */}
          {/* ==================================================== */}
          {currentTab === 'voters' && (
            <div className="space-y-4 animate-in fade-in duration-200">

              {/* Header & Quick Actions */}
              <div className={`rounded-3xl p-5 border space-y-3.5 transition-all ${isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={20} className="text-emerald-500" />
                    <h2 className="font-extrabold text-lg">משתתפים ומנות</h2>
                  </div>
                  <span className="text-xs font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    {doneGuests} / {totalGuests} סיימו
                  </span>
                </div>

                {/* Primary Action Buttons: Add Voter & Manage Meals */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={() => setIsAddVoterModalOpen(true)}
                    className="py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    <UserPlus size={16} />
                    <span>+ הוסף משתתף חדש</span>
                  </button>

                  <button
                    onClick={() => setIsManageMealsModalOpen(true)}
                    className={`py-3 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer ${isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-750'
                      : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                      }`}
                  >
                    <UtensilsCrossed size={16} />
                    <span>ניהול והסרת מנות ({meals.length})</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative pt-1">
                  <Search size={16} className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    value={voterSearch}
                    onChange={(e) => setVoterSearch(e.target.value)}
                    placeholder="חיפוש לפי שם משתתף או משק בית..."
                    className={`w-full rounded-2xl pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isDarkMode
                      ? 'bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
                  />
                  {voterSearch && (
                    <button
                      onClick={() => setVoterSearch('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                    >
                      נקה
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setVoterFilter('all')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${voterFilter === 'all'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : isDarkMode
                        ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                  >
                    הכל ({activeGuests.length})
                  </button>
                  <button
                    onClick={() => setVoterFilter('pending')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${voterFilter === 'pending'
                      ? 'bg-amber-500 text-black border-amber-500 font-extrabold shadow-xs'
                      : isDarkMode
                        ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                  >
                    ממתינים ({pendingGuests})
                  </button>
                  <button
                    onClick={() => setVoterFilter('done')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${voterFilter === 'done'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : isDarkMode
                        ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                  >
                    סיימו ({doneGuests})
                  </button>
                </div>
              </div>

              {/* Grouped Household Cards List */}
              <div className="space-y-2">
                {householdGroups.map((hh) => {
                  const isMulti = hh.members.length > 1;

                  return (
                    <div
                      key={hh.id}
                      className={`rounded-2xl border overflow-hidden transition-all ${
                        isDarkMode
                          ? 'bg-slate-900/70 border-slate-800'
                          : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      {/* Slim household header when household has multiple members */}
                      {isMulti && (
                        <div
                          className={`px-3.5 py-1.5 flex items-center justify-between border-b text-xs font-bold ${
                            isDarkMode
                              ? 'bg-slate-800/40 border-slate-800 text-slate-300'
                              : 'bg-slate-50 border-slate-100 text-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">🏠</span>
                            <span>{hh.name}</span>
                          </div>
                          <span className="text-[11px] font-normal text-slate-400 font-mono">
                            {hh.members.length} משתתפים
                          </span>
                        </div>
                      )}

                      {/* Member rows */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {hh.members.map((guest) => {
                          const status = getGuestStatus(guest);
                          const linkedMeal = getGuestLinkedMeal(guest);

                          return (
                            <div
                              key={guest.id}
                              className="p-3 flex items-center justify-between gap-2.5 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                            >
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <div
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                                    status === 'done'
                                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                                      : status === 'voting'
                                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                                        : isDarkMode
                                          ? 'bg-slate-800 border-slate-700 text-slate-400'
                                          : 'bg-slate-100 border-slate-200 text-slate-500'
                                  }`}
                                >
                                  {status === 'done' ? (
                                    <CheckCircle2 size={16} />
                                  ) : status === 'voting' ? (
                                    <Flame size={16} className="animate-bounce" />
                                  ) : (
                                    <Clock size={16} />
                                  )}
                                </div>

                                <div className="overflow-hidden">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm leading-tight truncate">
                                      {guest.name}
                                    </span>
                                    {linkedMeal && (
                                      <span
                                        className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 cursor-help shrink-0"
                                        title={`מנה מקושרת: ${linkedMeal.name}${linkedMeal.isNonParticipating ? ' (מחוץ לתחרות)' : ''}`}
                                      >
                                        🍽️
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                                    <span className="flex items-center gap-1">
                                      <KeyRound size={11} className="text-amber-500 shrink-0" />
                                      <span>PIN: {guest.pin || '----'}</span>
                                    </span>
                                    {!isMulti && guest.householdName && guest.householdName !== guest.name && (
                                      <span className="truncate text-slate-400 font-sans">
                                        • {guest.householdName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Status & Edit Button */}
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                                    status === 'done'
                                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                      : status === 'voting'
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                        : isDarkMode
                                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                                          : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {status === 'done' ? 'הצביע' : status === 'voting' ? 'מצביע' : 'ממתין'}
                                </span>

                                <button
                                  onClick={() => setEditingGuest(guest)}
                                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                    isDarkMode
                                      ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-750'
                                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                                  }`}
                                  title="ערוך משתתף"
                                >
                                  <Edit3 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {filteredGuests.length === 0 && (
                  <div className={`text-center py-12 rounded-3xl border border-dashed p-6 ${isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500 shadow-xs'
                    }`}>
                    <Users size={36} className="mx-auto text-slate-400 mb-2 opacity-50" />
                    <p className="text-sm font-medium">לא נמצאו משתתפים תואמים לסינון</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: RESULTS (תוצאות מנות בלבד)                   */}
          {/* ==================================================== */}
          {currentTab === 'results' && (
            <div className="space-y-4 animate-in fade-in duration-200">

              {/* Standings Header */}
              <div className={`rounded-3xl p-5 border space-y-1.5 transition-all ${isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy size={22} className="text-amber-500" />
                    <h2 className="font-extrabold text-xl">תוצאות ודירוג מנות</h2>
                  </div>
                  <span className="text-xs font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full">
                    {mealScores.length} מנות
                  </span>
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  דירוג המנות לפי ניקוד ההצבעות. לחץ על מנה כדי לראות מי הצביע לה ובאיזה מקום (1 או 2).
                </p>
              </div>

              {/* Ranked Meals List */}
              <div className="space-y-2.5">
                {mealScores.map((meal, index) => (
                  <div
                    key={meal.id}
                    onClick={() => setSelectedMealForVotes(meal)}
                    className={`rounded-2xl p-4 flex items-center justify-between gap-3 border transition-all cursor-pointer active:scale-[0.99] ${isDarkMode
                      ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-850/80 shadow-md'
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 shadow-xs'
                      }`}
                  >
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      {/* Rank Medal / Number */}
                      <span className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${index === 0
                        ? 'bg-amber-400 text-black shadow-amber-400/20 text-base'
                        : index === 1
                          ? 'bg-slate-300 text-slate-900 text-base'
                          : index === 2
                            ? 'bg-amber-700 text-white text-base'
                            : isDarkMode
                              ? 'bg-slate-800 text-slate-400 border border-slate-700 font-mono'
                              : 'bg-slate-100 text-slate-700 border border-slate-200 font-mono'
                        }`}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </span>

                      {/* Meal photo */}
                      {meal.imageUrl ? (
                        <img
                          src={meal.imageUrl}
                          alt={meal.name}
                          className="w-12 h-12 rounded-xl object-cover shrink-0 border border-black/10"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg shrink-0">
                          🍽️
                        </div>
                      )}

                      {/* Details */}
                      <div className="overflow-hidden">
                        <div className="font-extrabold text-base leading-tight truncate">
                          {meal.name}
                        </div>
                        {meal.chefs.length > 0 && (
                          <div className={`text-xs truncate mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            שף: {meal.chefs.join(', ')}
                          </div>
                        )}
                        <div className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {meal.votesCount} {meal.votesCount === 1 ? 'מצביע' : 'מצביעים'} (לחץ לפירוט)
                        </div>
                      </div>
                    </div>

                    {/* Points & Chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-left">
                        <span className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                          {meal.score}
                        </span>
                        <span className="text-xs text-slate-400 mr-1 font-bold">נק׳</span>
                      </div>
                      <ChevronRight size={18} className="text-slate-400 rotate-180" />
                    </div>
                  </div>
                ))}

                {mealScores.length === 0 && (
                  <div className={`text-center py-12 rounded-3xl border border-dashed p-6 ${isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500 shadow-xs'
                    }`}>
                    <Trophy size={36} className="mx-auto text-slate-400 mb-2 opacity-50" />
                    <p className="text-sm font-medium">אין מנות משתתפות כעת</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 4: TOOLS (מצב תכנון, איפוס, קישורים, עדכון)       */}
          {/* ==================================================== */}
          {currentTab === 'tools' && (
            <div className="space-y-4 animate-in fade-in duration-200">

              {/* 1. PLANNER MODE LAUNCHER */}
              <div className={`rounded-3xl p-5 border space-y-3 transition-all ${isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                <div className="flex items-center gap-2">
                  <Sliders size={20} className="text-purple-500" />
                  <h3 className="font-extrabold text-lg">מצב תכנון האירוע</h3>
                </div>
                <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  מעבר למערכת התכנון המלאה: ניהול רשימת אורחים ומשקי בית, תפריט מנות, תקציב ורכש עבור אירוע זה.
                </p>
                <button
                  onClick={() => navigate(`/plan/${eventId}`)}
                  className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <Sliders size={16} />
                  <span>פתח את מצב התכנון</span>
                </button>
              </div>

              {/* 2. DANGER ZONE: EVENT RESET */}
              <div className={`rounded-3xl p-5 border space-y-3 transition-all ${isDarkMode ? 'bg-rose-950/20 border-rose-900/40' : 'bg-rose-50/50 border-rose-200'
                }`}>
                <div className="flex items-center gap-2 text-rose-500">
                  <AlertTriangle size={20} />
                  <h3 className="font-extrabold text-lg">אזור סכנה: איפוס אירוע</h3>
                </div>
                <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  מחיקת כל ההצבעות, איפוס סטטוס המשתתפים, ואיפוס הטיימר והתוצאות בחזרה להתחלה.
                </p>
                <button
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  <RotateCcw size={16} />
                  <span>איפוס מלא של האירוע...</span>
                </button>
              </div>

              {/* 3. LINKS & SHARING */}
              <div className={`rounded-3xl p-5 border space-y-4 transition-all ${isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                <div className="flex items-center gap-2">
                  <Share2 size={20} className="text-emerald-500" />
                  <h2 className="font-extrabold text-lg">קישורים ושיתוף</h2>
                </div>

                {/* Voters Link */}
                <div className={`rounded-2xl p-3.5 space-y-2 border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                  <div className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>קישור הצבעה לאורחים:</div>
                  <div className="flex gap-2">
                    <button
                      onClick={shareViaWhatsApp}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Share2 size={14} />
                      <span>וואטסאפ</span>
                    </button>
                    <button
                      onClick={() => copyToClipboard(voterLink, 'קישור הצבעה')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                        : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100 shadow-xs'
                        }`}
                    >
                      <Copy size={14} />
                      <span>העתק</span>
                    </button>
                  </div>
                </div>

                {/* TV Link */}
                <div className={`rounded-2xl p-3.5 space-y-2 border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                  <div className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>קישור תצוגה לטלוויזיה החכמה:</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(tvLink, 'קישור טלוויזיה')}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Copy size={14} />
                      <span>העתק קישור TV</span>
                    </button>
                    <a
                      href={tvLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                        : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100 shadow-xs'
                        }`}
                    >
                      <ExternalLink size={14} />
                      <span>פתח</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* 4. APP UPDATE CARD */}
              <div className={`rounded-3xl p-5 border space-y-3 transition-all ${isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={20} className="text-blue-500" />
                    <h3 className="font-extrabold text-lg">עדכון אפליקציה</h3>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${isDarkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}>
                    {APP_CURRENT_VERSION}
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  בדיקת עדכונים, רענון גרסה מהיר או הורדת קובץ עדכון למכשיר.
                </p>
                <button
                  onClick={() => setIsUpdateModalOpen(true)}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <RefreshCw size={16} />
                  <span>בדוק עדכונים / עדכן אפליקציה</span>
                </button>
              </div>

            </div>
          )}

        </main>

        {/* --- FIXED BOTTOM NAVIGATION BAR --- */}
        <nav className={`fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl border-t px-3 py-2 flex items-center justify-around max-w-lg mx-auto shadow-lg transition-colors ${isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/95 border-slate-200'
          }`}>
          {/* Cockpit Tab */}
          <button
            onClick={() => setCurrentTab('cockpit')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all cursor-pointer ${currentTab === 'cockpit'
              ? 'text-blue-600 dark:text-blue-400 font-extrabold scale-105'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
          >
            <Sliders size={20} className={currentTab === 'cockpit' ? 'stroke-[2.5]' : ''} />
            <span className="text-[11px]">בקרה</span>
          </button>

          {/* Voters Tab */}
          <button
            onClick={() => setCurrentTab('voters')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all relative cursor-pointer ${currentTab === 'voters'
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold scale-105'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
          >
            <Users size={20} className={currentTab === 'voters' ? 'stroke-[2.5]' : ''} />
            <span className="text-[11px]">משתתפים</span>
            {pendingGuests > 0 && (
              <span className="absolute top-1 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>

          {/* Results Tab (Renamed from תוצאות TV to תוצאות) */}
          <button
            onClick={() => setCurrentTab('results')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all cursor-pointer ${currentTab === 'results'
              ? 'text-amber-500 font-extrabold scale-105'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
          >
            <Trophy size={20} className={currentTab === 'results' ? 'stroke-[2.5]' : ''} />
            <span className="text-[11px]">תוצאות</span>
          </button>

          {/* Tools Tab */}
          <button
            onClick={() => setCurrentTab('tools')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all cursor-pointer ${currentTab === 'tools'
              ? 'text-indigo-600 dark:text-indigo-400 font-extrabold scale-105'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
          >
            <Share2 size={20} className={currentTab === 'tools' ? 'stroke-[2.5]' : ''} />
            <span className="text-[11px]">כלים</span>
          </button>
        </nav>

        {/* --- DANGER ZONE RESET CONFIRM MODAL --- */}
        {isResetConfirmOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
            onClick={() => setIsResetConfirmOpen(false)}
          >
            <div
              className={`rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200 border cursor-default ${isDarkMode ? 'bg-slate-900 border-rose-500/40 text-white' : 'bg-white border-rose-200 text-slate-900'
                }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500">
                <AlertTriangle size={36} />
              </div>

              <div>
                <h3 className="text-xl font-bold mb-1">איפוס אירוע מוחלט</h3>
                <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  האם אתה בטוח שברצונך לאפס? פעולה זו תמחק את כל ההצבעות, תאפס את הסטטוס של כל המשתתפים ותחזיר את הטיימר והטלוויזיה להתחלה.
                </p>
                <div className="mt-3 p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold">
                  לא ניתן לשחזר מידע לאחר איפוס!
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleReset}
                  className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  הבנתי, אפס את האירוע עכשיו
                </button>
                <button
                  onClick={() => setIsResetConfirmOpen(false)}
                  className={`w-full py-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- ADD VOTER MODAL --- */}
        <AddVoterModal
          isOpen={isAddVoterModalOpen}
          onClose={() => setIsAddVoterModalOpen(false)}
          onAdd={handleAddGuest}
          meals={meals}
          isDarkMode={isDarkMode}
        />

        {/* --- EDIT VOTER MODAL --- */}
        <EditVoterModal
          guest={editingGuest}
          onClose={() => setEditingGuest(null)}
          onUpdate={handleUpdateGuest}
          onDelete={handleDeleteGuest}
          meals={meals}
          isDarkMode={isDarkMode}
        />

        {/* --- MANAGE MEALS MODAL --- */}
        <ManageMealsModal
          isOpen={isManageMealsModalOpen}
          onClose={() => setIsManageMealsModalOpen(false)}
          meals={meals}
          guests={guests}
          onRemoveMeal={handleRemoveMeal}
          isDarkMode={isDarkMode}
        />

        {/* --- MEAL VOTES BREAKDOWN MODAL (Results Tab) --- */}
        <MealVotesModal
          eventId={eventId || ''}
          meal={selectedMealForVotes}
          votes={votes}
          guests={guests}
          onClose={() => setSelectedMealForVotes(null)}
          isDarkMode={isDarkMode}
        />

        {/* App Update Modal */}
        <AppUpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          title="עדכון אפליקציית המארח"
          currentVersion={APP_CURRENT_VERSION}
          apkDownloadUrl="https://github.com/cfiramar/cook-off/releases/latest/download/CookOff-Host-Mobile.apk"
          apkName="CookOff-Host-Mobile.apk"
          apkTitle="הורדת קובץ עדכון למכשיר"
          apkDescription="מוריד את קובץ העדכון למכשיר."
          isDarkMode={isDarkMode}
        />

      </div>
    </div>
  );
}

/**
 * Add Voter Modal Component
 */
function AddVoterModal({
  isOpen,
  onClose,
  onAdd,
  meals,
  isDarkMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, pin: string, householdName?: string, mealId?: string) => Promise<void>;
  meals: Meal[];
  isDarkMode: boolean;
}) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [householdName, setHouseholdName] = useState('');
  const [mealId, setMealId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPin(Math.floor(1000 + Math.random() * 9000).toString());
      setHouseholdName('');
      setMealId('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    await onAdd(name.trim(), pin.trim(), householdName.trim() || undefined, mealId || undefined);
    setIsSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div
        className={`rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 border cursor-default ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <h3 className="text-lg font-bold">הוספת משתתף חדש</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-500/10 text-slate-400 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold mb-1">שם המשתתף *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: יונתן כהן"
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border ${isDarkMode ? 'bg-slate-950/80 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">קוד PIN (4 ספרות) *</label>
            <input
              type="text"
              required
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 border ${isDarkMode ? 'bg-slate-950/80 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">שם משק בית / משפחה (אופציונלי)</label>
            <input
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="משפחת כהן (ברירת מחדל: שם המשתתף)"
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border ${isDarkMode ? 'bg-slate-950/80 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">שיוך כשף למנה (אופציונלי)</label>
            <select
              value={mealId}
              onChange={(e) => setMealId(e.target.value)}
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border ${isDarkMode ? 'bg-slate-950/80 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
            >
              <option value="">ללא שיוך למנה (מצביע רגיל)</option>
              {meals.map((m) => (
                <option key={m.id} value={m.id}>
                  🍽️ {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'שומר...' : 'הוסף משתתף'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-3 rounded-xl text-xs font-semibold cursor-pointer ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Edit Voter Modal Component (Rename, Set PIN, Link Meal, Delete)
 */
function EditVoterModal({
  guest,
  onClose,
  onUpdate,
  onDelete,
  meals,
  isDarkMode,
}: {
  guest: Guest | null;
  onClose: () => void;
  onUpdate: (guestId: string, name: string, pin: string, mealId?: string | null) => Promise<void>;
  onDelete: (guest: Guest) => void;
  meals: Meal[];
  isDarkMode: boolean;
}) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [mealId, setMealId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (guest) {
      setName(guest.name || '');
      setPin(guest.pin || '');
      const linkedMeal = meals.find((m) => m.chefIds && m.chefIds.includes(guest.id));
      setMealId(linkedMeal ? linkedMeal.id : '');
      setIsSubmitting(false);
    }
  }, [guest, meals]);

  if (!guest) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    await onUpdate(guest.id, name.trim(), pin.trim(), mealId || null);
    setIsSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div
        className={`rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 border cursor-default ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <Edit3 size={20} />
            </div>
            <h3 className="text-lg font-bold">עריכת פרטי משתתף</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-500/10 text-slate-400 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold mb-1">שם המשתתף (משפיע מיידית על השפים והטלוויזיה) *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border ${isDarkMode ? 'bg-slate-950/80 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">קוד PIN להתחברות *</label>
            <input
              type="text"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 border ${isDarkMode ? 'bg-slate-950/80 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">שיוך למנה כשף</label>
            <select
              value={mealId}
              onChange={(e) => setMealId(e.target.value)}
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border ${isDarkMode ? 'bg-slate-950/80 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
            >
              <option value="">ללא שיוך למנה</option>
              {meals.map((m) => (
                <option key={m.id} value={m.id}>
                  🍽️ {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'מעדכן...' : 'שמור שינויים'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(guest)}
              className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 hover:bg-rose-500/25 transition-all cursor-pointer"
              title="מחק משתתף"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Manage and Remove Meals Modal Component
 */
function ManageMealsModal({
  isOpen,
  onClose,
  meals,
  guests,
  onRemoveMeal,
  isDarkMode,
}: {
  isOpen: boolean;
  onClose: () => void;
  meals: Meal[];
  guests: Guest[];
  onRemoveMeal: (meal: Meal) => void;
  isDarkMode: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div
        className={`rounded-3xl p-5 max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl border cursor-default ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <UtensilsCrossed size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">ניהול והסרת מנות ({meals.length})</h3>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                מנות שיוסרו יירדו מיידית מהטלוויזיה ומההצבעה
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-500/10 text-slate-400 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
          {meals.map((meal) => {
            const chefs = getOrderedChefNamesForMeal(meal, guests);
            return (
              <div
                key={meal.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {meal.imageUrl ? (
                    <img
                      src={meal.imageUrl}
                      alt={meal.name}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-black/10"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      🍽️
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <div className="font-bold text-sm truncate">{meal.name}</div>
                    {chefs.length > 0 && (
                      <div className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        שף: {chefs.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onRemoveMeal(meal)}
                  className="py-2 px-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 hover:bg-rose-500/25 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 active:scale-95 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>הסר מנה</span>
                </button>
              </div>
            );
          })}

          {meals.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-8">אין מנות באירוע זה</p>
          )}
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className={`w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Meal Votes Modal Component (Results Tab: Details of who voted and ranking)
 */
function MealVotesModal({
  eventId,
  meal,
  votes,
  guests,
  onClose,
  isDarkMode,
}: {
  eventId: string;
  meal: (Meal & { score: number; chefs: string[]; votesCount: number }) | null;
  votes: Vote[];
  guests: Guest[];
  onClose: () => void;
  isDarkMode: boolean;
}) {
  if (!meal) return null;

  const mealVotes = votes.filter((v) => v.mealId === meal.id);
  const firstPlaceVotes = mealVotes.filter((v) => v.points === 3);
  const secondPlaceVotes = mealVotes.filter((v) => v.points === 2);
  const baseVotesScore = useMemo(() => {
    return mealVotes.reduce((sum, v) => sum + (v.points || 0), 0);
  }, [mealVotes]);

  const [showSecretEditor, setShowSecretEditor] = useState(false);
  const [targetScore, setTargetScore] = useState<number>(meal.score);
  const [isSaving, setIsSaving] = useState(false);
  const clicksCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTargetScore(meal.score);
  }, [meal.score, meal.id]);

  const handleImageClick = () => {
    clicksCountRef.current += 1;
    if (clicksCountRef.current >= 4) {
      clicksCountRef.current = 0;
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      setShowSecretEditor(true);
      return;
    }
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clicksCountRef.current = 0;
    }, 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div
        className={`rounded-3xl p-5 max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl border cursor-default ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with image */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              onClick={handleImageClick}
              className="relative cursor-pointer active:scale-95 transition-transform shrink-0 select-none group"
              title="תמונת המנה (לחיצה מרובעת מפעילה עריכת ניקוד סודית)"
            >
              {meal.imageUrl ? (
                <img
                  src={meal.imageUrl}
                  alt={meal.name}
                  className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-black/10 group-hover:opacity-90"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center text-2xl shrink-0 group-hover:bg-amber-500/25">
                  🍽️
                </div>
              )}
            </div>
            <div className="overflow-hidden">
              <h3 className="text-base font-extrabold truncate">{meal.name}</h3>
              {meal.chefs.length > 0 && (
                <p className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  שף: {meal.chefs.join(', ')}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono">
                  {meal.score} נקודות
                </span>
                {meal.pointsAdjustment ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                    {meal.pointsAdjustment > 0 ? `+${meal.pointsAdjustment}` : meal.pointsAdjustment} התאמה
                  </span>
                ) : null}
                <span className="text-xs text-slate-400 font-mono">• {mealVotes.length} מצביעים</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-500/10 text-slate-400 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Secret Points Adjustment Editor */}
        {showSecretEditor && (
          <div className={`p-3 rounded-2xl border space-y-2.5 mt-3 animate-in fade-in duration-150 ${
            isDarkMode ? 'bg-amber-950/20 border-amber-500/40 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Sparkles size={14} className="text-amber-500 shrink-0" />
                <span>עריכת ניקוד סופי למנה (עבור המארח)</span>
              </div>
              <button
                onClick={() => setShowSecretEditor(false)}
                className="p-1 rounded hover:bg-black/10 text-slate-400 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <span>הצבעות אורחים: <strong className="font-mono">{baseVotesScore}</strong></span>
              <span>
                התאמה (בונוס/קנס):{' '}
                <strong className="font-mono">
                  {(targetScore - baseVotesScore) > 0 ? `+${targetScore - baseVotesScore}` : (targetScore - baseVotesScore)}
                </strong>
              </span>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setTargetScore((prev) => prev - 5)}
                className="px-2.5 py-1 rounded-lg border text-xs font-mono font-bold hover:bg-black/5 active:scale-95 cursor-pointer"
              >
                -5
              </button>
              <button
                type="button"
                onClick={() => setTargetScore((prev) => prev - 1)}
                className="px-2.5 py-1 rounded-lg border text-xs font-mono font-bold hover:bg-black/5 active:scale-95 cursor-pointer"
              >
                -1
              </button>
              <input
                type="number"
                value={targetScore}
                onChange={(e) => setTargetScore(Number(e.target.value))}
                className={`w-20 text-center font-mono font-extrabold text-base py-1 rounded-lg border ${
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={() => setTargetScore((prev) => prev + 1)}
                className="px-2.5 py-1 rounded-lg border text-xs font-mono font-bold hover:bg-black/5 active:scale-95 cursor-pointer"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => setTargetScore((prev) => prev + 5)}
                className="px-2.5 py-1 rounded-lg border text-xs font-mono font-bold hover:bg-black/5 active:scale-95 cursor-pointer"
              >
                +5
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (!eventId) return;
                  setIsSaving(true);
                  try {
                    await updateDoc(doc(db, 'events', eventId, 'meals', meal.id), {
                      pointsAdjustment: 0
                    });
                    setTargetScore(baseVotesScore);
                    setShowSecretEditor(false);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-black/5 cursor-pointer"
              >
                איפוס
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (!eventId) return;
                  setIsSaving(true);
                  try {
                    const adjustment = Number(targetScore) - baseVotesScore;
                    await updateDoc(doc(db, 'events', eventId, 'meals', meal.id), {
                      pointsAdjustment: adjustment
                    });
                    setShowSecretEditor(false);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm cursor-pointer"
              >
                {isSaving ? 'שומר...' : 'שמור ניקוד'}
              </button>
            </div>
          </div>
        )}

        {/* Votes Summary Pills */}
        <div className="grid grid-cols-2 gap-2 pt-3">
          <div className={`p-2.5 rounded-xl border text-center ${isDarkMode ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
            <span className="text-xs font-bold block">🥇 מקום ראשון (3 נק׳)</span>
            <span className="text-lg font-black font-mono">{firstPlaceVotes.length}</span>
          </div>
          <div className={`p-2.5 rounded-xl border text-center ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}>
            <span className="text-xs font-bold block">🥈 מקום שני (2 נק׳)</span>
            <span className="text-lg font-black font-mono">{secondPlaceVotes.length}</span>
          </div>
        </div>

        {/* Voter List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          <div className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            פירוט הצבעות האורחים:
          </div>

          {mealVotes.map((vote) => {
            const voter = guests.find((g) => g.id === vote.guestId);
            const voterName = voter?.name || 'אורח';
            const household = voter?.householdName;
            const isFirst = vote.points === 3;

            return (
              <div
                key={vote.id || `${vote.guestId}_${vote.mealId}`}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
              >
                <div>
                  <div className="font-bold text-sm">{voterName}</div>
                  {household && (
                    <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {household}
                    </div>
                  )}
                </div>

                <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border shrink-0 ${isFirst
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30'
                  : isDarkMode
                    ? 'bg-slate-800 text-slate-300 border-slate-700'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                  {isFirst ? '🥇 מקום ראשון (+3)' : '🥈 מקום שני (+2)'}
                </span>
              </div>
            );
          })}

          {mealVotes.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400">
              עדיין לא נרשמו הצבעות למנה זו
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className={`w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
