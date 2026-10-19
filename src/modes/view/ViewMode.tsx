import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useFirebaseData } from '../../hooks/useFirebaseData';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { getThemeStyles } from '../../utils/theme';
import { ChefHat, Users, ArrowRight } from 'lucide-react';
import { buildGallerySchedule, type ScheduledMealSlide } from '../../utils/mealGalleryScheduler';
import { getOrderedChefNamesForMeal } from '../../utils/mealChefOrder';

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface CircularTimerProps {
  timeRemaining: number;
  totalDuration: number;
  size?: number;
  strokeWidth?: number;
  fontSizeClass?: string;
  showLabel?: boolean;
}

const CircularTimer = ({
  timeRemaining,
  totalDuration,
  size = 104,
  strokeWidth = 6,
  fontSizeClass = 'text-2xl md:text-3xl',
  showLabel = false,
}: CircularTimerProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Progress from 1 (full circle) down to 0 (empty circle)
  const progress = totalDuration > 0
    ? Math.max(0, Math.min(1, timeRemaining / totalDuration))
    : 0;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className="relative flex items-center justify-center shrink-0 rounded-full shadow-[0_0_25px_rgba(0,0,0,0.8)] bg-black/75 backdrop-blur-md"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 transform overflow-visible"
      >
        {/* Track circle (subtle background ring) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth={strokeWidth}
        />
        {/* Animated emptying progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--theme-primary, #FF7A00)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 1s linear',
            opacity: progress <= 0 ? 0 : 1,
            filter: 'drop-shadow(0 0 6px var(--theme-primary, #FF7A00))',
          }}
        />
      </svg>

      {/* Center readout in Assistant font */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        <span
          className={`${fontSizeClass} font-bold text-white tracking-tight tabular-nums leading-none`}
          style={{ fontFamily: "'Assistant', sans-serif" }}
        >
          {formatTime(timeRemaining)}
        </span>
        {showLabel && (
          <span
            className="text-gray-400 text-sm md:text-lg mt-2 font-medium tracking-wide"
            style={{ fontFamily: "'Assistant', sans-serif" }}
          >
            זמן נותר
          </span>
        )}
      </div>
    </div>
  );
};

const Confetti = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(80)].map((_, i) => (
        <motion.div
          key={i}
          initial={{
            y: -50,
            x: `${Math.random() * 100}vw`,
            rotate: 0,
            scale: Math.random() * 0.5 + 0.5
          }}
          animate={{
            y: '110vh',
            rotate: Math.random() * 720 - 360,
          }}
          transition={{
            duration: Math.random() * 3 + 2.5,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: "linear"
          }}
          className={`absolute top-0 w-6 h-4 rounded-sm ${['bg-red-500', 'bg-yellow-400', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'][Math.floor(Math.random() * 6)]}`}
          style={{ opacity: 0.8 }}
        />
      ))}
    </div>
  );
};

const FLAVOR_TEXTS = [
  'המכשפות רוקחות שיקוי עבור המנצח...',
  'המדיום אוספת את קולות האורחים...',
  'ממתינים לאל-מתים ולרוחות שיסיימו להצביע...',
  'העטלפים סופרים את פתקי ההצבעה...',
  'הרוחות בוחשות בקדירת הניקוד המסתורית...',
  'עורבי הלילה מביאים את תוצאות הקלפי מהיער...',
  'השדים מסכמים את נקודות השפים...'
];

function FlavorTextRotator() {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isVisible) {
      // Appear for 5 seconds
      timer = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
    } else {
      // Don't show any text for 5 seconds, then show new text
      timer = setTimeout(() => {
        setIndex((prev) => (prev + 1) % FLAVOR_TEXTS.length);
        setIsVisible(true);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [isVisible]);

  return (
    <div className="absolute bottom-8 md:bottom-12 inset-x-0 flex justify-center items-center z-30 pointer-events-none px-6" dir="rtl">
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="bg-black/75 backdrop-blur-md px-8 py-3.5 rounded-full border border-theme-primary/30 shadow-[0_0_30px_rgba(0,0,0,0.8)]"
          >
            <p className="text-xl md:text-2xl lg:text-3xl text-theme-primary font-medium tracking-wide drop-shadow-md">
              {FLAVOR_TEXTS[index]}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Persistent in-memory image cache to eliminate network latency between rotations
const globalImageCache = new Map<string, HTMLImageElement>();

/**
 * Calculates adaptive title font sizing so titles never exceed 2 lines.
 */
const getTitleClass = (name: string) => {
  if (name.length > 45) return 'text-2xl md:text-3xl lg:text-4xl';
  if (name.length > 25) return 'text-3xl md:text-4xl lg:text-5xl';
  return 'text-4xl md:text-5xl lg:text-6xl';
};

const FONT_LEVELS = [
  'text-2xl md:text-3xl',
  'text-xl md:text-2xl',
  'text-lg md:text-xl'
];

interface AutoScrollDescriptionProps {
  text?: string;
  slideId: string;
  durationMs: number;
  onExtraTimeNeeded: (needed: boolean) => void;
}

/**
 * Component that auto-sizes description text without trimming.
 * If text still overflows at smallest font size, triggers slow linear scrolling
 * (pause 2s at top -> smooth scroll to end -> pause 2s at bottom) and requests +5s extra slide duration.
 */
function AutoScrollDescription({ text, slideId, durationMs, onExtraTimeNeeded }: AutoScrollDescriptionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLParagraphElement | null>(null);
  const [level, setLevel] = useState(0);
  const [overflow, setOverflow] = useState(0);

  // Reset when slide changes
  useEffect(() => {
    setLevel(0);
    setOverflow(0);
  }, [slideId]);

  // Measure overflow and step down font or trigger scroll
  useLayoutEffect(() => {
    if (!text || !containerRef.current || !contentRef.current) return;

    const containerHeight = containerRef.current.clientHeight;
    const contentHeight = contentRef.current.scrollHeight;
    const diff = contentHeight - containerHeight;

    if (diff > 4) {
      if (level < FONT_LEVELS.length - 1) {
        // Step down font size to fit
        setLevel((prev) => prev + 1);
      } else {
        // At smallest font size and still overflowing: enable auto-scroll + extra 5s
        setOverflow(diff);
        onExtraTimeNeeded(true);
      }
    } else {
      setOverflow(0);
      onExtraTimeNeeded(false);
    }
  }, [text, level, slideId, onExtraTimeNeeded]);

  if (!text) return null;

  const durationSec = Math.max(durationMs / 1000, 1);
  const pauseStartRatio = Math.min(0.2, 2 / durationSec);
  const pauseEndRatio = Math.max(0.8, (durationSec - 2) / durationSec);

  return (
    <div
      ref={containerRef}
      className="w-full flex-1 min-h-0 relative overflow-hidden flex flex-col justify-center my-3"
    >
      <motion.div
        key={`${slideId}-${level}`}
        initial={{ y: 0 }}
        animate={
          overflow > 0
            ? { y: [0, 0, -overflow, -overflow] }
            : { y: 0 }
        }
        transition={
          overflow > 0
            ? {
                duration: durationSec,
                times: [0, pauseStartRatio, pauseEndRatio, 1],
                ease: 'linear'
              }
            : { duration: 0.3 }
        }
      >
        <p
          ref={contentRef}
          className={`${FONT_LEVELS[level]} text-white/95 leading-relaxed font-medium whitespace-pre-line drop-shadow-[0_2px_10px_rgba(0,0,0,1)]`}
        >
          {text}
        </p>
      </motion.div>
    </div>
  );
}

export default function ViewMode() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { eventInfo, guests, meals, votes, generalSettings, loading, error } = useFirebaseData(eventId);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [prevRevealState, setPrevRevealState] = useState<'none' | '3rd' | '2nd' | '1st'>('none');
  const [showDrumroll, setShowDrumroll] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasRevealed, setHasRevealed] = useState(false);
  const [dramaticState, setDramaticState] = useState<'none' | 'countdown' | 'ended'>('none');
  const [extraTimeNeeded, setExtraTimeNeeded] = useState(false);

  // Handle remote Back button or Escape to return to event selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || (e as any).keyCode === 4) {
        navigate('/view');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Keep screen awake for TV view mode
  useEffect(() => {
    let wakeLockSentinel: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // ignore wake lock failure on unsupported browsers
      }
    };
    requestWakeLock();
    const handleVisibilityChange = () => {
      if (wakeLockSentinel !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      wakeLockSentinel?.release().catch(() => {});
    };
  }, []);

  const [bgStep, setBgStep] = useState(0);

  // Anti-burn-in offsets: discrete 2-4 pixel steps
  const BG_OFFSETS = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 3 },
    { x: 0, y: 3 },
    { x: -3, y: 3 },
    { x: -3, y: 0 },
    { x: -3, y: -3 },
    { x: 0, y: -3 },
    { x: 3, y: -3 },
    { x: 4, y: 0 },
    { x: 3, y: 2 },
    { x: 0, y: 4 },
    { x: -4, y: 2 },
    { x: -4, y: 0 },
    { x: -2, y: -4 },
    { x: 0, y: -4 },
    { x: 2, y: -3 },
  ];

  const currentBgOffset = BG_OFFSETS[bgStep % BG_OFFSETS.length];
  const prevBgOffset = BG_OFFSETS[(bgStep - 1 + BG_OFFSETS.length) % BG_OFFSETS.length];

  // Let an offset be {x: X, y: Y}. Let M = max(|X|, |Y|). Each glide lasts 3M seconds.
  const rawM = Math.max(Math.abs(currentBgOffset.x), Math.abs(currentBgOffset.y));
  const deltaM = Math.max(
    Math.abs(currentBgOffset.x - prevBgOffset.x),
    Math.abs(currentBgOffset.y - prevBgOffset.y)
  );
  const M = rawM > 0 ? rawM : (deltaM > 0 ? deltaM : 3);
  const glideDurationSeconds = 3 * M;

  // Anti-burn-in shift: glides for 3M seconds once every 3 minutes, remaining static & crisp in between
  useEffect(() => {
    const BG_SHIFT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
    const interval = setInterval(() => {
      setBgStep((prev) => (prev + 1) % BG_OFFSETS.length);
    }, BG_SHIFT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [BG_OFFSETS.length]);


  // Timer effect
  const [totalDuration, setTotalDuration] = useState<number | null>(null);

  useEffect(() => {
    if (!eventInfo) return;

    let interval: ReturnType<typeof setInterval>;
    if (eventInfo.timerStatus === 'running' && eventInfo.timerEndTime) {
      const remaining = Math.max(0, eventInfo.timerEndTime - Date.now());
      setTimeRemaining(remaining);
      interval = setInterval(() => {
        const nextRemaining = Math.max(0, eventInfo.timerEndTime! - Date.now());
        setTimeRemaining(nextRemaining);
      }, 1000);
    } else {
      setTimeRemaining(null);
    }

    return () => clearInterval(interval);
  }, [eventInfo?.timerStatus, eventInfo?.timerEndTime]);

  // Sync total duration for the emptying circular timer
  useEffect(() => {
    if (eventInfo?.timerStatus === 'running' && timeRemaining !== null) {
      if (eventInfo.timerDuration) {
        setTotalDuration(eventInfo.timerDuration);
      } else {
        setTotalDuration((prev) => (prev === null || timeRemaining > prev ? timeRemaining : prev));
      }
    } else if (eventInfo?.timerStatus !== 'running') {
      setTotalDuration(null);
    }
  }, [eventInfo?.timerStatus, eventInfo?.timerDuration, timeRemaining]);

  // Handle dramatic state
  useEffect(() => {
    if (eventInfo?.timerStatus === 'running' && timeRemaining !== null && timeRemaining > 0 && timeRemaining <= 10000) {
      setDramaticState('countdown');
    } else if ((eventInfo?.timerStatus === 'ended' || timeRemaining === 0) && dramaticState === 'countdown') {
      setDramaticState('ended');
      setTimeout(() => setDramaticState('none'), 4000);
    } else if (eventInfo?.timerStatus !== 'ended' && timeRemaining === null) {
      setDramaticState('none');
    }
  }, [timeRemaining, eventInfo?.timerStatus, dramaticState]);

  // Handle drumroll trigger on reveal state change
  useEffect(() => {
    if (eventInfo && eventInfo.revealState !== prevRevealState) {
      if (eventInfo.revealState !== 'none') {
        setHasRevealed(true);
      }
      if (prevRevealState === 'none' && eventInfo.revealState !== 'none') {
        setShowDrumroll(true);
        // Hide drumroll after 3 seconds
        setTimeout(() => setShowDrumroll(false), 3000);
      }
      setPrevRevealState(eventInfo.revealState);
    }
  }, [eventInfo?.revealState, prevRevealState]);

  // Build scheduled slides with dynamic durations and chef-conflict avoidance
  const slides: ScheduledMealSlide[] = useMemo(() => {
    return buildGallerySchedule({
      meals,
      guests,
      timerDurationMs: eventInfo?.timerDuration,
      timerStatus: eventInfo?.timerStatus,
    });
  }, [meals, guests, eventInfo?.timerDuration, eventInfo?.timerStatus]);

  // Persistent memory cache and active ahead-of-time image preloading (current + next 2 slides)
  useEffect(() => {
    if (!slides || slides.length === 0) return;
    const preloadIndices = [
      activeIndex,
      (activeIndex + 1) % slides.length,
      (activeIndex + 2) % slides.length
    ];
    preloadIndices.forEach((idx) => {
      const slide = slides[idx];
      const meal = slide?.meals[0];
      if (meal?.imageUrl && !globalImageCache.has(meal.imageUrl)) {
        const img = new Image();
        img.src = meal.imageUrl;
        globalImageCache.set(meal.imageUrl, img);
      }
      if (meal?.lowResImageUrl && !globalImageCache.has(meal.lowResImageUrl)) {
        const lowImg = new Image();
        lowImg.src = meal.lowResImageUrl;
        globalImageCache.set(meal.lowResImageUrl, lowImg);
      }
    });
  }, [slides, activeIndex]);

  // Auto-rotating gallery effect with dynamic per-slide duration
  useEffect(() => {
    if (!slides || slides.length === 0) return;

    // Don't rotate if we are showing results or have already revealed results
    if (hasRevealed || (eventInfo?.revealState && eventInfo.revealState !== 'none')) {
      return;
    }

    const currentSlide = slides[activeIndex] || slides[0];
    const baseDuration = currentSlide?.durationMs || 15000;
    const duration = baseDuration + (extraTimeNeeded ? 5000 : 0);

    const timeout = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
      setExtraTimeNeeded(false);
    }, duration);

    return () => clearTimeout(timeout);
  }, [slides, activeIndex, eventInfo?.revealState, hasRevealed, extraTimeNeeded]);

  // Adjust activeIndex if it goes out of bounds when slides update
  useEffect(() => {
    if (slides && slides.length > 0 && activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [slides, activeIndex]);

  // Calculate eligible attendees who haven't completed voting yet (excluding guests not allowed to vote)
  const eligibleVoters = useMemo(() => {
    return guests ? guests.filter(g => g.rsvpStatus !== 'not_coming' && g.canVote !== false) : [];
  }, [guests]);

  const doneGuestsCount = useMemo(() => {
    return eligibleVoters.filter(guest => {
      const guestVotesCount = votes ? votes.filter(v => v.guestId === guest.id).length : 0;
      return guestVotesCount >= 2 || guest.status === 'done';
    }).length;
  }, [eligibleVoters, votes]);

  const stillVotingCount = Math.max(0, eligibleVoters.length - doneGuestsCount);
  const stillVotingText = stillVotingCount === 1
    ? 'אדם 1 עדיין מצביע'
    : `${stillVotingCount} אנשים עדיין מצביעים`;

  if (loading) return <div className="flex-1 flex items-center justify-center h-screen w-screen bg-black text-white overflow-hidden">טוען...</div>;

  if (error || !eventId) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center h-screen w-screen bg-black overflow-hidden">
        <h2 className="text-2xl text-red-500 mb-4">{error || "אירוע לא נמצא"}</h2>
      </div>
    );
  }

  // Calculate scores (excluding non-participating meals from competition rankings)
  const mealScores = meals
    .filter(meal => !meal.isNonParticipating)
    .map(meal => {
      const mealVotes = votes.filter(v => v.mealId === meal.id);
      const score = mealVotes.reduce((sum, vote) => sum + vote.points, 0);
      return { ...meal, score };
    }).sort((a, b) => b.score - a.score);

  const top3 = mealScores.slice(0, 3);
  const show3rd = eventInfo?.revealState === '3rd' || eventInfo?.revealState === '2nd' || eventInfo?.revealState === '1st';
  const show2nd = eventInfo?.revealState === '2nd' || eventInfo?.revealState === '1st';
  const show1st = eventInfo?.revealState === '1st';

  const themeStyles = getThemeStyles(eventInfo?.activeThemeId, [
    ...(generalSettings?.themes || []),
    ...(eventInfo?.themes || [])
  ]);
  const { backgroundImage: _bg, backgroundSize: _bs, backgroundPosition: _bp, ...containerStyles } = themeStyles as any;

  const isRevealing = eventInfo?.revealState && eventInfo.revealState !== 'none';
  const isHiddenResults = hasRevealed && eventInfo?.revealState === 'none';
  // When time is up (timerStatus === 'ended'), do not get back to showing meals by default.
  // The host can start the meals show any moment via showMealsCarousel === true.
  const isCarouselEnabled = eventInfo?.timerStatus === 'ended'
    ? eventInfo?.showMealsCarousel === true
    : eventInfo?.showMealsCarousel !== false;
  const shouldShowMeals = isCarouselEnabled && !isRevealing && !isHiddenResults && slides.length > 0;
  const currentSlide = slides[activeIndex] || slides[0];

  /**
   * Returns sorted names of attending chefs for a meal:
   * 1. Different households: ordered by household name (a-z).
   * 2. Inner order (in household): ordered as in the guests list (respecting custom reordering).
   * Guests with rsvpStatus === 'not_coming' are excluded from View Mode display.
   */
  const getAttendingChefs = (meal?: (typeof meals)[0]): string[] => {
    return getOrderedChefNamesForMeal(meal, guests, { filterAttendingOnly: true });
  };

  return (
    <div style={containerStyles} className="absolute inset-0 flex flex-col overflow-hidden bg-theme-bg">
      {/* Subtle TV back navigation button (visible on hover or remote focus) */}
      <button
        onClick={() => navigate('/view')}
        aria-label="חזרה לרשימת אירועים"
        className="fixed top-4 right-4 z-50 p-2.5 rounded-full bg-black/40 hover:bg-black/80 text-white/50 hover:text-white backdrop-blur-md transition-all duration-300 opacity-0 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
        title="חזרה לבחירת אירוע"
      >
        <ArrowRight size={22} />
      </button>

      {/* Crisp Integer-Stepped Background (zoomed in to prevent black edges, anti-burn-in) */}
      <img
        src="/spooky_kitchen_bg.webp"
        alt="Background"
        className="absolute -top-[5%] -left-[5%] w-[110%] h-[110%] max-w-none object-cover z-0 pointer-events-none"
        style={{
          transform: `translate3d(${currentBgOffset.x}px, ${currentBgOffset.y}px, 0)`,
          transition: `transform ${glideDurationSeconds}s ease-in-out`,
          willChange: 'transform',
        }}
      />
      {/* Background Dimmer - removed when hiding results to show full image */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${isHiddenResults ? 'opacity-0' : 'bg-black/60'} z-0`}></div>

      {/* Dramatic Full Screen Timer Overlay */}
      <AnimatePresence>
        {(dramaticState === 'countdown' || dramaticState === 'ended') && !isRevealing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-80 backdrop-blur-md"
          >
            {dramaticState === 'countdown' ? (
              <>
                <motion.div
                  key={timeRemaining}
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="text-9xl md:text-[20rem] font-bold text-red-500 drop-shadow-[0_0_80px_rgba(239,68,68,0.8)]"
                  style={{ fontFamily: "'Assistant', sans-serif" }}
                >
                  {Math.ceil(timeRemaining! / 1000)}
                </motion.div>
                <h2 className="text-5xl mt-12 text-white font-theme-main tracking-widest drop-shadow-md">
                  ההצבעה מסתיימת!
                </h2>
              </>
            ) : (
              <motion.h2
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-7xl md:text-9xl text-white font-theme-main drop-shadow-[0_0_50px_rgba(255,255,255,0.8)]"
              >
                ההצבעה הסתיימה!
              </motion.h2>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confetti overlay for 1st place */}
      {show1st && <Confetti />}

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex justify-center items-center w-full h-full overflow-hidden">

        {/* Drumroll Overlay */}
        <AnimatePresence>
          {showDrumroll && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm"
            >
              <h2 className="text-9xl md:text-[12rem] font-theme-main text-theme-primary animate-bounce drop-shadow-[0_0_80px_var(--theme-primary)]">
                ...תוצאות...
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Corner Timer & Voter Counter (overlay over both sections, independent of details layout) */}
        <AnimatePresence>
          {shouldShowMeals && meals.length > 0 && eventInfo?.timerStatus === 'running' && dramaticState !== 'countdown' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.3 }}
              className="absolute top-6 right-6 md:top-8 md:right-8 z-40 flex items-center gap-4 pointer-events-auto"
              dir="rtl"
            >
              {timeRemaining !== null && (
                <CircularTimer
                  timeRemaining={timeRemaining}
                  totalDuration={totalDuration || timeRemaining}
                  size={104}
                  strokeWidth={6}
                  fontSizeClass="text-2xl md:text-3xl"
                />
              )}
              <div
                className="bg-black/75 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.6)] flex items-center gap-2.5"
                style={{ fontFamily: "'Assistant', sans-serif" }}
              >
                <Users className="w-5 h-5 text-theme-primary shrink-0 drop-shadow" />
                <span className="text-gray-200 font-bold text-base md:text-lg whitespace-nowrap">
                  {stillVotingText}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Meal Gallery Display: Single Meal Only (40% Details on Left, 60% Image on Right) */}
        {shouldShowMeals && currentSlide && currentSlide.meals[0] && (
          <div className="absolute inset-0 w-full h-full z-10 flex flex-row">
            {/* Left Column: Meal Details */}
            <div className="w-[40%] h-full flex flex-col justify-between p-6 md:p-8 pl-2 md:pl-4 z-20" dir="rtl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="w-full h-full flex flex-col justify-between"
                >
                  {/* Top section: Non-participating badge + Title (Pinned) */}
                  <div className="flex flex-col text-right gap-3 shrink-0">
                    {currentSlide.meals[0].isNonParticipating && (
                      <div className="self-start bg-amber-500/90 text-black font-extrabold text-base md:text-xl px-5 py-1.5 rounded-full shadow-lg border border-amber-300 backdrop-blur-md">
                        מחוץ לתחרות
                      </div>
                    )}

                    <h2
                      className={`${getTitleClass(currentSlide.meals[0].name)} font-theme-main font-bold text-theme-primary leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,1)] line-clamp-2`}
                    >
                      {currentSlide.meals[0].name}
                    </h2>
                  </div>

                  {/* Middle section: Auto-sizing and auto-scrolling Description */}
                  <AutoScrollDescription
                    text={currentSlide.meals[0].description}
                    slideId={currentSlide.id}
                    durationMs={(currentSlide?.durationMs || 15000) + (extraTimeNeeded ? 5000 : 0)}
                    onExtraTimeNeeded={setExtraTimeNeeded}
                  />

                  {/* Bottom section: White Chef hat with side lines + unbreakable chef names below */}
                  {(() => {
                    const attendingChefs = getAttendingChefs(currentSlide.meals[0]);
                    if (attendingChefs.length === 0) return null;
                    return (
                      <div className="mt-auto pt-3 shrink-0 flex flex-col items-center gap-2.5 w-full">
                        {/* Chef Hat with two lines on its sides */}
                        <div className="w-full flex items-center gap-3">
                          <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-white/40" />
                          <ChefHat className="text-white w-7 h-7 md:w-8 md:h-8 drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)] shrink-0" />
                          <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-white/40 to-white/40" />
                        </div>

                        {/* Chef names below hat, each name unbreakable */}
                        <div className="w-full text-center flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
                          {attendingChefs.map((chef, idx) => (
                            <span key={idx} className="inline-flex items-center">
                              <span className="inline-block whitespace-nowrap text-xl md:text-2xl text-gray-100 font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,1)] tracking-wide">
                                {chef}
                              </span>
                              {idx < attendingChefs.length - 1 && (
                                <span className="text-white/40 mx-2 text-lg select-none">|</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right Column: Large Meal Image with tighter padding and progressive loading */}
            <div className="w-[60%] h-full flex items-center justify-center p-4 md:p-6 pr-2 md:pr-4 z-20">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="w-full h-full relative flex items-center justify-center"
                >
                  {currentSlide.meals[0].lowResImageUrl && (
                    <img
                      src={currentSlide.meals[0].lowResImageUrl}
                      alt=""
                      aria-hidden="true"
                      className="absolute max-w-full max-h-full object-contain filter blur-sm scale-95 opacity-50 pointer-events-none transition-opacity duration-300"
                    />
                  )}
                  <img
                    src={currentSlide.meals[0].imageUrl}
                    alt={currentSlide.meals[0].name}
                    loading="eager"
                    decoding="sync"
                    className="relative max-w-full max-h-full object-contain drop-shadow-[0_25px_60px_rgba(0,0,0,0.85)] rounded-2xl z-10"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Centered Timer / Event View when Meals Carousel is Hidden */}
        {!shouldShowMeals && !isRevealing && !showDrumroll && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center" dir="rtl">
            {eventInfo?.timerStatus === 'running' && dramaticState !== 'countdown' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-6"
              >
                <h2 className="text-4xl md:text-6xl font-theme-main text-theme-primary drop-shadow-lg">
                  {eventInfo?.title}
                </h2>
                {timeRemaining !== null && (
                  <CircularTimer
                    timeRemaining={timeRemaining}
                    totalDuration={totalDuration || timeRemaining}
                    size={260}
                    strokeWidth={10}
                    fontSizeClass="text-6xl md:text-7xl"
                    showLabel
                  />
                )}
                <div
                  className="bg-black/75 backdrop-blur-md px-8 py-3 rounded-full border border-white/20 shadow-xl flex items-center gap-3"
                  style={{ fontFamily: "'Assistant', sans-serif" }}
                >
                  <Users className="w-6 h-6 text-theme-primary shrink-0 drop-shadow" />
                  <span className="text-gray-200 font-bold text-xl md:text-2xl">
                    {stillVotingText}
                  </span>
                </div>
              </motion.div>
            ) : !isHiddenResults ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4 max-w-3xl"
              >
                <h1 className="text-6xl md:text-8xl font-theme-main text-theme-primary drop-shadow-2xl">
                  {eventInfo?.title || 'תחרות בישול'}
                </h1>
                {eventInfo?.subtitle && (
                  <p className="text-2xl md:text-4xl text-gray-300 font-medium leading-relaxed drop-shadow-md">
                    {eventInfo.subtitle}
                  </p>
                )}
              </motion.div>
            ) : null}
          </div>
        )}

        {/* Flavor Texts when Time is Up & Carousel is Hidden */}
        {eventInfo?.timerStatus === 'ended' && !isRevealing && !showDrumroll && !shouldShowMeals && eventInfo?.showFlavorTexts !== false && (
          <FlavorTextRotator />
        )}

        {/* Reveal Podium */}
        {isRevealing && !showDrumroll && (
          <div className="absolute bottom-0 inset-x-0 flex justify-center items-end gap-6 md:gap-12 w-full px-[5%] z-30">

            {/* 2nd Place */}
            {top3.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 300 }}
                animate={{ opacity: show2nd ? 1 : 0, y: show2nd ? 0 : 300 }}
                className="flex flex-col items-center flex-1 order-1 max-w-[28vw]"
              >
                <div className="relative w-full aspect-square">
                  <img src="/medal_2nd.png" alt="2nd Place" className="absolute -top-10 -right-10 w-28 h-28 object-contain z-40 drop-shadow-xl" />
                  <div className="w-full h-full relative rounded-3xl overflow-hidden border-[6px] border-gray-400 shadow-[0_0_50px_rgba(156,163,175,0.6)] bg-black">
                    {/* Score */}
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <p className="text-gray-300 font-bold text-6xl drop-shadow-lg">{top3[1].score} נק׳</p>
                    </div>
                    {/* Meal info delayed */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: show2nd ? 1 : 0 }}
                      transition={{ delay: 2.5, duration: 1 }}
                      className="absolute inset-0 z-20 flex flex-col bg-black"
                    >
                      <div className="w-full h-1/2 p-4 pb-0">
                        <img src={top3[1].imageUrl} alt={top3[1].name} className="w-full h-full object-contain drop-shadow-lg" />
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                        <h3 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">{top3[1].name}</h3>
                        {(() => {
                          const chefs = getAttendingChefs(top3[1]);
                          return chefs.length > 0 ? (
                            <p className="text-white font-semibold mt-2 text-xl md:text-2xl">שפים: {chefs.join(', ')}</p>
                          ) : null;
                        })()}
                      </div>
                    </motion.div>
                  </div>
                </div>
                <div className="w-[85%] h-[25vh] bg-gradient-to-b from-gray-500 to-gray-800 mt-6 rounded-t-2xl shadow-[inset_0_10px_30px_rgba(0,0,0,0.6)] border-t-2 border-gray-400"></div>
              </motion.div>
            )}

            {/* 1st Place */}
            {top3.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 300 }}
                animate={{ opacity: show1st ? 1 : 0, y: show1st ? 0 : 300 }}
                className="flex flex-col items-center flex-1 order-2 z-40 max-w-[32vw]"
              >
                <div className="relative w-full aspect-[4/5]">
                  <img src="/medal_1st.png" alt="1st Place" className="absolute -top-12 -right-12 w-36 h-36 object-contain z-40 drop-shadow-xl" />
                  <div className="w-full h-full relative rounded-3xl overflow-hidden border-[8px] border-yellow-500 shadow-[0_0_100px_rgba(250,204,21,0.9)] bg-black">
                    {/* Score */}
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <p className="text-yellow-400 font-extrabold text-[5.5rem] drop-shadow-xl">{top3[0].score} נק׳</p>
                    </div>
                    {/* Meal info delayed */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: show1st ? 1 : 0 }}
                      transition={{ delay: 3.5, duration: 1 }}
                      className="absolute inset-0 z-20 flex flex-col bg-black"
                    >
                      <div className="w-full h-1/2 p-6 pb-0">
                        <img src={top3[0].imageUrl} alt={top3[0].name} className="w-full h-full object-contain drop-shadow-lg" />
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                        <h3 className="text-4xl md:text-5xl font-bold text-white mb-2 leading-tight">{top3[0].name}</h3>
                        {(() => {
                          const chefs = getAttendingChefs(top3[0]);
                          return chefs.length > 0 ? (
                            <p className="text-white font-semibold mt-4 text-2xl md:text-3xl">שפים: {chefs.join(', ')}</p>
                          ) : null;
                        })()}
                      </div>
                    </motion.div>
                  </div>
                </div>
                <div className="w-full h-[35vh] bg-gradient-to-b from-yellow-500 to-yellow-800 mt-8 rounded-t-2xl shadow-[inset_0_15px_40px_rgba(0,0,0,0.7)] border-t-4 border-yellow-300"></div>
              </motion.div>
            )}

            {/* 3rd Place */}
            {top3.length > 2 && (
              <motion.div
                initial={{ opacity: 0, y: 300 }}
                animate={{ opacity: show3rd ? 1 : 0, y: show3rd ? 0 : 300 }}
                className="flex flex-col items-center flex-1 order-3 max-w-[25vw]"
              >
                <div className="relative w-full aspect-square">
                  <img src="/medal_3rd.png" alt="3rd Place" className="absolute -top-10 -right-10 w-28 h-28 object-contain z-40 drop-shadow-xl" />
                  <div className="w-full h-full relative rounded-3xl overflow-hidden border-[6px] border-orange-700 shadow-[0_0_50px_rgba(249,115,22,0.6)] bg-black">
                    {/* Score */}
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <p className="text-theme-primary font-bold text-6xl drop-shadow-lg">{top3[2].score} נק׳</p>
                    </div>
                    {/* Meal info delayed */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: show3rd ? 1 : 0 }}
                      transition={{ delay: 1.5, duration: 1 }}
                      className="absolute inset-0 z-20 flex flex-col bg-black"
                    >
                      <div className="w-full h-1/2 p-4 pb-0">
                        <img src={top3[2].imageUrl} alt={top3[2].name} className="w-full h-full object-contain drop-shadow-lg" />
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                        <h3 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">{top3[2].name}</h3>
                        {(() => {
                          const chefs = getAttendingChefs(top3[2]);
                          return chefs.length > 0 ? (
                            <p className="text-white font-semibold mt-2 text-xl md:text-2xl">שפים: {chefs.join(', ')}</p>
                          ) : null;
                        })()}
                      </div>
                    </motion.div>
                  </div>
                </div>
                <div className="w-[85%] h-[20vh] bg-gradient-to-b from-orange-700 to-orange-950 mt-6 rounded-t-2xl shadow-[inset_0_10px_30px_rgba(0,0,0,0.6)] border-t-2 border-orange-600"></div>
              </motion.div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
