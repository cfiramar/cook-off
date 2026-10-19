import { useState, useMemo, useEffect } from 'react';
import {
  DEFAULT_KEY_ROWS,
  calculateKeyRowValues,
  calculateGroceryList,
  calculateSliderMilestones,
  type GroceryItem,
  type SliderMilestones,
  formatGroceryUnit
} from '../../../utils/groceryKeyData';
import type { Guest, GeneralSettings } from '../../../hooks/useFirebaseData';
import {
  ShoppingCart,
  CheckSquare,
  Square,
  Search,
  Copy,
  Sliders,
  CheckCircle2,
  Beer,
  UtensilsCrossed,
  Cake,
  GlassWater,
  Home,
  Carrot,
  Popcorn,
  Layers
} from 'lucide-react';
import { usePopup } from '../../../components/ui/PopupProvider';

interface Props {
  guests: Guest[];
  generalSettings?: GeneralSettings | null;
  eventId?: string;
  onOpenKeySettings?: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'מנות אורחים': <UtensilsCrossed size={16} className="text-indigo-600" />,
  'מנות שלי': <Home size={16} className="text-[#8c3d10]" />,
  'קינוחים שלי': <Cake size={16} className="text-pink-600" />,
  'ירקות': <Carrot size={16} className="text-emerald-600" />,
  'חטיפים': <Popcorn size={16} className="text-red-600" />,
  'שתייה חריפה': <Beer size={16} className="text-amber-600" />,
  'שתייה קלה': <GlassWater size={16} className="text-sky-600" />
};

const CATEGORY_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  'מנות אורחים': { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  'מנות שלי': { bg: 'bg-[#fdf5ee]', text: 'text-[#8c3d10]', border: 'border-[#edd0be]' },
  'קינוחים שלי': { bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-200' },
  'ירקות': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  'חטיפים': { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
  'שתייה חריפה': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  'שתייה קלה': { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' }
};

export default function GroceryListManager({
  guests,
  generalSettings,
  eventId,
  onOpenKeySettings
}: Props) {
  const { showSuccess } = usePopup();

  // 1. Calculate Milestones from the event's guests list
  const milestones: SliderMilestones = useMemo(() => {
    return calculateSliderMilestones(guests);
  }, [guests]);

  // 2. Active multiplier guest count N
  // Default to expectedAmount (confirmed coming guests + hosts) or 25 if empty
  const [multiplierN, setMultiplierN] = useState<number>(() => {
    if (milestones.expectedAmount > 0) return milestones.expectedAmount;
    if (milestones.totalInvited > 0) return milestones.totalInvited;
    return 25;
  });

  // Track the selected preset milestone
  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(() => {
    return milestones.expectedAmount > 0 ? 1 : null;
  });

  // Checklist of checked items (saved in localStorage by eventId)
  const storageKey = `grocery_checked_${eventId || 'default'}`;
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(checkedItems));
    } catch {
      // ignore
    }
  }, [checkedItems, storageKey]);

  // 3. Computed active key mapping (from generalSettings or default values)
  const computedKeys = useMemo(() => {
    return calculateKeyRowValues(
      DEFAULT_KEY_ROWS,
      generalSettings?.groceryKeySettings || {},
      generalSettings?.defaultGroceryKeySettings
    );
  }, [generalSettings?.groceryKeySettings, generalSettings?.defaultGroceryKeySettings]);

  // 4. Calculate full grocery items list in real-time based on multiplierN
  const groceryItems: GroceryItem[] = useMemo(() => {
    return calculateGroceryList(computedKeys, multiplierN);
  }, [computedKeys, multiplierN]);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = useMemo(() => {
    const set = new Set(groceryItems.map((i) => i.category));
    return ['all', ...Array.from(set)];
  }, [groceryItems]);

  const filteredItems = useMemo(() => {
    return groceryItems.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        item.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [groceryItems, selectedCategory, searchQuery]);

  // Preset milestone definitions for UI (simple, non-mathematical terms)
  const presets = useMemo(() => {
    return [
      {
        index: 0,
        id: 'min',
        label: 'מינימלי',
        count: milestones.minAmount,
        tooltip: 'חישוב מופחת (90% מהמאשרים הגעה)'
      },
      {
        index: 1,
        id: 'expected',
        label: 'צפוי',
        count: milestones.expectedAmount,
        tooltip: `${milestones.confirmedComingGuests} אורחים + ${milestones.confirmedComingHosts} מארחים שאישרו הגעה`
      },
      {
        index: 2,
        id: 'average',
        label: 'ממוצע',
        count: milestones.averageAmount,
        tooltip: 'ממוצע בין כמות המגיעים הוודאיים למקסימום הסביר'
      },
      {
        index: 3,
        id: 'plausible_max',
        label: 'מקסימום סביר',
        count: milestones.plausibleMax,
        tooltip: `${milestones.expectedAmount} מגיעים + ${milestones.maybes} בסטטוס "אולי"`
      },
      {
        index: 4,
        id: 'max',
        label: 'כל המוזמנים',
        count: milestones.maxAmount,
        tooltip: `כל ${milestones.totalInvited} המוזמנים שנרשמו לאירוע`
      }
    ];
  }, [milestones]);

  const handleSelectPreset = (p: typeof presets[0]) => {
    setActivePresetIndex(p.index);
    setMultiplierN(p.count);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setMultiplierN(val);

    // Check if slider value matches one of the presets closely
    const match = presets.find((p) => Math.abs(p.count - val) < 0.05);
    setActivePresetIndex(match !== undefined ? match.index : null);
  };

  const toggleCheck = (itemId: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const checkedCount = useMemo(() => {
    return groceryItems.filter((i) => checkedItems[i.id]).length;
  }, [groceryItems, checkedItems]);

  const handleCopyShoppingList = () => {
    let text = `🛒 רשימת קניות לאירוע (עבור ${multiplierN} אורחים):\n\n`;

    const groups: Record<string, GroceryItem[]> = {};
    for (const item of groceryItems) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }

    for (const [cat, items] of Object.entries(groups)) {
      text += `📌 ${cat}:\n`;
      for (const it of items) {
        const isDone = checkedItems[it.id] ? '✅' : '⬜';
        text += `${isDone} ${it.item}: ${it.recommendedPurchase} ${formatGroceryUnit(it.unit, it.recommendedPurchase)}\n`;
      }
      text += '\n';
    }

    navigator.clipboard.writeText(text.trim());
    showSuccess('רשימת הקניות הועתקה ללוח (מוכנה לשליחה בוואטסאפ)');
  };

  // Slider min and max bounds (integer minimum rounded down)
  const sliderMin = Math.floor(Math.max(1, Math.min(milestones.minAmount, milestones.expectedAmount, 5)));
  const sliderMax = Math.ceil(Math.max(milestones.maxAmount, 10, multiplierN + 5));

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 h-full overflow-hidden flex flex-col" dir="rtl">
      <div className="flex-1 overflow-y-auto admin-scroll p-3.5 sm:p-6 md:p-8 text-right relative">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-xs">
              <ShoppingCart size={26} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
                רשימת קניות
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                הכמויות מחושבות בזמן אמת לפי מפתח הכמויות ומספר האורחים שנבחר.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenKeySettings && (
              <button
                onClick={onOpenKeySettings}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 text-xs md:text-sm font-bold transition-all shadow-xs active:scale-95"
                title="מעבר לעריכת מפתח הכמויות בהגדרות כלליות"
              >
                <Sliders size={15} className="text-blue-600" />
                <span>ערוך מפתח כמויות</span>
              </button>
            )}

            <button
              onClick={handleCopyShoppingList}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold shadow-md shadow-blue-500/10 transition-all active:scale-95"
              title="העתק רשימת קניות מלאה לוואטסאפ"
            >
              <Copy size={15} />
              <span>העתק לוואטסאפ</span>
            </button>
          </div>
        </div>

        {/* Streamlined Guest Count & Slider Controls (Compact & Human-friendly) */}
        <div className="bg-gray-50/80 border border-gray-200/70 rounded-2xl p-3.5 sm:p-4 mb-6 space-y-2.5">
          {/* Row 1: Active guest count stepper + Pre-defined stops pills */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Active Guest Count (Human friendly, number shown only ONCE) */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-gray-700">חישוב עבור:</span>
              
              {/* Stepper with - / input / + */}
              <div className="inline-flex items-center bg-white border border-gray-300 rounded-xl shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = Math.max(sliderMin, multiplierN - 0.5);
                    setMultiplierN(nextVal);
                    const match = presets.find((p) => Math.abs(p.count - nextVal) < 0.05);
                    setActivePresetIndex(match !== undefined ? match.index : null);
                  }}
                  className="px-2.5 py-1 text-gray-500 hover:text-blue-600 hover:bg-gray-50 font-black text-sm transition-colors border-l border-gray-200 select-none"
                  title="הפחת 0.5"
                >
                  -
                </button>

                <input
                  type="number"
                  min={sliderMin}
                  max={1000}
                  step="0.5"
                  value={multiplierN}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') return;
                    const val = Number(raw);
                    if (!isNaN(val) && val >= 0) {
                      const rounded = Math.round(val * 2) / 2;
                      setMultiplierN(rounded);
                      const match = presets.find((p) => Math.abs(p.count - rounded) < 0.05);
                      setActivePresetIndex(match !== undefined ? match.index : null);
                    }
                  }}
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    const clamped = Math.max(sliderMin, Math.round((isNaN(val) ? sliderMin : val) * 2) / 2);
                    setMultiplierN(clamped);
                  }}
                  className="w-14 text-center text-sm font-mono font-black text-blue-600 bg-transparent focus:outline-hidden py-1"
                />

                <button
                  type="button"
                  onClick={() => {
                    const nextVal = Math.min(sliderMax, multiplierN + 0.5);
                    setMultiplierN(nextVal);
                    const match = presets.find((p) => Math.abs(p.count - nextVal) < 0.05);
                    setActivePresetIndex(match !== undefined ? match.index : null);
                  }}
                  className="px-2.5 py-1 text-gray-500 hover:text-blue-600 hover:bg-gray-50 font-black text-sm transition-colors border-r border-gray-200 select-none"
                  title="הוסף 0.5"
                >
                  +
                </button>
              </div>

              <span className="text-xs font-semibold text-gray-500">אורחים ומארחים</span>
            </div>

            {/* Pre-defined Stops (Compact, sleek pill buttons taking minimal space) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-gray-400 ml-1 hidden sm:inline">יעדים:</span>
              {presets.map((preset) => {
                const isActive = activePresetIndex === preset.index || Math.abs(multiplierN - preset.count) < 0.05;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    title={preset.tooltip}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200/90'
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.2 rounded-md ${
                        isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {preset.count}
                    </span>
                  </button>
                );
              })}
            </div>

          </div>

          {/* Row 2: Sleek Slider Track without loud bold text */}
          <div className="pt-1">
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step="0.5"
              value={multiplierN}
              onChange={handleSliderChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-hidden transition-all"
            />
            <div className="flex justify-between items-center text-[11px] font-medium text-gray-400 mt-1 px-1">
              <span>נמוך</span>
              <span>גבוה</span>
            </div>
          </div>

        </div>

      {/* Sticky Progress & Category Filter Bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md pt-1 pb-3 mb-4 border-b border-gray-100 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Requirement 2: Search Bar moved to the RIGHT side (RTL start) */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start shrink-0">
          <div className="relative w-full md:w-64">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש מצרך..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 rounded-xl text-xs sm:text-sm border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl whitespace-nowrap shadow-2xs shrink-0">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span>
              נקנו: {checkedCount}/{groceryItems.length}
            </span>
          </div>
        </div>

        {/* Requirement 3: Category Filter Icons - Icons only, reveal text on hover */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 admin-scroll">
          {categories.map((cat) => {
            const count =
              cat === 'all'
                ? groceryItems.length
                : groceryItems.filter((i) => i.category === cat).length;
            const isSelected = selectedCategory === cat;
            const label = cat === 'all' ? 'כל הקטגוריות' : cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                title={label}
                className={`group relative flex items-center px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap shadow-2xs ${
                  isSelected
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                {/* Category Icon */}
                <span className="shrink-0 flex items-center">
                  {cat === 'all' ? (
                    <Layers size={16} className={isSelected ? 'text-white' : 'text-gray-700'} />
                  ) : (
                    CATEGORY_ICONS[cat]
                  )}
                </span>

                {/* Requirement 3: Text hidden by default, expands on hover */}
                <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out group-hover:max-w-[140px] group-hover:opacity-100 group-hover:mr-1.5 text-xs font-bold">
                  {label}
                </span>

                {/* Count Pill */}
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold mr-1.5 ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grocery Items List Table */}
      <div className="rounded-2xl border border-gray-200/80 overflow-hidden mb-4">
        <div className="overflow-x-auto admin-scroll">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200/80 text-xs font-black text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">נקנה</th>
                <th className="py-3.5 px-4 w-32">קטגוריה</th>
                <th className="py-3.5 px-4 w-60 max-w-xs">פריט לרכישה</th>
                <th className="py-3.5 px-4 w-36">חישוב מדויק</th>
                <th className="py-3.5 px-4">כמות מומלצת לרכישה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredItems.map((item) => {
                const isChecked = !!checkedItems[item.id];
                const catStyle = CATEGORY_BADGES[item.category] || {
                  bg: 'bg-gray-50',
                  text: 'text-gray-800',
                  border: 'border-gray-200'
                };

                const isRoundedUp = !item.isFixed && item.recommendedPurchase > item.calculatedAmount;
                const isRoundedDown = !item.isFixed && item.recommendedPurchase < item.calculatedAmount;

                return (
                  <tr
                    key={item.id}
                    onClick={() => toggleCheck(item.id)}
                    className={`cursor-pointer transition-colors ${isChecked
                      ? 'bg-emerald-50/40 opacity-75 hover:bg-emerald-50/60'
                      : 'hover:bg-blue-50/40'
                      }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCheck(item.id);
                        }}
                        className="text-gray-400 hover:text-emerald-600 transition-colors p-1"
                      >
                        {isChecked ? (
                          <CheckSquare size={20} className="text-emerald-600" />
                        ) : (
                          <Square size={20} />
                        )}
                      </button>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                      >
                        {CATEGORY_ICONS[item.category]}
                        <span>{item.category}</span>
                      </span>
                    </td>

                    {/* Item Name */}
                    <td className="py-3.5 px-4 w-60 max-w-xs">
                      <span
                        className={`font-bold text-gray-900 ${isChecked ? 'line-through text-gray-400' : ''
                          }`}
                      >
                        {item.item}
                      </span>
                    </td>

                    {/* Calculated Amount */}
                    <td className="py-3.5 px-4 text-sm text-gray-600">
                      {item.isFixed ? (
                        <span className="text-gray-400">1 בקבוק קבוע</span>
                      ) : (
                        <span>
                          {Number(item.calculatedAmount.toFixed(2))} {formatGroceryUnit(item.unit, item.calculatedAmount)}
                        </span>
                      )}
                    </td>

                    {/* Recommended Purchase */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-bold text-sm text-gray-900 ${isChecked ? 'line-through text-gray-400' : ''}`}
                        >
                          {item.recommendedPurchase} {formatGroceryUnit(item.unit, item.recommendedPurchase)}
                        </span>

                        {isRoundedUp && !isChecked && (
                          <span
                            title={`עוגל כלפי מעלה (מ-${Number(item.calculatedAmount.toFixed(2))})`}
                            className="text-xs font-bold text-gray-400 hover:text-gray-700 cursor-help"
                          >
                            ↑
                          </span>
                        )}

                        {isRoundedDown && !isChecked && (
                          <span
                            title={`עוגל כלפי מטה (מ-${Number(item.calculatedAmount.toFixed(2))})`}
                            className="text-xs font-bold text-gray-400 hover:text-gray-700 cursor-help"
                          >
                            ↓
                          </span>
                        )}

                        {item.consumptionGuide && !isChecked && (
                          <span className="text-[11px] text-gray-500 font-normal">
                            ({item.consumptionGuide})
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            לא נמצאו מצרכים התואמים לחיפוש
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
