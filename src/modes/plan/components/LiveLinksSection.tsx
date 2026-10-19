import { useState } from 'react';
import { Copy, ExternalLink, Share2, Tv, UserCheck, Shield, Check, QrCode, Sparkles } from 'lucide-react';
import type { EventInfo } from '../../../hooks/useFirebaseData';
import { usePopup } from '../../../components/ui/PopupProvider';

interface Props {
  eventId: string;
  eventInfo: EventInfo | null;
}

/**
 * Dedicated Live Broadcast Links Section
 * Gives the event host immediate access to Voters URL (with QR code and WhatsApp share),
 * Host Cockpit URL, and TV / View Screen URL.
 */
export default function LiveLinksSection({ eventId, eventInfo }: Props) {
  const { showSuccess } = usePopup();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showQrFor, setShowQrFor] = useState<string | null>('voters');

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

  const copyAllLinks = () => {
    const summary = `🏆 קישורים לאירוע "${eventInfo?.title || 'התחרות'}":\n\n` +
      `📱 קישור להצבעה (עבור האורחים):\n${voterLink}\n\n` +
      `📺 קישור למסך הטלוויזיה:\n${viewLink}\n\n` +
      `🔒 קישור למנחה (קוד PIN: ${eventInfo?.hostPin || '1234'}):\n${hostLink}`;
    navigator.clipboard.writeText(summary);
    showSuccess('כל הקישורים הועתקו ללוח בהצלחה!');
  };

  const shareViaWhatsApp = () => {
    const text = `היכנסו להצביע באירוע התחרות "${eventInfo?.title || 'שלנו'}"!\n${voterLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 h-full overflow-hidden flex flex-col" dir="rtl">
      <div className="flex-1 overflow-y-auto admin-scroll p-6 md:p-8 flex flex-col text-right min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-gray-100 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <Share2 className="text-blue-600" />
            קישורים לאירוע ושידור חי
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            קישורים ייעודיים לכל אחד ממרכיבי התחרות בזמן אמת: אורחים, מנחה, ומסך הטלוויזיה
          </p>
        </div>

        <button
          onClick={copyAllLinks}
          className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center gap-2 text-sm"
        >
          <Copy size={16} />
          <span>העתק את כל הקישורים</span>
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 1. Voters Link Card */}
        <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/40 rounded-3xl border border-blue-200/80 p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="p-3 bg-blue-600 text-white rounded-2xl shadow-sm">
                <UserCheck size={24} />
              </span>
              <span className="text-xs font-bold text-blue-700 bg-blue-100/80 px-3 py-1 rounded-full">
                עבור האורחים
              </span>
            </div>

            <h3 className="text-xl font-black text-gray-900 mb-1">קישור להצבעה</h3>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              הקישור לכלל האורחים והמשתתפים באירוע. דרכו הם נכנסים, צופים בתפריט המנות, ומדרגים בנייד בזמן אמת.
            </p>

            {/* URL Display */}
            <div className="bg-white rounded-xl border border-blue-200 p-2.5 flex items-center justify-between gap-2 mb-4">
              <span className="text-xs font-mono text-gray-700 truncate dir-ltr select-all text-left">
                {voterLink}
              </span>
              <button
                onClick={() => copyToClipboard(voterLink, 'voter', 'קישור להצבעה')}
                className={`p-2 rounded-lg transition-all shrink-0 ${
                  copiedKey === 'voter'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                }`}
                title="העתק קישור"
              >
                {copiedKey === 'voter' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            {/* QR Code Section */}
            {showQrFor === 'voters' && (
              <div className="bg-white rounded-2xl p-4 border border-blue-100 mb-4 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(voterLink)}`}
                  alt="QR Code להצבעה"
                  className="w-36 h-36 rounded-xl border border-gray-100 shadow-2xs mb-2"
                />
                <span className="text-[11px] text-gray-500 font-medium">
                  סרקו בנייד כדי להיכנס מיידית
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-blue-200/60">
            <button
              onClick={shareViaWhatsApp}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs"
            >
              <Share2 size={16} />
              <span>שיתוף מהיר בוואטסאפ</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowQrFor(prev => (prev === 'voters' ? null : 'voters'))}
                className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs"
              >
                <QrCode size={15} />
                <span>{showQrFor === 'voters' ? 'הסתר ברקוד' : 'הצג ברקוד'}</span>
              </button>

              <a
                href={voterLink}
                target="_blank"
                rel="noreferrer"
                className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs text-center"
              >
                <ExternalLink size={15} />
                <span>פתח בדפדפן</span>
              </a>
            </div>
          </div>
        </div>

        {/* 2. Host Cockpit Card */}
        <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 rounded-3xl border border-amber-200/80 p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="p-3 bg-amber-500 text-white rounded-2xl shadow-sm">
                <Shield size={24} />
              </span>
              <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-3 py-1 rounded-full">
                פאנל מנחה
              </span>
            </div>

            <h3 className="text-xl font-black text-gray-900 mb-1">קישור למנחה (קונטרול)</h3>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              פאנל השליטה החי של מנחה האירוע. כולל הפעלת טיימר ההצבעה, ניהול מצביעים חי, חשיפת מנצחים מדורגת, ואיפוס.
            </p>

            {/* URL Display */}
            <div className="bg-white rounded-xl border border-amber-200 p-2.5 flex items-center justify-between gap-2 mb-4">
              <span className="text-xs font-mono text-gray-700 truncate dir-ltr select-all text-left">
                {hostLink}
              </span>
              <button
                onClick={() => copyToClipboard(hostLink, 'host', 'קישור לפאנל מנחה')}
                className={`p-2 rounded-lg transition-all shrink-0 ${
                  copiedKey === 'host'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                }`}
                title="העתק קישור"
              >
                {copiedKey === 'host' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            {/* PIN Badge Notice */}
            <div className="bg-white rounded-2xl p-3.5 border border-amber-200 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">קוד נעילה (PIN):</span>
                <span className="font-mono font-black text-amber-700 text-sm tracking-wider bg-amber-100/60 px-2 py-0.5 rounded-md">
                  {eventInfo?.hostPin || '1234'}
                </span>
              </div>
              <p className="text-[11px] text-amber-800 mt-1.5 leading-normal">
                הפאנל מוגן בקוד נעילה זה כדי למנוע גישה של אורחים.
              </p>
            </div>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-amber-200/60">
            <a
              href={hostLink}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs text-center"
            >
              <ExternalLink size={16} />
              <span>פתח פאנל מנחה</span>
            </a>
          </div>
        </div>

        {/* 3. View Screen Card */}
        <div className="bg-gradient-to-br from-purple-50/70 to-pink-50/40 rounded-3xl border border-purple-200/80 p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="p-3 bg-purple-600 text-white rounded-2xl shadow-sm">
                <Tv size={24} />
              </span>
              <span className="text-xs font-bold text-purple-700 bg-purple-100/80 px-3 py-1 rounded-full">
                מסך טלוויזיה / מקרן
              </span>
            </div>

            <h3 className="text-xl font-black text-gray-900 mb-1">מסך תצוגה חיה (View Mode)</h3>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              מסך מרהיב למסך הטלוויזיה או המקרן בסלון. מציג גלריית מנות מסתובבת, טיימר מרהיב, ואת טקס הכרזת המנצחים.
            </p>

            {/* URL Display */}
            <div className="bg-white rounded-xl border border-purple-200 p-2.5 flex items-center justify-between gap-2 mb-4">
              <span className="text-xs font-mono text-gray-700 truncate dir-ltr select-all text-left">
                {viewLink}
              </span>
              <button
                onClick={() => copyToClipboard(viewLink, 'view', 'קישור למסך הטלוויזיה')}
                className={`p-2 rounded-lg transition-all shrink-0 ${
                  copiedKey === 'view'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-purple-50 hover:bg-purple-100 text-purple-700'
                }`}
                title="העתק קישור"
              >
                {copiedKey === 'view' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            {/* Features Highlight */}
            <div className="bg-white rounded-2xl p-3.5 border border-purple-200 mb-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-900">
                <Sparkles size={14} className="text-purple-600" />
                <span>גלריית מנות חכמה ללא צריבת מסך</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-900">
                <Sparkles size={14} className="text-purple-600" />
                <span>סנכרון מלא בזמן אמת עם הטיימר</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-purple-200/60">
            <a
              href={viewLink}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs text-center"
            >
              <ExternalLink size={16} />
              <span>פתח מסך טלוויזיה</span>
            </a>
          </div>
        </div>

      </div>
      </div>
    </div>
  );
}
