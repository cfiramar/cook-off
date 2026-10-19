import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllEvents } from '../../hooks/useFirebaseData';
import ViewSplashOverlay from './components/ViewSplashOverlay';
import AppUpdateModal, { APP_CURRENT_VERSION } from '../../components/ui/AppUpdateModal';
import { useTvRemoteNavigation } from '../../utils/useTvRemoteNavigation';
import {
  Calendar,
  Tv,
  PlayCircle,
  RefreshCw
} from 'lucide-react';

const LAST_EVENT_KEY = 'cookoff_last_tv_event';

export default function GeneralViewDashboard() {
  const { events, loading, error } = useAllEvents();
  const navigate = useNavigate();
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const firstCardRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // App Update Modal State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_EVENT_KEY);
      if (saved) {
        setLastEventId(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const selectEvent = (eventId?: string) => {
    if (!eventId) return;
    try {
      localStorage.setItem(LAST_EVENT_KEY, eventId);
    } catch {
      // ignore storage errors
    }
    navigate(`/view/${eventId}`);
  };

  // Auto-redirect if only 1 event exists or if an active running event exists (unless user navigated via ?select=true)
  useEffect(() => {
    if (loading || events.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const isManualSelect = params.get('select') === 'true';

    if (!isManualSelect) {
      // 1. If there's only 1 event, directly launch it
      if (events.length === 1) {
        selectEvent(events[0].id);
        return;
      }

      // 2. If an event has a currently running contest/timer, auto-launch it
      const runningEvent = events.find(e => (e as any).timerStatus === 'running');
      if (runningEvent) {
        selectEvent(runningEvent.id);
        return;
      }
    }
  }, [loading, events]);

  // TV Remote Spatial Navigation (D-pad arrow navigation, prevent default scroll, OK/Enter click)
  useTvRemoteNavigation({
    containerRef,
    initialFocusRef: firstCardRef,
    active: !loading && events.length > 0 && !isUpdateModalOpen && splashPhase === 'done',
    autoFocus: true,
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'לא נקבע תאריך';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].substring(2)}`;
    return dateStr;
  };

  const lastEvent = events.find(e => e.id === lastEventId);

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full relative bg-gray-950 text-white font-sans h-screen overflow-y-auto overflow-x-hidden admin-scroll select-none max-w-full"
    >
      {/* 1s Minimum Splash Screen Overlay with Smooth Fade-Out (on web only) */}
      {!isTvApp && splashPhase !== 'done' && <ViewSplashOverlay isFadingOut={splashPhase === 'fading'} />}

      {/* Background Ambient Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto w-full p-6 sm:p-10 relative z-10 flex flex-col min-h-screen">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white flex items-center gap-4 drop-shadow-md">
              <Tv className="w-10 h-10 sm:w-12 sm:h-12 text-blue-400" /> מצב תצוגה לטלוויזיה
            </h1>
            <p className="text-gray-400 text-sm sm:text-base mt-1">
              בחר אירוע להצגה על המסך הגדול (ניתן לנווט עם שלט הטלוויזיה)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              tabIndex={0}
              onClick={() => setIsUpdateModalOpen(true)}
              className="flex items-center gap-2.5 bg-gray-900/90 hover:bg-gray-800 text-gray-200 hover:text-white px-4 py-3 rounded-2xl font-bold border border-gray-700/80 shadow-lg shadow-black/40 transition-all transform hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-blue-400 focus:border-blue-400 focus:shadow-[0_0_30px_rgba(59,130,246,0.6)] cursor-pointer outline-none"
              title="עדכון אפליקציה"
            >
              <RefreshCw className="w-5 h-5 text-blue-400" />
              <span>עדכן אפליקציה</span>
            </button>

            {lastEvent && (
              <button
                tabIndex={0}
                onClick={() => selectEvent(lastEvent.id)}
                className="group flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-blue-400 focus:border-blue-400 focus:shadow-[0_0_30px_rgba(59,130,246,0.6)] cursor-pointer outline-none"
              >
                <PlayCircle className="w-6 h-6 animate-pulse" />
                <span>המשך לאירוע האחרון: {lastEvent.title}</span>
              </button>
            )}
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-blue-400 text-2xl font-semibold">טוען אירועים למסך...</div>
          </div>
        ) : error ? (
          <div className="col-span-full text-center text-red-400 py-12 bg-red-950/40 backdrop-blur-md rounded-3xl border border-red-800/50 p-6">
            <p className="text-xl font-bold mb-2">שגיאה בטעינת אירועים</p>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
            {events.length === 0 ? (
              <div className="col-span-full text-center text-gray-400 py-16 bg-gray-900/60 rounded-3xl border border-gray-800 backdrop-blur-md">
                אין אירועים קיימים. יש ליצור אירוע דרך לוח התכנון תחילה.
              </div>
            ) : (
              events.map((event, idx) => {
                const isLast = event.id === lastEventId;
                return (
                  <div 
                    key={event.id}
                    ref={idx === 0 ? firstCardRef : undefined}
                    tabIndex={0}
                    role="button"
                    onClick={() => selectEvent(event.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ' || (e as any).keyCode === 23) {
                        e.preventDefault();
                        selectEvent(event.id);
                      }
                    }}
                    className={`bg-gray-900/80 backdrop-blur-xl rounded-3xl border p-6 flex flex-col transition-all duration-200 transform cursor-pointer relative overflow-hidden group outline-none ${
                      isLast 
                        ? 'border-blue-500/80 shadow-lg shadow-blue-500/20' 
                        : 'border-gray-800 hover:border-gray-700'
                    } hover:scale-[1.02] hover:shadow-2xl hover:border-blue-400 focus:scale-[1.04] focus:ring-4 focus:ring-blue-400 focus:border-blue-400 focus:shadow-[0_0_40px_rgba(59,130,246,0.6)]`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                    <div className="relative z-10 h-full flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <h2 className="text-2xl font-bold text-white group-hover:text-blue-300 group-focus:text-blue-300 transition-colors">
                          {event.title}
                        </h2>
                        {isLast && (
                          <span className="bg-blue-500/20 text-blue-300 text-xs px-2.5 py-1 rounded-full border border-blue-500/40 font-medium">
                            אחרון שנצפה
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-gray-400 mb-4 text-sm font-medium">
                        <Calendar size={16} className="text-blue-400" />
                        <span>{formatDate(event.date)}</span>
                      </div>

                      <p className="text-gray-300 mb-6 line-clamp-2 leading-relaxed min-h-[3rem] text-sm">
                        {event.subtitle || 'אין תיאור לאירוע'}
                      </p>

                      <div className="mt-auto pt-4 border-t border-gray-800/80">
                        <div
                          className="w-full bg-blue-600/20 group-hover:bg-blue-600 group-focus:bg-blue-600 text-blue-300 group-hover:text-white group-focus:text-white border border-blue-500/40 group-hover:border-blue-600 group-focus:border-blue-600 p-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all font-bold tracking-wide"
                        >
                          <Tv size={18} /> <span>הצג על המסך (לחץ אישור)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <footer className="mt-auto text-center text-xs text-gray-500 py-4 border-t border-gray-900">
          טיפ לשלט: השתמש בחצים למעבר בין אירועים, בלחצן המרכזי (OK) לבחירה, ובחזרה (Back) ליציאה.
        </footer>
      </div>

      {/* App Update Modal */}
      <AppUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        title="עדכון אפליקציית הטלוויזיה"
        currentVersion={APP_CURRENT_VERSION}
        apkDownloadUrl="https://github.com/cfiramar/cook-off/releases/latest/download/CookOff-AndroidTV-ViewMode.apk"
        apkName="CookOff-AndroidTV-ViewMode.apk"
        apkTitle="הורדת קובץ התקנה לטלוויזיה (APK)"
        apkDescription="מוריד את קובץ ה-APK המלא (CookOff-AndroidTV-ViewMode.apk) להתקנה על Android TV."
        isDarkMode={true}
      />
    </div>
  );
}

