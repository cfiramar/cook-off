import { useState, useMemo, useEffect, useRef } from 'react';
import {
  DEFAULT_KEY_ROWS,
  calculateKeyRowValues,
  parseNumericInput,
  getActiveDefaultValue,
  type KeyRowDefinition
} from '../../../utils/groceryKeyData';
import {
  Calculator,
  RotateCcw,
  Search,
  Info,
  BookmarkCheck,
  Lock
} from 'lucide-react';
import { usePopup } from '../../../components/ui/PopupProvider';

interface Props {
  groceryKeySettings?: Record<string, number>;
  defaultGroceryKeySettings?: Record<string, number>;
  onSave: (settings: Record<string, number>) => Promise<void>;
  onSetAsNewDefaults: (settings: Record<string, number>) => Promise<void>;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'מנות אורחים': { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  'מנות שלי': { bg: 'bg-[#fdf5ee]', text: 'text-[#8c3d10]', border: 'border-[#edd0be]' },
  'קינוחים שלי': { bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-200' },
  'ירקות': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  'חטיפים': { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
  'שתייה חריפה': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  'שתייה קלה': { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' }
};

export default function KeySettings({
  groceryKeySettings,
  defaultGroceryKeySettings,
  onSave,
  onSetAsNewDefaults
}: Props) {
  const { showAlert, showConfirm, showSuccess } = usePopup();

  // Local overrides state initialized from saved settings or defaults
  const [overrides, setOverrides] = useState<Record<string, number>>(() => ({
    ...(groceryKeySettings || defaultGroceryKeySettings || {})
  }));

  // Keep overrides in sync when props update (e.g. from Firestore sync)
  useEffect(() => {
    if (groceryKeySettings) {
      setOverrides(groceryKeySettings);
    } else if (defaultGroceryKeySettings) {
      setOverrides(defaultGroceryKeySettings);
    }
  }, [groceryKeySettings, defaultGroceryKeySettings]);

  // String input buffers for editing in-place without glitching decimal or fraction typing
  const [inputBuffers, setInputBuffers] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Auto-save debounce timer ref
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const triggerAutoSave = (newOverrides: Record<string, number>, delay = 750) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await onSave(newOverrides);
      } catch {
        // Handled silently
      }
    }, delay);
  };

  // Compute live values based on definitions, active overrides, and active defaults
  const computedValues = useMemo(() => {
    return calculateKeyRowValues(DEFAULT_KEY_ROWS, overrides, defaultGroceryKeySettings);
  }, [overrides, defaultGroceryKeySettings]);

  // Unique categories list (excluding constants)
  const categories = useMemo(() => {
    const list = Array.from(new Set(DEFAULT_KEY_ROWS.filter(r => !r.isConstant).map((r) => r.category)));
    return ['all', ...list];
  }, []);

  // Filtered rows for display: hide constants like cups per bottle (Requirement 6)
  const filteredRows = useMemo(() => {
    return DEFAULT_KEY_ROWS.filter((r) => {
      if (r.isConstant) return false;
      const matchCat = selectedCategory === 'all' || r.category === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        r.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.formulaExplanation && r.formulaExplanation.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchQuery;
    });
  }, [selectedCategory, searchQuery]);

  const handleInputChange = (id: string, rawVal: string) => {
    setInputBuffers((prev) => ({ ...prev, [id]: rawVal }));
    const parsed = parseNumericInput(rawVal);
    if (parsed !== null && !isNaN(parsed)) {
      const nextOverrides = { ...overrides, [id]: parsed };
      setOverrides(nextOverrides);
      triggerAutoSave(nextOverrides, 750);
    }
  };

  const handleInputBlur = async (id: string) => {
    const rawVal = inputBuffers[id];
    if (rawVal === undefined) return;
    const parsed = parseNumericInput(rawVal);
    if (parsed === null || isNaN(parsed)) {
      // Revert input buffer to currently computed value
      setInputBuffers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      showAlert(`ערך לא תקין. ניתן להזין מספר עשרוני (כגון 0.25) או שבר (כגון 1/6).`);
    } else {
      const nextOverrides = { ...overrides, [id]: parsed };
      setOverrides(nextOverrides);
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      try {
        await onSave(nextOverrides);
        showSuccess('השינוי נשמר בהצלחה');
      } catch {
        showAlert('שגיאה בשמירת הערך');
      }
    }
  };

  const handleSetAsNewDefaults = () => {
    showConfirm(
      'האם לקבוע את הערכים הנוכחיים כברירת המחדל החדשה? שים לב: פעולה זו בלתי הפיכה.',
      async () => {
        try {
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
          }
          // Build new defaults mapping with active values for all definitions
          const newDefaults: Record<string, number> = {};
          for (const r of DEFAULT_KEY_ROWS) {
            newDefaults[r.id] = computedValues[r.id] ?? getActiveDefaultValue(r, defaultGroceryKeySettings);
          }
          await onSetAsNewDefaults(newDefaults);
          setOverrides(newDefaults);
          setInputBuffers({});
          showSuccess('הערכים הנוכחיים נקבעו בהצלחה כברירת המחדל החדשה של המערכת');
        } catch {
          showAlert('שגיאה בקביעת ברירת המחדל החדשה');
        }
      },
      'קביעת ברירת מחדל חדשה'
    );
  };

  const handleResetToDefaults = () => {
    showConfirm('האם ברצונך לאפס את כל המפתחות לברירת המחדל הפעילה?', async () => {
      try {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        const targetDefaults = defaultGroceryKeySettings || {};
        setOverrides(targetDefaults);
        setInputBuffers({});
        await onSave(targetDefaults);
        showSuccess('המפתחות אופסו לברירת המחדל');
      } catch {
        showAlert('שגיאה באיפוס המפתחות');
      }
    });
  };

  const handleResetSingleRow = async (row: KeyRowDefinition) => {
    const activeDefault = getActiveDefaultValue(row, defaultGroceryKeySettings);
    const nextOverrides = { ...overrides, [row.id]: activeDefault };
    setOverrides(nextOverrides);
    setInputBuffers((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    try {
      await onSave(nextOverrides);
      showSuccess('השורה אופסה לברירת המחדל');
    } catch {
      showAlert('שגיאה באיפוס השורה');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-xs">
            <Calculator size={26} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
              מפתח כמויות
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              טבלה זו משמשת לחישוב כמויות האוכל והשתייה ברשימת הקניות לפי כמות האורחים. כל שינוי נשמר אוטומטית.
            </p>

            {/* Discrete hover tooltip for conversion rates (Requirement 6) */}
            <div className="flex items-center gap-3 mt-2">
              <div className="relative group inline-flex items-center">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50/50 border border-gray-200/80 hover:border-indigo-200 px-2.5 py-1 rounded-xl cursor-help transition-all">
                  <Info size={13} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
                  <span className="font-medium">יחסי המרה קבועים</span>
                </div>
                {/* Tooltip on hover */}
                <div className="absolute top-full right-0 mt-1.5 hidden group-hover:block z-30 w-72 p-3 bg-gray-900/95 backdrop-blur-md text-white text-xs rounded-2xl shadow-xl transition-all border border-gray-800 pointer-events-none">
                  <div className="font-bold text-gray-200 mb-1.5 border-b border-gray-700/80 pb-1">
                    יחסי המרה קבועים במערכת:
                  </div>
                  <ul className="space-y-1.5 text-gray-300">
                    <li className="flex items-center justify-between">
                      <span>בקבוק יין (750 מ"ל):</span>
                      <span className="font-bold font-mono text-indigo-300">5 כוסות</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>בקבוק אלכוהול כבד (750 מ"ל):</span>
                      <span className="font-bold font-mono text-indigo-300">16 צ'ייסרים</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>כוס שתייה קלה:</span>
                      <span className="font-bold font-mono text-indigo-300">240 מ"ל (המרה ל-1.5 ליטר)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleResetToDefaults}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 text-xs md:text-sm font-semibold transition-all shadow-xs active:scale-95"
            title="איפוס כל הערכים לברירת המחדל"
          >
            <RotateCcw size={15} className="text-gray-500" />
            <span>שחזר ברירת מחדל</span>
          </button>

          <button
            onClick={handleSetAsNewDefaults}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 text-xs md:text-sm font-bold transition-all shadow-xs active:scale-95"
            title="קבע את הערכים הנוכחיים כברירת המחדל החדשה של המערכת (פעולה בלתי הפיכה)"
          >
            <BookmarkCheck size={16} className="text-indigo-600" />
            <span>קבע כברירת מחדל חדשה</span>
          </button>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 admin-scroll">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${selectedCategory === cat
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {cat === 'all' ? 'כל הקטגוריות' : cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש פריט או קטגוריה..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-2 rounded-xl text-sm border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Key Table - w-auto so item width fits the longest text without stretching (Requirement 3) */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-auto border-collapse text-right">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200/80 text-xs font-black text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 whitespace-nowrap w-28">קטגוריה</th>
                <th className="py-3.5 px-4 whitespace-nowrap">פריט</th>
                <th className="py-3.5 px-4 whitespace-nowrap w-20 text-center">יחידה</th>
                <th className="py-3.5 px-4 whitespace-nowrap w-36 text-center">ערך מפתח פעיל</th>
                <th className="py-3.5 px-4 whitespace-nowrap w-32 text-center">הדגמה (30 איש)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredRows.map((row) => {
                const activeDefault = getActiveDefaultValue(row, defaultGroceryKeySettings);
                const activeVal = computedValues[row.id] ?? activeDefault;
                const formattedVal = Number(activeVal.toFixed(4));
                const isChanged = !row.isConstant && !row.isCalculated && Math.abs(activeVal - activeDefault) > 0.0001;

                const inputValue =
                  inputBuffers[row.id] !== undefined
                    ? inputBuffers[row.id]
                    : isChanged
                      ? String(overrides[row.id] ?? formattedVal)
                      : row.formulaDisplay || String(formattedVal);

                const sample30 = row.isParam
                  ? '-'
                  : (activeVal * 30).toFixed(1) + (row.unit ? ` ${row.unit}` : '');

                const catStyle = CATEGORY_COLORS[row.category] || {
                  bg: 'bg-gray-50',
                  text: 'text-gray-800',
                  border: 'border-gray-200'
                };

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50/70 transition-colors"
                  >
                    {/* Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                      >
                        {row.category}
                      </span>
                    </td>

                    {/* Item with friendly formula explanation - fits longest text naturally */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                          <span>{row.item}</span>
                          {row.description && (
                            <span title={row.description} className="text-gray-400 hover:text-gray-600 cursor-help">
                              <Info size={14} />
                            </span>
                          )}
                        </div>
                        {row.formulaExplanation && (
                          <span className="text-[11px] text-gray-400 font-normal mt-0.5">
                            {row.formulaExplanation}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Unit */}
                    <td className="py-3.5 px-4 text-xs text-gray-500 font-medium whitespace-nowrap text-center">
                      {row.unit || '-'}
                    </td>

                    {/* Key Value - Gray for uneditable formulas (Requirement 7) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {row.isConstant ? (
                        <div
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100/90 border border-gray-200 text-gray-700 text-sm font-mono font-bold select-none"
                          title="ערך קבוע במערכת (לא ניתן לעריכה)"
                        >
                          <Lock size={13} className="text-gray-400" />
                          <span>{row.defaultValue}</span>
                          <span className="text-[11px] text-gray-400 font-sans font-normal">(קבוע)</span>
                        </div>
                      ) : row.isCalculated ? (
                        <div
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100/90 border border-gray-200 text-gray-700 text-sm font-mono font-bold select-none"
                          title={row.formulaExplanation || "מחושב אוטומטית לפי ערכי הבסיס"}
                        >
                          <span className="text-[11px] text-gray-400 font-sans font-bold">fx</span>
                          <span>{formattedVal}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => handleInputChange(row.id, e.target.value)}
                            onBlur={() => handleInputBlur(row.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-24 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-mono font-bold transition-all text-center"
                            title="הזן מספר עשרוני או שבר (למשל: 1/6 או 0.2)"
                          />
                          {isChanged && (
                            <button
                              onClick={() => handleResetSingleRow(row)}
                              className="shrink-0 p-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 active:scale-95 transition-all shadow-xs"
                              title="שחזר לברירת המחדל"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Sample for 30 guests */}
                    <td className="py-3.5 px-4 text-xs font-semibold text-gray-600 whitespace-nowrap text-center">
                      <span className="bg-gray-100 px-2 py-1 rounded-lg">
                        {sample30}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredRows.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            לא נמצאו פריטים התואמים לחיפוש
          </div>
        )}
      </div>
    </div>
  );
}
