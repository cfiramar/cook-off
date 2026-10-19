import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllEvents } from '../../hooks/useFirebaseData';
import {
  Calendar,
  Tv,
  PlayCircle,
  RefreshCw,
  Download,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const LAST_EVENT_KEY = 'cookoff_last_tv_event';
const CURRENT_VERSION = 'v1.0.1';

export default function GeneralViewDashboard() {
  const { events, loading, error } = useAllEvents();
  const navigate = useNavigate();
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const firstCardRef = useRef<HTMLDivElement | null>(null);
  const modalCloseRef = useRef<HTMLButtonElement | null>(null);

  // App Update Modal State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [latestReleaseTag, setLatestReleaseTag] = useState<string | null>(null);
  const [releaseCheckError, setReleaseCheckError] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);

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

  // Auto-focus first card or last visited card when events load for TV remote D-pad navigation
  useEffect(() => {
    if (!loading && events.length > 0 && !isUpdateModalOpen) {
      const timer = setTimeout(() => {
        firstCardRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, events.length, isUpdateModalOpen]);

  // Focus modal close button when modal opens
  useEffect(() => {
    if (isUpdateModalOpen) {
      const timer = setTimeout(() => {
        modalCloseRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isUpdateModalOpen]);

  const checkUpdates = async () => {
    setIsCheckingUpdate(true);
    setReleaseCheckError(null);
    try {
      const res = await fetch('https://api.github.com/repos/cfiramar/cook-off/releases/latest');
      if (res.ok) {
        const data = await res.json();
        setLatestReleaseTag(data.tag_name || null);
      } else {
        setReleaseCheckError('לא ניתן לאחזר מידע מ-GitHub (ייתכן שהמאגר פרטי)');
      }
    } catch {
      setReleaseCheckError('שגיאת רשת בבדיקת עדכונים');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleForceWebReload = async () => {
    setIsReloading(true);
    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
    } catch (e) {
      console.error('Error clearing cache:', e);
    }
    window.location.reload();
  };

  const selectEvent = (eventId?: string) => {
    if (!eventId) return;
    try {
      localStorage.setItem(LAST_EVENT_KEY, eventId);
    } catch {
      // ignore storage errors
    }
    navigate(`/view/${eventId}`);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'לא נקבע תאריך';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].substring(2)}`;
    return dateStr;
  };

  const lastEvent = events.find(e => e.id === lastEventId);

  return (
    <div className="flex-1 w-full relative bg-gray-950 text-white font-sans h-screen overflow-y-auto admin-scroll select-none">
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
              onClick={() => {
                setIsUpdateModalOpen(true);
                checkUpdates();
              }}
              className="flex items-center gap-2.5 bg-gray-900/90 hover:bg-gray-800 text-gray-200 hover:text-white px-4 py-3 rounded-2xl font-bold border border-gray-700/80 shadow-lg shadow-black/40 transition-all transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-400 cursor-pointer"
              title="עדכון אפליקציה"
            >
              <RefreshCw className="w-5 h-5 text-blue-400" />
              <span>עדכן אפליקציה</span>
            </button>

            {lastEvent && (
              <button
                onClick={() => selectEvent(lastEvent.id)}
                className="group flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-400 cursor-pointer"
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
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectEvent(event.id);
                      }
                    }}
                    className={`bg-gray-900/80 backdrop-blur-xl rounded-3xl border p-6 flex flex-col transition-all duration-200 transform cursor-pointer relative overflow-hidden group outline-none ${
                      isLast 
                        ? 'border-blue-500/80 shadow-lg shadow-blue-500/20' 
                        : 'border-gray-800 hover:border-gray-700'
                    } hover:scale-[1.02] hover:shadow-2xl hover:border-blue-400 focus:scale-[1.03] focus:ring-4 focus:ring-blue-500 focus:border-blue-400 focus:shadow-2xl focus:shadow-blue-500/40`}
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
      {isUpdateModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-modal-title"
          dir="rtl"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsUpdateModalOpen(false);
            }
          }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative flex flex-col gap-6 text-right">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div>
                  <h2 id="update-modal-title" className="text-2xl font-bold text-white">עדכון אפליקציה</h2>
                  <p className="text-gray-400 text-xs sm:text-sm">גרסה נוכחית: {CURRENT_VERSION}</p>
                </div>
              </div>
              <button
                ref={modalCloseRef}
                onClick={() => setIsUpdateModalOpen(false)}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                aria-label="סגור חלון"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Release Status */}
            <div className="bg-gray-950/70 border border-gray-800 rounded-2xl p-4 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                {isCheckingUpdate ? (
                  <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                ) : latestReleaseTag ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <div className="font-semibold text-white">
                    {isCheckingUpdate
                      ? 'בודק זמינות עדכונים ב-GitHub...'
                      : latestReleaseTag
                      ? `גרסה זמינה ב-GitHub: ${latestReleaseTag}`
                      : 'בדיקת עדכונים ב-GitHub'}
                  </div>
                  {releaseCheckError && (
                    <div className="text-xs text-gray-400 mt-0.5">{releaseCheckError}</div>
                  )}
                </div>
              </div>
              <button
                onClick={checkUpdates}
                disabled={isCheckingUpdate}
                className="text-xs text-blue-400 hover:text-blue-300 underline font-medium focus:outline-none focus:ring-1 focus:ring-blue-400 p-1 rounded cursor-pointer"
              >
                בדוק שוב
              </button>
            </div>

            {/* Update options */}
            <div className="flex flex-col gap-3.5">
              {/* Option 1: Fast Web Reload (Clears ServiceWorker + Cache Storage) */}
              <button
                tabIndex={0}
                onClick={handleForceWebReload}
                disabled={isReloading}
                className="group flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 hover:from-blue-800/60 hover:to-indigo-800/60 border border-blue-500/40 hover:border-blue-400 text-right transition-all transform hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-blue-400 cursor-pointer"
              >
                <div className="p-3 bg-blue-600/30 text-blue-300 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
                  <RefreshCw className={`w-6 h-6 ${isReloading ? 'animate-spin' : ''}`} />
                </div>
                <div className="flex-1">
                  <div className="text-base font-bold text-white flex items-center gap-2">
                    רענון וטעינת גרסה חדשה (Web)
                    <span className="bg-emerald-500/20 text-emerald-300 text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/30">
                      מומלץ
                    </span>
                  </div>
                  <div className="text-xs text-gray-300 mt-1 leading-relaxed">
                    מנקה זיכרון מטמון וטוען את השינויים העדכניים ביותר ישירות מהשרת (מתאים גם לאפליקציית הטלוויזיה).
                  </div>
                </div>
              </button>

              {/* Option 2: Download APK */}
              <a
                tabIndex={0}
                href="https://github.com/cfiramar/cook-off/releases/latest/download/CookOff-AndroidTV-ViewMode.apk"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 p-4 rounded-2xl bg-gray-800/60 hover:bg-gray-800/90 border border-gray-700 hover:border-gray-600 text-right transition-all transform hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-blue-400 cursor-pointer"
              >
                <div className="p-3 bg-purple-600/20 text-purple-300 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
                  <Download className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-bold text-white flex items-center gap-2">
                    הורדת קובץ התקנה לטלוויזיה (APK)
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="text-xs text-gray-400 mt-1 leading-relaxed">
                    מוריד את קובץ ה-APK המלא (CookOff-AndroidTV-ViewMode.apk) להתקנה על Android TV.
                  </div>
                </div>
              </a>

              {/* Option 3: GitHub Releases page */}
              <a
                tabIndex={0}
                href="https://github.com/cfiramar/cook-off/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-950/40 hover:bg-gray-900 border border-gray-800/80 text-xs text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              >
                <span>צפייה בכל הגרסאות ב-GitHub (כולל אפליקציית המנחה)</span>
                <ExternalLink className="w-4 h-4 text-gray-500" />
              </a>
            </div>

            {/* Footer */}
            <div className="pt-2 flex justify-end">
              <button
                tabIndex={0}
                onClick={() => setIsUpdateModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

