import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EventInfo, Guest, Meal } from '../../../hooks/useFirebaseData';
import {
  Settings,
  Users,
  UtensilsCrossed,
  ShoppingCart,
  Radio,
  Sliders,
  Palette,
  Share2,
  Trophy,
  UserCheck,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  X,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Coins,
  Clock,
  ChefHat,
  Utensils,
  Calendar,
  Layers
} from 'lucide-react';

interface Props {
  eventId?: string;
  eventInfo: EventInfo | null;
  currentTab: string;
  currentSubTab: string;
  guests: Guest[];
  meals: Meal[];
  onNavigate: (tab: string, subTab?: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export default function PlanningSidebar({
  eventId: _eventId,
  eventInfo,
  currentTab,
  currentSubTab,
  guests,
  meals,
  onNavigate,
  isOpenMobile,
  onCloseMobile
}: Props) {
  const navigate = useNavigate();

  // Accordion state for expandable sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    settings: currentTab === 'settings',
    guests: currentTab === 'guests',
    meals: currentTab === 'meals',
    live: currentTab === 'live'
  });

  // Requirement 6: Auto-collapse sections when entering different section, auto-expand current section
  useEffect(() => {
    setExpandedSections({
      settings: currentTab === 'settings',
      guests: currentTab === 'guests',
      meals: currentTab === 'meals',
      live: currentTab === 'live'
    });
  }, [currentTab]);

  const toggleSection = (section: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Requirement 4: Do not count non-coming guests in other statuses like yet-to-pay or no-meal
  const guestStats = useMemo(() => {
    const total = guests.length;
    const coming = guests.filter(g => g.rsvpStatus === 'coming').length;
    const maybe = guests.filter(g => !g.rsvpStatus || g.rsvpStatus === 'maybe').length;
    const notComing = guests.filter(g => g.rsvpStatus === 'not_coming').length;

    // Only count guests who are NOT 'not_coming' in paid, unpaid, hasMeal, noMeal
    const paid = guests.filter(g => g.paid && g.rsvpStatus !== 'not_coming').length;
    const unpaid = guests.filter(g => !g.paid && g.shouldPayFee !== false && g.rsvpStatus !== 'not_coming').length;

    // Chef mapping
    const chefIdSet = new Set<string>();
    meals.forEach(m => {
      (m.chefIds || []).forEach(id => chefIdSet.add(id));
      if (m.householdChefIds && m.householdChefIds.length > 0) {
        guests.forEach(g => {
          if (g.householdId && m.householdChefIds!.includes(g.householdId)) {
            chefIdSet.add(g.id);
          }
        });
      }
    });

    const hasMeal = guests.filter(g => chefIdSet.has(g.id) && g.rsvpStatus !== 'not_coming').length;
    const noMeal = guests.filter(g => !chefIdSet.has(g.id) && g.rsvpStatus !== 'not_coming').length;

    return { total, coming, maybe, notComing, paid, unpaid, hasMeal, noMeal };
  }, [guests, meals]);

  // Requirement 1 & 2: Meal category stats for meal sub-sections
  const mealStats = useMemo(() => {
    const total = meals.length;
    const appetizer = meals.filter(m => m.category === 'מתאבן').length;
    const salad = meals.filter(m => m.category === 'סלט').length;
    const savory = meals.filter(m => (m.category || 'מלוח') === 'מלוח').length;
    const dessert = meals.filter(m => m.category === 'קינוח').length;
    return { total, appetizer, salad, savory, dessert };
  }, [meals]);

  const handleItemClick = (tab: string, subTab?: string) => {
    onNavigate(tab, subTab);
    onCloseMobile();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].substring(2)}`;
    return dateStr;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full w-full bg-white border-l border-gray-200/80 text-right select-none">
      
      {/* Top Header: Back button + Event branding */}
      <div className="p-4 sm:p-5 pb-4 border-b border-gray-100 flex-shrink-0 bg-gradient-to-b from-gray-50/70 to-white">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate('/planning')}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-2.5 py-1.5 rounded-xl transition-all shadow-2xs group"
            title="חזרה לרשימת כל האירועים"
          >
            <ArrowRight size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>כל האירועים</span>
          </button>

          {/* Close button for mobile drawer */}
          <button
            onClick={onCloseMobile}
            className="md:hidden text-gray-400 hover:text-gray-700 p-1 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Event Card */}
        <div className="bg-gray-50/80 border border-gray-200/70 rounded-2xl p-3.5">
          <h1 className="font-black text-gray-900 text-lg leading-tight truncate" title={eventInfo?.title}>
            {eventInfo?.title || 'תחרות'}
          </h1>
          {eventInfo?.subtitle && (
            <p className="text-xs text-gray-500 mt-0.5 truncate" title={eventInfo.subtitle}>
              {eventInfo.subtitle}
            </p>
          )}

          {eventInfo?.date && (
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-lg w-fit">
              <Calendar size={12} className="text-blue-600" />
              <span>{formatDate(eventInfo.date)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto admin-scroll p-3 space-y-1.5 min-h-0">
        
        {/* ========================================================= */}
        {/* 1. SETTINGS SECTION                                       */}
        {/* ========================================================= */}
        <div className="rounded-2xl overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => handleItemClick('settings', currentTab === 'settings' ? currentSubTab : 'details')}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all ${
              currentTab === 'settings'
                ? 'bg-blue-50/80 text-blue-950'
                : 'text-gray-700 hover:bg-gray-100/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`p-1.5 rounded-lg ${currentTab === 'settings' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <Settings size={15} />
              </span>
              <span className="text-sm">הגדרות</span>
            </div>
            <button
              type="button"
              onClick={e => toggleSection('settings', e)}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-md"
            >
              {expandedSections.settings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </button>

          {/* Sub-sections: Details, Theme */}
          {expandedSections.settings && (
            <div className="mr-5 pr-2.5 my-1 space-y-1 border-r-2 border-gray-200 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => handleItemClick('settings', 'details')}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentTab === 'settings' && (currentSubTab === 'details' || !currentSubTab)
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Sliders size={13} />
                <span>פרטים והגדרות אירוע</span>
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('settings', 'theme')}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentTab === 'settings' && (currentSubTab === 'theme' || currentSubTab === 'themes')
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Palette size={13} />
                <span>עיצוב ומראה</span>
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 2. GUESTS SECTION (WITH FILTERS AS SUB-SECTIONS)          */}
        {/* ========================================================= */}
        <div className="rounded-2xl overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => handleItemClick('guests', 'all')}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all ${
              currentTab === 'guests'
                ? 'bg-blue-50/80 text-blue-950'
                : 'text-gray-700 hover:bg-gray-100/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`p-1.5 rounded-lg ${currentTab === 'guests' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <Users size={15} />
              </span>
              <span className="text-sm">אורחים</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold bg-gray-200/80 text-gray-700 px-2 py-0.5 rounded-full">
                {guestStats.total}
              </span>
              <button
                type="button"
                onClick={e => toggleSection('guests', e)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-md"
              >
                {expandedSections.guests ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </button>

          {/* Filter Sub-sections */}
          {expandedSections.guests && (
            <div className="mr-5 pr-2.5 my-1 space-y-0.5 border-r-2 border-gray-200 animate-in fade-in duration-150">
              
              {/* All */}
              <button
                type="button"
                onClick={() => handleItemClick('guests', 'all')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'guests' && (currentSubTab === 'all' || !currentSubTab)
                    ? 'bg-blue-600 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Layers size={12} />
                  <span>כל האורחים</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'guests' && (currentSubTab === 'all' || !currentSubTab)
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {guestStats.total}
                </span>
              </button>

              {/* Coming */}
              <button
                type="button"
                onClick={() => handleItemClick('guests', 'coming')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'guests' && currentSubTab === 'coming'
                    ? 'bg-green-600 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={12} className={currentTab === 'guests' && currentSubTab === 'coming' ? 'text-white' : 'text-green-600'} />
                  <span>מגיעים</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'guests' && currentSubTab === 'coming'
                    ? 'bg-white/20 text-white'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {guestStats.coming}
                </span>
              </button>

              {/* Maybe / Pending */}
              <button
                type="button"
                onClick={() => handleItemClick('guests', 'maybe')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'guests' && currentSubTab === 'maybe'
                    ? 'bg-amber-500 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <HelpCircle size={12} className={currentTab === 'guests' && currentSubTab === 'maybe' ? 'text-white' : 'text-amber-500'} />
                  <span>טרם השיבו / אולי</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'guests' && currentSubTab === 'maybe'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {guestStats.maybe}
                </span>
              </button>

              {/* Not Coming */}
              <button
                type="button"
                onClick={() => handleItemClick('guests', 'not_coming')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'guests' && currentSubTab === 'not_coming'
                    ? 'bg-red-600 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <XCircle size={12} className={currentTab === 'guests' && currentSubTab === 'not_coming' ? 'text-white' : 'text-red-500'} />
                  <span>לא מגיעים</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'guests' && currentSubTab === 'not_coming'
                    ? 'bg-white/20 text-white'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {guestStats.notComing}
                </span>
              </button>

              {/* Paid */}
              <button
                type="button"
                onClick={() => handleItemClick('guests', 'paid')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'guests' && currentSubTab === 'paid'
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Coins size={12} className={currentTab === 'guests' && currentSubTab === 'paid' ? 'text-white' : 'text-emerald-600'} />
                  <span>שילמו</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'guests' && currentSubTab === 'paid'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {guestStats.paid}
                </span>
              </button>

              {/* Unpaid */}
              <button
                type="button"
                onClick={() => handleItemClick('guests', 'unpaid')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'guests' && currentSubTab === 'unpaid'
                    ? 'bg-slate-700 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className={currentTab === 'guests' && currentSubTab === 'unpaid' ? 'text-white' : 'text-slate-500'} />
                  <span>טרם שילמו</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'guests' && currentSubTab === 'unpaid'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {guestStats.unpaid}
                </span>
              </button>

              {/* Chefs (Has Meal) */}
              <button
                type="button"
                onClick={() => handleItemClick('guests', 'has_meal')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'guests' && currentSubTab === 'has_meal'
                    ? 'bg-purple-600 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <ChefHat size={12} className={currentTab === 'guests' && currentSubTab === 'has_meal' ? 'text-white' : 'text-purple-600'} />
                  <span>שפים (עם מנה)</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'guests' && currentSubTab === 'has_meal'
                    ? 'bg-white/20 text-white'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {guestStats.hasMeal}
                </span>
              </button>

              {/* No Meal */}
              <button
                type="button"
                onClick={() => handleItemClick('guests', 'no_meal')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'guests' && currentSubTab === 'no_meal'
                    ? 'bg-gray-700 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Utensils size={12} className={currentTab === 'guests' && currentSubTab === 'no_meal' ? 'text-white' : 'text-gray-400'} />
                  <span>ללא מנה מקושרת</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'guests' && currentSubTab === 'no_meal'
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {guestStats.noMeal}
                </span>
              </button>

            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. MEALS SECTION (WITH CATEGORIES AS SUB-SECTIONS)        */}
        {/* ========================================================= */}
        <div className="rounded-2xl overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => handleItemClick('meals', 'all')}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all ${
              currentTab === 'meals'
                ? 'bg-blue-50/80 text-blue-950'
                : 'text-gray-700 hover:bg-gray-100/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`p-1.5 rounded-lg ${currentTab === 'meals' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <UtensilsCrossed size={15} />
              </span>
              <span className="text-sm">מנות</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold bg-gray-200/80 text-gray-700 px-2 py-0.5 rounded-full">
                {mealStats.total}
              </span>
              <button
                type="button"
                onClick={e => toggleSection('meals', e)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-md"
              >
                {expandedSections.meals ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </button>

          {/* Meal Category Filter Sub-sections */}
          {expandedSections.meals && (
            <div className="mr-5 pr-2.5 my-1 space-y-0.5 border-r-2 border-gray-200 animate-in fade-in duration-150">
              
              {/* All Meals */}
              <button
                type="button"
                onClick={() => handleItemClick('meals', 'all')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'meals' && (currentSubTab === 'all' || !currentSubTab)
                    ? 'bg-blue-600 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Layers size={12} />
                  <span>כל המנות</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'meals' && (currentSubTab === 'all' || !currentSubTab)
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {mealStats.total}
                </span>
              </button>

              {/* מתאבן */}
              <button
                type="button"
                onClick={() => handleItemClick('meals', 'מתאבן')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'meals' && currentSubTab === 'מתאבן'
                    ? 'bg-amber-500 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                  <span>מתאבנים</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'meals' && currentSubTab === 'מתאבן'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {mealStats.appetizer}
                </span>
              </button>

              {/* סלט */}
              <button
                type="button"
                onClick={() => handleItemClick('meals', 'סלט')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'meals' && currentSubTab === 'סלט'
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span>סלטים</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'meals' && currentSubTab === 'סלט'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {mealStats.salad}
                </span>
              </button>

              {/* מלוח */}
              <button
                type="button"
                onClick={() => handleItemClick('meals', 'מלוח')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'meals' && currentSubTab === 'מלוח'
                    ? 'bg-blue-600 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                  <span>מלוחים (עיקריות)</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'meals' && currentSubTab === 'מלוח'
                    ? 'bg-white/20 text-white'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {mealStats.savory}
                </span>
              </button>

              {/* קינוח */}
              <button
                type="button"
                onClick={() => handleItemClick('meals', 'קינוח')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  currentTab === 'meals' && currentSubTab === 'קינוח'
                    ? 'bg-pink-500 text-white font-bold shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0"></span>
                  <span>קינוחים</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'meals' && currentSubTab === 'קינוח'
                    ? 'bg-white/20 text-white'
                    : 'bg-pink-100 text-pink-800'
                }`}>
                  {mealStats.dessert}
                </span>
              </button>

            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 4. GROCERY LIST SECTION                                   */}
        {/* ========================================================= */}
        <div className="rounded-2xl overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => handleItemClick('grocery')}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all ${
              currentTab === 'grocery'
                ? 'bg-blue-50/80 text-blue-950'
                : 'text-gray-700 hover:bg-gray-100/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`p-1.5 rounded-lg ${currentTab === 'grocery' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <ShoppingCart size={15} />
              </span>
              <span className="text-sm">רשימת קניות</span>
            </div>
          </button>
        </div>

        {/* ========================================================= */}
        {/* 5. LIVE SECTION (NO RED / GLOWING DOT - REQUIREMENT 3)    */}
        {/* ========================================================= */}
        <div className="rounded-2xl overflow-hidden transition-all pt-1">
          <button
            type="button"
            onClick={() => handleItemClick('live', currentTab === 'live' ? currentSubTab : 'results')}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all ${
              currentTab === 'live'
                ? 'bg-blue-50/80 text-blue-950'
                : 'text-gray-700 hover:bg-gray-100/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`p-1.5 rounded-lg ${currentTab === 'live' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <Radio size={15} />
              </span>
              <span className="text-sm">שידור חי</span>
            </div>

            <button
              type="button"
              onClick={e => toggleSection('live', e)}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-md"
            >
              {expandedSections.live ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </button>

          {/* Sub-sections: Links, Results, Voters (Clean Blue/Neutral styling) */}
          {expandedSections.live && (
            <div className="mr-5 pr-2.5 my-1 space-y-1 border-r-2 border-gray-200 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => handleItemClick('live', 'links')}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentTab === 'live' && currentSubTab === 'links'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Share2 size={13} />
                <span>קישורים לאירוע</span>
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('live', 'results')}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentTab === 'live' && currentSubTab === 'results'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Trophy size={13} />
                <span>תוצאות ודירוג</span>
              </button>

              <button
                type="button"
                onClick={() => handleItemClick('live', 'voters')}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentTab === 'live' && currentSubTab === 'voters'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <UserCheck size={13} />
                <span>סטטוס מצביעים</span>
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar (Requirement 5) */}
      <aside className="hidden md:flex w-64 lg:w-72 h-screen max-h-screen shrink-0 sticky top-0 z-20 overflow-hidden shadow-xs">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />
          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-right duration-200 z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
