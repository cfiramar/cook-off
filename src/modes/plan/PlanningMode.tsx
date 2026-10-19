import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFirebaseData } from '../../hooks/useFirebaseData';
import EventSettings from './components/EventSettings';
import GuestManager from './components/GuestManager';
import MealManager from './components/MealManager';
import ResultsDashboard from './components/ResultsDashboard';
import ThemeSettings from './components/ThemeSettings';
import GroceryListManager from './components/GroceryListManager';
import LiveLinksSection from './components/LiveLinksSection';
import LiveVotersSection from './components/LiveVotersSection';
import PlanningSidebar from './components/PlanningSidebar';
import GeneralSettingsModal from './components/GeneralSettingsModal';
import { Menu, ArrowRight } from 'lucide-react';
import { executeHostingSync } from '../../utils/hostingHouseholdSync';

export default function PlanningMode() {
  const { eventId, tab, subTab } = useParams<{ eventId: string; tab?: string; subTab?: string }>();
  const navigate = useNavigate();
  const { eventInfo, guests, meals, votes, generalSettings, loading, error } = useFirebaseData(eventId);
  const [isKeySettingsModalOpen, setIsKeySettingsModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Normalize Tab and Sub-Tab (with full backwards-compatibility)
  let currentTab = tab || 'settings';
  let currentSubTab = subTab || '';

  if (currentTab === 'details') {
    currentTab = 'settings';
    currentSubTab = 'details';
  } else if (currentTab === 'themes' || currentTab === 'theme') {
    currentTab = 'settings';
    currentSubTab = 'theme';
  } else if (currentTab === 'results') {
    currentTab = 'live';
    currentSubTab = 'results';
  } else if (currentTab === 'links') {
    currentTab = 'live';
    currentSubTab = 'links';
  } else if (currentTab === 'voters') {
    currentTab = 'live';
    currentSubTab = 'voters';
  }

  // Set default sub-tabs when not explicitly specified
  if (currentTab === 'settings' && !currentSubTab) {
    currentSubTab = 'details';
  } else if (currentTab === 'live' && !currentSubTab) {
    currentSubTab = 'results';
  } else if (currentTab === 'guests' && !currentSubTab) {
    currentSubTab = 'all';
  } else if (currentTab === 'meals' && !currentSubTab) {
    currentSubTab = 'all';
  }

  // Synchronize hosting household members with this event's guests
  useEffect(() => {
    if (!loading && eventId && generalSettings?.hostingHousehold && guests) {
      executeHostingSync(eventId, generalSettings.hostingHousehold, guests);
    }
  }, [loading, eventId, generalSettings?.hostingHousehold, guests]);

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-pulse text-indigo-500 text-2xl font-bold">טוען נתונים...</div>
      </div>
    );
  }

  if (error || !eventId) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center h-screen bg-gray-50 p-6 text-center">
        <h2 className="text-2xl font-bold text-red-500 mb-4">{error || "אירוע לא נמצא"}</h2>
        <button
          onClick={() => navigate('/planning')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md"
        >
          חזרה לכל האירועים
        </button>
      </div>
    );
  }

  const handleNavigate = (newTab: string, newSubTab?: string) => {
    if (newSubTab && newSubTab !== 'all') {
      navigate(`/planning/${eventId}/${newTab}/${newSubTab}`);
    } else {
      navigate(`/planning/${eventId}/${newTab}`);
    }
  };

  return (
    <div className="flex-1 w-full bg-gray-50 text-gray-900 font-sans h-screen max-h-screen overflow-hidden flex flex-col md:flex-row relative">
      
      {/* Background Glow Accents */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-400/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-400/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Mobile Top Header (Visible only on < md screens) */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/planning')}
            className="text-gray-500 hover:text-blue-600 p-1.5 rounded-lg border border-gray-200"
            title="חזרה לכל האירועים"
          >
            <ArrowRight size={18} />
          </button>
          <div>
            <h1 className="font-extrabold text-sm text-gray-900 truncate max-w-[190px]">
              {eventInfo?.title || 'תחרות'}
            </h1>
          </div>
        </div>

        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          title="פתח תפריט"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Sidebar Navigation */}
      <PlanningSidebar
        eventId={eventId}
        eventInfo={eventInfo}
        currentTab={currentTab}
        currentSubTab={currentSubTab}
        guests={guests}
        meals={meals}
        onNavigate={handleNavigate}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 h-full max-h-screen overflow-hidden flex flex-col min-w-0 p-3 sm:p-5 md:p-6 lg:p-8 relative z-10">
        
        {/* Settings Tab */}
        {currentTab === 'settings' && (
          <div className="h-full overflow-hidden flex flex-col min-h-0">
            {currentSubTab === 'details' && (
              <div className="h-full overflow-y-auto admin-scroll pb-4">
                <EventSettings eventInfo={eventInfo} eventId={eventId} />
              </div>
            )}
            {(currentSubTab === 'theme' || currentSubTab === 'themes') && (
              <div className="h-full overflow-y-auto admin-scroll pb-4">
                <ThemeSettings eventInfo={eventInfo} eventId={eventId} />
              </div>
            )}
          </div>
        )}

        {/* Guests Tab */}
        {currentTab === 'guests' && (
          <div className="h-full overflow-hidden flex flex-col min-h-0">
            <GuestManager
              guests={guests}
              meals={meals}
              eventInfo={eventInfo}
              eventId={eventId}
              activeFilter={currentSubTab}
              onFilterChange={(filter) => handleNavigate('guests', filter)}
            />
          </div>
        )}

        {/* Meals Tab */}
        {currentTab === 'meals' && (
          <div className="h-full overflow-hidden flex flex-col min-h-0">
            <MealManager
              meals={meals}
              guests={guests}
              eventId={eventId}
              activeCategoryFilter={currentSubTab}
              onCategoryFilterChange={(cat) => handleNavigate('meals', cat)}
            />
          </div>
        )}

        {/* Grocery List Tab */}
        {currentTab === 'grocery' && (
          <div className="h-full overflow-hidden flex flex-col min-h-0">
            <GroceryListManager
              guests={guests}
              generalSettings={generalSettings}
              eventId={eventId}
              onOpenKeySettings={() => setIsKeySettingsModalOpen(true)}
            />
          </div>
        )}

        {/* Live Broadcast Tab */}
        {currentTab === 'live' && (
          <div className="h-full overflow-hidden flex flex-col min-h-0">
            {currentSubTab === 'links' && (
              <LiveLinksSection eventId={eventId} eventInfo={eventInfo} />
            )}
            {currentSubTab === 'results' && (
              <ResultsDashboard guests={guests} meals={meals} votes={votes} mode="results" />
            )}
            {currentSubTab === 'voters' && (
              <LiveVotersSection guests={guests} meals={meals} votes={votes} />
            )}
          </div>
        )}

      </main>

      {/* Key / General Settings Modal */}
      <GeneralSettingsModal
        isOpen={isKeySettingsModalOpen}
        onClose={() => setIsKeySettingsModalOpen(false)}
        initialTab="key"
      />

    </div>
  );
}
