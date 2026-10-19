import { useState, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useGeneralSettings } from '../../../hooks/useFirebaseData';
import type { EventInfo, ThemeConfig } from '../../../hooks/useFirebaseData';
import { defaultThemes, getThemeStyles } from '../../../utils/theme';
import { Plus, Check, Trash2, Edit2, X } from 'lucide-react';
import { usePopup } from '../../../components/ui/PopupProvider';

interface Props {
  eventInfo: EventInfo | null;
  eventId: string;
}

export default function ThemeSettings({ eventInfo, eventId }: Props) {
  const { generalSettings } = useGeneralSettings();
  const [editingTheme, setEditingTheme] = useState<ThemeConfig | null>(null);
  const { showConfirm } = usePopup();
  
  if (!eventInfo) return null;

  // Combine global themes from General Settings and event themes
  const allThemes = useMemo(() => {
    const globalThemes = generalSettings?.themes || [];
    const eventThemes = eventInfo.themes || [];
    const deletedIds = [
      ...(eventInfo.deletedThemeIds || []),
      ...(generalSettings?.deletedThemeIds || [])
    ];

    const map = new Map<string, ThemeConfig>();
    defaultThemes.forEach(t => map.set(t.id, t));
    globalThemes.forEach(t => map.set(t.id, t));
    eventThemes.forEach(t => map.set(t.id, t));

    return Array.from(map.values()).filter(t => !deletedIds.includes(t.id));
  }, [eventInfo.themes, eventInfo.deletedThemeIds, generalSettings?.themes, generalSettings?.deletedThemeIds]);

  const handleSetActive = async (id: string) => {
    await updateDoc(doc(db, 'events', eventId), {
      activeThemeId: id
    });
  };

  const handleDelete = (id: string) => {
    showConfirm("האם אתה בטוח שברצונך למחוק עיצוב זה?", async () => {
      const updates: any = {};
      
      if (defaultThemes.some(t => t.id === id)) {
        updates.deletedThemeIds = [...(eventInfo.deletedThemeIds || []), id];
      } else {
        updates.themes = (eventInfo.themes || []).filter(t => t.id !== id);
      }
      
      await updateDoc(doc(db, 'events', eventId), updates);
    });
  };

  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTheme) return;

    let newThemes = [...(eventInfo.themes || [])];
    const existingIndex = newThemes.findIndex(t => t.id === editingTheme.id);
    
    if (existingIndex >= 0) {
      newThemes[existingIndex] = editingTheme;
    } else {
      if (editingTheme.id && defaultThemes.some(t => t.id === editingTheme.id)) {
        newThemes.push(editingTheme);
      } else {
        newThemes.push({ ...editingTheme, id: `custom_${Date.now()}` });
      }
    }

    await updateDoc(doc(db, 'events', eventId), {
      themes: newThemes,
      activeThemeId: existingIndex < 0 && !defaultThemes.some(t => t.id === editingTheme.id) ? `custom_${Date.now()}` : eventInfo.activeThemeId
    });
    
    setEditingTheme(null);
  };

  const startNewTheme = (baseTheme?: ThemeConfig) => {
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
        backgroundColor: '#FFFFFF',
        surfaceColor: '#F3F4F6',
        textColor: '#1F2937',
        fontFamily: '"Assistant", "Heebo", "Rubik", "Inter", ui-sans-serif, system-ui, sans-serif',
        backgroundImageUrl: '',
        mobileBackgroundImageUrl: ''
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">בחירת עיצוב לאירוע</h2>
          <p className="text-xs text-gray-500 mt-0.5">בחרו את ערכת העיצוב שתשמש במסכי התצוגה וההצבעה של אירוע זה</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => startNewTheme()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-2xs transition-all">
            <Plus size={18} /> עיצוב חדש
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allThemes.map(theme => {
          const isActive = eventInfo.activeThemeId === theme.id || (!eventInfo.activeThemeId && theme.id === 'halloween');
          
          return (
            <div 
              key={theme.id} 
              className={`bg-white rounded-xl shadow-sm border-2 p-5 transition-all ${isActive ? 'border-blue-600 ring-4 ring-blue-100' : 'border-gray-100 hover:border-gray-300'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-gray-800">{theme.name}</h3>
                {isActive && <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Check size={14}/> פעיל</div>}
              </div>

              {/* Theme Preview Mini */}
              <div 
                className="h-40 rounded-lg mb-4 overflow-hidden relative border border-gray-200" 
                style={getThemeStyles(theme.id, eventInfo.themes)}
              >
                <div className="absolute inset-0 bg-theme-bg opacity-90" style={{ backgroundColor: 'var(--theme-bg)' }}></div>
                <div className="relative z-10 p-4 h-full flex flex-col justify-center items-center gap-3">
                  <div 
                    className="w-full h-16 rounded-xl shadow-md border flex items-center justify-center font-bold"
                    style={{ 
                      backgroundColor: 'var(--theme-surface)', 
                      borderColor: 'rgba(255,255,255,0.1)',
                      color: 'var(--theme-text)',
                      fontFamily: 'var(--theme-font)'
                    }}
                  >
                    כותרת או כרטיסייה
                  </div>
                  <div 
                    className="w-3/4 h-8 rounded-lg shadow-sm flex items-center justify-center font-bold text-sm text-white"
                    style={{ backgroundColor: 'var(--theme-primary)', fontFamily: 'var(--theme-font)' }}
                  >
                    כפתור ראשי
                  </div>
                </div>
              </div>

                <div className="flex gap-2">
                  {!isActive && (
                    <button onClick={() => handleSetActive(theme.id)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-md font-medium text-sm transition-colors">
                      הפעל עיצוב
                    </button>
                  )}
                  <button onClick={() => setEditingTheme(theme)} className="p-2 bg-gray-50 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="ערוך עיצוב">
                    <Edit2 size={18} />
                  </button>
                  {!isActive && (
                    <button onClick={() => handleDelete(theme.id)} className="p-2 bg-gray-50 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="מחק עיצוב">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
            </div>
          );
        })}
      </div>

      {editingTheme && (
        <div 
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 cursor-pointer"
          onClick={() => setEditingTheme(null)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-white p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">{editingTheme.id ? 'עריכת עיצוב' : 'עיצוב חדש'}</h2>
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
                  <label className="block text-sm font-medium mb-1">שם העיצוב</label>
                  <input 
                    type="text" 
                    value={editingTheme.name} 
                    onChange={e => setEditingTheme({...editingTheme, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">צבע ראשי (Primary)</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={editingTheme.primaryColor} onChange={e => setEditingTheme({...editingTheme, primaryColor: e.target.value})} className="w-10 h-10 rounded cursor-pointer" />
                      <span className="text-sm text-gray-500 uppercase">{editingTheme.primaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">צבע משני (Secondary)</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={editingTheme.secondaryColor} onChange={e => setEditingTheme({...editingTheme, secondaryColor: e.target.value})} className="w-10 h-10 rounded cursor-pointer" />
                      <span className="text-sm text-gray-500 uppercase">{editingTheme.secondaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">צבע רקע (Background)</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={editingTheme.backgroundColor} onChange={e => setEditingTheme({...editingTheme, backgroundColor: e.target.value})} className="w-10 h-10 rounded cursor-pointer" />
                      <span className="text-sm text-gray-500 uppercase">{editingTheme.backgroundColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">צבע כרטיסיות (Surface)</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={editingTheme.surfaceColor || '#ffffff'} onChange={e => setEditingTheme({...editingTheme, surfaceColor: e.target.value})} className="w-10 h-10 rounded cursor-pointer" />
                      <span className="text-sm text-gray-500 uppercase">{editingTheme.surfaceColor || '#ffffff'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">צבע טקסט (Text)</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={editingTheme.textColor || '#000000'} onChange={e => setEditingTheme({...editingTheme, textColor: e.target.value})} className="w-10 h-10 rounded cursor-pointer" />
                      <span className="text-sm text-gray-500 uppercase">{editingTheme.textColor || '#000000'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">גופן עיקרי (Font)</label>
                    <select 
                      value={editingTheme.fontFamily || '"Assistant", "Heebo", "Rubik", "Inter", ui-sans-serif, system-ui, sans-serif'} 
                      onChange={e => setEditingTheme({...editingTheme, fontFamily: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
                  <label className="block text-sm font-medium mb-1">תמונת רקע (URL - אופציונלי למסך מלא)</label>
                  <input 
                    type="url" 
                    value={editingTheme.backgroundImageUrl || ''} 
                    onChange={e => setEditingTheme({...editingTheme, backgroundImageUrl: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="https://example.com/bg.jpg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">תמונת רקע קלה לנייד (URL - אופציונלי למצב הצבעה)</label>
                  <input 
                    type="url" 
                    value={editingTheme.mobileBackgroundImageUrl || ''} 
                    onChange={e => setEditingTheme({...editingTheme, mobileBackgroundImageUrl: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="https://example.com/bg_mobile.webp"
                  />
                </div>

                <div className="flex gap-3 mt-auto pt-8">
                  <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors shadow-md">
                    שמור עיצוב
                  </button>
                  {editingTheme.id && !defaultThemes.some(t => t.id === editingTheme.id) && (
                    <button type="button" onClick={() => { handleDelete(editingTheme.id); setEditingTheme(null); }} className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-3 rounded-xl font-bold transition-colors">
                      מחק
                    </button>
                  )}
                  <button type="button" onClick={() => setEditingTheme(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold transition-colors">
                    ביטול
                  </button>
                </div>
              </form>

              {/* Live Preview Section */}
              <div className="hidden lg:flex flex-col bg-gray-50 rounded-2xl p-4 border border-gray-200">
                <h3 className="font-bold text-gray-700 mb-4 text-center">תצוגה מקדימה חיה</h3>
                
                <div 
                  className="flex-1 rounded-xl overflow-hidden relative shadow-inner border border-gray-300 min-h-[300px]" 
                  style={{
                    backgroundColor: editingTheme.backgroundColor,
                    backgroundImage: editingTheme.backgroundImageUrl ? `url(${editingTheme.backgroundImageUrl})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundAttachment: 'fixed',
                    color: editingTheme.textColor || '#000000',
                    fontFamily: editingTheme.fontFamily || 'inherit'
                  }}
                >
                  <div className="absolute inset-0 p-6 flex flex-col gap-4">
                    <div className="text-center">
                      <h1 className="text-3xl font-extrabold mb-1 drop-shadow-sm">כותרת המסך</h1>
                      <p className="opacity-80">טקסט תיאור של המסך (למשל: ברוכים הבאים לאירוע)</p>
                    </div>

                    <div 
                      className="mt-4 p-5 rounded-2xl shadow-xl backdrop-blur-md border border-gray-800/10 flex-1 flex flex-col"
                      style={{ backgroundColor: editingTheme.surfaceColor || 'rgba(255,255,255,0.9)' }}
                    >
                      <h2 className="text-xl font-bold mb-3">כרטיסיית תוכן</h2>
                      <p className="opacity-90 mb-4 flex-1">
                        כך תיראה התצוגה של המנות, האורחים ושאר רכיבי המערכת בתוך העיצוב החדש שאתה יוצר.
                      </p>
                      <div className="flex gap-2">
                        <button 
                          className="flex-1 py-3 px-4 rounded-xl font-bold text-white shadow-md transition-transform transform hover:scale-105"
                          style={{ backgroundColor: editingTheme.primaryColor }}
                        >
                          כפתור ראשי
                        </button>
                        <button 
                          className="flex-1 py-3 px-4 rounded-xl font-bold transition-transform transform hover:scale-105 border border-gray-300"
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
    </div>
  );
}
