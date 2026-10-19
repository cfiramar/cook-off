import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Download, ExternalLink, X, CheckCircle2, AlertCircle } from 'lucide-react';

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

export const APP_CURRENT_VERSION = 'v1.0.3';

export default function AppUpdateModal({
  isOpen,
  onClose,
  title = 'עדכון אפליקציה',
  currentVersion = APP_CURRENT_VERSION,
  apkDownloadUrl = 'https://github.com/cfiramar/cook-off/releases/latest/download/CookOff-Host-Mobile.apk',
  apkTitle = 'הורדת קובץ התקנה למכשיר (APK)',
  apkDescription = 'מוריד את קובץ ה-APK המעודכן (CookOff-Host-Mobile.apk) להתקנה על מכשיר אנדרואיד.',
  isDarkMode = true
}: AppUpdateModalProps) {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [latestReleaseTag, setLatestReleaseTag] = useState<string | null>(null);
  const [releaseCheckError, setReleaseCheckError] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const modalCloseRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      checkUpdates();
      const timer = setTimeout(() => {
        modalCloseRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-modal-title"
      dir="rtl"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div
        className={`border rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative flex flex-col gap-6 text-right animate-in zoom-in-95 duration-200 ${
          isDarkMode
            ? 'bg-gray-900 border-gray-700 text-white'
            : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between border-b pb-4 ${isDarkMode ? 'border-gray-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-500 dark:text-blue-400 rounded-2xl border border-blue-500/30">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h2 id="update-modal-title" className="text-2xl font-bold">
                {title}
              </h2>
              <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                גרסה נוכחית: {currentVersion}
              </p>
            </div>
          </div>
          <button
            ref={modalCloseRef}
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer ${
              isDarkMode
                ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            aria-label="סגור חלון"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Release Status */}
        <div className={`border rounded-2xl p-4 flex items-center justify-between text-sm ${
          isDarkMode
            ? 'bg-gray-950/70 border-gray-800'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            {isCheckingUpdate ? (
              <RefreshCw className="w-5 h-5 text-blue-500 dark:text-blue-400 animate-spin" />
            ) : latestReleaseTag ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <div className="font-semibold">
                {isCheckingUpdate
                  ? 'בודק זמינות עדכונים ב-GitHub...'
                  : latestReleaseTag
                  ? `גרסה זמינה ב-GitHub: ${latestReleaseTag}`
                  : 'בדיקת עדכונים ב-GitHub'}
              </div>
              {releaseCheckError && (
                <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                  {releaseCheckError}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={checkUpdates}
            disabled={isCheckingUpdate}
            className="text-xs text-blue-500 dark:text-blue-400 hover:underline font-medium focus:outline-none focus:ring-1 focus:ring-blue-400 p-1 rounded cursor-pointer"
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
            className={`group flex items-start gap-4 p-4 rounded-2xl border text-right transition-all transform hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-blue-400 cursor-pointer ${
              isDarkMode
                ? 'bg-gradient-to-r from-blue-900/40 to-indigo-900/40 hover:from-blue-800/60 hover:to-indigo-800/60 border-blue-500/40 hover:border-blue-400'
                : 'bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-200 hover:border-blue-400'
            }`}
          >
            <div className="p-3 bg-blue-600/30 text-blue-600 dark:text-blue-300 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
              <RefreshCw className={`w-6 h-6 ${isReloading ? 'animate-spin' : ''}`} />
            </div>
            <div className="flex-1">
              <div className="text-base font-bold flex items-center gap-2">
                רענון וטעינת גרסה חדשה (Web)
                <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/30">
                  מומלץ
                </span>
              </div>
              <div className={`text-xs mt-1 leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                מנקה זיכרון מטמון וטוען את השינויים העדכניים ביותר ישירות מהשרת (מתאים גם לאפליקציית הנייד וה-PWA).
              </div>
            </div>
          </button>

          {/* Option 2: Download APK */}
          <a
            tabIndex={0}
            href={apkDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-start gap-4 p-4 rounded-2xl border text-right transition-all transform hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-blue-400 cursor-pointer ${
              isDarkMode
                ? 'bg-gray-800/60 hover:bg-gray-800/90 border-gray-700 hover:border-gray-600'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="p-3 bg-purple-600/20 text-purple-600 dark:text-purple-300 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
              <Download className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="text-base font-bold flex items-center gap-2">
                {apkTitle}
                <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className={`text-xs mt-1 leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                {apkDescription}
              </div>
            </div>
          </a>

          {/* Option 3: GitHub Releases page */}
          <a
            tabIndex={0}
            href="https://github.com/cfiramar/cook-off/releases"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer ${
              isDarkMode
                ? 'bg-gray-950/40 hover:bg-gray-900 border-gray-800/80 text-gray-300 hover:text-white'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>צפייה בכל הגרסאות והעדכונים ב-GitHub</span>
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </a>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            tabIndex={0}
            onClick={onClose}
            className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer ${
              isDarkMode
                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
            }`}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
