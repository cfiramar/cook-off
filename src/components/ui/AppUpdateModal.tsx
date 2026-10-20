import { useEffect, useRef, useState, useCallback } from 'react';
import { Download, X, CheckCircle2, AlertCircle, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { useTvRemoteNavigation } from '../../utils/useTvRemoteNavigation';

export interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  currentVersion?: string;
  apkDownloadUrl?: string;
  apkName?: string;
  apkTitle?: string;
  apkDescription?: string;
  isDarkMode?: boolean;
}

export const APP_CURRENT_VERSION = 'v1.1.0';

/**
 * Compare semantic versions like "v1.0.5" vs "v1.0.4".
 * Returns true if latest is strictly higher than current.
 */
function isNewerVersion(latestTag: string, currentVer: string): boolean {
  try {
    const clean = (v: string) => v.replace(/^v/i, '').trim();
    const lParts = clean(latestTag).split('.').map((n) => parseInt(n, 10) || 0);
    const cParts = clean(currentVer).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
      const l = lParts[i] || 0;
      const c = cParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
  } catch {
    // If parsing fails, fall back to string inequality
    return latestTag.trim() !== currentVer.trim();
  }
  return false;
}

export default function AppUpdateModal({
  isOpen,
  onClose,
  title: _title = 'בדיקת עדכונים',
  currentVersion = APP_CURRENT_VERSION,
  apkDownloadUrl = 'https://github.com/cfiramar/cook-off/releases/latest/download/CookOff-Host-Mobile.apk',
  apkName = 'CookOff-App.apk',
  isDarkMode = true,
}: AppUpdateModalProps) {
  const [phase, setPhase] = useState<'checking' | 'new_version' | 'up_to_date' | 'error'>('checking');
  const [latestReleaseTag, setLatestReleaseTag] = useState<string | null>(null);
  const [resolvedDownloadUrl, setResolvedDownloadUrl] = useState<string>(apkDownloadUrl);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useTvRemoteNavigation({
    active: isOpen,
    containerRef: modalRef,
    initialFocusRef: primaryBtnRef,
  });

  // Handle escape / back key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || (e as any).keyCode === 4) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Clean cache and check for updates as soon as modal opens
  const runAutoCleanAndCheck = useCallback(async () => {
    setPhase('checking');
    setErrorMessage(null);

    // 1. Auto-clean cache and service worker registrations
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
      console.warn('Cache clearing notice:', e);
    }

    // 2. Fetch latest release from GitHub
    try {
      const res = await fetch('https://api.github.com/repos/cfiramar/cook-off/releases/latest', {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      if (!res.ok) {
        setErrorMessage('לא ניתן לאמת גרסה מול GitHub (ייתכן ומאגר פרטי או בעיית רשת)');
        setPhase('error');
        return;
      }

      const data = await res.json();
      const tagName: string = data.tag_name || '';
      setLatestReleaseTag(tagName);

      // Check if release contains matching asset
      if (Array.isArray(data.assets) && data.assets.length > 0) {
        const matchedAsset = data.assets.find((a: any) =>
          typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk')
        );
        if (matchedAsset?.browser_download_url) {
          setResolvedDownloadUrl(matchedAsset.browser_download_url);
        }
      }

      if (tagName && isNewerVersion(tagName, currentVersion)) {
        setPhase('new_version');
      } else {
        setPhase('up_to_date');
      }
    } catch {
      setErrorMessage('שגיאת רשת בבדיקת עדכונים');
      setPhase('error');
    }
  }, [currentVersion]);

  useEffect(() => {
    if (isOpen) {
      runAutoCleanAndCheck();
    }
  }, [isOpen, runAutoCleanAndCheck]);

  // Focus primary button when phase settles
  useEffect(() => {
    if (isOpen && phase !== 'checking') {
      const timer = setTimeout(() => {
        primaryBtnRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, phase]);

  const handleDownload = () => {
    const downloadUrl = resolvedDownloadUrl || apkDownloadUrl;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = apkName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onClose();
  };

  const handleWebReload = () => {
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      dir="rtl"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={`border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative flex flex-col gap-6 text-right animate-in zoom-in-95 duration-200 ${isDarkMode
          ? 'bg-gray-900 border-gray-700 text-white'
          : 'bg-white border-slate-200 text-slate-900'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close "X" button */}
        <button
          onClick={onClose}
          className={`absolute top-5 left-5 p-2 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer ${isDarkMode
            ? 'text-gray-400 hover:text-white hover:bg-gray-800'
            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
          aria-label="סגור חלון"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Phase: Checking / Auto-cleaning */}
        {phase === 'checking' && (
          <div className="flex flex-col items-center justify-center text-center py-6 gap-4">
            <div className="p-4 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-full border border-blue-500/20">
              <Loader2 className="w-10 h-10 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold">מנקה זיכרון ובודק עדכונים...</h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                מנקה זיכרון מטמון ובודק מול GitHub
              </p>
            </div>
          </div>
        )}

        {/* Phase: New Version Detected */}
        {phase === 'new_version' && (
          <div className="flex flex-col gap-5 pt-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-500 rounded-2xl border border-amber-500/30 shrink-0">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-amber-400">זוהתה גרסה חדשה!</h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                  זיכרון המטמון נוקה בהצלחה
                </p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex flex-col gap-1.5 ${isDarkMode ? 'bg-gray-950/60 border-gray-800' : 'bg-slate-50 border-slate-200'
                }`}
            >
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-gray-400">גרסה חדשה זמינה:</span>
                <span className="text-emerald-400 font-mono font-bold text-base">
                  {latestReleaseTag}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>גרסה מותקנת נוכחית:</span>
                <span className="font-mono">{currentVersion}</span>
              </div>
            </div>

            <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
              הגרסה החדשה כוללת שיפורים ותיקונים. ניתן להתקין את הגרסה החדשה בלחיצה אחת.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                ref={primaryBtnRef}
                tabIndex={0}
                onClick={handleDownload}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-amber-300"
              >
                <Download className="w-5 h-5" />
                <span>הורד עכשיו</span>
              </button>
              <button
                tabIndex={0}
                onClick={onClose}
                className={`py-3 px-5 rounded-xl font-bold text-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-400 ${isDarkMode
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {/* Phase: Up to date */}
        {phase === 'up_to_date' && (
          <div className="flex flex-col gap-5 pt-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold">האפליקציה מעודכנת!</h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                  גרסה נוכחית: {currentVersion}
                </p>
              </div>
            </div>

            <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
              הזיכרון נוקה בהצלחה! הנך משתמש בגרסה העדכנית ביותר.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                ref={primaryBtnRef}
                tabIndex={0}
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-emerald-400"
              >
                מעולה, תודה!
              </button>
              <button
                tabIndex={0}
                onClick={handleWebReload}
                title="טען מחדש את הדף עם הזיכרון הנקי"
                className={`py-3 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-gray-300 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>רענן דף</span>
              </button>
            </div>
          </div>
        )}

        {/* Phase: Error */}
        {phase === 'error' && (
          <div className="flex flex-col gap-5 pt-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30 shrink-0">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold">זיכרון המטמון נוקה</h3>
                <p className={`text-xs mt-0.5 text-gray-400`}>
                  {errorMessage || 'לא הצלחנו לבדוק עדכונים'}
                </p>
              </div>
            </div>

            <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
              זיכרון המטמון נוקה בהצלחה. תוכל להמשיך להשתמש באפליקציה, או להוריד את הגרסה האחרונה ידנית.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                ref={primaryBtnRef}
                tabIndex={0}
                onClick={onClose}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-colors cursor-pointer ${isDarkMode
                  ? 'bg-gray-800 hover:bg-gray-700 text-white'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
              >
                סגור
              </button>
              <button
                tabIndex={0}
                onClick={handleDownload}
                className="py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>הורד בכל זאת</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
