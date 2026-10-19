import { useState, useMemo, useRef, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import type { Guest, Meal, MealCategory } from '../../../hooks/useFirebaseData';
import {
  Trash2, Edit2, X, Plus, UtensilsCrossed, Upload, ImageIcon, Loader2,
  Home, Users, ChefHat, User, Eye, EyeOff, Filter
} from 'lucide-react';
import Fuse from 'fuse.js';
import { usePopup } from '../../../components/ui/PopupProvider';
import { isHostingChef } from '../../../utils/hostingHouseholdSync';
import { ImageOptimizerService } from '../../../utils/imageOptimizer';

interface Props {
  meals: Meal[];
  guests: Guest[];
  eventId: string;
  activeCategoryFilter?: string;
  onCategoryFilterChange?: (category: string) => void;
}

interface HouseholdChefGroup {
  id: string;
  name: string;
  members: Guest[];
}

export default function MealManager({
  meals,
  guests,
  eventId,
  activeCategoryFilter = 'all',
  onCategoryFilterChange
}: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MealCategory>('מלוח');
  const [imageUrl, setImageUrl] = useState('');
  const [lowResImageUrl, setLowResImageUrl] = useState('');
  const [selectedChefs, setSelectedChefs] = useState<string[]>([]);
  const [selectedHouseholdChefs, setSelectedHouseholdChefs] = useState<string[]>([]);
  const [isNonParticipating, setIsNonParticipating] = useState(false);

  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { showAlert, showConfirm, showSuccess } = usePopup();

  const searchRef = useRef<HTMLDivElement>(null);

  // Derive unique households from guests
  const households = useMemo<HouseholdChefGroup[]>(() => {
    const map = new Map<string, HouseholdChefGroup>();
    guests.forEach(g => {
      const hId = g.householdId || `ind_${g.id}`;
      const hName = g.householdName || g.name;
      if (!map.has(hId)) {
        map.set(hId, { id: hId, name: hName, members: [] });
      }
      map.get(hId)!.members.push(g);
    });
    return Array.from(map.values());
  }, [guests]);

  // Households not yet selected and where not all members are 'not_coming'
  const availableHouseholds = useMemo(() => {
    return households.filter(h => {
      if (selectedHouseholdChefs.includes(h.id)) return false;
      const isAllNotComing = h.members.length > 0 && h.members.every(m => m.rsvpStatus === 'not_coming');
      return !isAllNotComing;
    });
  }, [households, selectedHouseholdChefs]);

  // Households without a linked meal for quick-choose
  const quickChooseHouseholds = useMemo(() => {
    const targetMeals = editingMealId ? meals.filter(m => m.id !== editingMealId) : meals;

    return availableHouseholds.filter(hh => {
      // Exclude if all members are already selected in the current meal
      if (hh.members.length > 0 && hh.members.every(m => selectedChefs.includes(m.id))) {
        return false;
      }

      // Check if this household or any of its members is linked to an existing meal
      const hasLinkedMeal = targetMeals.some(meal => {
        const isHouseholdChef = Array.isArray(meal.householdChefIds) && meal.householdChefIds.includes(hh.id);
        const isMemberChef = Array.isArray(meal.chefIds) && hh.members.some(member => meal.chefIds.includes(member.id));
        return isHouseholdChef || isMemberChef;
      });

      return !hasLinkedMeal;
    });
  }, [availableHouseholds, meals, editingMealId, selectedChefs]);

  // Guests not covered by selected households, not selected individually, and not marked 'not_coming'
  const availableGuests = useMemo(() => {
    return guests.filter(g => {
      const hId = g.householdId || `ind_${g.id}`;
      if (selectedHouseholdChefs.includes(hId)) return false;
      if (selectedChefs.includes(g.id)) return false;
      if (g.rsvpStatus === 'not_coming') return false;
      return true;
    });
  }, [guests, selectedHouseholdChefs, selectedChefs]);

  // Individual chefs selected (not covered by an active household chef tag)
  const individualSelectedChefs = useMemo(() => {
    return selectedChefs.filter(cId => {
      const guest = guests.find(g => g.id === cId);
      if (!guest) return true;
      const hId = guest.householdId || `ind_${guest.id}`;
      return !selectedHouseholdChefs.includes(hId);
    });
  }, [selectedChefs, selectedHouseholdChefs, guests]);

  const hasHostingChef = useMemo(() => {
    return selectedChefs.some(cId => isHostingChef(cId, guests)) ||
      selectedHouseholdChefs.some(hId => isHostingChef(hId, guests));
  }, [selectedChefs, selectedHouseholdChefs, guests]);

  // Fuse search instances
  const householdFuse = useMemo(() => new Fuse(availableHouseholds, {
    keys: ['name', 'members.name'],
    threshold: 0.35
  }), [availableHouseholds]);

  const guestFuse = useMemo(() => new Fuse(availableGuests, {
    keys: ['name', 'householdName', 'pin'],
    threshold: 0.35
  }), [availableGuests]);

  const matchedHouseholds = useMemo(() => {
    if (!searchQuery.trim()) return availableHouseholds;
    return householdFuse.search(searchQuery.trim()).map(r => r.item);
  }, [searchQuery, availableHouseholds, householdFuse]);

  const matchedGuests = useMemo(() => {
    if (!searchQuery.trim()) return availableGuests;
    return guestFuse.search(searchQuery.trim()).map(r => r.item);
  }, [searchQuery, availableGuests, guestFuse]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await uploadImage(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadImage(file);
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showAlert('יש להעלות קובץ תמונה בלבד.');
      return;
    }

    setIsUploading(true);
    try {
      const apiKey = import.meta.env.VITE_IMGBB_API_KEY;

      // 1. Generate lightweight mobile copy (800px max width, 80% quality WebP)
      const lowResFile = await ImageOptimizerService.createLightweightCopy(file, {
        maxWidth: 800,
        quality: 0.8,
        format: 'image/webp'
      });

      // 2. Upload high-res original for TV / ViewMode
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!data.success) {
        showAlert('שגיאה בהעלאת התמונה לשרת.');
        return;
      }

      const highResUrl = data.data.url;
      setImageUrl(highResUrl);

      // 3. Upload lightweight mobile copy for VotingMode
      try {
        const lowResFormData = new FormData();
        lowResFormData.append('image', lowResFile);

        const lowResResponse = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: 'POST',
          body: lowResFormData,
        });
        const lowResData = await lowResResponse.json();

        if (lowResData.success) {
          setLowResImageUrl(lowResData.data.url);
        } else {
          setLowResImageUrl(highResUrl);
        }
      } catch (err) {
        console.warn('Lightweight image upload fallback to high-res:', err);
        setLowResImageUrl(highResUrl);
      }
    } catch (error) {
      console.error('Upload error:', error);
      showAlert('שגיאה בהעלאת התמונה.');
    } finally {
      setIsUploading(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Add an entire household as chefs
  const handleAddHouseholdChef = (householdId: string) => {
    const hh = households.find(h => h.id === householdId);
    if (!hh) return;
    if (isHostingChef(householdId, guests) || hh.members.some(m => isHostingChef(m.id, guests))) {
      setIsNonParticipating(true);
    }
    setSelectedHouseholdChefs(prev => Array.from(new Set([...prev, householdId])));
    const memberIds = hh.members.map(m => m.id);
    setSelectedChefs(prev => Array.from(new Set([...prev, ...memberIds])));
    setSearchQuery('');
    setShowSuggestions(false);
  };

  // Remove household as chefs
  const handleRemoveHouseholdChef = (householdId: string) => {
    setSelectedHouseholdChefs(prev => prev.filter(id => id !== householdId));
    const hh = households.find(h => h.id === householdId);
    if (hh) {
      const memberIds = new Set(hh.members.map(m => m.id));
      setSelectedChefs(prev => prev.filter(id => !memberIds.has(id)));
    }
  };

  // Add individual chef
  const handleAddChef = (guestId: string) => {
    if (isHostingChef(guestId, guests)) {
      setIsNonParticipating(true);
    }
    setSelectedChefs(prev => Array.from(new Set([...prev, guestId])));
    setSearchQuery('');
    setShowSuggestions(false);
  };

  // Remove individual chef
  const handleRemoveChef = (guestId: string) => {
    setSelectedChefs(prev => prev.filter(id => id !== guestId));
    const guest = guests.find(g => g.id === guestId);
    const hId = guest?.householdId || `ind_${guest?.id}`;
    if (selectedHouseholdChefs.includes(hId)) {
      setSelectedHouseholdChefs(prev => prev.filter(id => id !== hId));
    }
  };

  const handleCreateNewGuest = async () => {
    if (!searchQuery.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'events', eventId, 'guests'), {
        name: searchQuery.trim(),
        status: 'not_logged_in'
      });
      handleAddChef(docRef.id);
    } catch (error) {
      console.error("Error creating new guest: ", error);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('מלוח');
    setImageUrl('');
    setLowResImageUrl('');
    setSelectedChefs([]);
    setSelectedHouseholdChefs([]);
    setIsNonParticipating(false);
    setEditingMealId(null);
    setIsModalOpen(false);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleSaveMeal = async () => {
    if (!name.trim()) {
      showAlert('יש להזין שם מנה.');
      return;
    }

    // Ensure all members of selectedHouseholdChefs are in chefIds
    const householdMemberIds = selectedHouseholdChefs.flatMap(hId => {
      const hh = households.find(h => h.id === hId);
      return hh ? hh.members.map(m => m.id) : [];
    });
    const allChefIds = Array.from(new Set([...selectedChefs, ...householdMemberIds]));

    if (allChefIds.length === 0) {
      showAlert('יש לבחור שף.');
      return;
    }

    const fallbackUrl = 'https://via.placeholder.com/300x200.png?text=No+Image';
    const finalImageUrl = imageUrl.trim() || fallbackUrl;
    const finalLowResUrl = lowResImageUrl.trim() || finalImageUrl;

    const mealData = {
      name: name.trim(),
      description: description.trim(),
      category: category || 'מלוח',
      imageUrl: finalImageUrl,
      lowResImageUrl: finalLowResUrl,
      chefIds: allChefIds,
      householdChefIds: selectedHouseholdChefs,
      isNonParticipating
    };

    try {
      if (editingMealId) {
        await updateDoc(doc(db, 'events', eventId, 'meals', editingMealId), mealData);
        showSuccess(`המנה "${name.trim()}" עודכנה בהצלחה`);
      } else {
        await addDoc(collection(db, 'events', eventId, 'meals'), mealData);
        showSuccess(`המנה "${name.trim()}" נוספה בהצלחה`);
      }
      resetForm();
    } catch (error) {
      console.error("Error saving meal: ", error);
      showAlert("שגיאה בשמירת המנה");
    }
  };

  const handleEditMeal = (meal: Meal) => {
    setName(meal.name);
    setDescription(meal.description);
    setCategory(meal.category || 'מלוח');
    setImageUrl(meal.imageUrl);
    setLowResImageUrl(meal.lowResImageUrl || meal.imageUrl);
    setSelectedHouseholdChefs(meal.householdChefIds || []);
    setIsNonParticipating(!!meal.isNonParticipating);
    // Include current members of selected households
    const householdMemberIds = (meal.householdChefIds || []).flatMap(hId => {
      const hh = households.find(h => h.id === hId);
      return hh ? hh.members.map(m => m.id) : [];
    });
    setSelectedChefs(Array.from(new Set([...(meal.chefIds || []), ...householdMemberIds])));
    setEditingMealId(meal.id);
    setIsModalOpen(true);
  };

  const handleToggleNonParticipating = async (meal: Meal) => {
    try {
      const nextState = !meal.isNonParticipating;
      await updateDoc(doc(db, 'events', eventId, 'meals', meal.id), {
        isNonParticipating: nextState
      });
      showSuccess(nextState ? `המנה "${meal.name}" הוגדרה כמחוץ לתחרות` : `המנה "${meal.name}" הוחזרה לתחרות`);
    } catch (error) {
      console.error("Error toggling meal participation: ", error);
      showAlert("שגיאה בעדכון הגדרת התחרות למנה");
    }
  };

  const handleDeleteMeal = (id: string) => {
    showConfirm('האם למחוק מנה זו?', async () => {
      try {
        await deleteDoc(doc(db, 'events', eventId, 'meals', id));
        if (editingMealId === id) resetForm();
      } catch (error) {
        console.error("Error deleting meal: ", error);
      }
    });
  };

  const participatingCount = meals.filter(m => !m.isNonParticipating).length;
  const nonParticipatingCount = meals.filter(m => m.isNonParticipating).length;

  const filteredMeals = useMemo(() => {
    if (!activeCategoryFilter || activeCategoryFilter === 'all') {
      return meals;
    }
    return meals.filter(m => (m.category || 'מלוח') === activeCategoryFilter);
  }, [meals, activeCategoryFilter]);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 h-full overflow-hidden flex flex-col" dir="rtl">
      <div className="flex-1 overflow-y-auto admin-scroll p-4 sm:p-6 md:p-8 flex flex-col relative text-right min-h-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <UtensilsCrossed className="text-blue-600" />
              ניהול מנות
            </h2>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="bg-gray-100 text-gray-700 font-bold px-2.5 py-1 rounded-lg">
                {meals.length} מנות
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-2 py-1 rounded-lg">
                {participatingCount} בתחרות
              </span>
              {nonParticipatingCount > 0 && (
                <span className="bg-amber-50 text-amber-800 border border-amber-200 font-semibold px-2 py-1 rounded-lg flex items-center gap-1">
                  <Eye size={12} />
                  {nonParticipatingCount} מחוץ לתחרות
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            הגדרת מנות, קטגוריות (מתאבן, סלט, מלוח, קינוח), תמונות ושיוך שפים
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/10 transition-all flex items-center gap-2 text-sm"
        >
          <Plus size={18} />
          <span>הוסף מנה</span>
        </button>
      </div>

      {/* Active Category Filter Chip Banner */}
      {activeCategoryFilter && activeCategoryFilter !== 'all' && (
        <div className="flex items-center justify-between bg-blue-50/90 border border-blue-200 text-blue-900 px-4 py-2.5 rounded-2xl text-xs font-bold mb-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-blue-600" />
            <span>סינון קטגוריה פעיל: <span className="font-extrabold underline">{activeCategoryFilter}</span> ({filteredMeals.length} מנות)</span>
          </div>
          {onCategoryFilterChange && (
            <button
              onClick={() => onCategoryFilterChange('all')}
              className="text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 font-bold shadow-2xs"
            >
              <X size={13} />
              <span>הצג את כל המנות</span>
            </button>
          )}
        </div>
      )}

      {/* Uncompressed, Generous Grid with Comfortable Scrolling */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-6">
        {filteredMeals.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-500 bg-gray-50/60 rounded-2xl border border-dashed border-gray-300">
            <UtensilsCrossed size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="font-bold text-gray-700">
              {activeCategoryFilter && activeCategoryFilter !== 'all'
                ? `לא נמצאו מנות בקטגוריה "${activeCategoryFilter}".`
                : 'אין עדיין מנות לאירוע.'}
            </p>
            <p className="text-xs text-gray-400 mt-1 mb-4">לחץ על "הוסף מנה" כדי להוסיף מנה חדשה.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-all"
            >
              + הוסף מנה ראשונה
            </button>
          </div>
        ) : (
          filteredMeals.map(meal => (
            <div
              key={meal.id}
              className="relative rounded-2xl border border-gray-200/90 group bg-white shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col overflow-hidden"
            >
              {/* Image Section */}
              <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-gray-100">
                <img
                  src={meal.imageUrl}
                  alt={meal.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Category & Status badges */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                  <span className={`font-bold text-xs px-2.5 py-1 rounded-xl shadow-sm border ${
                    (meal.category || 'מלוח') === 'מתאבן'
                      ? 'bg-amber-500 text-white border-amber-400'
                      : (meal.category || 'מלוח') === 'סלט'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : (meal.category || 'מלוח') === 'קינוח'
                      ? 'bg-pink-500 text-white border-pink-400'
                      : 'bg-blue-600 text-white border-blue-500'
                  }`}>
                    {meal.category || 'מלוח'}
                  </span>
                  {meal.isNonParticipating && (
                    <div className="bg-amber-500 text-black font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-sm flex items-center gap-1">
                      <Eye size={12} />
                      <span>מחוץ לתחרות</span>
                    </div>
                  )}
                </div>

                {/* Action buttons (overlayed top left on image with clean glassmorphism) */}
                <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                  <button
                    type="button"
                    onClick={() => handleToggleNonParticipating(meal)}
                    className={`p-2 rounded-xl backdrop-blur-md shadow-sm transition-all ${
                      meal.isNonParticipating
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-white/90 text-gray-700 hover:bg-white hover:text-gray-900'
                    }`}
                    title={meal.isNonParticipating ? 'החזר מנה זו לתחרות' : 'הגדר מנה זו לתצוגה בלבד (מחוץ לתחרות)'}
                  >
                    {meal.isNonParticipating ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button
                    onClick={() => handleEditMeal(meal)}
                    className="bg-white/90 hover:bg-white text-gray-700 hover:text-blue-600 backdrop-blur-md p-2 rounded-xl shadow-sm transition-all"
                    title="ערוך מנה"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteMeal(meal.id)}
                    className="bg-white/90 hover:bg-red-50 text-gray-700 hover:text-red-600 backdrop-blur-md p-2 rounded-xl shadow-sm transition-all"
                    title="מחק מנה"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Card Body - Generous spacing, readable text */}
              <div className="p-4 sm:p-5 flex flex-col justify-between flex-1 space-y-3">
                <div>
                  <h3 className="font-black text-lg text-gray-900 leading-snug">
                    {meal.name}
                  </h3>
                  {meal.description ? (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                      {meal.description}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 italic mt-1">אין תיאור למנה</p>
                  )}
                </div>

                {/* Chef Information Section */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 mb-2">
                    <ChefHat size={14} className="text-blue-600" />
                    <span>שפים:</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Household chef badges */}
                    {meal.householdChefIds && meal.householdChefIds.length > 0 && (
                      meal.householdChefIds.map(hId => {
                        const hh = households.find(h => h.id === hId);
                        if (!hh) return null;
                        return (
                          <span
                            key={hId}
                            className="bg-blue-50 border border-blue-200 text-blue-900 px-2.5 py-1 rounded-lg flex items-center gap-1 font-bold text-xs shadow-2xs"
                          >
                            <Home size={12} className="text-blue-600" />
                            <span>{hh.name} ({hh.members.length})</span>
                          </span>
                        );
                      })
                    )}

                    {/* Individual chefs not in the selected households */}
                    {(() => {
                      const standaloneNames = (meal.chefIds || [])
                        .filter(cId => {
                          const g = guests.find(guest => guest.id === cId);
                          const hId = g?.householdId || `ind_${g?.id}`;
                          return !(meal.householdChefIds || []).includes(hId);
                        })
                        .map(cId => guests.find(g => g.id === cId)?.name)
                        .filter(Boolean);

                      if (standaloneNames.length === 0 && (!meal.householdChefIds || meal.householdChefIds.length === 0)) {
                        return <span className="text-gray-400 italic text-xs">טרם הוגדרו שפים</span>;
                      }
                      return standaloneNames.map((cName, idx) => (
                        <span
                          key={idx}
                          className="bg-gray-100 border border-gray-200 text-gray-800 px-2 py-0.5 rounded-lg text-xs font-semibold"
                        >
                          {cName}
                        </span>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={resetForm}></div>
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto admin-scroll p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-black text-gray-800">
                  {editingMealId ? 'עריכת מנה' : 'הוספת מנה חדשה'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">הזן פרטי מנה, תמונה ובחר שפים</p>
              </div>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-800 transition-colors p-2 hover:bg-gray-100 rounded-full">
                <X size={22} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-700 mb-2 font-semibold">שם המנה</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm text-right" placeholder="למשל: עוגת גבינה עם פירורים" />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2 font-semibold">קטגוריית מנה</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['מתאבן', 'סלט', 'מלוח', 'קינוח'] as MealCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                        category === cat
                          ? cat === 'מתאבן'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : cat === 'סלט'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : cat === 'מלוח'
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-pink-500 text-white border-pink-600 shadow-xs'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2 font-semibold">תיאור המנה</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm text-right" rows={3} placeholder="תיאור קצר של המנה והמרכיבים..."></textarea>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2 font-semibold">תמונה</label>
                <div
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'} ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="לחץ או גרור תמונה לכאן"
                  />

                  <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                    {isUploading ? (
                      <>
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="text-sm text-gray-600 font-medium">מעלה תמונות (מקורית + מותאמת לנייד)...</p>
                      </>
                    ) : imageUrl && imageUrl !== 'https://via.placeholder.com/300x200.png?text=No+Image' ? (
                      <>
                        <img src={imageUrl} alt="Preview" className="h-32 object-contain rounded-lg shadow-sm" />
                        {lowResImageUrl && lowResImageUrl !== imageUrl && (
                          <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            נוצרה גרסה קלה לנייד ✓
                          </span>
                        )}
                        <p className="text-xs text-gray-500 mt-1">לחץ או גרור תמונה חדשה להחלפה</p>
                      </>
                    ) : (
                      <>
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-full mb-2">
                          <Upload className="w-6 h-6" />
                        </div>
                        <p className="text-sm text-gray-700 font-medium">לחץ או גרור תמונה לכאן</p>
                        <p className="text-xs text-gray-500">תומך ב- JPG, PNG, WEBP (מייצר עותק קל לנייד אוטומטית)</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center">
                  <div className="flex-1 border-t border-gray-200"></div>
                  <span className="px-3 text-xs text-gray-400 uppercase">או</span>
                  <div className="flex-1 border-t border-gray-200"></div>
                </div>

                <div className="mt-3 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ImageIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setLowResImageUrl(e.target.value);
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm text-left"
                    dir="ltr"
                    placeholder="הדבק קישור לתמונה (URL)..."
                  />
                </div>
              </div>

              {/* Chef Selection: Support Household as Chefs + Individual Chefs */}
              <div ref={searchRef}>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm text-gray-800 font-bold flex items-center gap-1.5">
                    <ChefHat size={16} className="text-blue-600" />
                    בחירת שפים למנה
                  </label>
                  <span className="text-[11px] text-gray-400 font-medium">
                    ניתן לבחור משק בית שלם או שפים בודדים
                  </span>
                </div>

                {/* Selected Household Chefs Chips */}
                {selectedHouseholdChefs.length > 0 && (
                  <div className="mb-2.5">
                    <span className="text-[11px] font-bold text-blue-900 mb-1 block">
                      משקי בית כשפים (כל הנפשות במשק הבית שפים):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedHouseholdChefs.map(hId => {
                        const hh = households.find(h => h.id === hId);
                        const hName = hh?.name || 'משק בית';
                        const memberNames = (hh?.members || []).map(m => m.name).join(', ');
                        return (
                          <div key={hId} className="flex items-center gap-2 bg-blue-50 border border-blue-300 text-blue-900 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs">
                            <Home size={14} className="text-blue-600 flex-shrink-0" />
                            <div className="flex flex-col text-right">
                              <span className="font-extrabold">{hName} ({hh?.members.length || 0} נפשות)</span>
                              {memberNames && <span className="text-[10px] text-blue-700 font-normal">{memberNames}</span>}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveHouseholdChef(hId)}
                              className="mr-1 p-1 text-blue-400 hover:text-blue-800 rounded-lg hover:bg-blue-100 transition-colors"
                              title={`הסר את ${hName} מרשימת השפים`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Individual Selected Chefs Chips */}
                {individualSelectedChefs.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[11px] font-bold text-gray-500 mb-1 block">
                      שפים בודדים נוספים:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {individualSelectedChefs.map(id => {
                        const guest = guests.find(g => g.id === id);
                        const guestName = guest?.name || 'אורח לא ידוע';
                        return (
                          <div key={id} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs">
                            <User size={13} className="text-indigo-500" />
                            <span>{guestName}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveChef(id)}
                              className="mr-1 text-indigo-400 hover:text-indigo-800 transition-colors p-0.5 rounded hover:bg-indigo-100"
                              title="הסר שף זה"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Autocomplete Input */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="חפש משק בית או שף מהרשימה..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm text-right"
                  />

                  {showSuggestions && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-gray-100 animate-in fade-in">

                      {/* Section 1: Households */}
                      {matchedHouseholds.length > 0 && (
                        <div className="p-2">
                          <div className="text-[11px] font-bold text-blue-700 px-2.5 py-1 flex items-center gap-1 bg-blue-50/60 rounded-lg mb-1">
                            <Home size={12} />
                            <span>משקי בית שלמים (הוספת כל חברי משק הבית בבת אחת):</span>
                          </div>
                          {matchedHouseholds.map(hh => (
                            <div
                              key={hh.id}
                              onClick={() => handleAddHouseholdChef(hh.id)}
                              className="p-2.5 hover:bg-blue-50/70 rounded-xl cursor-pointer text-xs transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px]">
                                  <Home size={13} />
                                </div>
                                <div>
                                  <span className="font-bold text-gray-900 block">{hh.name}</span>
                                  <span className="text-[11px] text-gray-500">
                                    {hh.members.length} נפשות: {hh.members.map(m => m.name).join(', ')}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-md">
                                + הוסף משק בית
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Section 2: Individual Guests */}
                      {matchedGuests.length > 0 && (
                        <div className="p-2">
                          <div className="text-[11px] font-bold text-gray-500 px-2.5 py-1 flex items-center gap-1">
                            <Users size={12} />
                            <span>שפים בודדים:</span>
                          </div>
                          {matchedGuests.map(guest => (
                            <div
                              key={guest.id}
                              onClick={() => handleAddChef(guest.id)}
                              className="p-2.5 hover:bg-gray-50 rounded-xl cursor-pointer text-xs text-gray-800 transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-[11px]">
                                  {guest.name.charAt(0) || 'א'}
                                </div>
                                <div>
                                  <span className="font-bold text-gray-900">{guest.name}</span>
                                  {guest.householdName && (
                                    <span className="text-[11px] text-gray-400 mr-1.5">
                                      (במשק בית: {guest.householdName})
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] bg-gray-100 text-gray-700 hover:bg-indigo-100 hover:text-indigo-800 font-bold px-2 py-0.5 rounded-md">
                                + הוסף שף
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {searchQuery.trim() && !guests.some(g => g.name.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                        <div
                          onClick={handleCreateNewGuest}
                          className="p-3 hover:bg-emerald-50 cursor-pointer text-xs text-emerald-700 flex items-center font-bold transition-colors"
                        >
                          <Plus size={15} className="ml-1.5" />
                          הוסף אורח ושף חדש: "{searchQuery}"
                        </div>
                      )}

                      {matchedHouseholds.length === 0 && matchedGuests.length === 0 && !searchQuery.trim() && (
                        <div className="p-4 text-gray-500 text-xs text-center">
                          אין משקי בית או אורחים נוספים לבחירה.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Add Household Buttons */}
                {quickChooseHouseholds.length > 0 && (
                  <div className="mt-3 bg-gray-50 border border-gray-200/80 rounded-2xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-gray-600 block">
                        בחירה מהירה - הוסף משק בית שלם כצוות שפים:
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        (משקי בית ללא מנה משויכת)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto admin-scroll">
                      {quickChooseHouseholds.map(hh => (
                        <button
                          key={hh.id}
                          type="button"
                          onClick={() => handleAddHouseholdChef(hh.id)}
                          className="bg-white hover:bg-blue-50 hover:border-blue-300 text-blue-800 border border-gray-200 text-xs font-bold px-2.5 py-1 rounded-xl transition-colors flex items-center gap-1 shadow-2xs"
                          title={`הוסף את כל בני ${hh.name} (${hh.members.length} נפשות) כשפים`}
                        >
                          <Home size={12} className="text-blue-600" />
                          <span>+ {hh.name} ({hh.members.length})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Non-Participating toggle */}
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500 text-black shrink-0 mt-0.5 shadow-xs">
                    <Eye size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">הגדר כמנה מחוץ לתחרות (ללא הצבעה)</div>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                      המנה תוצג לאורחים ברשימת המנות ובמסך התצוגה המסתובב בטלוויזיה, אך אורחים לא יוכלו להצביע עבורה והיא לא תיכלל בדירוג המנצחים.
                    </p>
                    {hasHostingChef && (
                      <p className="text-[11px] font-bold text-amber-800 mt-1.5 bg-amber-100/70 px-2.5 py-1 rounded-lg inline-block">
                        💡 הוגדרה אוטומטית כמנה מחוץ לתחרות כיוון שאחד השפים מארח (ניתן לבטל סימון זה).
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNonParticipating(!isNonParticipating)}
                  dir="ltr"
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none shrink-0 cursor-pointer ${isNonParticipating ? 'bg-amber-500' : 'bg-gray-300'
                    }`}
                  role="switch"
                  aria-checked={isNonParticipating}
                  title={isNonParticipating ? 'החזר מנה לתחרות' : 'הגדר כמנה מחוץ לתחרות'}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${isNonParticipating ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              <div className="pt-4 border-t border-gray-100 mt-6 flex justify-end gap-3">
                <button onClick={resetForm} className="px-6 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                  ביטול
                </button>
                <button onClick={handleSaveMeal} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-md transition-all flex items-center justify-center min-w-[120px]">
                  {editingMealId ? 'שמור שינויים' : 'הוסף מנה'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
