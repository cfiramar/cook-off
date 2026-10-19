import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFirebaseData, useAllEvents, type Meal } from '../../hooks/useFirebaseData';
import { doc, updateDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
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
  Tv,
  CheckCircle2,
  Sparkles,
  Search,
  Lock,
  ChevronRight,
  Flame,
  ChefHat,
  Sliders,
  Eye,
  EyeOff,
  ArrowLeftRight,
  Calendar,
  Fingerprint,
  Sun,
  Moon,
  KeyRound
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePopup } from '../../components/ui/PopupProvider';
import PinPad from '../../components/ui/PinPad';
import GuestManager from '../plan/components/GuestManager';
import { getOrderedChefNamesForMeal } from '../../utils/mealChefOrder';

type TabType = 'cockpit' | 'voters' | 'results' | 'tools';
type VoterFilterType = 'all' | 'pending' | 'done';

/**
 * Triggers native device authentication (Fingerprint, FaceID, Windows Hello, Screen Lock)
 * using WebAuthn without storing any sensitive biometric data on a server.
 */
async function authenticateDeviceBiometrics(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!window.PublicKeyCredential) {
      return { success: false, error: 'WebAuthn אינו נתמך בדפדפן זה' };
    }

    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      return { success: false, error: 'לא זוהה מנגנון נעילה ביומטרי/מכשיר פעיל' };
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const storedId = localStorage.getItem('cookoff_device_cred_id');
    if (storedId) {
      try {
        const rawId = Uint8Array.from(atob(storedId), c => c.charCodeAt(0));
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            allowCredentials: [{
              id: rawId,
              type: 'public-key',
              transports: ['internal']
            }],
            userVerification: 'required',
            timeout: 60000
          }
        });
        if (assertion) return { success: true };
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          return { success: false, error: 'האימות בוטל' };
        }
        localStorage.removeItem('cookoff_device_cred_id');
      }
    }

    // First time registration of this device's authenticator
    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Cook-Off Host',
          id: window.location.hostname
        },
        user: {
          id: userId,
          name: 'host_manager',
          displayName: 'מארח התחרות'
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' }
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred'
        },
        timeout: 60000
      }
    }) as PublicKeyCredential | null;

    if (credential && credential.rawId) {
      const b64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem('cookoff_device_cred_id', b64);
      return { success: true };
    }

    return { success: false, error: 'לא התקבל אישור מהמכשיר' };
  } catch (err: any) {
    console.error('Device auth error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'האימות בוטל' };
    }
    return { success: false, error: err.message || 'שגיאה באימות מול המכשיר' };
  }
}

/**
 * Event selection screen for the host when no specific event is selected,
 * or when the host chooses to switch events.
 */
function HostEventSelector({ isDarkMode, onToggleTheme }: { isDarkMode: boolean; onToggleTheme: () => void }) {
  const { events, loading, error } = useAllEvents();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

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
    <div className={`flex-1 flex flex-col w-full min-h-screen relative font-sans p-4 max-w-lg mx-auto select-none transition-colors duration-200 ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Ambient background glows */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[40%] rounded-full blur-[100px] pointer-events-none ${
        isDarkMode ? 'bg-blue-600/15' : 'bg-blue-400/20'
      }`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[40%] rounded-full blur-[100px] pointer-events-none ${
        isDarkMode ? 'bg-emerald-600/15' : 'bg-emerald-400/20'
      }`} />

      {/* Top action row */}
      <div className="flex justify-between items-center z-10 pt-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <ChefHat size={18} />
          </div>
          <span className="font-extrabold text-sm tracking-wide">Cook-Off Host</span>
        </div>

        <button
          onClick={onToggleTheme}
          className={`p-2 rounded-xl border transition-colors ${
            isDarkMode
              ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs'
          }`}
          title={isDarkMode ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
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
          className={`w-full rounded-2xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
            isDarkMode
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
        <div className={`p-8 text-center rounded-3xl border text-sm space-y-3 z-10 ${
          isDarkMode ? 'bg-slate-900/50 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500 shadow-sm'
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
              className={`rounded-3xl p-4.5 border transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.98] group ${
                isDarkMode
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

              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                isDarkMode
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:bg-blue-500/20'
                  : 'bg-blue-50 text-blue-600 border border-blue-100 group-hover:bg-blue-100'
              }`}>
                <ChevronRight size={18} className="rotate-180" />
              </div>
            </div>
          ))}
        </div>
      )}
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
  
  // Navigation & View states
  const [currentTab, setCurrentTab] = useState<TabType>('cockpit');
  const [isGuestManagerOpen, setIsGuestManagerOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Timer states
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Voters tab states
  const [voterFilter, setVoterFilter] = useState<VoterFilterType>('all');
  const [voterSearch, setVoterSearch] = useState('');

  const { showAlert, showSuccess } = usePopup();



  // Pure Native Device Authentication (Fingerprint / FaceID / Device Lock)
  const handleDeviceAuth = useCallback(async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    const res = await authenticateDeviceBiometrics();
    setIsAuthenticating(false);
    if (res.success) {
      setIsAuthenticated(true);
      sessionStorage.setItem(`host_authed_${eventId}`, 'true');
      showSuccess('אימות מכשיר הצליח!');
    } else {
      setAuthError(res.error || 'האימות נכשל');
    }
  }, [eventId, showSuccess]);

  const [isPinError, setIsPinError] = useState(false);

  // Fallback PIN Handler
  const handlePinComplete = (completedPin: string) => {
    if (!eventInfo) return;
    if (completedPin === eventInfo.hostPin) {
      setIsAuthenticated(true);
      sessionStorage.setItem(`host_authed_${eventId}`, 'true');
      showSuccess('ברוך הבא לפאנל המארח');
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
      setIsGuestManagerOpen(false);
      setIsResetConfirmOpen(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openGuestManager = () => {
    setIsGuestManagerOpen(true);
    window.history.pushState({ modal: 'guests' }, '');
  };

  const closeGuestManager = () => {
    setIsGuestManagerOpen(false);
    window.history.back();
  };

  // Timer actions
  const handleStartTimer = async () => {
    if (!eventInfo || !eventId) return;
    const duration = timerMinutes * 60 * 1000;
    const endTime = Date.now() + duration;
    try {
      await updateDoc(doc(db, 'events', eventId), {
        timerStatus: 'running',
        timerEndTime: endTime,
        timerDuration: duration
      });
      showSuccess(`הטיימר הופעל ל-${timerMinutes} דקות!`);
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בהפעלת הטיימר');
    }
  };

  const handleStopTimer = async () => {
    if (!eventInfo || !eventId) return;
    try {
      await updateDoc(doc(db, 'events', eventId), {
        timerStatus: 'ended',
        showMealsCarousel: false
      });
      showSuccess('הטיימר נעצר');
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בעצירת הטיימר');
    }
  };

  // TV Flavor Texts Toggle (for Ended Timer Screen)
  const handleToggleFlavorTexts = async () => {
    if (!eventInfo || !eventId) return;
    const nextState = eventInfo.showFlavorTexts !== false ? false : true;
    try {
      await updateDoc(doc(db, 'events', eventId), {
        showFlavorTexts: nextState
      });
      showSuccess(nextState ? 'טקסט אווירה מופעל בטלוויזיה ✨' : 'טקסט אווירה כבוי בטלוויזיה');
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בעדכון הגדרת טקסט אווירה');
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
      showSuccess(`נוספו ${minutes} דקות לטיימר`);
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
      showSuccess(nextState ? 'גלריית המנות מוצגת בטלוויזיה 🖼️' : 'גלריית המנות הוסתרה מהטלוויזיה 🙈');
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בעדכון הגדרת גלריית המנות');
    }
  };

  // TV Reveal Director actions
  const handleReveal = async (state: 'none' | '3rd' | '2nd' | '1st') => {
    if (!eventId) return;
    try {
      await updateDoc(doc(db, 'events', eventId), {
        revealState: state
      });
      const stateLabels: Record<string, string> = {
        '3rd': 'מקום 3 נחשף בטלוויזיה! 🥉',
        '2nd': 'מקום 2 נחשף בטלוויזיה! 🥈',
        '1st': 'המנצח הוכרז בטלוויזיה! 🥇🏆',
        'none': 'מסך הטלוויזיה אופס'
      };
      showSuccess(stateLabels[state]);
    } catch (err) {
      console.error(err);
      showAlert('שגיאה בעדכון מסך הטלוויזיה');
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
        const score = mealVotes.reduce((sum, vote) => sum + vote.points, 0);
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
      <div className={`flex-1 flex flex-col items-center justify-center min-h-screen p-6 ${
        isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'
      }`}>
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">טוען נתוני אירוע...</p>
      </div>
    );
  }

  if (error || !eventInfo) {
    return (
      <div className={`flex-1 flex flex-col justify-center items-center min-h-screen p-6 text-center ${
        isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
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
      <div className={`flex-1 flex flex-col items-center justify-center p-6 w-full min-h-screen relative overflow-hidden select-none transition-colors ${
        isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
      }`}>
        {/* Ambient background glows */}
        <div className={`absolute top-[-15%] left-[-10%] w-[55%] h-[45%] rounded-full blur-[110px] pointer-events-none ${
          isDarkMode ? 'bg-blue-600/15' : 'bg-blue-400/25'
        }`} />
        <div className={`absolute bottom-[-15%] right-[-10%] w-[55%] h-[45%] rounded-full blur-[110px] pointer-events-none ${
          isDarkMode ? 'bg-purple-600/15' : 'bg-purple-400/25'
        }`} />

        <div className="relative z-10 flex flex-col items-center w-full max-w-[340px]">
          {/* Header icon */}
          <div className={`w-18 h-18 rounded-3xl flex items-center justify-center mb-5 shadow-lg border transition-all ${
            isDarkMode
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
                onClick={handleDeviceAuth}
                disabled={isAuthenticating}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-base flex items-center justify-center gap-3 shadow-lg shadow-blue-600/25 active:scale-95 transition-all disabled:opacity-50"
              >
                <Fingerprint size={22} />
                <span>{isAuthenticating ? 'ממתין לאישור המכשיר...' : 'אימות בטביעת אצבע / מכשיר'}</span>
              </button>

              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs text-center font-medium">
                  {authError}
                </div>
              )}

              <div className="text-center pt-2">
                <button
                  onClick={() => setShowPinFallback(true)}
                  className={`text-xs flex items-center justify-center gap-1.5 mx-auto font-semibold transition-colors ${
                    isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
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
                  className={`text-xs flex items-center justify-center gap-1.5 mx-auto font-semibold transition-colors ${
                    isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Fingerprint size={14} />
                  <span>חזרה לאימות בטביעת אצבע / מכשיר</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-10">
            <button
              onClick={() => navigate('/host')}
              className={`text-xs flex items-center gap-1.5 py-2 px-3 rounded-xl border transition-colors ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs'
              }`}
            >
              <ArrowLeftRight size={13} />
              <span>החלף אירוע</span>
            </button>

            <button
              onClick={onToggleTheme}
              className={`text-xs flex items-center gap-1.5 py-2 px-3 rounded-xl border transition-colors ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs'
              }`}
            >
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
              <span>{isDarkMode ? 'מצב בהיר' : 'מצב כהה'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active status badge description
  const getTVStateLabel = () => {
    switch (eventInfo.revealState) {
      case '1st':
        return { text: 'הטלוויזיה מציגה: המנצח הגדול 🥇', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30' };
      case '2nd':
        return { text: 'הטלוויזיה מציגה: מקום 2 🥈', color: 'bg-slate-400/15 text-slate-700 dark:text-slate-200 border-slate-400/30' };
      case '3rd':
        return { text: 'הטלוויזיה מציגה: מקום 3 🥉', color: 'bg-orange-600/15 text-orange-700 dark:text-orange-300 border-orange-600/30' };
      default:
        return eventInfo.showMealsCarousel !== false
          ? { text: 'הטלוויזיה מציגה: גלריית מנות וטיימר 🖼️', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' }
          : { text: 'הטלוויזיה מציגה: טיימר בלבד (גלריה מוסתרת) ⏱️', color: isDarkMode ? 'bg-slate-850 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const tvStateInfo = getTVStateLabel();
  const isCarouselActive = eventInfo.showMealsCarousel !== false;
  const isFlavorTextsActive = eventInfo.showFlavorTexts !== false;

  return (
    <div className={`flex-1 flex flex-col w-full min-h-screen relative overflow-x-hidden font-sans select-none transition-colors duration-200 ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Soft Ambient Background Glows */}
      <div className={`fixed top-[-10%] left-[-10%] w-[50%] h-[40%] rounded-full blur-[110px] pointer-events-none ${
        isDarkMode ? 'bg-blue-600/15' : 'bg-blue-400/20'
      }`} />
      <div className={`fixed bottom-[-10%] right-[-10%] w-[50%] h-[40%] rounded-full blur-[110px] pointer-events-none ${
        isDarkMode ? 'bg-emerald-600/15' : 'bg-emerald-400/20'
      }`} />

      {/* Main Container */}
      <div className="relative z-10 flex flex-col flex-1 w-full max-w-lg mx-auto pb-24">
        
        {/* --- STICKY MOBILE TOP BAR --- */}
        <header className={`sticky top-0 z-30 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between transition-colors ${
          isDarkMode ? 'bg-slate-950/85 border-slate-800' : 'bg-white/85 border-slate-200 shadow-xs'
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
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors ${
                isDarkMode
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
              className={`p-2 rounded-xl border transition-colors ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
              title={isDarkMode ? 'מצב בהיר' : 'מצב כהה'}
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>



            {/* Lock Panel */}
            <button
              onClick={() => {
                setIsAuthenticated(false);
                sessionStorage.removeItem(`host_authed_${eventId}`);
              }}
              className={`p-2 rounded-xl border transition-colors ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-red-400'
                  : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-red-600'
              }`}
              title="נעילת מסך"
            >
              <Lock size={17} />
            </button>
          </div>
        </header>



        {/* --- TAB CONTENT AREA --- */}
        <main className="flex-1 p-4 space-y-4 overflow-y-auto">

          {/* ==================================================== */}
          {/* TAB 1: COCKPIT (קונטרול מהיר)                        */}
          {/* ==================================================== */}
          {currentTab === 'cockpit' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* 1. HERO TIMER CARD */}
              <div className={`rounded-3xl p-5 border relative overflow-hidden transition-all ${
                isDarkMode
                  ? 'bg-slate-900/80 border-slate-800 shadow-xl'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock size={20} className="text-blue-500" />
                    <span className="font-extrabold text-lg">טיימר הצבעה</span>
                  </div>

                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    eventInfo.timerStatus === 'running'
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

                {/* Timer Running View */}
                {eventInfo.timerStatus === 'running' ? (
                  <div className="flex flex-col items-center py-2">
                    <div className="relative my-2">
                      <span className={`text-6xl font-black font-mono tracking-tight drop-shadow-sm ${
                        timeRemaining !== null && timeRemaining < 60000 ? 'text-red-500 animate-pulse' : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {timeRemaining !== null ? formatTime(timeRemaining) : '00:00'}
                      </span>
                    </div>

                    {/* Quick Extend Buttons */}
                    <div className="grid grid-cols-2 gap-3 w-full my-4">
                      <button
                        onClick={() => handleExtendTimer(1)}
                        className={`py-3 px-4 rounded-2xl border font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs ${
                          isDarkMode
                            ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                        }`}
                      >
                        <Plus size={16} className="text-blue-500" />
                        <span>דקה אחת (+1)</span>
                      </button>
                      <button
                        onClick={() => handleExtendTimer(5)}
                        className={`py-3 px-4 rounded-2xl border font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs ${
                          isDarkMode
                            ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                        }`}
                      >
                        <Plus size={16} className="text-blue-500" />
                        <span>5 דקות (+5)</span>
                      </button>
                    </div>

                    {/* Stop Timer Button */}
                    <button
                      onClick={handleStopTimer}
                      className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-base flex items-center justify-center gap-2 shadow-md shadow-rose-600/20 active:scale-95 transition-all"
                    >
                      <Square size={18} fill="currentColor" />
                      <span>עצור טיימר מיד</span>
                    </button>
                  </div>
                ) : (
                  /* Timer Idle / Ended View */
                  <div className="space-y-4 py-1">
                    {/* Stepper & Display */}
                    <div className={`flex items-center justify-between rounded-2xl p-3 border ${
                      isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <button
                        onClick={() => setTimerMinutes(m => Math.max(1, m - 1))}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center active:scale-95 transition-all border ${
                          isDarkMode
                            ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-xs'
                        }`}
                      >
                        <Minus size={20} />
                      </button>

                      <div className="flex flex-col items-center">
                        <span className="text-4xl font-black font-mono">
                          {timerMinutes}
                        </span>
                        <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>דקות</span>
                      </div>

                      <button
                        onClick={() => setTimerMinutes(m => m + 1)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center active:scale-95 transition-all border ${
                          isDarkMode
                            ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-xs'
                        }`}
                      >
                        <Plus size={20} />
                      </button>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-4 gap-2">
                      {[3, 5, 10, 15].map(preset => (
                        <button
                          key={preset}
                          onClick={() => setTimerMinutes(preset)}
                          className={`py-2 rounded-xl font-bold text-xs transition-all border ${
                            timerMinutes === preset
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

                    {/* Start Button */}
                    <button
                      onClick={handleStartTimer}
                      className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                    >
                      <Play size={22} fill="currentColor" />
                      <span>הפעל טיימר הצבעה</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. LIVE VOTING PULSE CARD */}
              <div className={`rounded-3xl p-5 border transition-all ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users size={20} className="text-emerald-500" />
                    <span className="font-extrabold text-lg">קצב הצבעה בלייב</span>
                  </div>
                  <button
                    onClick={() => setCurrentTab('voters')}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>לרשימת המצביעים</span>
                    <ChevronRight size={14} className="rotate-180" />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-sm">
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                      סיימו להצביע: <strong className={isDarkMode ? 'text-white' : 'text-slate-900 font-bold'}>{doneGuests}</strong> מתוך <span className="font-mono">{totalGuests}</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">
                      {progressPercent}%
                    </span>
                  </div>

                  <div className={`w-full h-3 rounded-full border overflow-hidden p-0.5 ${
                    isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                  }`}>
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Sub Stats Row */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-center">
                  <div className={`rounded-xl p-2 border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className={`block text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>סיימו</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">{doneGuests}</span>
                  </div>
                  <div className={`rounded-xl p-2 border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className={`block text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>מצביעים</span>
                    <span className="text-lg font-bold text-amber-500 font-mono">{votingGuests}</span>
                  </div>
                  <div className={`rounded-xl p-2 border ${isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className={`block text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ממתינים</span>
                    <span className={`text-lg font-bold font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{pendingGuests}</span>
                  </div>
                </div>
              </div>

              {/* 3. TV STAGE DIRECT CONTROL CARD (With Independent Carousel Toggle) */}
              <div className={`rounded-3xl p-5 border space-y-3 transition-all ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv size={20} className="text-blue-500" />
                    <span className="font-extrabold text-lg">בקרת מסך טלוויזיה</span>
                  </div>
                  <button
                    onClick={() => setCurrentTab('results')}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>בימוי מלא</span>
                    <ChevronRight size={14} className="rotate-180" />
                  </button>
                </div>

                {/* Current TV status pill */}
                <div className={`p-3 rounded-2xl border text-sm font-semibold text-center ${tvStateInfo.color}`}>
                  {tvStateInfo.text}
                </div>

                {/* Show/Hide Meals Carousel Independent Toggle */}
                <div className={`flex items-center justify-between rounded-2xl p-3.5 border ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {isCarouselActive ? (
                      <Eye size={18} className="text-emerald-500 shrink-0" />
                    ) : (
                      <EyeOff size={18} className="text-slate-400 shrink-0" />
                    )}
                    <div className="overflow-hidden">
                      <div className="text-sm font-bold truncate">גלריית מנות בטלוויזיה</div>
                      <div className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isCarouselActive ? 'מוצגת במסך (ללא תלות בטיימר)' : 'מוסתרת מהטלוויזיה'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleToggleMealsCarousel}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 active:scale-95 ${
                      isCarouselActive
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-white text-slate-700 border-slate-200 shadow-xs'
                    }`}
                  >
                    {isCarouselActive ? 'פעיל (הסתר)' : 'כבוי (הצג)'}
                  </button>
                </div>

                {/* Show/Hide Flavor Texts Toggle */}
                <div className={`flex items-center justify-between rounded-2xl p-3.5 border ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <Sparkles size={18} className={isFlavorTextsActive ? "text-purple-400 shrink-0" : "text-slate-400 shrink-0"} />
                    <div className="overflow-hidden">
                      <div className="text-sm font-bold truncate">טקסט אווירה בסיום</div>
                      <div className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isFlavorTextsActive ? 'מוצג בתחתית המסך (4 שנ׳ טקסט / 3 שנ׳ הפסקה)' : 'מוסתר מהטלוויזיה'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleToggleFlavorTexts}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 active:scale-95 ${
                      isFlavorTextsActive
                        ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-white text-slate-700 border-slate-200 shadow-xs'
                    }`}
                  >
                    {isFlavorTextsActive ? 'פעיל (הסתר)' : 'כבוי (הצג)'}
                  </button>
                </div>

                {/* Quick Next Reveal Action */}
                <div className="pt-1">
                  {eventInfo.revealState === 'none' && (
                    <button
                      onClick={() => handleReveal('3rd')}
                      className="w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                    >
                      <Sparkles size={16} />
                      <span>חשוף מקום שלישי בטלוויזיה (שלב 1) 🥉</span>
                    </button>
                  )}
                  {eventInfo.revealState === '3rd' && (
                    <button
                      onClick={() => handleReveal('2nd')}
                      className="w-full py-3.5 rounded-2xl bg-slate-600 hover:bg-slate-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                    >
                      <Sparkles size={16} />
                      <span>חשוף מקום שני בטלוויזיה (שלב 2) 🥈</span>
                    </button>
                  )}
                  {eventInfo.revealState === '2nd' && (
                    <button
                      onClick={() => handleReveal('1st')}
                      className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
                    >
                      <Trophy size={18} />
                      <span>הכרז על המנצח הגדול! 🥇🏆</span>
                    </button>
                  )}
                  {eventInfo.revealState === '1st' && (
                    <button
                      onClick={() => handleReveal('none')}
                      className={`w-full py-3 rounded-xl border text-xs font-semibold transition-colors ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      איפוס מסך טלוויזיה (חזרה לתצוגה רגילה)
                    </button>
                  )}
                </div>
              </div>

              {/* 4. QUICK SHARE ROW */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={shareViaWhatsApp}
                  className="py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all"
                >
                  <Share2 size={16} />
                  <span>שליחה בוואטסאפ</span>
                </button>
                <button
                  onClick={() => copyToClipboard(voterLink, 'קישור ההצבעה')}
                  className={`py-3.5 px-4 rounded-2xl border font-semibold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-white'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <Copy size={16} />
                  <span>העתק קישור</span>
                </button>
              </div>

            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: VOTERS LIST (רשימת מצביעים בלייב)             */}
          {/* ==================================================== */}
          {currentTab === 'voters' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Header & Search */}
              <div className={`rounded-3xl p-4 border space-y-3 transition-all ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={20} className="text-emerald-500" />
                    <h2 className="font-extrabold text-lg">סטטוס מצביעים</h2>
                  </div>
                  <span className="text-xs font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    {doneGuests} / {totalGuests} סיימו
                  </span>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search size={16} className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    value={voterSearch}
                    onChange={e => setVoterSearch(e.target.value)}
                    placeholder="חיפוש אורח או משק בית..."
                    className={`w-full rounded-2xl pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                      isDarkMode
                        ? 'bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500'
                        : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  {voterSearch && (
                    <button
                      onClick={() => setVoterSearch('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      נקה
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setVoterFilter('all')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      voterFilter === 'all'
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
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      voterFilter === 'pending'
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
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      voterFilter === 'done'
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

              {/* Guest Cards List */}
              <div className="space-y-2.5">
                {filteredGuests.map(guest => {
                  const status = getGuestStatus(guest);
                  return (
                    <div
                      key={guest.id}
                      className={`rounded-2xl p-3.5 flex items-center justify-between gap-3 border transition-all ${
                        isDarkMode
                          ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          status === 'done'
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                            : status === 'voting'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                            : isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-slate-400'
                            : 'bg-slate-100 border-slate-200 text-slate-500'
                        }`}>
                          {status === 'done' ? (
                            <CheckCircle2 size={20} />
                          ) : status === 'voting' ? (
                            <Flame size={20} className="animate-bounce" />
                          ) : (
                            <Clock size={20} />
                          )}
                        </div>

                        <div className="overflow-hidden">
                          <div className="font-bold text-base leading-tight truncate">
                            {guest.name}
                          </div>
                          {guest.householdName && (
                            <div className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              {guest.householdName}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`px-3 py-1 rounded-xl text-xs font-bold border shrink-0 ${
                        status === 'done'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : status === 'voting'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : isDarkMode
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {status === 'done' ? 'הצביע (סיום)' : status === 'voting' ? 'מצביע כעת' : 'טרם התחבר'}
                      </span>
                    </div>
                  );
                })}

                {filteredGuests.length === 0 && (
                  <div className={`text-center py-12 rounded-3xl border border-dashed p-6 ${
                    isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500 shadow-xs'
                  }`}>
                    <Users size={36} className="mx-auto text-slate-400 mb-2 opacity-50" />
                    <p className="text-sm font-medium">לא נמצאו מצביעים תואמים לסינון</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: RESULTS & TV DIRECTOR                         */}
          {/* ==================================================== */}
          {currentTab === 'results' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* TV Screen Direct Control Card */}
              <div className={`rounded-3xl p-5 border space-y-4 transition-all ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy size={20} className="text-amber-500" />
                    <h2 className="font-extrabold text-lg">בימוי חשיפת תוצאות בטלוויזיה</h2>
                  </div>
                  <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>חשיפה מדורגת</span>
                </div>

                <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  שלב אחרי שלב: התחל בחשיפת מקום שלישי, עבור למקום שני, ובשיא האירוע הכרז על המנצח!
                </p>

                {/* Show/Hide Carousel Control inside Results Tab */}
                <div className={`flex items-center justify-between rounded-2xl p-3 border ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 text-xs">
                    {isCarouselActive ? <Eye size={16} className="text-emerald-500" /> : <EyeOff size={16} className="text-slate-400" />}
                    <span>גלריית מנות בטלוויזיה:</span>
                    <span className={isCarouselActive ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>
                      {isCarouselActive ? 'פעילה' : 'מוסתרת'}
                    </span>
                  </div>
                  <button
                    onClick={handleToggleMealsCarousel}
                    className={`text-xs py-1 px-2.5 rounded-lg border font-semibold transition-colors ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                        : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100 shadow-xs'
                    }`}
                  >
                    {isCarouselActive ? 'הסתר גלריה' : 'הצג גלריה'}
                  </button>
                </div>

                {/* Stepper Buttons */}
                <div className="space-y-3">
                  {/* Step 1: 3rd Place */}
                  <button
                    onClick={() => handleReveal('3rd')}
                    className={`w-full p-4 rounded-2xl font-bold border-2 transition-all flex items-center justify-between text-right ${
                      eventInfo.revealState === '3rd' || eventInfo.revealState === '2nd' || eventInfo.revealState === '1st'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                        : isDarkMode
                        ? 'bg-slate-900 border-amber-800/40 text-amber-500 hover:border-amber-600'
                        : 'bg-amber-50/60 border-amber-200 text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-sm">
                        🥉
                      </span>
                      <div>
                        <div className="text-base font-extrabold">1. חשוף מקום שלישי</div>
                        <div className={`text-xs font-normal opacity-90`}>
                          {top3[2] ? `מנה: ${top3[2].name} (${top3[2].score} נק')` : 'חשיפת מקום 3 בטלוויזיה'}
                        </div>
                      </div>
                    </div>
                    {(eventInfo.revealState === '3rd' || eventInfo.revealState === '2nd' || eventInfo.revealState === '1st') && (
                      <span className="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
                        נחשף ✓
                      </span>
                    )}
                  </button>

                  {/* Step 2: 2nd Place */}
                  <button
                    onClick={() => handleReveal('2nd')}
                    disabled={eventInfo.revealState === 'none'}
                    className={`w-full p-4 rounded-2xl font-bold border-2 transition-all flex items-center justify-between text-right ${
                      eventInfo.revealState === '2nd' || eventInfo.revealState === '1st'
                        ? 'bg-slate-600 text-white border-slate-400 shadow-md'
                        : isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-500/20 flex items-center justify-center font-bold text-sm">
                        🥈
                      </span>
                      <div>
                        <div className="text-base font-extrabold">2. חשוף מקום שני</div>
                        <div className={`text-xs font-normal opacity-90`}>
                          {top3[1] ? `מנה: ${top3[1].name} (${top3[1].score} נק')` : 'חשיפת מקום 2 בטלוויזיה'}
                        </div>
                      </div>
                    </div>
                    {(eventInfo.revealState === '2nd' || eventInfo.revealState === '1st') && (
                      <span className="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
                        נחשף ✓
                      </span>
                    )}
                  </button>

                  {/* Step 3: 1st Place */}
                  <button
                    onClick={() => handleReveal('1st')}
                    disabled={eventInfo.revealState === 'none' || eventInfo.revealState === '3rd'}
                    className={`w-full p-4 rounded-2xl font-bold border-2 transition-all flex items-center justify-between text-right ${
                      eventInfo.revealState === '1st'
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-black border-yellow-300 shadow-lg scale-[1.01]'
                        : isDarkMode
                        ? 'bg-slate-900 border-yellow-600/40 text-yellow-500 hover:border-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed'
                        : 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-amber-400/30 flex items-center justify-center font-bold text-sm">
                        🥇
                      </span>
                      <div>
                        <div className="text-base font-black">3. חשוף את המנצח הגדול!</div>
                        <div className="text-xs font-medium opacity-90">
                          {top3[0] ? `מנה: ${top3[0].name} (${top3[0].score} נק')` : 'הכרזה רשמית וקונפטי בטלוויזיה'}
                        </div>
                      </div>
                    </div>
                    {eventInfo.revealState === '1st' && (
                      <span className="text-xs font-black bg-black text-amber-400 px-2.5 py-0.5 rounded-full">
                        המנצח 🏆
                      </span>
                    )}
                  </button>
                </div>

                {/* Reset TV display */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => handleReveal('none')}
                    className={`w-full py-3 rounded-xl border text-xs font-semibold transition-colors ${
                      isDarkMode
                        ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    הסתר תוצאות (איפוס מסך טלוויזיה לתצוגה רגילה)
                  </button>
                </div>
              </div>

              {/* Host Confidential Standings Preview */}
              <div className={`rounded-3xl p-5 border space-y-3 transition-all ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-blue-500" />
                    <h3 className="font-extrabold text-base">דירוג מנות בלייב (למארח בלבד)</h3>
                  </div>
                  <span className="text-[11px] bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md font-bold">
                    סודי
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  {mealScores.map((meal, index) => (
                    <div
                      key={meal.id}
                      className={`rounded-2xl p-3 flex items-center justify-between gap-3 border ${
                        isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          index === 0
                            ? 'bg-yellow-400 text-black font-black'
                            : index === 1
                            ? 'bg-slate-300 text-slate-900 font-black'
                            : index === 2
                            ? 'bg-amber-600 text-white font-bold'
                            : isDarkMode
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {index + 1}
                        </span>

                        <div className="overflow-hidden">
                          <div className="font-bold text-sm truncate">{meal.name}</div>
                          {meal.chefs.length > 0 && (
                            <div className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              שף: {meal.chefs.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <span className="text-base font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                          {meal.score}
                        </span>
                        <span className="text-[11px] text-slate-400 mr-1">נק'</span>
                      </div>
                    </div>
                  ))}

                  {mealScores.length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-4">אין מנות משתתפות עדיין</p>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 4: TOOLS & ADMIN (כלים, שיתוף, החלפת אירוע, איפוס)*/}
          {/* ==================================================== */}
          {currentTab === 'tools' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Event Switcher Card */}
              <div className={`rounded-3xl p-5 border space-y-3 transition-all ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center gap-2">
                  <ArrowLeftRight size={20} className="text-indigo-500" />
                  <h3 className="font-extrabold text-lg">החלפת אירוע נוכחי</h3>
                </div>
                <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  האירוע הנוכחי: <strong className="font-bold text-blue-600 dark:text-blue-400">{eventInfo.title}</strong>. ניתן לעבור לניהול אירוע אחר בכל עת.
                </p>
                <button
                  onClick={() => navigate('/host')}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all"
                >
                  <ArrowLeftRight size={16} />
                  <span>בחירת אירוע אחר לניהול</span>
                </button>
              </div>



              {/* Links & Sharing Card */}
              <div className={`rounded-3xl p-5 border space-y-4 transition-all ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center gap-2">
                  <Share2 size={20} className="text-emerald-500" />
                  <h2 className="font-extrabold text-lg">קישורים ושיתוף</h2>
                </div>

                {/* Voters Link */}
                <div className={`rounded-2xl p-3.5 space-y-2 border ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>קישור הצבעה לאורחים:</div>
                  <div className="flex gap-2">
                    <button
                      onClick={shareViaWhatsApp}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Share2 size={14} />
                      <span>וואטסאפ</span>
                    </button>
                    <button
                      onClick={() => copyToClipboard(voterLink, 'קישור הצבעה')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        isDarkMode
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
                <div className={`rounded-2xl p-3.5 space-y-2 border ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>קישור תצוגה לטלוויזיה החכמה:</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(tvLink, 'קישור טלוויזיה')}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Copy size={14} />
                      <span>העתק קישור TV</span>
                    </button>
                    <a
                      href={tvLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        isDarkMode
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

              {/* Guest Management Launcher */}
              <div className={`rounded-3xl p-5 border space-y-3 transition-all ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-purple-500" />
                  <h3 className="font-extrabold text-lg">ניהול אורחים ומשקי בית</h3>
                </div>
                <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  הוספה ועריכה של אורחים, אישורי הגעה, תשלומים, שיוך למשקי בית והגדרות מנות.
                </p>
                <button
                  onClick={openGuestManager}
                  className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all"
                >
                  <Users size={16} />
                  <span>פתח ניהול אורחים מתקדם</span>
                </button>
              </div>

              {/* Danger Zone: Event Reset */}
              <div className={`rounded-3xl p-5 border space-y-3 transition-all ${
                isDarkMode ? 'bg-rose-950/20 border-rose-900/40' : 'bg-rose-50/50 border-rose-200'
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
                  className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs"
                >
                  <RotateCcw size={16} />
                  <span>איפוס מלא של האירוע...</span>
                </button>
              </div>

            </div>
          )}

        </main>

        {/* --- FIXED BOTTOM NAVIGATION BAR --- */}
        <nav className={`fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl border-t px-3 py-2 flex items-center justify-around max-w-lg mx-auto shadow-lg transition-colors ${
          isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/95 border-slate-200'
        }`}>
          {/* Cockpit Tab */}
          <button
            onClick={() => setCurrentTab('cockpit')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
              currentTab === 'cockpit'
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
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all relative ${
              currentTab === 'voters'
                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold scale-105'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Users size={20} className={currentTab === 'voters' ? 'stroke-[2.5]' : ''} />
            <span className="text-[11px]">מצביעים</span>
            {pendingGuests > 0 && (
              <span className="absolute top-1 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>

          {/* Results Tab */}
          <button
            onClick={() => setCurrentTab('results')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
              currentTab === 'results'
                ? 'text-amber-500 font-extrabold scale-105'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Trophy size={20} className={currentTab === 'results' ? 'stroke-[2.5]' : ''} />
            <span className="text-[11px]">תוצאות TV</span>
          </button>

          {/* Tools Tab */}
          <button
            onClick={() => setCurrentTab('tools')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
              currentTab === 'tools'
                ? 'text-indigo-600 dark:text-indigo-400 font-extrabold scale-105'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Share2 size={20} className={currentTab === 'tools' ? 'stroke-[2.5]' : ''} />
            <span className="text-[11px]">כלים</span>
          </button>
        </nav>

        {/* --- FULLSCREEN GUEST MANAGER MODAL --- */}
        {isGuestManagerOpen && (
          <div className={`fixed inset-0 z-50 flex flex-col animate-in slide-in-from-bottom-5 duration-200 ${
            isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
          }`}>
            <header className={`sticky top-0 z-20 border-b px-4 py-3 flex items-center justify-between ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <button
                onClick={closeGuestManager}
                className={`p-2 rounded-full flex items-center justify-center transition-colors ${
                  isDarkMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="חזרה"
              >
                <ArrowRight size={20} />
              </button>
              <h2 className="text-lg font-bold">ניהול אורחים מלא</h2>
              <div className="w-8" />
            </header>
            <div className="flex-1 overflow-y-auto md:overflow-hidden p-2.5 sm:p-4 max-w-5xl mx-auto w-full flex flex-col admin-scroll overscroll-contain min-h-0">
              <GuestManager
                guests={guests}
                meals={meals}
                eventInfo={eventInfo}
                eventId={eventId}
              />
            </div>
          </div>
        )}

        {/* --- DANGER ZONE RESET CONFIRM MODAL --- */}
        {isResetConfirmOpen && (
          <div 
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
            onClick={() => setIsResetConfirmOpen(false)}
          >
            <div 
              className={`rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200 border cursor-default ${
                isDarkMode ? 'bg-slate-900 border-rose-500/40 text-white' : 'bg-white border-rose-200 text-slate-900'
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
                  className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-md transition-all active:scale-95"
                >
                  הבנתי, אפס את האירוע עכשיו
                </button>
                <button
                  onClick={() => setIsResetConfirmOpen(false)}
                  className={`w-full py-3 rounded-xl text-xs font-semibold transition-colors ${
                    isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
