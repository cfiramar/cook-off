import { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { useFirebaseData, type Meal } from '../../hooks/useFirebaseData';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { getThemeStyles } from '../../utils/theme';
import { ChefHat, Users, ArrowRight, Sparkles } from 'lucide-react';
import { buildGallerySchedule, type ScheduledMealSlide } from '../../utils/mealGalleryScheduler';
import { getOrderedChefNamesForMeal } from '../../utils/mealChefOrder';
import { isHebrewText, getTextDirection, getTitleFontFamily } from '../../utils/textUtils';
import ViewSplashOverlay from './components/ViewSplashOverlay';

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
      className="relative flex items-center justify-center shrink-0 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.85)] bg-black/80 backdrop-blur-md"
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
            filter: 'drop-shadow(0 0 10px var(--theme-primary, #FF7A00))',
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
            className="text-gray-300 text-sm md:text-lg mt-2 font-medium tracking-wide"
            style={{ fontFamily: "'Assistant', sans-serif" }}
          >
            זמן נותר
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Rich, festive confetti for 1st place celebration.
 * 160 colorful, golden, metallic pieces with physics & sway.
 */
const Confetti = () => {
  const pieces = useMemo(() => {
    const colors = [
      '#FFD700', '#FFA500', '#FF4500', '#FF1493',
      '#00E5FF', '#76FF03', '#FFFFFF', '#FFEB3B',
      '#FF6D00', '#E040FB', '#38BDF8', '#F43F5E'
    ];
    return Array.from({ length: 160 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: colors[i % colors.length],
      size: Math.random() * 12 + 8,
      duration: Math.random() * 2.5 + 2.5,
      delay: Math.random() * 2.5,
      isCircle: i % 4 === 0,
      isRibbon: i % 5 === 0,
      sway: Math.random() * 60 - 30,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            y: -40,
            x: 0,
            rotate: 0,
            opacity: 1,
          }}
          animate={{
            y: '108vh',
            x: [0, p.sway, 0, -p.sway, 0],
            rotate: p.isRibbon ? [0, 360, 720, 1080] : [0, 180, 360, 720],
            opacity: [1, 1, 0.9, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'linear',
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.isRibbon ? p.size * 0.4 : p.size,
            height: p.isRibbon ? p.size * 1.9 : p.isCircle ? p.size : p.size * 0.75,
            borderRadius: p.isCircle ? '50%' : p.isRibbon ? '2px' : '3px',
            backgroundColor: p.color,
            boxShadow: `0 0 10px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
};

/**
 * Animated count-up score component to amplify the thrill.
 */
function ScoreCounter({ targetScore, duration = 1.6 }: { targetScore: number; duration?: number }) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animFrame: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.floor(eased * targetScore));

      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        setDisplayScore(targetScore);
      }
    };

    animFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animFrame);
  }, [targetScore, duration]);

  return <span>{displayScore}</span>;
}

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
            className="bg-black/80 backdrop-blur-md px-8 py-3.5 rounded-full border border-theme-primary/30 shadow-[0_0_35px_rgba(0,0,0,0.8)]"
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

const STATIC_VIEW_ASSETS = [
  '/emblem-3d.png',
  '/medal_1st.png',
  '/medal_2nd.png',
  '/medal_3rd.png',
  '/spooky_kitchen_bg.webp',
  '/spooky_kitchen_bg_low.webp',
  '/favicon.png',
  '/icon.png',
];

function preloadImage(url?: string): Promise<void> {
  if (!url || globalImageCache.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;
    globalImageCache.set(url, img);
    if (img.complete) {
      if ('decode' in img) {
        img.decode().then(resolve).catch(resolve);
      } else {
        resolve();
      }
      return;
    }
    img.onload = () => {
      if ('decode' in img) {
        img.decode().then(resolve).catch(resolve);
      } else {
        resolve();
      }
    };
    img.onerror = () => resolve();
  });
}

interface DynamicTitleProps {
  text: string;
}

/**
 * Title component that renders Hebrew titles with "Rubik Wet Paint" and adapts
 * direction (LTR for mostly-English, RTL for Hebrew) without multi-pass font stepping.
 */
function DynamicTitle({ text }: DynamicTitleProps) {
  const isHebrew = isHebrewText(text);
  const dir = getTextDirection(text);

  return (
    <h2
      dir={dir}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        fontFamily: getTitleFontFamily(text),
        letterSpacing: isHebrew ? '0.05em' : undefined,
      }}
      className={`text-3xl md:text-4xl lg:text-5xl font-bold text-theme-primary leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,1)] ${
        dir === 'ltr' ? 'text-left' : 'text-right'
      }`}
    >
      {text}
    </h2>
  );
}

interface MealDetailsContentProps {
  meal: Meal;
  slideId: string;
  durationMs: number;
  onExtraTimeNeeded: (needed: boolean) => void;
}

/**
 * Component displaying meal title and description.
 * Scrolling animation accurately stops when the last line is visible,
 * with no redundant padding below it.
 */
function MealDetailsContent({
  meal,
  slideId,
  durationMs,
  onExtraTimeNeeded,
}: MealDetailsContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const descWrapperRef = useRef<HTMLDivElement | null>(null);
  const descContentRef = useRef<HTMLParagraphElement | null>(null);
  const [overflow, setOverflow] = useState(0);

  const checkOverflow = useCallback(() => {
    if (!meal.description || !descWrapperRef.current || !descContentRef.current) {
      setOverflow(0);
      onExtraTimeNeeded(false);
      return;
    }

    const viewportH = descWrapperRef.current.clientHeight;
    const fullTextH = descContentRef.current.scrollHeight;
    const diff = fullTextH - viewportH;

    if (diff > 4) {
      // Exactly diff pixels so the bottom of the text aligns with the bottom of the viewport
      setOverflow(diff);
      onExtraTimeNeeded(true);
    } else {
      setOverflow(0);
      onExtraTimeNeeded(false);
    }
  }, [meal.description, onExtraTimeNeeded]);

  useLayoutEffect(() => {
    checkOverflow();
  }, [checkOverflow, meal.id, slideId]);

  useEffect(() => {
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [checkOverflow]);

  const isScrolling = overflow > 0;
  const durationSec = Math.max(durationMs / 1000, 1);
  const pauseStartRatio = Math.min(0.2, 2.5 / durationSec);
  const pauseEndRatio = Math.max(0.8, (durationSec - 2.5) / durationSec);
  const dir = getTextDirection(meal.description || meal.name);

  return (
    <div
      ref={containerRef}
      dir={dir}
      className={`w-full flex-1 min-h-0 relative flex flex-col my-auto ${
        isScrolling ? 'justify-start' : 'justify-center'
      }`}
    >
      {/* Header section: Non-participating badge + Title */}
      <div ref={headerRef} className="shrink-0 mb-2 md:mb-3">
        {meal.isNonParticipating && (
          <div className="self-start inline-block mb-2 bg-amber-500/90 text-black font-extrabold text-sm md:text-lg px-4 py-1 rounded-full shadow-lg border border-amber-300 backdrop-blur-md">
            מחוץ לתחרות
          </div>
        )}
        <DynamicTitle text={meal.name} />
      </div>

      {/* Description section: stops exactly on the last line when scrolling */}
      {meal.description && (
        <div
          ref={descWrapperRef}
          className={`w-full relative overflow-hidden ${
            isScrolling ? 'flex-1 min-h-0 flex flex-col justify-start' : 'shrink-0'
          }`}
        >
          <motion.div
            key={`${slideId}-${isScrolling ? 'scroll' : 'static'}`}
            initial={{ y: 0 }}
            animate={isScrolling ? { y: [0, 0, -overflow, -overflow] } : { y: 0 }}
            transition={
              isScrolling
                ? {
                    duration: durationSec,
                    times: [0, pauseStartRatio, pauseEndRatio, 1],
                    ease: 'linear',
                  }
                : { duration: 0.2 }
            }
            className="w-full"
          >
            <p
              ref={descContentRef}
              className={`text-xl md:text-2xl lg:text-3xl text-white/95 leading-relaxed font-medium whitespace-pre-line drop-shadow-[0_2px_10px_rgba(0,0,0,1)] ${
                dir === 'ltr' ? 'text-left' : 'text-right'
              }`}
            >
              {meal.description}
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/**
 * Chefs section: Center-aligned vertical divider line directly beneath the ChefHat icon.
 * Names have a fixed small distance from the separator and expand outwards to the sides.
 */
function MealChefSection({ attendingChefs }: { attendingChefs: string[] }) {
  if (attendingChefs.length === 0) return null;

  return (
    <div className="mt-auto pt-2 shrink-0 flex flex-col items-center gap-2 w-full">
      {/* Chef Hat with two divider lines on sides */}
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-white/40" />
        <ChefHat className="text-white w-7 h-7 md:w-8 md:h-8 drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)] shrink-0" />
        <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-white/40 to-white/40" />
      </div>

      {/* Chefs list */}
      {attendingChefs.length === 1 ? (
        <div className="w-full text-center">
          <span className="inline-block whitespace-nowrap text-xl md:text-2xl text-gray-100 font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,1)] tracking-wide">
            {attendingChefs[0]}
          </span>
        </div>
      ) : attendingChefs.length === 2 ? (
        <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center" dir="ltr">
          {/* Chef 1: right-aligned in left cell */}
          <div className="flex justify-end items-center pr-3.5">
            <span className="whitespace-nowrap text-xl md:text-2xl text-gray-100 font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,1)] tracking-wide">
              {attendingChefs[0]}
            </span>
          </div>
          {/* Central Vertical Separator: center-aligned directly under the ChefHat icon */}
          <div className="w-[2px] h-6 bg-white/70 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6)] select-none shrink-0" />
          {/* Chef 2: left-aligned in right cell */}
          <div className="flex justify-start items-center pl-3.5">
            <span className="whitespace-nowrap text-xl md:text-2xl text-gray-100 font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,1)] tracking-wide">
              {attendingChefs[1]}
            </span>
          </div>
        </div>
      ) : (
        /* 3+ chefs: balanced center row */
        <div className="w-full flex items-center justify-center flex-wrap gap-x-4 gap-y-1">
          {attendingChefs.map((chef, idx) => (
            <span key={idx} className="inline-flex items-center gap-3">
              {idx > 0 && <span className="w-[1px] h-5 bg-white/40 inline-block" />}
              <span className="whitespace-nowrap text-xl md:text-2xl text-gray-100 font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,1)] tracking-wide">
                {chef}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ViewMode() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { eventInfo, guests, meals, votes, generalSettings, loading, error } = useFirebaseData(eventId);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [prevRevealState, setPrevRevealState] = useState<string>('none');
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasRevealed, setHasRevealed] = useState(false);
  const [dramaticState, setDramaticState] = useState<'none' | 'countdown' | 'ended'>('none');
  const [extraTimeNeeded, setExtraTimeNeeded] = useState(false);

  const isTvApp = typeof navigator !== 'undefined' && navigator.userAgent.includes('CookOffTV');

  // Splash screen state (1s minimum display + fade out on web; skipped on TV where native splash handles loading)
  const [splashPhase, setSplashPhase] = useState<'holding' | 'fading' | 'done'>(
    isTvApp ? 'done' : 'holding'
  );
  const [minTimeElapsed, setMinTimeElapsed] = useState(isTvApp);

  useEffect(() => {
    if (isTvApp) return;
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [isTvApp]);

  useEffect(() => {
    if (isTvApp) return;
    if (minTimeElapsed && !loading && splashPhase === 'holding') {
      setSplashPhase('fading');
      const fadeTimer = setTimeout(() => {
        setSplashPhase('done');
      }, 600);
      return () => clearTimeout(fadeTimer);
    }
  }, [minTimeElapsed, loading, splashPhase, isTvApp]);

  // Handle remote Back button or Escape to return to event selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || (e as any).keyCode === 4) {
        navigate('/view?select=true');
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

  const rawM = Math.max(Math.abs(currentBgOffset.x), Math.abs(currentBgOffset.y));
  const deltaM = Math.max(
    Math.abs(currentBgOffset.x - prevBgOffset.x),
    Math.abs(currentBgOffset.y - prevBgOffset.y)
  );
  const M = rawM > 0 ? rawM : (deltaM > 0 ? deltaM : 3);
  const glideDurationSeconds = 3 * M;

  // Anti-burn-in shift: glides for 3M seconds once every 3 minutes, remaining static & crisp in between
  useEffect(() => {
    const BG_SHIFT_INTERVAL_MS = 3 * 60 * 1000;
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

  // Handle dramatic countdown state (C & D)
  useEffect(() => {
    if (eventInfo?.timerStatus === 'running' && timeRemaining !== null && timeRemaining > 0 && timeRemaining <= 10000) {
      setDramaticState('countdown');
    } else if ((eventInfo?.timerStatus === 'ended' || timeRemaining === 0) && dramaticState === 'countdown') {
      setDramaticState('ended');
      // Hold Stage D "Time's up" for 4 seconds before transitioning to Stage E
      const t = setTimeout(() => {
        setDramaticState('none');
      }, 4000);
      return () => clearTimeout(t);
    } else if (eventInfo?.timerStatus !== 'ended' && timeRemaining === null) {
      setDramaticState('none');
    }
  }, [timeRemaining, eventInfo?.timerStatus, dramaticState]);

  // Track reveal state change
  useEffect(() => {
    if (eventInfo && eventInfo.revealState !== prevRevealState) {
      if (eventInfo.revealState !== 'none') {
        setHasRevealed(true);
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

  // 1. Preload static assets immediately on mount
  useEffect(() => {
    STATIC_VIEW_ASSETS.forEach((asset) => preloadImage(asset));
  }, []);

  // 2. Preload ALL meal images as soon as meals data is available
  useEffect(() => {
    if (!meals || meals.length === 0) return;
    meals.forEach((meal) => {
      if (meal.imageUrl) {
        preloadImage(meal.imageUrl);
      }
    });
  }, [meals]);

  // 3. Priority preloading for next slides
  useEffect(() => {
    if (!slides || slides.length === 0) return;
    const preloadIndices = [
      activeIndex,
      (activeIndex + 1) % slides.length,
      (activeIndex + 2) % slides.length,
    ];
    preloadIndices.forEach((idx) => {
      const slide = slides[idx];
      const meal = slide?.meals[0];
      if (meal?.imageUrl) {
        preloadImage(meal.imageUrl);
      }
    });
  }, [slides, activeIndex]);

  // Auto-rotating gallery effect
  useEffect(() => {
    if (!slides || slides.length === 0) return;

    // Don't rotate if revealing results, or in countdown/ended state
    if (
      hasRevealed ||
      (eventInfo?.revealState && eventInfo.revealState !== 'none') ||
      dramaticState !== 'none'
    ) {
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
  }, [slides, activeIndex, eventInfo?.revealState, hasRevealed, extraTimeNeeded, dramaticState]);

  useEffect(() => {
    if (slides && slides.length > 0 && activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [slides, activeIndex]);

  // Calculate eligible attendees who haven't completed voting yet
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

  if (loading) return <ViewSplashOverlay isFadingOut={false} />;

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
      const score = mealVotes.reduce((sum, vote) => sum + vote.points, 0) + (meal.pointsAdjustment || 0);
      return { ...meal, score };
    }).sort((a, b) => b.score - a.score);

  const top3 = mealScores.slice(0, 3);

  // Flow Stage Determination (A to J):
  // A: Rotating gallery (idle)
  // B: Timer running, gallery continues
  // C: Last 10s countdown (automatic, gallery removed, clock & counter, screen shake)
  // D: Time's up message (automatic, clock 00:00, counter hidden)
  // E: No gallery, Emblem + flavor text
  // F: Results screen
  // G: 3rd place
  // H: 2nd place
  // I: 1st place + confetti
  // J: Just background image
  const isStageJ = eventInfo?.revealState === 'background' || eventInfo?.showStage === 'J';
  const isStageI = eventInfo?.revealState === '1st' || eventInfo?.showStage === 'I';
  const isStageH = eventInfo?.revealState === '2nd' || eventInfo?.showStage === 'H';
  const isStageG = eventInfo?.revealState === '3rd' || eventInfo?.showStage === 'G';
  const isStageF = eventInfo?.revealState === 'results' || eventInfo?.showStage === 'F';
  const isStageE =
    eventInfo?.revealState === 'emblem' ||
    eventInfo?.showStage === 'E' ||
    (eventInfo?.timerStatus === 'ended' &&
      dramaticState === 'none' &&
      !isStageF &&
      !isStageG &&
      !isStageH &&
      !isStageI &&
      !isStageJ &&
      eventInfo?.showMealsCarousel !== true);

  const isPodiumActive = isStageG || isStageH || isStageI;
  const show3rd = isStageG || isStageH || isStageI;
  const show2nd = isStageH || isStageI;
  const show1st = isStageI;

  const isCountdownStageC = dramaticState === 'countdown';
  const isTimesUpStageD = dramaticState === 'ended';

  // In Stage J, if showMealsCarousel is explicitly enabled, show meals gallery with darkened background!
  const isStageJGallery = isStageJ && eventInfo?.showMealsCarousel === true;

  // Carousel is shown ONLY in Stage A and B, or in Stage J when explicitly enabled by host
  const shouldShowMeals =
    ((!isStageJ &&
      !isPodiumActive &&
      !isStageF &&
      !isStageE &&
      !isCountdownStageC &&
      !isTimesUpStageD &&
      (eventInfo?.timerStatus === 'ended'
        ? eventInfo?.showMealsCarousel === true
        : eventInfo?.showMealsCarousel !== false)) ||
      isStageJGallery) &&
    slides.length > 0;

  const currentSlide = slides[activeIndex] || slides[0];

  const themeStyles = getThemeStyles(eventInfo?.activeThemeId, [
    ...(generalSettings?.themes || []),
    ...(eventInfo?.themes || [])
  ]);
  const { backgroundImage: _bg, backgroundSize: _bs, backgroundPosition: _bp, ...containerStyles } = themeStyles as any;

  const getAttendingChefs = (meal?: (typeof meals)[0]): string[] => {
    return getOrderedChefNamesForMeal(meal, guests, { filterAttendingOnly: true });
  };

  return (
    <div style={containerStyles} className="absolute inset-0 flex flex-col overflow-hidden bg-theme-bg select-none">
      {/* 1s Minimum Splash Screen Overlay with Smooth Fade-Out (on web only) */}
      {!isTvApp && splashPhase !== 'done' && <ViewSplashOverlay isFadingOut={splashPhase === 'fading'} />}

      {/* Subtle TV back navigation button */}
      <button
        onClick={() => navigate('/view?select=true')}
        aria-label="חזרה לרשימת אירועים"
        className="fixed top-4 right-4 z-50 p-2.5 rounded-full bg-black/40 hover:bg-black/80 text-white/50 hover:text-white backdrop-blur-md transition-all duration-300 opacity-0 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
        title="חזרה לבחירת אירוע"
      >
        <ArrowRight size={22} />
      </button>

      {/* Crisp Integer-Stepped Background (anti-burn-in) */}
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

      {/* Subtle Dark Vignette Dimmer - removed when showing pure background (Stage J without gallery) */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isStageJ && !isStageJGallery ? 'opacity-0' : 'bg-black/60'
        } z-0`}
      />
      {/* Extra background darkening for Stage J when gallery is active */}
      {isStageJGallery && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-700 z-0 pointer-events-none" />
      )}

      {/* Confetti overlay for 1st place celebration (Stage I) */}
      {show1st && <Confetti />}

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex justify-center items-center w-full h-full overflow-hidden">

        {/* ========================================================================= */}
        {/* STAGE A & B: ROTATING GALLERY (Image ALWAYS on Left, Description on Right) */}
        {/* ========================================================================= */}
        <AnimatePresence mode="wait">
          {shouldShowMeals && currentSlide && currentSlide.meals[0] && (
            <motion.div
              key={currentSlide.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="absolute inset-0 w-full h-full z-10 flex flex-row"
              dir="ltr"
            >
              {/* Left Column (58%): Image ALWAYS on Left */}
              <div className="w-[58%] h-full flex items-center justify-center p-4 md:p-8 pl-8 md:pl-12 pr-3 md:pr-6 z-20">
                <div className="w-full h-full relative flex items-center justify-center">
                  <img
                    src={currentSlide.meals[0].imageUrl}
                    alt={currentSlide.meals[0].name}
                    loading="eager"
                    decoding="async"
                    className="relative max-w-full max-h-full object-contain drop-shadow-[0_25px_60px_rgba(0,0,0,0.9)] rounded-3xl z-10 transition-opacity duration-500 ease-in-out"
                  />
                </div>
              </div>

              {/* Right Column (42%): Description & Chefs ALWAYS on Right */}
              <div
                className={`w-[42%] h-full flex flex-col justify-between pb-6 md:pb-8 pr-8 md:pr-12 pl-3 md:pr-6 z-20 ${
                  eventInfo?.timerStatus === 'running' ? 'pt-32 md:pt-36' : 'pt-8 md:pt-10'
                }`}
                dir={getTextDirection(currentSlide.meals[0].description || currentSlide.meals[0].name)}
              >
                <MealDetailsContent
                  meal={currentSlide.meals[0]}
                  slideId={currentSlide.id}
                  durationMs={(currentSlide?.durationMs || 15000) + (extraTimeNeeded ? 5000 : 0)}
                  onExtraTimeNeeded={setExtraTimeNeeded}
                />

                <MealChefSection attendingChefs={getAttendingChefs(currentSlide.meals[0])} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Corner Timer & Voters Counter for Stage B (Fixed in top right) */}
        <AnimatePresence>
          {shouldShowMeals && eventInfo?.timerStatus === 'running' && !isCountdownStageC && (
            <motion.div
              key="view-corner-timer-badge"
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.4 }}
              className="absolute top-6 right-6 md:top-8 md:right-8 z-40 flex items-center gap-4 flex-row"
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
                className="bg-black/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.7)] flex items-center gap-2.5"
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

        {/* ========================================================================= */}
        {/* STAGE C: LAST 10 SECONDS COUNTDOWN (Clock & Counter, Subtle Screen Shake) */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {isCountdownStageC && (
            <motion.div
              key="stage-c-countdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center p-8 text-center"
            >
              {/* Shake container per second change */}
              <motion.div
                key={Math.ceil((timeRemaining || 1000) / 1000)}
                animate={{
                  x: [0, -7, 7, -5, 5, -2, 2, 0],
                  y: [0, 3, -3, 2, -2, 0],
                  scale: [1.06, 1],
                }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex flex-col items-center gap-7"
              >
                <div className="relative flex flex-col items-center justify-center">
                  <CircularTimer
                    timeRemaining={timeRemaining || 0}
                    totalDuration={totalDuration || 10000}
                    size={280}
                    strokeWidth={12}
                    fontSizeClass="text-7xl md:text-8xl"
                  />
                </div>

                <h2 className="text-4xl md:text-6xl font-black text-red-500 font-theme-main tracking-wider drop-shadow-[0_0_35px_rgba(239,68,68,0.85)]">
                  ההצבעה מסתיימת!
                </h2>

                {/* Voters counter */}
                <div
                  className="bg-black/80 backdrop-blur-md px-8 py-3 rounded-full border border-white/20 shadow-2xl flex items-center gap-3"
                  style={{ fontFamily: "'Assistant', sans-serif" }}
                >
                  <Users className="w-6 h-6 text-theme-primary shrink-0 drop-shadow" />
                  <span className="text-gray-200 font-bold text-xl md:text-2xl">
                    {stillVotingText}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* STAGE D: TIME'S UP MESSAGE (Same layout: Only clock showing, voters hidden) */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {isTimesUpStageD && (
            <motion.div
              key="stage-d-times-up"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="relative flex flex-col items-center justify-center">
                  <CircularTimer
                    timeRemaining={0}
                    totalDuration={totalDuration || 10000}
                    size={280}
                    strokeWidth={12}
                    fontSizeClass="text-7xl md:text-8xl"
                  />
                </div>

                <div className="space-y-2">
                  <h2 className="text-6xl md:text-8xl font-black text-white font-theme-main tracking-wider drop-shadow-[0_0_40px_rgba(255,255,255,0.85)]">
                    הזמן נגמר!
                  </h2>
                  <p className="text-2xl md:text-4xl text-amber-400 font-bold drop-shadow-lg">
                    ההצבעה הסתיימה
                  </p>
                </div>
                {/* Voters counter is hidden as requested */}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* STAGE E: NO GALLERY - 3D EMBLEM + FLAVOR TEXT                            */}
        {/* ========================================================================= */}
        {isStageE && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center justify-center gap-6 max-w-4xl"
            >
              <motion.img
                src="/emblem-3d.png"
                alt="Cook-Off 3D Emblem"
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-64 md:w-80 lg:w-96 object-contain drop-shadow-[0_25px_60px_rgba(255,122,0,0.45)]"
              />
              <h1
                style={{ fontFamily: getTitleFontFamily(eventInfo?.title) }}
                className="text-5xl md:text-7xl text-theme-primary font-black drop-shadow-2xl"
              >
                {eventInfo?.title || 'תחרות בישול'}
              </h1>
              {eventInfo?.subtitle && (
                <p
                  dir={getTextDirection(eventInfo.subtitle)}
                  className="text-2xl md:text-3xl text-gray-200 font-medium leading-relaxed drop-shadow"
                >
                  {eventInfo.subtitle}
                </p>
              )}
            </motion.div>
            <FlavorTextRotator />
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE F: CINEMATIC RESULTS SCREEN                                         */}
        {/* ========================================================================= */}
        {isStageF && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1], rotate: [0, 1, -1, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative mb-4"
            >
              <div className="absolute inset-0 rounded-full blur-3xl bg-amber-500/25 scale-125 pointer-events-none" />
              <img
                src="/emblem-3d.png"
                alt="Contest Emblem"
                className="w-56 md:w-72 object-contain drop-shadow-[0_0_80px_rgba(245,158,11,0.7)] relative z-10"
              />
            </motion.div>

            <div className="space-y-3">
              <h2 className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 drop-shadow-[0_10px_35px_rgba(245,158,11,0.6)] font-theme-main">
                התוצאות!
              </h2>
              <p className="text-2xl md:text-4xl text-gray-100 font-bold tracking-wide drop-shadow-md">
                מי המנות המנצחות של הערב?
              </p>
            </div>
          </motion.div>
        )}

        {/* ========================================================================= */}
        {/* STAGES G, H, I: REVEAL PODIUM (Redesigned stairs, large images, medals)   */}
        {/* ========================================================================= */}
        {isPodiumActive && (
          <div className="absolute bottom-0 inset-x-0 flex justify-center items-end gap-6 md:gap-10 w-full px-[4%] z-30 max-h-[88vh]" dir="ltr">

            {/* 2nd Place (Left Column in LTR / Order 1) */}
            {top3.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 300 }}
                animate={{ opacity: show2nd ? 1 : 0, y: show2nd ? 0 : 300 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex flex-col items-center flex-1 order-1 max-w-[28vw]"
              >
                {/* Meal & Medal Container (NO black square background!) */}
                <div className="relative w-full flex flex-col items-center">
                  {/* Medal pinned directly on the meal */}
                  <div className="absolute -top-7 -right-4 z-40">
                    <img
                      src="/medal_2nd.png"
                      alt="2nd Place Medal"
                      className="w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
                    />
                  </div>

                  {/* Meal Image */}
                  <div className="w-full h-44 sm:h-52 md:h-60 flex items-center justify-center p-2 relative z-10">
                    <img
                      src={top3[1].imageUrl}
                      alt={top3[1].name}
                      className="max-w-full max-h-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.9)] rounded-2xl"
                    />
                  </div>

                  {/* Score badge with animated count-up */}
                  <div className="mt-1 bg-black/80 backdrop-blur-md px-5 py-1.5 rounded-full border border-gray-400/50 shadow-lg z-20">
                    <span className="text-gray-200 font-extrabold text-2xl md:text-3xl tabular-nums">
                      {show2nd ? <ScoreCounter targetScore={top3[1].score} /> : 0} נק׳
                    </span>
                  </div>

                  {/* Meal Name & Chefs */}
                  <div className="w-full text-center mt-2 px-2">
                    <h3
                      dir={getTextDirection(top3[1].name)}
                      style={{ fontFamily: getTitleFontFamily(top3[1].name) }}
                      className="text-2xl md:text-3xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,1)] line-clamp-2"
                    >
                      {top3[1].name}
                    </h3>
                    {(() => {
                      const chefs = getAttendingChefs(top3[1]);
                      return chefs.length > 0 ? (
                        <p
                          dir={getTextDirection(chefs.join(', '))}
                          className="text-gray-300 font-semibold mt-1 text-sm md:text-base drop-shadow"
                        >
                          שפים: {chefs.join(', ')}
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Pedestal Stair (Proportional height) */}
                <div className="w-full h-[12vh] min-h-[75px] max-h-[100px] bg-gradient-to-b from-gray-400 via-gray-600 to-gray-800 mt-4 rounded-t-2xl shadow-[inset_0_10px_25px_rgba(0,0,0,0.6)] border-t-2 border-gray-300 flex items-center justify-center">
                  <span className="text-gray-300 font-black text-3xl md:text-4xl opacity-50 select-none">
                    2
                  </span>
                </div>
              </motion.div>
            )}

            {/* 1st Place (Center Column / Order 2 - Tallest, but fits comfortably on screen) */}
            {top3.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 300 }}
                animate={{ opacity: show1st ? 1 : 0, y: show1st ? 0 : 300 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="flex flex-col items-center flex-1 order-2 z-40 max-w-[32vw]"
              >
                {/* Meal & Medal Container (NO black square background!) */}
                <div className="relative w-full flex flex-col items-center">
                  {/* Golden Medal directly on meal */}
                  <div className="absolute -top-10 -right-6 z-40">
                    <img
                      src="/medal_1st.png"
                      alt="1st Place Medal"
                      className="w-24 h-24 md:w-32 md:h-32 object-contain drop-shadow-[0_15px_30px_rgba(250,204,21,0.6)]"
                    />
                  </div>

                  {/* Meal Image - Prominent & appetizing */}
                  <div className="w-full h-52 sm:h-64 md:h-72 flex items-center justify-center p-2 relative z-10">
                    <img
                      src={top3[0].imageUrl}
                      alt={top3[0].name}
                      className="max-w-full max-h-full object-contain drop-shadow-[0_25px_50px_rgba(250,204,21,0.5)] rounded-2xl"
                    />
                  </div>

                  {/* Winner Score badge with animated count-up */}
                  <div className="mt-1 bg-gradient-to-r from-amber-500/90 to-yellow-500/90 backdrop-blur-md px-6 py-2 rounded-full border-2 border-yellow-200 shadow-xl z-20 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-black shrink-0" />
                    <span className="text-black font-black text-3xl md:text-4xl tabular-nums drop-shadow-sm">
                      {show1st ? <ScoreCounter targetScore={top3[0].score} /> : 0} נק׳
                    </span>
                  </div>

                  {/* Meal Name & Chefs */}
                  <div className="w-full text-center mt-2 px-2">
                    <h3
                      dir={getTextDirection(top3[0].name)}
                      style={{ fontFamily: getTitleFontFamily(top3[0].name) }}
                      className="text-3xl md:text-4xl font-black text-amber-300 drop-shadow-[0_2px_12px_rgba(0,0,0,1)] line-clamp-2"
                    >
                      {top3[0].name}
                    </h3>
                    {(() => {
                      const chefs = getAttendingChefs(top3[0]);
                      return chefs.length > 0 ? (
                        <p
                          dir={getTextDirection(chefs.join(', '))}
                          className="text-yellow-100 font-bold mt-1 text-base md:text-xl drop-shadow"
                        >
                          שפים: {chefs.join(', ')}
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* 1st Place Pedestal Stair */}
                <div className="w-full h-[16vh] min-h-[100px] max-h-[135px] bg-gradient-to-b from-yellow-500 via-amber-600 to-amber-900 mt-4 rounded-t-2xl shadow-[inset_0_15px_35px_rgba(0,0,0,0.7)] border-t-4 border-yellow-300 flex items-center justify-center">
                  <span className="text-yellow-200 font-black text-4xl md:text-5xl opacity-60 select-none">
                    1
                  </span>
                </div>
              </motion.div>
            )}

            {/* 3rd Place (Right Column in LTR / Order 3) */}
            {top3.length > 2 && (
              <motion.div
                initial={{ opacity: 0, y: 300 }}
                animate={{ opacity: show3rd ? 1 : 0, y: show3rd ? 0 : 300 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="flex flex-col items-center flex-1 order-3 max-w-[26vw]"
              >
                {/* Meal & Medal Container (NO black square background!) */}
                <div className="relative w-full flex flex-col items-center">
                  {/* Medal pinned directly on the meal */}
                  <div className="absolute -top-7 -right-4 z-40">
                    <img
                      src="/medal_3rd.png"
                      alt="3rd Place Medal"
                      className="w-18 h-18 md:w-22 md:h-22 object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
                    />
                  </div>

                  {/* Meal Image */}
                  <div className="w-full h-40 sm:h-48 md:h-56 flex items-center justify-center p-2 relative z-10">
                    <img
                      src={top3[2].imageUrl}
                      alt={top3[2].name}
                      className="max-w-full max-h-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.9)] rounded-2xl"
                    />
                  </div>

                  {/* Score badge with animated count-up */}
                  <div className="mt-1 bg-black/80 backdrop-blur-md px-5 py-1.5 rounded-full border border-orange-500/50 shadow-lg z-20">
                    <span className="text-orange-400 font-extrabold text-2xl md:text-3xl tabular-nums">
                      {show3rd ? <ScoreCounter targetScore={top3[2].score} /> : 0} נק׳
                    </span>
                  </div>

                  {/* Meal Name & Chefs */}
                  <div className="w-full text-center mt-2 px-2">
                    <h3
                      dir={getTextDirection(top3[2].name)}
                      style={{ fontFamily: getTitleFontFamily(top3[2].name) }}
                      className="text-2xl md:text-3xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,1)] line-clamp-2"
                    >
                      {top3[2].name}
                    </h3>
                    {(() => {
                      const chefs = getAttendingChefs(top3[2]);
                      return chefs.length > 0 ? (
                        <p
                          dir={getTextDirection(chefs.join(', '))}
                          className="text-gray-300 font-semibold mt-1 text-sm md:text-base drop-shadow"
                        >
                          שפים: {chefs.join(', ')}
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Pedestal Stair */}
                <div className="w-full h-[8vh] min-h-[55px] max-h-[75px] bg-gradient-to-b from-orange-700 via-orange-850 to-orange-950 mt-4 rounded-t-2xl shadow-[inset_0_10px_25px_rgba(0,0,0,0.6)] border-t-2 border-orange-500 flex items-center justify-center">
                  <span className="text-orange-300 font-black text-2xl md:text-3xl opacity-50 select-none">
                    3
                  </span>
                </div>
              </motion.div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE J: JUST BACKGROUND IMAGE                                            */}
        {/* (Nothing is rendered, pure background is visible)                          */}
        {/* ========================================================================= */}

      </div>
    </div>
  );
}
