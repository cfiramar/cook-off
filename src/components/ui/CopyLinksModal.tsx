import { useState } from 'react';
import { X, Copy, ExternalLink, Share2, Check, Tv, UserCheck, Shield } from 'lucide-react';
import { usePopup } from './PopupProvider';

interface CopyLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
}

/**
 * Reusable modal for copying and sharing event links across planning-mode, dashboard, and host views.
 * Ensures consistent URL formats across the entire application:
 * - Voter: /:eventId
 * - Host: /host/:eventId
 * - View / TV: /view/:eventId
 */
export default function CopyLinksModal({ isOpen, onClose, eventId }: CopyLinksModalProps) {
  const { showSuccess } = usePopup();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen || !eventId) return null;

  const voterLink = `${window.location.origin}/${eventId}`;
  const hostLink = `${window.location.origin}/host/${eventId}`;
  const viewLink = `${window.location.origin}/view/${eventId}`;

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showSuccess(`${label} הועתק בהצלחה!`);
    setTimeout(() => {
      setCopiedKey(prev => (prev === key ? null : prev));
    }, 2000);
  };

  const shareViaWhatsApp = () => {
    const text = `היכנסו להצביע באירוע התחרות שלנו!\n${voterLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const links = [
    {
      key: 'voters',
      title: 'קישור למצביעים',
      subtitle: 'עבור האורחים והמשתתפים באירוע',
      url: voterLink,
      icon: <UserCheck size={20} className="text-blue-600" />,
      colorClasses: 'border-blue-200 bg-blue-50/50 hover:bg-blue-50',
      copyButtonClasses: 'bg-blue-600 hover:bg-blue-700 text-white',
      hasWhatsApp: true,
    },
    {
      key: 'host',
      title: 'קישור למנחה (פאנל שליטה)',
      subtitle: 'לניהול טיימר, הצגת תוצאות ואיפוס',
      url: hostLink,
      icon: <Shield size={20} className="text-amber-600" />,
      colorClasses: 'border-amber-200 bg-amber-50/50 hover:bg-amber-50',
      copyButtonClasses: 'bg-amber-600 hover:bg-amber-700 text-white',
      hasWhatsApp: false,
    },
    {
      key: 'view',
      title: 'קישור למסך הטלוויזיה (View Mode)',
      subtitle: 'לתצוגה חיה, טיימר וחשיפת מנצחים על מסך גדול',
      url: viewLink,
      icon: <Tv size={20} className="text-purple-600" />,
      colorClasses: 'border-purple-200 bg-purple-50/50 hover:bg-purple-50',
      copyButtonClasses: 'bg-purple-600 hover:bg-purple-700 text-white',
      hasWhatsApp: false,
    },
  ];

  return (
    <div 
      className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-4 sm:p-0 transition-opacity cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 p-6 sm:p-8 w-full sm:max-w-lg relative overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:fade-in duration-300 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-[-50px] right-[-50px] w-[150px] h-[150px] bg-blue-400/20 rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute bottom-[-50px] left-[-50px] w-[150px] h-[150px] bg-purple-400/20 rounded-full blur-[60px] pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 left-5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-full transition-all z-20"
          title="סגור"
        >
          <X size={22} />
        </button>

        <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center relative z-10">
          שיתוף וקישורי אירוע
        </h2>
        <p className="text-gray-500 text-sm text-center mb-6 relative z-10">
          העתק קישורים ייעודיים לכל אחד מהמסכים באירוע
        </p>

        <div className="flex flex-col gap-4 relative z-10">
          {links.map(item => {
            const isCopied = copiedKey === item.key;

            return (
              <div
                key={item.key}
                className={`p-4 rounded-2xl border transition-all ${item.colorClasses}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-white rounded-xl shadow-xs">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                        {item.title}
                      </h3>
                      <p className="text-xs text-gray-500">{item.subtitle}</p>
                    </div>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-white/80 transition-colors"
                    title="פתח בחלון חדש"
                  >
                    <ExternalLink size={18} />
                  </a>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => copyToClipboard(item.url, item.key, item.title)}
                    className={`flex-1 flex items-center justify-center gap-2 font-bold py-2.5 px-4 rounded-xl text-sm shadow-xs transition-all active:scale-[0.98] ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : item.copyButtonClasses
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check size={16} />
                        <span>הועתק!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        <span>העתק קישור</span>
                      </>
                    )}
                  </button>

                  {item.hasWhatsApp && (
                    <button
                      onClick={shareViaWhatsApp}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-sm shadow-xs transition-all active:scale-[0.98] flex items-center gap-1.5"
                      title="שתף ב-WhatsApp"
                    >
                      <Share2 size={16} />
                      <span className="hidden sm:inline">וואטסאפ</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
