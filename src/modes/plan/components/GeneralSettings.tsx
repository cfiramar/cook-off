import { useState, useMemo } from 'react';
import { useGeneralSettings } from '../../../hooks/useFirebaseData';
import type { ThemeConfig, HostingHousehold, HostingMember } from '../../../hooks/useFirebaseData';
import { defaultThemes, getThemeStyles } from '../../../utils/theme';
import {
  Home, Users, Palette, Plus, Trash2, Edit2,
  RefreshCw, DollarSign, Vote, Calendar, Copy, Loader2,
  CheckCircle2, AlertCircle, Settings, AlertTriangle, X, Calculator
} from 'lucide-react';
import { usePopup } from '../../../components/ui/PopupProvider';
import KeySettings from './KeySettings';

interface Props {
  initialTab?: 'household' | 'themes' | 'key';
  onClose?: () => void;
  isModal?: boolean;
}

const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

export default function GeneralSettings({ initialTab = 'household', isModal = false, onClose }: Props) {
  const {
    generalSettings,
    loading,
    error,
    saveThemes,
    saveHostingHousehold,
    saveGroceryKeySettings,
    saveDefaultGroceryKeySettings
  } = useGeneralSettings();
  const { showAlert, showConfirm, showSuccess } = usePopup();

  const [activeTab, setActiveTab] = useState<'household' | 'themes' | 'key'>(initialTab);
  const [editingTheme, setEditingTheme] = useState<ThemeConfig | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Local state for hosting household
  const household: HostingHousehold = useMemo(() => {
    return generalSettings?.hostingHousehold || {
      id: 'hosting_household',
      name: 'מארחים',
      members: []
    };
  }, [generalSettings?.hostingHousehold]);

  // Combine themes
  const allThemes: ThemeConfig[] = useMemo(() => {
    const custom = generalSettings?.themes || [];
    const deletedIds = generalSettings?.deletedThemeIds || [];
    const merged = [...custom];
    for (const dt of defaultThemes) {
      if (!deletedIds.includes(dt.id) && !merged.some(t => t.id === dt.id)) {
        merged.push(dt);
      }
    }
    return merged;
  }, [generalSettings?.themes, generalSettings?.deletedThemeIds]);

  // --- Hosting Household Handlers ---
  const handleUpdateHouseholdName = async (name: string) => {
    try {
      setSaveStatus('saving');
      const updated: HostingHousehold = { ...household, name };
      await saveHostingHousehold(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      showAlert('שגיאה בעדכון שם הבית המארח');
    }
  };

  const handleAddMember = async () => {
    const newMember: HostingMember = {
      id: `hm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `חבר מארח ${household.members.length + 1}`,
      pin: generatePin(),
      includeInEveryEvent: true,
      canVote: true,
      shouldPayFee: false
    };

    try {
      setSaveStatus('saving');
      const updated: HostingHousehold = {
        ...household,
        members: [...household.members, newMember]
      };
      await saveHostingHousehold(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
      showSuccess(`החבר ${newMember.name} נוסף למארחים`);
    } catch {
      setSaveStatus('error');
      showAlert('שגיאה בהוספת חבר');
    }
  };

  const handleUpdateMember = async (memberId: string, updates: Partial<HostingMember>) => {
    try {
      setSaveStatus('saving');
      const updatedMembers = household.members.map(m =>
        m.id === memberId ? { ...m, ...updates } : m
      );
      const updated: HostingHousehold = {
        ...household,
        members: updatedMembers
      };
      await saveHostingHousehold(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      showAlert('שגיאה בעדכון הגדרות החבר');
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    showConfirm(`האם למחוק את ${memberName} המארחים?`, async () => {
      try {
        setSaveStatus('saving');
        const updatedMembers = household.members.filter(m => m.id !== memberId);
        const updated: HostingHousehold = {
          ...household,
          members: updatedMembers
        };
        await saveHostingHousehold(updated);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
        showSuccess(`${memberName} הוסר מהמארחים`);
      } catch {
        setSaveStatus('error');
        showAlert('שגיאה במחיקת חבר');
      }
    });
  };

  const handleDeleteHousehold = () => {
    showConfirm('האם למחוק את המארחים?', async () => {
      try {
        setSaveStatus('saving');
        await saveHostingHousehold(null);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
        showSuccess('המארחים נמחקו בהצלחה');
      } catch {
        setSaveStatus('error');
        showAlert('שגיאה במחיקת המארחים');
      }
    });
  };

  // --- Themes Handlers ---
  const handleStartNewTheme = (baseTheme?: ThemeConfig) => {
    if (baseTheme) {
      setEditingTheme({
        ...baseTheme,
        id: '',
        name: `${baseTheme.name} (עותק)`
      });
    } else {
      setEditingTheme({
        id: '',
        name: 'עיצוב חדש',
        primaryColor: '#3B82F6',
        secondaryColor: '#8B5CF6',
        backgroundColor: '#0F172A',
        surfaceColor: '#1E293B',
        textColor: '#F8FAFC',
        fontFamily: '"Assistant", "Heebo", "Rubik", "Inter", ui-sans-serif, system-ui, sans-serif',
        backgroundImageUrl: '',
        mobileBackgroundImageUrl: ''
      });
    }
  };

  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTheme) return;

    try {
      setSaveStatus('saving');
      const currentThemes = [...(generalSettings?.themes || [])];
      const isNew = !editingTheme.id;
      const themeId = isNew ? `custom_${Date.now()}` : editingTheme.id;
      const themeToSave = { ...editingTheme, id: themeId };

      const existingIndex = currentThemes.findIndex(t => t.id === themeId);
      if (existingIndex >= 0) {
        currentThemes[existingIndex] = themeToSave;
      } else {
        currentThemes.push(themeToSave);
      }

      // If user modified a default theme, ensure it's not in deletedThemeIds
      const deletedThemeIds = (generalSettings?.deletedThemeIds || []).filter(id => id !== themeId);

      await saveThemes(currentThemes, deletedThemeIds);
      setSaveStatus('saved');
      setEditingTheme(null);
      setTimeout(() => setSaveStatus('idle'), 2500);
      showSuccess(`העיצוב "${themeToSave.name}" נשמר בהצלחה`);
    } catch {
      setSaveStatus('error');
      showAlert('שגיאה בשמירת העיצוב');
    }
  };

  const handleDeleteTheme = (id: string, themeName: string) => {
    showConfirm(`האם למחוק את העיצוב "${themeName}" לצמיתות?`, async () => {
      try {
        setSaveStatus('saving');
        const isDefault = defaultThemes.some(t => t.id === id);
        let updatedCustomThemes = (generalSettings?.themes || []).filter(t => t.id !== id);
        let updatedDeletedIds = [...(generalSettings?.deletedThemeIds || [])];

        if (isDefault && !updatedDeletedIds.includes(id)) {
          updatedDeletedIds.push(id);
        }

        await saveThemes(updatedCustomThemes, updatedDeletedIds);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
        showSuccess(`העיצוב "${themeName}" נמחק`);
      } catch {
        setSaveStatus('error');
        showAlert('שגיאה במחיקת העיצוב');
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <span className="mr-3 text-lg font-semibold text-gray-700">טוען הגדרות כלליות...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 text-center">
        <AlertTriangle className="mx-auto mb-2 text-red-500" size={32} />
        <p className="font-bold text-lg">שגיאה בטעינת הגדרות כלליות</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isModal ? '' : 'max-w-6xl mx-auto w-full'}`} dir="rtl">
      {/* Header Bar */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-xs">
              <Settings size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
                הגדרות כלליות
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                ניהול הבית המארח וערכות העיצוב המשותפות לכלל האירועים
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 p-2.5 rounded-2xl border border-gray-200 transition-colors shadow-2xs"
              title="סגור"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Status Indicator, Tabs & Desktop Close Button */}
        <div className="flex items-center gap-3 flex-wrap">
          {saveStatus === 'saving' && (
            <span className="flex items-center text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
              <Loader2 size={14} className="animate-spin ml-1.5" />
              שומר שינויים...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              <CheckCircle2 size={14} className="ml-1.5" />
              נשמר בהצלחה
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
              <AlertCircle size={14} className="ml-1.5" />
              שגיאה בשמירה
            </span>
          )}

          {/* Sub Navigation Tabs */}
          <div className="bg-gray-100 p-1 rounded-2xl flex items-center gap-1">
            <button
              onClick={() => setActiveTab('household')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'household'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Home size={16} />
              <span>מארחים</span>
            </button>
            <button
              onClick={() => setActiveTab('themes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'themes'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Palette size={16} />
              <span>ערכות עיצוב</span>
            </button>
            <button
              onClick={() => setActiveTab('key')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'key'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Calculator size={16} />
              <span>מפתח כמויות</span>
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="hidden md:flex items-center justify-center text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 p-2.5 rounded-2xl border border-gray-200 transition-colors shadow-2xs"
              title="סגור"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: HOSTING HOUSEHOLD */}
      {activeTab === 'household' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Household Card */}
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Home size={28} />
                </div>
                <div>
                  <input
                    type="text"
                    defaultValue={household.name}
                    onBlur={(e) => handleUpdateHouseholdName(e.target.value)}
                    placeholder="שם הבית המארח (לדוגמה: משפחת כהן)"
                    className="text-2xl font-black text-gray-900 mt-1 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 outline-none transition-all px-1 py-0.5"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    המארחים נספרים כאורחים מגיעים, ומשתלבים אוטומטית באירועים לפי ההגדרות למטה.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddMember}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/10 flex items-center gap-2 transition-all transform active:scale-95"
                >
                  <Plus size={18} />
                  <span>הוסף חבר</span>
                </button>
                {household.members.length > 0 && (
                  <button
                    onClick={handleDeleteHousehold}
                    className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                    title="מחק מארחים"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Members List */}
            {household.members.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
                  <Users size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">עדיין אין חברים בבית המארח</h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
                  הוסיפו את הדיירים או המארחים של הבית. תוכלו לקבוע עבור כל חבר האם לכלול אותו בכל אירוע, האם הוא מורשה להצביע והאם עליו לשלם דמי כניסה.
                </p>
                <button
                  onClick={handleAddMember}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold shadow-md shadow-blue-500/20 inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  <span>הוסף חבר ראשון</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 pt-6">
                {household.members.map((member, idx) => (
                  <div
                    key={member.id}
                    className="bg-gray-50/70 hover:bg-gray-50 border border-gray-200/80 rounded-2xl p-5 transition-all shadow-2xs hover:shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    {/* Member Details */}
                    <div className="flex items-center gap-4 min-w-[240px]">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 shadow-2xs text-gray-700 font-black text-lg flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-gray-400 mb-0.5">
                          שם החבר
                        </label>
                        <input
                          type="text"
                          defaultValue={member.name}
                          onBlur={(e) => handleUpdateMember(member.id, { name: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                          placeholder="שם חבר המארח"
                        />
                      </div>

                      {/* PIN Field */}
                      <div className="w-28 shrink-0">
                        <label className="block text-[11px] font-bold text-gray-400 mb-0.5">
                          קוד PIN
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            maxLength={4}
                            defaultValue={member.pin || '1234'}
                            onBlur={(e) => handleUpdateMember(member.id, { pin: e.target.value })}
                            className="w-full bg-white border border-gray-200 rounded-xl pr-3 pl-8 py-1.5 text-center font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateMember(member.id, { pin: generatePin() })}
                            className="absolute left-1.5 top-2 text-gray-400 hover:text-blue-600 transition-colors"
                            title="הגרל קוד PIN חדש"
                          >
                            <RefreshCw size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Member 3 Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 lg:max-w-2xl">
                      {/* Toggle 1: Include in every event */}
                      <div
                        onClick={() => handleUpdateMember(member.id, { includeInEveryEvent: !member.includeInEveryEvent })}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${member.includeInEveryEvent
                          ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                          : 'bg-white border-gray-200 text-gray-500 opacity-70'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <Calendar size={14} className={member.includeInEveryEvent ? 'text-blue-600' : 'text-gray-400'} />
                            נכלל בכל אירוע
                          </span>
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold ${member.includeInEveryEvent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-transparent'
                            }`}>
                            ✓
                          </span>
                        </div>
                        <p className="text-[11px] leading-tight text-gray-600">
                          {member.includeInEveryEvent ? 'יתווסף אוטומטית לכל אירוע' : 'לא מתווסף אוטומטית'}
                        </p>
                      </div>

                      {/* Toggle 2: Can vote */}
                      <div
                        onClick={() => handleUpdateMember(member.id, { canVote: !member.canVote })}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${member.canVote
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                          : 'bg-white border-gray-200 text-gray-500'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <Vote size={14} className={member.canVote ? 'text-emerald-600' : 'text-gray-400'} />
                            מורשה להצביע
                          </span>
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold ${member.canVote ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-transparent'
                            }`}>
                            ✓
                          </span>
                        </div>
                        <p className="text-[11px] leading-tight text-gray-600">
                          {member.canVote ? 'יכול להצביע בתחרות' : 'לא נספר במצביעים'}
                        </p>
                      </div>

                      {/* Toggle 3: Entry fee exemption */}
                      {(() => {
                        const isExempt = !member.shouldPayFee;
                        return (
                          <div
                            onClick={() => handleUpdateMember(member.id, { shouldPayFee: !isExempt })}
                            className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                              isExempt
                                ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                                : 'bg-white border-gray-200 text-gray-500'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold flex items-center gap-1.5">
                                <DollarSign size={14} className={isExempt ? 'text-amber-600' : 'text-gray-400'} />
                                פטור מדמי כניסה
                              </span>
                              <span
                                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  isExempt ? 'bg-amber-500 text-white' : 'bg-gray-200 text-transparent'
                                }`}
                              >
                                ✓
                              </span>
                            </div>
                            <p className="text-[11px] leading-tight text-gray-600">
                              {isExempt ? 'פטור מתשלום (לא נדרש לשלם)' : 'נדרש לשלם דמי כניסה'}
                            </p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Delete Member Button */}
                    <div className="flex items-center justify-end shrink-0">
                      <button
                        onClick={() => handleRemoveMember(member.id, member.name)}
                        className="text-gray-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-colors"
                        title="מחק חבר"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: THEMES MANAGER */}
      {activeTab === 'themes' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div>
              <h2 className="text-xl font-black text-gray-900">ניהול ערכות נושא כלליות</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                ערכות נושא אלו זמינות לבחירה בכלל האירועים במערכת
              </p>
            </div>
            <button
              onClick={() => handleStartNewTheme()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/10 flex items-center gap-2 transition-all transform active:scale-95"
            >
              <Plus size={18} /> עיצוב חדש
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allThemes.map(theme => (
              <div
                key={theme.id}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex flex-col hover:border-blue-200 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-extrabold text-lg text-gray-900">{theme.name}</h3>
                    <span className="text-[11px] font-bold text-gray-400 uppercase font-mono">
                      {theme.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartNewTheme(theme)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                      title="שכפל עיצוב"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => setEditingTheme(theme)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                      title="ערוך עיצוב"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTheme(theme.id, theme.name)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="מחק עיצוב"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Theme Preview Card */}
                <div
                  className="h-36 rounded-2xl mb-4 overflow-hidden relative border border-gray-200/80 shadow-inner"
                  style={getThemeStyles(theme.id, allThemes)}
                >
                  <div className="absolute inset-0 bg-theme-bg opacity-90" style={{ backgroundColor: 'var(--theme-bg)' }}></div>
                  <div className="relative z-10 p-4 h-full flex flex-col justify-center items-center gap-2">
                    <div
                      className="w-full py-2 px-3 rounded-xl shadow-xs border flex items-center justify-center font-bold text-sm"
                      style={{
                        backgroundColor: 'var(--theme-surface)',
                        borderColor: 'rgba(255,255,255,0.15)',
                        color: 'var(--theme-text)',
                        fontFamily: 'var(--theme-font)'
                      }}
                    >
                      כרטיסיית תצוגה
                    </div>
                    <div
                      className="w-2/3 py-1.5 px-3 rounded-lg shadow-xs flex items-center justify-center font-bold text-xs text-white"
                      style={{ backgroundColor: 'var(--theme-primary)', fontFamily: 'var(--theme-font)' }}
                    >
                      כפתור ראשי
                    </div>
                  </div>
                </div>

                {/* Color swatches */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                  <span className="font-semibold text-[11px]">צבעים:</span>
                  <span className="w-4 h-4 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: theme.primaryColor }} title={`Primary: ${theme.primaryColor}`} />
                  <span className="w-4 h-4 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: theme.secondaryColor }} title={`Secondary: ${theme.secondaryColor}`} />
                  <span className="w-4 h-4 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: theme.backgroundColor }} title={`Background: ${theme.backgroundColor}`} />
                  <span className="w-4 h-4 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: theme.surfaceColor || '#ffffff' }} title={`Surface: ${theme.surfaceColor || '#ffffff'}`} />
                  <span className="mr-auto text-[11px] text-gray-400 truncate max-w-[120px]">
                    {theme.fontFamily?.includes('Georgia') ? 'Georgia' : theme.fontFamily?.includes('Creepster') ? 'Creepster' : 'Assistant'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Theme Edit Modal */}
      {editingTheme && (
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 cursor-pointer"
          onClick={() => setEditingTheme(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-white p-6 md:p-8 w-full max-w-4xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">
                {editingTheme.id ? `עריכת עיצוב: ${editingTheme.name}` : 'יצירת עיצוב חדש'}
              </h2>
              <button
                type="button"
                onClick={() => setEditingTheme(null)}
                className="text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 p-2 rounded-full border border-gray-200 transition-colors shadow-2xs"
                title="סגור"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Form Section */}
              <form onSubmit={handleSaveTheme} className="space-y-4 text-gray-700 flex flex-col h-full">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">שם העיצוב</label>
                  <input
                    type="text"
                    value={editingTheme.name}
                    onChange={e => setEditingTheme({ ...editingTheme, name: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-bold"
                    placeholder="לדוגמה: קיץ זוהר, פרימיום זהב"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">צבע ראשי (Primary)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={editingTheme.primaryColor}
                        onChange={e => setEditingTheme({ ...editingTheme, primaryColor: e.target.value })}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200 shadow-2xs"
                      />
                      <span className="text-xs font-mono font-bold text-gray-500 uppercase">{editingTheme.primaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">צבע משני (Secondary)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={editingTheme.secondaryColor}
                        onChange={e => setEditingTheme({ ...editingTheme, secondaryColor: e.target.value })}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200 shadow-2xs"
                      />
                      <span className="text-xs font-mono font-bold text-gray-500 uppercase">{editingTheme.secondaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">צבע רקע (Background)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={editingTheme.backgroundColor}
                        onChange={e => setEditingTheme({ ...editingTheme, backgroundColor: e.target.value })}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200 shadow-2xs"
                      />
                      <span className="text-xs font-mono font-bold text-gray-500 uppercase">{editingTheme.backgroundColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">צבע כרטיסיות (Surface)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={editingTheme.surfaceColor || '#ffffff'}
                        onChange={e => setEditingTheme({ ...editingTheme, surfaceColor: e.target.value })}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200 shadow-2xs"
                      />
                      <span className="text-xs font-mono font-bold text-gray-500 uppercase">{editingTheme.surfaceColor || '#ffffff'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">צבע טקסט (Text)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={editingTheme.textColor || '#000000'}
                        onChange={e => setEditingTheme({ ...editingTheme, textColor: e.target.value })}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200 shadow-2xs"
                      />
                      <span className="text-xs font-mono font-bold text-gray-500 uppercase">{editingTheme.textColor || '#000000'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">גופן עיקרי (Font)</label>
                    <select
                      value={editingTheme.fontFamily || '"Assistant", "Heebo", "Rubik", "Inter", ui-sans-serif, system-ui, sans-serif'}
                      onChange={e => setEditingTheme({ ...editingTheme, fontFamily: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold shadow-2xs"
                    >
                      <option value='"Assistant", "Heebo", "Rubik", "Inter", ui-sans-serif, system-ui, sans-serif'>Inter / Assistant (מודרני)</option>
                      <option value='"Creepster", "Assistant", system-ui, sans-serif'>Creepster (האלווין)</option>
                      <option value='"Georgia", serif'>Georgia (קלאסי)</option>
                      <option value='"Assistant", sans-serif'>Assistant (נקי)</option>
                      <option value='system-ui, sans-serif'>System Default</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">תמונת רקע (URL - אופציונלי למסך מלא)</label>
                  <input
                    type="url"
                    value={editingTheme.backgroundImageUrl || ''}
                    onChange={e => setEditingTheme({ ...editingTheme, backgroundImageUrl: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    placeholder="https://example.com/bg.jpg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">תמונת רקע קלה לנייד (URL - אופציונלי למצב הצבעה)</label>
                  <input
                    type="url"
                    value={editingTheme.mobileBackgroundImageUrl || ''}
                    onChange={e => setEditingTheme({ ...editingTheme, mobileBackgroundImageUrl: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    placeholder="https://example.com/bg_mobile.webp"
                  />
                </div>

                <div className="flex gap-3 mt-auto pt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-bold transition-all shadow-md shadow-blue-500/20 active:scale-98"
                  >
                    שמור עיצוב
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTheme(null)}
                    className="px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-2xl font-bold transition-all"
                  >
                    ביטול
                  </button>
                </div>
              </form>

              {/* Live Preview Section */}
              <div className="hidden lg:flex flex-col bg-gray-50 rounded-3xl p-5 border border-gray-200/80">
                <h3 className="font-extrabold text-gray-700 mb-4 text-center text-sm">תצוגה מקדימה חיה</h3>
                <div
                  className="flex-1 rounded-2xl overflow-hidden relative shadow-inner border border-gray-300 min-h-[340px]"
                  style={{
                    backgroundColor: editingTheme.backgroundColor,
                    backgroundImage: editingTheme.backgroundImageUrl ? `url(${editingTheme.backgroundImageUrl})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    color: editingTheme.textColor || '#000000',
                    fontFamily: editingTheme.fontFamily || 'inherit'
                  }}
                >
                  <div className="absolute inset-0 p-6 flex flex-col gap-4">
                    <div className="text-center">
                      <h1 className="text-2xl font-black mb-1 drop-shadow-sm">תחרות הבישול הגדולה</h1>
                      <p className="text-xs opacity-80">ברוכים הבאים לאירוע! מי יזכה בתואר השף הגדול?</p>
                    </div>

                    <div
                      className="mt-2 p-5 rounded-2xl shadow-xl backdrop-blur-md border border-white/20 flex-1 flex flex-col justify-between"
                      style={{ backgroundColor: editingTheme.surfaceColor || 'rgba(255,255,255,0.9)' }}
                    >
                      <div>
                        <h2 className="text-lg font-bold mb-2">כרטיסיית מנה או מתמודד</h2>
                        <p className="text-xs opacity-90 leading-relaxed">
                          כך תיראה התצוגה של המנות, האורחים ושאר רכיבי המערכת בעיצוב זה.
                        </p>
                      </div>
                      <div className="flex gap-2 pt-4">
                        <button
                          type="button"
                          className="flex-1 py-2.5 px-4 rounded-xl font-bold text-white shadow-md text-xs"
                          style={{ backgroundColor: editingTheme.primaryColor }}
                        >
                          כפתור ראשי
                        </button>
                        <button
                          type="button"
                          className="flex-1 py-2.5 px-4 rounded-xl font-bold border border-gray-300 text-xs"
                          style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: editingTheme.secondaryColor }}
                        >
                          כפתור משני
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: KEY SETTINGS */}
      {activeTab === 'key' && (
        <div className="animate-in fade-in duration-200">
          <KeySettings
            groceryKeySettings={generalSettings?.groceryKeySettings}
            defaultGroceryKeySettings={generalSettings?.defaultGroceryKeySettings}
            onSave={async (newSettings) => {
              setSaveStatus('saving');
              try {
                await saveGroceryKeySettings(newSettings);
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2500);
              } catch (e) {
                setSaveStatus('error');
                throw e;
              }
            }}
            onSetAsNewDefaults={async (newDefaults) => {
              setSaveStatus('saving');
              try {
                await saveDefaultGroceryKeySettings(newDefaults);
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2500);
              } catch (e) {
                setSaveStatus('error');
                throw e;
              }
            }}
            saveStatus={saveStatus}
          />
        </div>
      )}
    </div>
  );
}
