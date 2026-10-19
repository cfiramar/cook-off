export interface MinimalGuest {
  id: string;
  name: string;
  householdId?: string;
  householdName?: string;
  rsvpStatus?: 'coming' | 'maybe' | 'not_coming';
  paid?: boolean;
}

export interface MinimalHouseholdGroup {
  id: string;
  name: string;
  members: any[];
  allNotComing: boolean;
  hasComing: boolean;
  paidCount: number;
  comingCount: number;
  comingPaidCount: number;
  hasPaidNotComingAlert: boolean;
  labels: string[];
  notes?: string;
}

export interface HouseholdSection<T extends MinimalHouseholdGroup = MinimalHouseholdGroup> {
  id: string;
  title?: string;
  iconType?: 'coming' | 'maybe' | 'not_coming' | 'paid_full' | 'paid_partial' | 'unpaid';
  badgeClass?: string;
  households: T[];
}

/**
 * Calculates household IDs where ALL members are marked as 'not_coming'.
 */
export function getNonComingHouseholdIds(guests: MinimalGuest[]): Set<string> {
  const householdMembers = new Map<string, MinimalGuest[]>();
  guests.forEach(g => {
    const hId = g.householdId || `ind_${g.id}`;
    if (!householdMembers.has(hId)) householdMembers.set(hId, []);
    householdMembers.get(hId)!.push(g);
  });

  const nonComingSet = new Set<string>();
  householdMembers.forEach((members, hId) => {
    if (members.length > 0 && members.every(m => m.rsvpStatus === 'not_coming')) {
      nonComingSet.add(hId);
    }
  });

  return nonComingSet;
}

/**
 * Groups households by arrival or payment status, or returns a flat list for alphabetical sorting.
 */
export function buildHouseholdSections<T extends MinimalHouseholdGroup>(
  sortBy: 'name' | 'arrival' | 'paid',
  householdGroups: T[]
): HouseholdSection<T>[] {
  if (sortBy === 'arrival') {
    const coming = householdGroups.filter(h => h.hasComing).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    const maybe = householdGroups.filter(h => !h.hasComing && !h.allNotComing).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    const notComing = householdGroups.filter(h => h.allNotComing).sort((a, b) => a.name.localeCompare(b.name, 'he'));

    const sections: HouseholdSection<T>[] = [];
    if (coming.length > 0) {
      sections.push({
        id: 'arrival-coming',
        title: 'מגיעים',
        iconType: 'coming',
        badgeClass: 'bg-green-50 text-green-700 border-green-200',
        households: coming
      });
    }
    if (maybe.length > 0) {
      sections.push({
        id: 'arrival-maybe',
        title: 'אולי / טרם השיבו',
        iconType: 'maybe',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        households: maybe
      });
    }
    if (notComing.length > 0) {
      sections.push({
        id: 'arrival-not-coming',
        title: 'לא מגיעים',
        iconType: 'not_coming',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        households: notComing
      });
    }
    return sections;
  }

  if (sortBy === 'paid') {
    const paidFull: T[] = [];
    const paidPartial: T[] = [];
    const unpaid: T[] = [];
    const notComing: T[] = [];

    householdGroups.forEach(h => {
      if (h.allNotComing) {
        notComing.push(h);
      } else {
        const targetCount = h.comingCount > 0 ? h.comingCount : h.members.length;
        const paid = h.comingCount > 0 ? h.comingPaidCount : h.paidCount;

        if (paid === targetCount && targetCount > 0) {
          paidFull.push(h);
        } else if (paid > 0) {
          paidPartial.push(h);
        } else {
          unpaid.push(h);
        }
      }
    });

    const sections: HouseholdSection<T>[] = [];
    if (paidFull.length > 0) {
      sections.push({
        id: 'paid-full',
        title: 'שילמו במלואו',
        iconType: 'paid_full',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        households: paidFull.sort((a, b) => a.name.localeCompare(b.name, 'he'))
      });
    }
    if (paidPartial.length > 0) {
      sections.push({
        id: 'paid-partial',
        title: 'שילמו חלקית',
        iconType: 'paid_partial',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        households: paidPartial.sort((a, b) => a.name.localeCompare(b.name, 'he'))
      });
    }
    if (unpaid.length > 0) {
      sections.push({
        id: 'paid-unpaid',
        title: 'טרם שילמו',
        iconType: 'unpaid',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        households: unpaid.sort((a, b) => a.name.localeCompare(b.name, 'he'))
      });
    }
    if (notComing.length > 0) {
      sections.push({
        id: 'paid-not-coming',
        title: 'לא מגיעים',
        iconType: 'not_coming',
        badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
        households: notComing.sort((a, b) => a.name.localeCompare(b.name, 'he'))
      });
    }
    return sections;
  }

  // Default sortBy === 'name': Single section with no title header
  return [{
    id: 'name-all',
    households: householdGroups
  }];
}
