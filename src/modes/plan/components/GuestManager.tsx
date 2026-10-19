import { useState, useMemo } from 'react';
import { collection, addDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';
import type { Guest, Meal, EventInfo } from '../../../hooks/useFirebaseData';
import {
  Users, Trash2, Edit2, Check, X, HelpCircle, CheckCircle2, XCircle,
  Search, ArrowUpDown, Plus, DollarSign, Home, UserPlus,
  ChefHat, Coins, Tag, UserCheck, ChevronDown, ChevronUp,
  ArrowUp, ArrowDown, FileText, AlertTriangle, Rows3, StretchHorizontal,
  Filter
} from 'lucide-react';
import Fuse from 'fuse.js';
import { usePopup } from '../../../components/ui/PopupProvider';
import GuestCardModal from './GuestCardModal';
import HouseholdModal from './HouseholdModal';
import HouseholdCardModal from './HouseholdCardModal';
import SingleGuestModal from './SingleGuestModal';
import { syncMemberToHouseholdMeals } from '../../../utils/mealChefSync';
import { getNonComingHouseholdIds, buildHouseholdSections } from '../../../utils/guestSortingGrouping';

interface Props {
  guests: Guest[];
  eventId: string;
  meals?: Meal[];
  eventInfo?: EventInfo | null;
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
}

interface HouseholdGroup {
  id: string;
  name: string;
  members: Guest[];
  allNotComing: boolean;
  hasComing: boolean;
  paidCount: number;
  comingCount: number;
  comingPaidCount: number;
  hasPaidNotComingAlert: boolean;
  labels: string[];
  notes?: string;
}

export default function GuestManager({
  guests,
  eventId,
  meals = [],
  eventInfo = null,
  activeFilter = 'all',
  onFilterChange
}: Props) {
  const { showConfirm, showAlert, showSuccess } = usePopup();

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterArrival, setFilterArrival] = useState<'all' | 'exclude_not_coming'>('all');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterMeal, setFilterMeal] = useState<'all' | 'no_meal' | 'has_meal'>('all');
  const [filterLabel, setFilterLabel] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'arrival' | 'paid'>('name');

  // Filters dropdown visibility toggle
  const [showFilters, setShowFilters] = useState(false);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterArrival !== 'all') count++;
    if (filterPaid !== 'all') count++;
    if (filterMeal !== 'all') count++;
    if (filterLabel !== 'all') count++;
    return count;
  }, [filterArrival, filterPaid, filterMeal, filterLabel]);

  // Density state: comfortable vs compact (always households view)
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  // Modals state
  const [isAddHouseholdOpen, setIsAddHouseholdOpen] = useState(false);
  const [isAddSingleModalOpen, setIsAddSingleModalOpen] = useState(false);
  const [selectedGuestForModal, setSelectedGuestForModal] = useState<Guest | null>(null);
  const [selectedHouseholdForCardId, setSelectedHouseholdForCardId] = useState<string | null>(null);

  // Member to Household inline addition / move state (Unified with Fuzzy Search)
  const [addingMemberToHouseholdId, setAddingMemberToHouseholdId] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPin, setNewMemberPin] = useState('');
  const [candidateMatches, setCandidateMatches] = useState<Guest[]>([]);

  // Household Rename state
  const [editingHouseholdId, setEditingHouseholdId] = useState<string | null>(null);
  const [editHouseholdName, setEditHouseholdName] = useState('');

  // Quick Household Labels editing state (Instant inline typing / chip clicking)
  const [quickTagHouseholdId, setQuickTagHouseholdId] = useState<string | null>(null);
  const [quickTagInput, setQuickTagInput] = useState('');

  // Collapse / Expand Households state
  const [collapsedHouseholdIds, setCollapsedHouseholdIds] = useState<Set<string>>(new Set());

  const toggleHouseholdCollapse = (householdId: string) => {
    setCollapsedHouseholdIds(prev => {
      const next = new Set(prev);
      if (next.has(householdId)) {
        next.delete(householdId);
      } else {
        next.add(householdId);
      }
      return next;
    });
  };

  // Collect all unique labels across all guests
  const allUniqueLabels = useMemo(() => {
    const set = new Set<string>();
    guests.forEach(g => {
      (g.labels || []).forEach(l => {
        if (l && l.trim()) set.add(l.trim());
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'));
  }, [guests]);

  // Pre-calculate chef/meal mapping (accounting for direct chefIds and householdChefIds)
  const guestToMealsMap = useMemo(() => {
    const map = new Map<string, Meal[]>();
    meals.forEach(m => {
      (m.chefIds || []).forEach(chefId => {
        if (!map.has(chefId)) map.set(chefId, []);
        if (!map.get(chefId)!.some(existing => existing.id === m.id)) {
          map.get(chefId)!.push(m);
        }
      });
      if (m.householdChefIds && m.householdChefIds.length > 0) {
        guests.forEach(g => {
          if (g.householdId && m.householdChefIds!.includes(g.householdId)) {
            if (!map.has(g.id)) map.set(g.id, []);
            if (!map.get(g.id)!.some(existing => existing.id === m.id)) {
              map.get(g.id)!.push(m);
            }
          }
        });
      }
    });
    return map;
  }, [meals, guests]);

  // Extract all unique households for datalist / selection
  const allUniqueHouseholds = useMemo(() => {
    const map = new Map<string, string>();
    guests.forEach(g => {
      const hId = g.householdId || `ind_${g.id}`;
      const hName = g.householdName || g.name;
      if (!map.has(hId)) map.set(hId, hName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [guests]);

  // Fuzzy Search via Fuse.js (including labels, meals, pin, names, notes)
  const searchableGuests = useMemo(() => {
    return guests.map(g => ({
      ...g,
      linkedMealNames: (guestToMealsMap.get(g.id) || []).map(m => m.name).join(' '),
      labelsText: (g.labels || []).join(' '),
      notesText: `${g.notes || ''} ${g.householdNotes || ''}`
    }));
  }, [guests, guestToMealsMap]);

  const fuse = useMemo(() => {
    return new Fuse(searchableGuests, {
      keys: ['name', 'householdName', 'pin', 'linkedMealNames', 'labelsText', 'notesText'],
      threshold: 0.35
    });
  }, [searchableGuests]);

  const searchedGuestIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const results = fuse.search(searchQuery.trim());
    return new Set(results.map(r => r.item.id));
  }, [searchQuery, fuse]);

  // Map of households where ALL members have rsvpStatus === 'not_coming'
  const nonComingHouseholdIds = useMemo(() => getNonComingHouseholdIds(guests), [guests]);

  // Filter & Sort Guests
  const filteredAndSortedGuests = useMemo(() => {
    return guests.filter(guest => {
      // Fuzzy search check
      if (searchedGuestIds && !searchedGuestIds.has(guest.id)) {
        return false;
      }

      // Sidebar Sub-section filter
      if (activeFilter && activeFilter !== 'all') {
        if (activeFilter === 'coming' && guest.rsvpStatus !== 'coming') return false;
        if (activeFilter === 'maybe' && guest.rsvpStatus !== 'maybe' && guest.rsvpStatus !== undefined) return false;
        if (activeFilter === 'not_coming' && guest.rsvpStatus !== 'not_coming') return false;
        if (activeFilter === 'paid' && (!guest.paid || guest.rsvpStatus === 'not_coming')) return false;
        if (activeFilter === 'unpaid' && (guest.paid || guest.shouldPayFee === false || guest.rsvpStatus === 'not_coming')) return false;
        const hasMeal = (guestToMealsMap.get(guest.id) || []).length > 0;
        if (activeFilter === 'has_meal' && (!hasMeal || guest.rsvpStatus === 'not_coming')) return false;
        if (activeFilter === 'no_meal' && (hasMeal || guest.rsvpStatus === 'not_coming')) return false;
      }

      // Arrival status filter
      if (filterArrival === 'exclude_not_coming') {
        const hId = guest.householdId || `ind_${guest.id}`;
        if (nonComingHouseholdIds.has(hId)) return false;
      }

      // Payment status filter
      if (filterPaid !== 'all') {
        const isPaid = !!guest.paid;
        if (filterPaid === 'paid' && (!isPaid || guest.rsvpStatus === 'not_coming')) return false;
        if (filterPaid === 'unpaid' && (isPaid || guest.shouldPayFee === false || guest.rsvpStatus === 'not_coming')) return false;
      }

      // Meal link filter
      if (filterMeal !== 'all') {
        const hasMeal = (guestToMealsMap.get(guest.id) || []).length > 0;
        if (filterMeal === 'has_meal' && (!hasMeal || guest.rsvpStatus === 'not_coming')) return false;
        if (filterMeal === 'no_meal' && (hasMeal || guest.rsvpStatus === 'not_coming')) return false;
      }

      // Label filter
      if (filterLabel !== 'all') {
        const labels = guest.labels || [];
        if (!labels.includes(filterLabel)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') {
        const hA = a.householdName || a.name;
        const hB = b.householdName || b.name;
        const hCompare = hA.localeCompare(hB, 'he');
        if (hCompare !== 0) return hCompare;
        return a.name.localeCompare(b.name, 'he');
      }
      if (sortBy === 'arrival') {
        const order = { coming: 1, maybe: 2, not_coming: 3 };
        const valA = order[a.rsvpStatus || 'maybe'];
        const valB = order[b.rsvpStatus || 'maybe'];
        return valA - valB;
      }
      if (sortBy === 'paid') {
        return (a.paid === b.paid) ? 0 : a.paid ? -1 : 1;
      }
      return 0;
    });
  }, [guests, searchedGuestIds, activeFilter, filterArrival, nonComingHouseholdIds, filterPaid, filterMeal, filterLabel, sortBy, guestToMealsMap]);

  // Group filtered guests into Households
  const householdGroups = useMemo(() => {
    const map = new Map<string, HouseholdGroup>();

    filteredAndSortedGuests.forEach(guest => {
      const hId = guest.householdId || `ind_${guest.id}`;
      const hName = guest.householdName || guest.name;

      if (!map.has(hId)) {
        map.set(hId, {
          id: hId,
          name: hName,
          members: [],
          allNotComing: true,
          hasComing: false,
          paidCount: 0,
          comingCount: 0,
          comingPaidCount: 0,
          hasPaidNotComingAlert: false,
          labels: []
        });
      }

      const group = map.get(hId)!;
      group.members.push(guest);
      if (guest.paid) group.paidCount += 1;
    });

    // Calculate household-level statuses, labels, and notes
    const groups = Array.from(map.values()).map(group => {
      // Requirement 4: Always move gray-out (non-coming) guests to the end of their household
      group.members.sort((a, b) => {
        const aNot = a.rsvpStatus === 'not_coming';
        const bNot = b.rsvpStatus === 'not_coming';
        if (aNot !== bNot) {
          return aNot ? 1 : -1;
        }
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, 'he');
      });

      const allNot = group.members.length > 0 && group.members.every(m => m.rsvpStatus === 'not_coming');
      const hasCome = group.members.some(m => m.rsvpStatus === 'coming');
      const comingMembers = group.members.filter(m => m.rsvpStatus === 'coming');
      const comingPaidMembers = comingMembers.filter(m => m.paid);
      const hasPaidNotComingAlert = group.members.some(m => m.paid && m.rsvpStatus === 'not_coming' && !m.paidAlertDismissed);

      const labelSet = new Set<string>();
      group.members.forEach(m => (m.labels || []).forEach(l => labelSet.add(l)));

      const householdNotes = group.members.find(m => m.householdNotes)?.householdNotes || '';

      return {
        ...group,
        allNotComing: allNot,
        hasComing: hasCome,
        comingCount: comingMembers.length,
        comingPaidCount: comingPaidMembers.length,
        hasPaidNotComingAlert,
        labels: Array.from(labelSet),
        notes: householdNotes
      };
    });

    // Requirement 3: Always move gray-out (non-coming) household to the end of the list
    return groups.sort((a, b) => {
      if (a.allNotComing !== b.allNotComing) {
        return a.allNotComing ? 1 : -1;
      }
      return a.name.localeCompare(b.name, 'he');
    });
  }, [filteredAndSortedGuests]);

  // Group households by status when sorting by arrival or payment
  const householdSections = useMemo(() => {
    return buildHouseholdSections<HouseholdGroup>(sortBy, householdGroups);
  }, [sortBy, householdGroups]);

  // Keep activeHouseholdForCard synced with live data
  const activeHouseholdForCard = useMemo(() => {
    if (!selectedHouseholdForCardId) return null;
    return householdGroups.find(h => h.id === selectedHouseholdForCardId) || null;
  }, [selectedHouseholdForCardId, householdGroups]);

  // Calculations for KPI Cards
  const totalGuests = guests.length;
  const comingGuests = guests.filter(g => g.rsvpStatus === 'coming').length;
  const maybeGuests = guests.filter(g => g.rsvpStatus === 'maybe' || !g.rsvpStatus).length;
  const notComingGuests = guests.filter(g => g.rsvpStatus === 'not_coming').length;
  const paidGuests = guests.filter(g => g.paid).length;

  const isFreeEvent = !!eventInfo?.isFree;
  const entryFee = isFreeEvent ? 0 : (eventInfo?.entryFee || 0);
  const totalCollectedMoney = paidGuests * entryFee;

  // Actions
  const handleTogglePaid = async (guest: Guest, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await updateDoc(doc(db, 'events', eventId, 'guests', guest.id), {
        paid: !guest.paid
      });
      showSuccess(guest.paid ? `בוטל סימון תשלום עבור ${guest.name}` : `סומן תשלום עבור ${guest.name}`);
    } catch (err) {
      console.error('Error toggling paid:', err);
      showAlert('שגיאה בעדכון סטטוס תשלום');
    }
  };

  const handleToggleExemption = (guest: Guest, e?: React.MouseEvent) => {
    e?.stopPropagation();
    showConfirm(
      `האורח "${guest.name}" מוגדר כפטור מתשלום. האם לבטל את הפטור ולחייבו בדמי כניסה?`,
      async () => {
        try {
          await updateDoc(doc(db, 'events', eventId, 'guests', guest.id), {
            shouldPayFee: true,
            paid: false
          });
          showSuccess(`הפטור בוטל. "${guest.name}" מחויב כעת בדמי כניסה.`);
        } catch (err) {
          console.error('Error toggling exemption:', err);
          showAlert('שגיאה בעדכון חיוב האורח');
        }
      }
    );
  };

  const handleRSVP = async (guestId: string, rsvpStatus: 'coming' | 'maybe' | 'not_coming', e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await updateDoc(doc(db, 'events', eventId, 'guests', guestId), { rsvpStatus });
      const statusLabel = rsvpStatus === 'coming' ? 'מגיע' : rsvpStatus === 'not_coming' ? 'לא מגיע' : 'אולי';
      showSuccess(`סטטוס עודכן ל-${statusLabel}`);
    } catch (err) {
      console.error('Error updating RSVP:', err);
      showAlert('שגיאה בעדכון סטטוס הגעה');
    }
  };

  // Unified member input with real-time fuzzy search
  const handleMemberNameInput = (val: string, householdId: string) => {
    setNewMemberName(val);
    if (!val.trim()) {
      setCandidateMatches([]);
      return;
    }
    const otherGuests = guests.filter(g => (g.householdId || `ind_${g.id}`) !== householdId);
    const fuseOther = new Fuse(otherGuests, {
      keys: ['name'],
      threshold: 0.35
    });
    const results = fuseOther.search(val.trim()).slice(0, 5).map(r => r.item);
    setCandidateMatches(results);
  };

  const handleAddMemberToHousehold = async (householdId: string, householdName: string) => {
    if (!newMemberName.trim()) {
      showAlert('יש להזין שם נפש');
      return;
    }
    const pin = newMemberPin || Math.floor(1000 + Math.random() * 9000).toString();
    try {
      const group = householdGroups.find(h => h.id === householdId);
      const inheritedLabels = group ? group.labels : [];
      const inheritedNotes = group ? (group.notes || '') : '';
      const nextOrder = group ? group.members.length : 0;

      const newGuestRef = await addDoc(collection(db, 'events', eventId, 'guests'), {
        name: newMemberName.trim(),
        pin,
        householdId,
        householdName,
        status: 'not_logged_in',
        rsvpStatus: 'maybe',
        paid: false,
        shouldPayFee: true,
        labels: inheritedLabels,
        householdNotes: inheritedNotes,
        order: nextOrder
      });

      if (meals && meals.length > 0) {
        await syncMemberToHouseholdMeals(eventId, newGuestRef.id, householdId, meals);
      }

      setNewMemberName('');
      setNewMemberPin('');
      setCandidateMatches([]);
      setAddingMemberToHouseholdId(null);
      showSuccess(`נפש חדשה נוספה למשק הבית "${householdName}"`);
    } catch (err) {
      console.error('Error adding member to household:', err);
      showAlert('שגיאה בהוספת חבר למשק הבית');
    }
  };

  // Move an existing guest to a target household
  const handleMoveGuestToHousehold = async (guestId: string, targetHouseholdId: string, targetHouseholdName: string) => {
    if (!guestId) return;
    const guestObj = guests.find(g => g.id === guestId);
    if (!guestObj) return;

    try {
      const targetGroup = householdGroups.find(h => h.id === targetHouseholdId);
      const nextOrder = targetGroup ? targetGroup.members.length : 0;
      await updateDoc(doc(db, 'events', eventId, 'guests', guestId), {
        householdId: targetHouseholdId,
        householdName: targetHouseholdName,
        order: nextOrder
      });

      if (meals && meals.length > 0) {
        await syncMemberToHouseholdMeals(eventId, guestId, targetHouseholdId, meals);
      }

      setCandidateMatches([]);
      setNewMemberName('');
      setAddingMemberToHouseholdId(null);
      showSuccess(`האורח "${guestObj.name}" הועבר בהצלחה למשק הבית "${targetHouseholdName}"`);
    } catch (err) {
      console.error('Error moving guest:', err);
      showAlert('שגיאה בהעברת האורח למשק הבית');
    }
  };

  const handleRenameHousehold = async (householdId: string) => {
    if (!editHouseholdName.trim()) {
      showAlert('יש להזין שם משק בית');
      return;
    }
    try {
      const membersToUpdate = guests.filter(g => (g.householdId || `ind_${g.id}`) === householdId);
      const batch = writeBatch(db);
      membersToUpdate.forEach(m => {
        batch.update(doc(db, 'events', eventId, 'guests', m.id), {
          householdName: editHouseholdName.trim()
        });
      });
      await batch.commit();
      setEditingHouseholdId(null);
      setEditHouseholdName('');
      showSuccess('שם משק הבית עודכן');
    } catch (err) {
      console.error('Error renaming household:', err);
      showAlert('שגיאה בשינוי שם משק הבית');
    }
  };

  // Quick Tag add (Instant save without needing to close an editor)
  const handleQuickAddHouseholdTag = async (householdId: string, tagToAdd: string) => {
    const trimmed = tagToAdd.trim().replace(/^#/, '');
    if (!trimmed) return;
    const group = householdGroups.find(h => h.id === householdId);
    if (!group) return;
    if (group.labels.includes(trimmed)) {
      setQuickTagHouseholdId(null);
      setQuickTagInput('');
      return;
    }
    const updated = [...group.labels, trimmed];
    try {
      const batch = writeBatch(db);
      group.members.forEach(m => {
        batch.update(doc(db, 'events', eventId, 'guests', m.id), {
          labels: updated
        });
      });
      await batch.commit();
      setQuickTagInput('');
      setQuickTagHouseholdId(null);
      showSuccess(`התגית "${trimmed}" נוספה למשק הבית`);
    } catch (err) {
      console.error('Error adding tag:', err);
      showAlert('שגיאה בהוספת תגית');
    }
  };

  // Quick Tag remove
  const handleRemoveHouseholdTag = async (householdId: string, tagToRemove: string) => {
    const group = householdGroups.find(h => h.id === householdId);
    if (!group) return;
    const updated = group.labels.filter(l => l !== tagToRemove);
    try {
      const batch = writeBatch(db);
      group.members.forEach(m => {
        batch.update(doc(db, 'events', eventId, 'guests', m.id), {
          labels: updated
        });
      });
      await batch.commit();
      showSuccess(`התגית "${tagToRemove}" הוסרה`);
    } catch (err) {
      console.error('Error removing tag:', err);
      showAlert('שגיאה בהסרת תגית');
    }
  };

  // Toggle paid alert dismissal ("הוסכם ללא החזר")
  const handleTogglePaidAlert = async (guestId: string, dismissed: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await updateDoc(doc(db, 'events', eventId, 'guests', guestId), {
        paidAlertDismissed: dismissed
      });
      showSuccess(dismissed ? 'ההתראה בוטלה (הוסכם ללא החזר)' : 'התראת תשלום הופעלה מחדש');
    } catch (err) {
      console.error('Error updating paid alert:', err);
      showAlert('שגיאה בעדכון התראה');
    }
  };

  const handleReorderMember = async (householdId: string, guestId: string, direction: 'up' | 'down') => {
    const group = householdGroups.find(h => h.id === householdId);
    if (!group) return;

    const list = [...group.members];
    const currentIndex = list.findIndex(m => m.id === guestId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Swap positions
    const [moved] = list.splice(currentIndex, 1);
    list.splice(targetIndex, 0, moved);

    try {
      const batch = writeBatch(db);
      list.forEach((m, idx) => {
        batch.update(doc(db, 'events', eventId, 'guests', m.id), {
          order: idx
        });
      });
      await batch.commit();
      showSuccess('סדר הנפשות עודכן');
    } catch (err) {
      console.error('Error reordering members:', err);
      showAlert('שגיאה בעדכון סדר הנפשות');
    }
  };

  const handleDeleteHousehold = (household: HouseholdGroup) => {
    showConfirm(
      `האם למחוק את כל משק הבית "${household.name}" ואת כל ${household.members.length} האורחים שבו?`,
      async () => {
        try {
          const batch = writeBatch(db);
          household.members.forEach(m => {
            batch.delete(doc(db, 'events', eventId, 'guests', m.id));
          });
          await batch.commit();
          showSuccess(`משק הבית "${household.name}" נמחק`);
        } catch (err) {
          console.error('Error deleting household:', err);
          showAlert('שגיאה במחיקת משק הבית');
        }
      }
    );
  };

  const getFilterLabel = (filter: string) => {
    switch (filter) {
      case 'coming': return 'מגיעים בלבד';
      case 'maybe': return 'טרם השיבו / אולי';
      case 'not_coming': return 'לא מגיעים';
      case 'paid': return 'שילמו בלבד';
      case 'unpaid': return 'טרם שילמו';
      case 'has_meal': return 'שפים עם מנה מקושרת';
      case 'no_meal': return 'ללא מנה מקושרת';
      default: return filter;
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 h-full overflow-hidden flex flex-col" dir="rtl">
      <div className="flex-1 overflow-y-auto admin-scroll p-3.5 sm:p-6 md:p-8 text-right relative flex flex-col min-h-0">

      {/* Top Header & Quick Add */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <Users className="text-blue-600" />
            ניהול אורחים ומשקי בית
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            מעקב אחר משקי בית, אישורי הגעה, תיוגים, שיוך שפים וגביית כספים
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsAddHouseholdOpen(true)}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-blue-500/10 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Home size={18} />
            <span>הוסף משק בית</span>
          </button>

          <button
            onClick={() => setIsAddSingleModalOpen(true)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 text-sm"
            title="הוסף אורח בודד"
          >
            <UserPlus size={18} />
            <span className="hidden md:inline">אורח בודד</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">

        {/* Total Guests */}
        <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="text-xs text-blue-900 font-bold flex items-center justify-between">
            <span>מוזמנים</span>
            <Users size={15} className="text-blue-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-blue-700">{totalGuests}</span>
            <span className="text-[11px] text-blue-600/80 mr-1.5 font-medium">({allUniqueHouseholds.length} בתים)</span>
          </div>
        </div>

        {/* Coming */}
        <div className="bg-green-50/70 border border-green-100 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="text-xs text-green-900 font-bold flex items-center justify-between">
            <span>מגיעים</span>
            <CheckCircle2 size={15} className="text-green-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-green-700">{comingGuests}</span>
          </div>
        </div>

        {/* Maybe */}
        <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="text-xs text-amber-900 font-bold flex items-center justify-between">
            <span>טרם השיבו / אולי</span>
            <HelpCircle size={15} className="text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-700">{maybeGuests}</span>
          </div>
        </div>

        {/* Not Coming */}
        <div className="bg-red-50/70 border border-red-100 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="text-xs text-red-900 font-bold flex items-center justify-between">
            <span>לא מגיעים</span>
            <XCircle size={15} className="text-red-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-red-700">{notComingGuests}</span>
          </div>
        </div>

        {/* Money / Payment KPI */}
        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="text-xs text-emerald-900 font-bold flex items-center justify-between">
            <span>קופת האירוע</span>
            <Coins size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2">
            {isFreeEvent ? (
              <div>
                <span className="text-base font-black text-emerald-700">אירוע חינם</span>
                <p className="text-[10px] text-emerald-600">ללא דמי כניסה</p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-700">₪{totalCollectedMoney.toLocaleString()}</span>
                  <span className="text-[11px] text-emerald-600 font-medium">נאספו</span>
                </div>
                <p className="text-[10px] text-emerald-700 mt-0.5">
                  {paidGuests} שילמו
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Active Sidebar Sub-Section Filter Banner */}
      {activeFilter && activeFilter !== 'all' && (
        <div className="flex items-center justify-between bg-blue-50/90 border border-blue-200 text-blue-900 px-4 py-2.5 rounded-2xl text-xs font-bold mb-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-blue-600" />
            <span>סינון פעיל: <span className="font-extrabold underline">{getFilterLabel(activeFilter)}</span> ({filteredAndSortedGuests.length} אורחים)</span>
          </div>
          {onFilterChange && (
            <button
              onClick={() => onFilterChange('all')}
              className="text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 font-bold shadow-2xs"
            >
              <X size={13} />
              <span>הצג את כל האורחים</span>
            </button>
          )}
        </div>
      )}

      {/* Toolbar: Search, Filters Toggle, Sorters, View Mode */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md pt-1 pb-3 mb-4 border-b border-gray-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">

        {/* Fuzzy Search Bar */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="חיפוש חכם: שם אורח, משק בית, תגית, קוד PIN או מנה..."
            className="w-full pl-9 pr-9 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <Search size={15} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Actions & Controls Group */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setShowFilters(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${showFilters || activeFiltersCount > 0
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            title={showFilters ? 'הסתר מסננים' : 'הצג מסננים'}
          >
            <Filter size={14} className={showFilters || activeFiltersCount > 0 ? 'text-blue-600' : 'text-gray-400'} />
            <span>מסננים</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
            {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Sort By */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1">
            <ArrowUpDown size={13} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="name">לפי שם (א-ת)</option>
              <option value="arrival">לפי סטטוס הגעה</option>
              <option value="paid">לפי סטטוס תשלום</option>
            </select>
          </div>

          {/* Expand / Collapse All Toggle */}
          {householdGroups.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const isAllCollapsed = householdGroups.length > 0 && householdGroups.every(h => collapsedHouseholdIds.has(h.id));
                if (isAllCollapsed) {
                  setCollapsedHouseholdIds(new Set());
                } else {
                  setCollapsedHouseholdIds(new Set(householdGroups.map(h => h.id)));
                }
              }}
              className="bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
              title={householdGroups.every(h => collapsedHouseholdIds.has(h.id)) ? 'הרחב את כל משקי הבית' : 'כווץ את כל משקי הבית'}
            >
              {householdGroups.every(h => collapsedHouseholdIds.has(h.id)) ? (
                <>
                  <ChevronDown size={14} />
                  <span>הרחב הכל</span>
                </>
              ) : (
                <>
                  <ChevronUp size={14} />
                  <span>כווץ הכל</span>
                </>
              )}
            </button>
          )}

          {/* Density Toggle (Comfortable vs Compact) with hover-revealed text */}
          <div className="flex items-center bg-gray-100 border border-gray-200 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setDensity('comfortable')}
              className={`group relative px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${density === 'comfortable'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
                }`}
              title="תצוגה מרווחת"
            >
              <StretchHorizontal size={14} className="shrink-0" />
              <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out group-hover:max-w-[70px] group-hover:opacity-100 group-hover:mr-1.5">
                מרווח
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDensity('compact')}
              className={`group relative px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${density === 'compact'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
                }`}
              title="תצוגה קומפקטית"
            >
              <Rows3 size={14} className="shrink-0" />
              <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out group-hover:max-w-[70px] group-hover:opacity-100 group-hover:mr-1.5">
                קומפקטי
              </span>
            </button>
          </div>

        </div>

      </div>

      {/* Expandable Filters Section */}
      {showFilters && (
        <div className="sticky top-[58px] z-10 bg-blue-50/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-2.5 mb-4 p-3 rounded-2xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5 ml-1">
              <Filter size={13} className="text-blue-600" />
              <span>סינון לפי:</span>
            </span>

            {/* Label Filter */}
            {allUniqueLabels.length > 0 && (
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <Tag size={13} className="text-indigo-500" />
                <select
                  value={filterLabel}
                  onChange={e => setFilterLabel(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-indigo-900 focus:outline-none"
                >
                  <option value="all">כל התגיות ({allUniqueLabels.length})</option>
                  {allUniqueLabels.map(lbl => (
                    <option key={lbl} value={lbl}>תגית: #{lbl}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Arrival Filter */}
            <select
              value={filterArrival}
              onChange={e => setFilterArrival(e.target.value as any)}
              className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            >
              <option value="all">הצג הכל</option>
              <option value="exclude_not_coming">הצג הכל (ללא משקי בית שלא מגיעים)</option>
            </select>

            {/* Paid Filter */}
            <select
              value={filterPaid}
              onChange={e => setFilterPaid(e.target.value as any)}
              className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            >
              <option value="all">כל סטטוסי התשלום</option>
              <option value="paid">שילמו בלבד</option>
              <option value="unpaid">טרם שילמו</option>
            </select>

            {/* Meal Filter */}
            <select
              value={filterMeal}
              onChange={e => setFilterMeal(e.target.value as any)}
              className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            >
              <option value="all">כל האורחים</option>
              <option value="no_meal">ללא מנה מקושרת</option>
              <option value="has_meal">שפים עם מנה מקושרת</option>
            </select>

            {/* Reset Filters Button if any active */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilterArrival('all');
                  setFilterPaid('all');
                  setFilterMeal('all');
                  setFilterLabel('all');
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline px-2 py-1 flex items-center gap-1"
              >
                <X size={12} />
                <span>איפוס מסננים</span>
              </button>
            )}
          </div>

          {/* Hide Filters Button */}
          <button
            type="button"
            onClick={() => setShowFilters(false)}
            className="text-xs text-gray-400 hover:text-gray-700 font-semibold p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1 mr-auto"
            title="הסתר מסננים"
          >
            <span>הסתר</span>
            <ChevronUp size={14} />
          </button>
        </div>
      )}

      {/* Main Content Area: Households or Flat List */}
      <div className="pr-1 pb-4">

        {guests.length === 0 ? (
          <div className="py-16 text-center text-gray-500 bg-gray-50/50 rounded-2xl border border-dashed border-gray-300">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-bold text-gray-700 text-base mb-1">אין אורחים ברשימה עדיין</h3>
            <p className="text-xs text-gray-400 mb-4">הוסף משק בית או אורח ראשון כדי להתחיל לנהל את האירוע.</p>
            <button
              onClick={() => setIsAddHouseholdOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-sm transition-all"
            >
              + הוסף משק בית
            </button>
          </div>
        ) : filteredAndSortedGuests.length === 0 ? (
          <div className="py-12 text-center text-gray-500 bg-gray-50/50 rounded-2xl border border-gray-200">
            <Search size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-600">לא נמצאו אורחים התואמים את הסינון או החיפוש.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterArrival('all');
                setFilterPaid('all');
                setFilterMeal('all');
                setFilterLabel('all');
              }}
              className="text-xs text-blue-600 hover:underline mt-2 font-bold"
            >
              אפס מסננים
            </button>
          </div>
        ) : (
          /* HOUSEHOLDS VIEW */
          <div className={density === 'compact' ? 'space-y-3' : 'space-y-5'}>
            {householdSections.map((section, sIdx) => (
              <div key={section.title || sIdx} className={density === 'compact' ? 'space-y-2' : 'space-y-3'}>
                {section.title && (
                  <div className="flex items-center gap-2.5 pt-2 pb-0.5 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold shadow-2xs ${section.badgeClass}`}>
                      {section.iconType === 'coming' && <CheckCircle2 size={14} />}
                      {section.iconType === 'maybe' && <HelpCircle size={14} />}
                      {section.iconType === 'not_coming' && <XCircle size={14} />}
                      {section.iconType === 'paid_full' && <CheckCircle2 size={14} />}
                      {section.iconType === 'paid_partial' && <Coins size={14} />}
                      {section.iconType === 'unpaid' && <DollarSign size={14} />}
                      <span>{section.title}</span>
                      <span className="bg-white/80 px-1.5 py-0.2 text-[10px] rounded-full font-black">
                        {section.households.length}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-gray-200/80" />
                  </div>
                )}
                <div className={density === 'compact' ? 'space-y-2' : 'space-y-3'}>
                  {section.households.map(household => {
                    const isAllNotComing = household.allNotComing;
                    const isEditingThisHousehold = editingHouseholdId === household.id;
                    const isAddingMemberHere = addingMemberToHouseholdId === household.id;
                    const isCollapsed = collapsedHouseholdIds.has(household.id);

                    return (
                      <div
                        key={household.id}
                        className={`rounded-2xl border transition-all ${isAllNotComing
                          ? 'bg-gray-100/70 border-dashed border-gray-300 opacity-60 grayscale'
                          : 'bg-white border-gray-200/80 shadow-sm hover:shadow-md'
                          }`}
                      >
                        {/* Household Header (Clickable anywhere to collapse/expand) */}
                        <div
                          onClick={() => toggleHouseholdCollapse(household.id)}
                          className={`border-b border-gray-100 rounded-t-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none transition-colors ${density === 'compact'
                            ? 'px-3.5 py-2 bg-gray-50/90 hover:bg-gray-100/90'
                            : 'px-5 py-3.5 bg-gray-50/80 hover:bg-gray-100/70'
                            }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Collapse / Expand Toggle Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHouseholdCollapse(household.id);
                              }}
                              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200/70 transition-colors"
                              title={isCollapsed ? 'הרחב משק בית' : 'כווץ משק בית'}
                            >
                              {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                            </button>

                            <div className={`p-1.5 rounded-xl ${isAllNotComing ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
                              <Home size={density === 'compact' ? 15 : 18} />
                            </div>

                            {isEditingThisHousehold ? (
                              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editHouseholdName}
                                  onChange={e => setEditHouseholdName(e.target.value)}
                                  className="px-2.5 py-1 text-sm font-bold bg-white border border-blue-400 rounded-lg text-right"
                                  autoFocus
                                  onKeyDown={e => e.key === 'Enter' && handleRenameHousehold(household.id)}
                                />
                                <button
                                  onClick={() => handleRenameHousehold(household.id)}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={() => setEditingHouseholdId(null)}
                                  className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <h3 className={`font-black text-gray-900 ${density === 'compact' ? 'text-sm' : 'text-base'}`}>
                                  {household.name}
                                </h3>
                                {household.members.some(m => m.isHostingMember) && (
                                  <span className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                                    מארחים
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Household Labels Badges */}
                            {household.labels.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 mr-1" onClick={e => e.stopPropagation()}>
                                {household.labels.map(lbl => (
                                  <span
                                    key={lbl}
                                    className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 group"
                                  >
                                    <Tag size={10} className="text-indigo-500" />
                                    <span>{lbl}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveHouseholdTag(household.id, lbl)}
                                      className="text-indigo-400 hover:text-indigo-800 p-0.5 rounded hover:bg-indigo-100 transition-colors"
                                      title={`הסר תגית "${lbl}"`}
                                    >
                                      <X size={10} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Quick Label Inline Input & Suggestions */}
                            {quickTagHouseholdId === household.id ? (
                              <div
                                className="flex items-center gap-1 bg-white border border-indigo-400 rounded-lg p-1 shadow-lg relative z-20"
                                onClick={e => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  value={quickTagInput}
                                  onChange={e => setQuickTagInput(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                      e.preventDefault();
                                      handleQuickAddHouseholdTag(household.id, quickTagInput);
                                    } else if (e.key === 'Escape') {
                                      setQuickTagHouseholdId(null);
                                      setQuickTagInput('');
                                    }
                                  }}
                                  placeholder="הקלד תגית + Enter..."
                                  autoFocus
                                  className="text-xs px-2 py-0.5 border border-indigo-200 rounded text-right font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32"
                                />
                                {quickTagInput.trim() && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickAddHouseholdTag(household.id, quickTagInput)}
                                    className="bg-indigo-600 text-white text-[11px] font-bold px-2 py-0.5 rounded hover:bg-indigo-700"
                                  >
                                    הוסף
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickTagHouseholdId(null);
                                    setQuickTagInput('');
                                  }}
                                  className="text-gray-400 hover:text-gray-600 p-0.5"
                                  title="סגור (Esc)"
                                >
                                  <X size={13} />
                                </button>

                                {/* Quick suggestions popover from existing event labels */}
                                {allUniqueLabels.filter(l => !household.labels.includes(l)).length > 0 && (
                                  <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded-xl shadow-xl p-2 min-w-[160px] max-w-xs flex flex-wrap gap-1 z-50 animate-in fade-in">
                                    <span className="text-[10px] text-gray-400 w-full px-1">הצעות (לחץ להוספה):</span>
                                    {allUniqueLabels.filter(l => !household.labels.includes(l)).slice(0, 6).map(s => (
                                      <button
                                        key={s}
                                        type="button"
                                        onClick={() => handleQuickAddHouseholdTag(household.id, s)}
                                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded transition-colors"
                                      >
                                        +{s}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQuickTagHouseholdId(household.id);
                                  setQuickTagInput('');
                                }}
                                className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                                title="הוסף תגית מהירה"
                              >
                                <Tag size={13} />
                                <span className="text-[11px]">+</span>
                              </button>
                            )}

                            {/* Household Notes Preview */}
                            {household.notes && (
                              <span
                                onClick={e => e.stopPropagation()}
                                className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1"
                                title={household.notes}
                              >
                                <FileText size={11} className="text-amber-600" />
                                <span>{household.notes.length > 20 ? `${household.notes.slice(0, 20)}...` : household.notes}</span>
                              </span>
                            )}

                            {/* Paid but Not Coming Alert Badge on Header */}
                            {household.hasPaidNotComingAlert && (
                              <span
                                onClick={e => e.stopPropagation()}
                                className="bg-red-100 border border-red-300 text-red-800 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs"
                                title="ישנו אורח ששילם אך לא מגיע! נדרש החזר או הסדר"
                              >
                                <AlertTriangle size={12} className="text-red-600" />
                                <span>שילם ולא מגיע</span>
                              </span>
                            )}

                            {isAllNotComing && (
                              <span className="bg-red-100 text-red-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                                כל בני הבית לא מגיעים
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-gray-500" onClick={e => e.stopPropagation()}>
                            {/* Payment Status: Green if all coming paid! */}
                            {!isFreeEvent && entryFee > 0 && (
                              <span className={`px-2.5 py-1 rounded-lg font-bold text-xs ${household.comingCount > 0 && household.comingPaidCount === household.comingCount
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : household.comingCount > 0
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : household.paidCount > 0
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                                }`}>
                                {household.comingCount > 0
                                  ? `${household.comingPaidCount}/${household.comingCount} שילמו (₪${(household.paidCount * entryFee).toLocaleString()})`
                                  : `${household.paidCount}/${household.members.length} שילמו`
                                }
                              </span>
                            )}

                            {/* Household Card Modal Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedHouseholdForCardId(household.id)}
                              className="bg-white border border-gray-200 hover:border-indigo-300 text-indigo-700 font-bold px-2.5 py-1 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1 shadow-sm"
                              title="פתח כרטיס ניהול משק בית מלא"
                            >
                              <Home size={13} className="text-indigo-600" />
                              <span>כרטיס בית</span>
                            </button>

                            <button
                              onClick={() => {
                                setAddingMemberToHouseholdId(isAddingMemberHere ? null : household.id);
                                setNewMemberName('');
                                setNewMemberPin(Math.floor(1000 + Math.random() * 9000).toString());
                                setCandidateMatches([]);
                                if (isCollapsed) toggleHouseholdCollapse(household.id);
                              }}
                              className="bg-white border border-gray-200 hover:border-blue-300 text-blue-600 font-bold px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1"
                              title="הוסף או העבר חבר למשק בית זה"
                            >
                              <Plus size={13} />
                              <span>הוסף נפש</span>
                            </button>

                            {/* Edit Household Name Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingHouseholdId(household.id);
                                setEditHouseholdName(household.name);
                              }}
                              className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                              title="ערוך שם משק בית"
                            >
                              <Edit2 size={15} />
                            </button>

                            <button
                              onClick={() => handleDeleteHousehold(household)}
                              className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              title="מחק משק בית זה על כל אורחיו"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Add Member inline form (Unified with real-time fuzzy search) */}
                        {isAddingMemberHere && (
                          <div className="bg-blue-50/80 p-3.5 border-b border-blue-100 flex flex-col gap-2.5 animate-in fade-in" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                <UserPlus size={14} className="text-blue-600" />
                                הוספת נפש ל-{household.name} (הקלד שם חדש או בחר אורח קיים):
                              </span>
                              <button
                                onClick={() => {
                                  setAddingMemberToHouseholdId(null);
                                  setNewMemberName('');
                                  setCandidateMatches([]);
                                }}
                                className="text-gray-400 hover:text-gray-600 p-1"
                              >
                                <X size={15} />
                              </button>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2 relative">
                              <div className="relative flex-1 w-full">
                                <input
                                  type="text"
                                  value={newMemberName}
                                  onChange={e => handleMemberNameInput(e.target.value, household.id)}
                                  placeholder="שם הנפש (או הקלד שם אורח קיים להעברה)..."
                                  className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      handleAddMemberToHousehold(household.id, household.name);
                                    }
                                  }}
                                />

                                {/* Fuzzy search results dropdown */}
                                {candidateMatches.length > 0 && (
                                  <div className="absolute top-full mt-1 right-0 left-0 bg-white border border-indigo-200 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in space-y-1">
                                    <div className="text-[10px] text-indigo-700 font-bold px-2 py-0.5 flex items-center gap-1 border-b border-indigo-50 pb-1">
                                      <UserCheck size={11} />
                                      <span>נמצא אורח קיים - לחץ להעברתו למשק בית זה:</span>
                                    </div>
                                    {candidateMatches.map(g => (
                                      <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => {
                                          handleMoveGuestToHousehold(g.id, household.id, household.name);
                                        }}
                                        className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs hover:bg-indigo-50 flex items-center justify-between transition-colors border border-transparent hover:border-indigo-200"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-gray-900">{g.name}</span>
                                          <span className="text-[11px] text-gray-500 font-medium">
                                            (במשק בית: {g.householdName || 'אורח יחיד'})
                                          </span>
                                        </div>
                                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                          <UserCheck size={10} />
                                          העבר לכאן
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <input
                                type="text"
                                value={newMemberPin}
                                onChange={e => setNewMemberPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="PIN"
                                maxLength={4}
                                className="w-20 bg-white border border-blue-300 rounded-xl px-2 py-2 text-xs font-mono text-center font-bold"
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    handleAddMemberToHousehold(household.id, household.name);
                                  }
                                }}
                              />

                              <button
                                type="button"
                                onClick={() => handleAddMemberToHousehold(household.id, household.name)}
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm whitespace-nowrap"
                              >
                                הוסף כאורח חדש
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Household Members List */}
                        {!isCollapsed && (
                          <div className="p-3 divide-y divide-gray-100 animate-in fade-in duration-150">
                            {household.members.map((guest, idx) => {
                              const isNotComing = guest.rsvpStatus === 'not_coming';
                              const guestMeals = guestToMealsMap.get(guest.id) || [];
                              const isFirst = idx === 0;
                              const isLast = idx === household.members.length - 1;

                              return (
                                <div
                                  key={guest.id}
                                  onClick={() => setSelectedGuestForModal(guest)}
                                  className={`rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2.5 cursor-pointer transition-all hover:bg-gray-50/80 ${density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-3'
                                    } ${isNotComing ? 'opacity-50 grayscale line-through bg-gray-50/40 text-gray-400' : ''
                                    }`}
                                >
                                  {/* Member details, Reorder & Labels */}
                                  <div className="flex items-center gap-2.5">
                                    {/* Up / Down Reorder buttons */}
                                    {!isNotComing && household.members.length > 1 && (
                                      <div className="flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          disabled={isFirst}
                                          onClick={() => handleReorderMember(household.id, guest.id, 'up')}
                                          className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                          title="הזז למעלה"
                                        >
                                          <ArrowUp size={density === 'compact' ? 10 : 12} />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isLast || household.members[idx + 1]?.rsvpStatus === 'not_coming'}
                                          onClick={() => handleReorderMember(household.id, guest.id, 'down')}
                                          className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                                          title="הזז למטה"
                                        >
                                          <ArrowDown size={density === 'compact' ? 10 : 12} />
                                        </button>
                                      </div>
                                    )}

                                    <div className={`${density === 'compact' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'} rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0`}>
                                      {guest.name.charAt(0) || 'א'}
                                    </div>

                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className={`font-bold text-gray-900 ${density === 'compact' ? 'text-xs' : 'text-sm'}`}>{guest.name}</span>
                                        <span className="bg-gray-100 text-gray-600 font-mono text-[10px] px-2 py-0.5 rounded-md font-bold tracking-wider">
                                          {guest.pin || 'אין PIN'}
                                        </span>

                                        {guest.isHostingMember && (
                                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-1.5 py-0.5 rounded-md">
                                            מארח
                                          </span>
                                        )}
                                        {guest.canVote === false && (
                                          <span className="bg-gray-100 text-gray-600 border border-gray-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                            לא מצביע
                                          </span>
                                        )}

                                        {/* Paid but Not Coming Alert with Dismiss Option */}
                                        {guest.paid && guest.rsvpStatus === 'not_coming' && (
                                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                            {!guest.paidAlertDismissed ? (
                                              <span className="bg-red-100 border border-red-300 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs animate-in fade-in">
                                                <AlertTriangle size={11} className="text-red-600 animate-pulse" />
                                                <span>שילם ולא מגיע!</span>
                                                <button
                                                  type="button"
                                                  onClick={() => handleTogglePaidAlert(guest.id, true)}
                                                  className="mr-1 text-[9px] bg-red-200 hover:bg-red-300 text-red-900 px-1.5 py-0.5 rounded font-bold underline transition-colors"
                                                  title="סמן שהוסכם ביניכם שדמי ההשתתפות לא יוחזרו וכבה התראה זו"
                                                >
                                                  הוסכם ללא החזר
                                                </button>
                                              </span>
                                            ) : (
                                              <span className="bg-gray-100 border border-gray-200 text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1" title="הוסכם שהתשלום לא יוחזר (ההתראה כבויה)">
                                                <span>ללא החזר</span>
                                                <button
                                                  type="button"
                                                  onClick={() => handleTogglePaidAlert(guest.id, false)}
                                                  className="text-[9px] text-gray-400 hover:text-red-600 underline"
                                                  title="הפעל מחדש את ההתראה"
                                                >
                                                  (בטל)
                                                </button>
                                              </span>
                                            )}
                                          </div>
                                        )}

                                        {/* Guest individual labels */}
                                        {guest.labels && guest.labels.length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {guest.labels.map(lbl => (
                                              <span key={lbl} className="bg-indigo-50/80 text-indigo-700 border border-indigo-200/80 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                                #{lbl}
                                              </span>
                                            ))}
                                          </div>
                                        )}

                                        {/* Guest individual notes */}
                                        {guest.notes && (
                                          <span
                                            className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium"
                                            title={guest.notes}
                                          >
                                            <FileText size={10} className="text-amber-600" />
                                            {guest.notes.length > 20 ? `${guest.notes.slice(0, 20)}...` : guest.notes}
                                          </span>
                                        )}
                                      </div>

                                      {/* Linked Meals pill */}
                                      {guestMeals.length > 0 && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                          <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <ChefHat size={11} />
                                            שף של: {guestMeals.map(m => m.name).join(', ')}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Member Controls: RSVP, Paid, Edit */}
                                  <div className="flex items-center gap-2.5 justify-end" onClick={e => e.stopPropagation()}>

                                    {/* RSVP Buttons */}
                                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-0.5 shadow-sm">
                                      <button
                                        onClick={e => handleRSVP(guest.id, 'not_coming', e)}
                                        className={`p-1.5 rounded-lg transition-all ${guest.rsvpStatus === 'not_coming'
                                          ? 'bg-red-600 text-white shadow-sm'
                                          : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                          }`}
                                        title="לא מגיע"
                                      >
                                        <XCircle size={16} />
                                      </button>
                                      <button
                                        onClick={e => handleRSVP(guest.id, 'maybe', e)}
                                        className={`p-1.5 rounded-lg transition-all ${guest.rsvpStatus === 'maybe' || !guest.rsvpStatus
                                          ? 'bg-amber-500 text-white shadow-sm'
                                          : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                                          }`}
                                        title="אולי / טרם השיב"
                                      >
                                        <HelpCircle size={16} />
                                      </button>
                                      <button
                                        onClick={e => handleRSVP(guest.id, 'coming', e)}
                                        className={`p-1.5 rounded-lg transition-all ${guest.rsvpStatus === 'coming'
                                          ? 'bg-green-600 text-white shadow-sm'
                                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                          }`}
                                        title="מגיע"
                                      >
                                        <CheckCircle2 size={16} />
                                      </button>
                                    </div>

                                    {/* Paid Toggle Button */}
                                    {guest.shouldPayFee === false ? (
                                      <button
                                        type="button"
                                        onClick={e => handleToggleExemption(guest, e)}
                                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs transition-all cursor-pointer"
                                        title={guest.isHostingMember ? "מארח - פטור מתשלום (לחץ לביטול הפטור וחיוב בדמי כניסה)" : "פטור מתשלום (לחץ לביטול הפטור וחיוב בדמי כניסה)"}
                                      >
                                        <DollarSign size={13} className="text-amber-600" />
                                        <span>פטור מתשלום</span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={e => handleTogglePaid(guest, e)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${guest.paid
                                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                          : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                                          }`}
                                        title="סטטוס תשלום (לחץ לשינוי)"
                                      >
                                        <DollarSign size={13} />
                                        <span>{guest.paid ? 'שולם' : 'לא שולם'}</span>
                                      </button>
                                    )}

                                    {/* Edit Card Button */}
                                    <button
                                      onClick={() => setSelectedGuestForModal(guest)}
                                      className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                      title="ערוך כרטיס אורח מלא"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Guest Card Modal */}
      {selectedGuestForModal && (
        <GuestCardModal
          guest={guests.find(g => g.id === selectedGuestForModal.id) || selectedGuestForModal}
          eventId={eventId}
          meals={meals}
          eventInfo={eventInfo}
          allHouseholds={allUniqueHouseholds}
          availableLabels={allUniqueLabels}
          onClose={() => setSelectedGuestForModal(null)}
        />
      )}

      {/* Household Card Modal */}
      {activeHouseholdForCard && (
        <HouseholdCardModal
          household={activeHouseholdForCard}
          eventId={eventId}
          eventInfo={eventInfo}
          allGuests={guests}
          meals={meals}
          availableLabels={allUniqueLabels}
          onClose={() => setSelectedHouseholdForCardId(null)}
          onOpenGuestModal={(guest) => setSelectedGuestForModal(guest)}
        />
      )}

      {/* Add Household Modal */}
      {isAddHouseholdOpen && (
        <HouseholdModal
          eventId={eventId}
          eventInfo={eventInfo}
          existingGuests={guests}
          availableLabels={allUniqueLabels}
          onClose={() => setIsAddHouseholdOpen(false)}
        />
      )}

      {/* Add Single Guest Modal */}
      <SingleGuestModal
        isOpen={isAddSingleModalOpen}
        onClose={() => setIsAddSingleModalOpen(false)}
        eventId={eventId}
        eventInfo={eventInfo}
        existingHouseholds={allUniqueHouseholds}
        availableLabels={allUniqueLabels}
        meals={meals}
      />

      </div>
    </div>
  );
}
