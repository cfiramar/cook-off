import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAllEvents, useGeneralSettings } from '../../hooks/useFirebaseData';
import { Plus, Calendar, Settings, Users, UtensilsCrossed, BarChart3, Copy, Palette, Trash2, Sliders, ShoppingCart } from 'lucide-react';
import { usePopup } from '../../components/ui/PopupProvider';
import CopyLinksModal from '../../components/ui/CopyLinksModal';
import GeneralSettingsModal from './components/GeneralSettingsModal';
import { executeHostingSync } from '../../utils/hostingHouseholdSync';

export default function PlanningDashboard() {
  const { events, loading, error } = useAllEvents();
  const { generalSettings } = useGeneralSettings();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [showCopyModalFor, setShowCopyModalFor] = useState<string | null>(null);
  const [isGeneralSettingsOpen, setIsGeneralSettingsOpen] = useState(false);
  const { showAlert, showConfirm } = usePopup();

  const handleCreateEvent = async () => {
    setIsCreating(true);
    try {
      const newEventRef = await addDoc(collection(db, 'events'), {
        title: 'אירוע חדש',
        subtitle: 'תיאור האירוע שלך',
        startButtonText: 'היכנסו לאירוע',
        theme: 'classic',
        date: new Date().toISOString().split('T')[0],
        pointsPerVoter: 5,
        hostPin: '1234',
        timerStatus: 'idle',
        timerEndTime: null,
        revealState: 'none'
      });
      // Auto-seed hosting household members who have includeInEveryEvent: true
      if (generalSettings?.hostingHousehold) {
        await executeHostingSync(newEventRef.id, generalSettings.hostingHousehold, []);
      }

      navigate(`/planning/${newEventRef.id}/settings/details`);
    } catch (error) {
      console.error("Error creating event: ", error);
      showAlert("שגיאה ביצירת אירוע");
    } finally {
      setIsCreating(false);
    }
  };


  const handleDeleteEvent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm('האם אתה בטוח שברצונך למחוק אירוע זה לצמיתות?', async () => {
      try {
        await deleteDoc(doc(db, 'events', id));
      } catch (error) {
        console.error("Error deleting event: ", error);
        showAlert("שגיאה במחיקת אירוע");
      }
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'לא נקבע תאריך';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].substring(2)}`;
    return dateStr;
  };

  return (
    <div className="flex-1 w-full relative bg-gray-50 text-gray-900 font-sans h-screen overflow-y-auto admin-scroll">
      {/* Background Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-400/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto w-full p-8 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 drop-shadow-sm">ניהול אירועים</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsGeneralSettingsOpen(true)}
              className="bg-white hover:bg-gray-100 text-gray-800 border border-gray-200 font-bold py-3 px-5 rounded-xl shadow-xs transition-transform transform active:scale-95 flex items-center gap-2"
              title="הגדרות כלליות למערכת"
            >
              <Sliders size={20} className="text-blue-600" /> הגדרות כלליות
            </button>
            <button
              onClick={handleCreateEvent}
              disabled={isCreating}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-transform transform active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              <Plus size={20} /> צור אירוע חדש
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-pulse text-indigo-400 text-2xl font-semibold">טוען אירועים...</div>
          </div>
        ) : error ? (
          <div className="col-span-full text-center text-red-600 py-12 bg-red-50/80 backdrop-blur-md rounded-2xl border border-red-200 p-6">
            <p className="text-xl font-bold mb-2">שגיאה בטעינת אירועים</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {events.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 py-12 bg-black bg-opacity-30 rounded-xl border border-gray-800">
                אין אירועים קיימים. לחץ על "צור אירוע חדש" כדי להתחיל.
              </div>
            ) : (
              events.map(event => (
                <div 
                  key={event.id} 
                  onClick={() => navigate(`/planning/${event.id}/guests`)}
                  className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg border border-white/50 p-6 flex flex-col hover:border-blue-300 hover:shadow-blue-500/10 transition-all duration-300 transform hover:-translate-y-2 relative overflow-hidden group cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-2xl font-bold text-gray-800">{event.title}</h2>
                      <button
                        onClick={(e) => handleDeleteEvent(event.id!, e)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors"
                        title="מחק אירוע"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 mb-4 text-sm font-medium">
                      <Calendar size={16} />
                      <span>{formatDate(event.date)}</span>
                    </div>
                    <p className="text-gray-600 mb-6 line-clamp-2 leading-relaxed min-h-[3rem]">{event.subtitle}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-auto pt-4 border-t border-gray-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/planning/${event.id}/settings/details`); }}
                        className="flex-1 min-w-[30%] bg-gray-50 hover:bg-white text-gray-700 hover:text-blue-600 border border-gray-100 hover:border-blue-200 hover:shadow-md p-2.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all font-medium"
                        title="פרטים"
                      >
                        <Settings size={18} /> <span className="hidden sm:inline">פרטים</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/planning/${event.id}/settings/theme`); }}
                        className="flex-1 min-w-[30%] bg-gray-50 hover:bg-white text-gray-700 hover:text-blue-600 border border-gray-100 hover:border-blue-200 hover:shadow-md p-2.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all font-medium"
                        title="עיצוב"
                      >
                        <Palette size={18} /> <span className="hidden sm:inline">עיצוב</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/planning/${event.id}/guests`); }}
                        className="flex-1 min-w-[30%] bg-gray-50 hover:bg-white text-gray-700 hover:text-blue-600 border border-gray-100 hover:border-blue-200 hover:shadow-md p-2.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all font-medium"
                        title="אורחים"
                      >
                        <Users size={18} /> <span className="hidden sm:inline">אורחים</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/planning/${event.id}/meals`); }}
                        className="flex-1 min-w-[30%] bg-gray-50 hover:bg-white text-gray-700 hover:text-blue-600 border border-gray-100 hover:border-blue-200 hover:shadow-md p-2.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all font-medium"
                        title="מנות"
                      >
                        <UtensilsCrossed size={18} /> <span className="hidden sm:inline">מנות</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/planning/${event.id}/grocery`); }}
                        className="flex-1 min-w-[30%] bg-gray-50 hover:bg-white text-gray-700 hover:text-blue-600 border border-gray-100 hover:border-blue-200 hover:shadow-md p-2.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all font-medium"
                        title="רשימת קניות"
                      >
                        <ShoppingCart size={18} /> <span className="hidden sm:inline">קניות</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/planning/${event.id}/live/results`); }}
                        className="flex-1 min-w-[30%] bg-gray-50 hover:bg-white text-gray-700 hover:text-blue-600 border border-gray-100 hover:border-blue-200 hover:shadow-md p-2.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all font-medium"
                        title="תוצאות"
                      >
                        <BarChart3 size={18} /> <span className="hidden sm:inline">תוצאות</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowCopyModalFor(event.id!); }}
                        className="flex-1 min-w-[30%] bg-gray-50 hover:bg-white text-gray-700 hover:text-blue-600 border border-gray-100 hover:border-blue-200 hover:shadow-md p-2.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all font-medium"
                        title="קישורים"
                      >
                        <Copy size={18} /> <span className="hidden sm:inline">קישורים</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Copy URL Modal */}
        <CopyLinksModal
          isOpen={!!showCopyModalFor}
          onClose={() => setShowCopyModalFor(null)}
          eventId={showCopyModalFor || ''}
        />

        {/* General Settings Modal */}
        <GeneralSettingsModal
          isOpen={isGeneralSettingsOpen}
          onClose={() => setIsGeneralSettingsOpen(false)}
        />
      </div>
    </div>
  );
}
