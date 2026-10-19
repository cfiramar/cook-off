import type { Guest, ThemeConfig } from '../hooks/useFirebaseData';

export interface HostingMember {
  id: string;
  name: string;
  pin: string;
  includeInEveryEvent: boolean;
  canVote: boolean;
  shouldPayFee: boolean;
}

export interface HostingHousehold {
  id: string;
  name: string;
  members: HostingMember[];
}

export interface GeneralSettings {
  themes?: ThemeConfig[];
  deletedThemeIds?: string[];
  hostingHousehold?: HostingHousehold | null;
}

export interface SyncAction {
  type: 'add' | 'update' | 'remove';
  guestId?: string;
  data?: Partial<Guest>;
  targetDocId?: string;
}

/**
 * Calculates the delta of actions needed to synchronize hosting household members
 * with the guests of an event.
 * 
 * Rules:
 * - Only members with `includeInEveryEvent === true` are auto-added/synced.
 * - Hosting members have `rsvpStatus: 'coming'` (counted as arriving guests).
 * - If `shouldPayFee === true`, `paid: true` by default (entry-fee is counted).
 * - If `shouldPayFee === false`, `paid: false` and exempt.
 * - If a hosting member exists, synchronize name, householdName, canVote, shouldPayFee.
 * - If multiple duplicate copies of the same hosting member exist, deduplicate and remove redundant copies!
 * - If a member was removed from hosting household or has includeInEveryEvent turned off,
 *   and has never voted or logged in, they can be removed.
 */
export function computeHostingSyncActions(
  hostingHousehold: HostingHousehold | null | undefined,
  currentGuests: Guest[]
): SyncAction[] {
  const actions: SyncAction[] = [];

  if (!hostingHousehold || !hostingHousehold.members || hostingHousehold.members.length === 0) {
    // If hosting household was deleted/emptied, remove auto-created hosting members who haven't voted
    currentGuests
      .filter(g => g.isHostingMember && g.status === 'not_logged_in')
      .forEach(g => actions.push({ type: 'remove', guestId: g.id }));
    return actions;
  }

  const activeMembers = hostingHousehold.members.filter(m => m.includeInEveryEvent);
  const activeMemberIds = new Set(activeMembers.map(m => m.id));
  const processedGuestIds = new Set<string>();

  // 1. Sync or add active members and remove duplicate copies
  for (const member of activeMembers) {
    const matches = currentGuests.filter(g =>
      (g.isHostingMember && g.hostingMemberId === member.id) ||
      (g.isHostingMember && g.name.trim() === member.name.trim()) ||
      (g.householdId === hostingHousehold.id && g.name.trim() === member.name.trim())
    );

    if (matches.length === 0) {
      actions.push({
        type: 'add',
        targetDocId: `host_${member.id}`,
        data: {
          name: member.name.trim(),
          pin: member.pin || '1234',
          householdId: hostingHousehold.id,
          householdName: hostingHousehold.name.trim() || 'מארחים',
          isHostingMember: true,
          hostingMemberId: member.id,
          canVote: member.canVote,
          shouldPayFee: member.shouldPayFee,
          rsvpStatus: 'coming', // Counted as arriving guests
          paid: !!member.shouldPayFee, // Counted in entry-fee when should pay
          status: 'not_logged_in',
          labels: ['מארח']
        }
      });
    } else {
      // Pick the primary guest:
      // Prioritize: (1) logged in or done status, (2) deterministic ID, (3) first match
      const primary = matches.reduce((best, curr) => {
        const bestScore = (best.status && best.status !== 'not_logged_in' ? 10 : 0) + (best.id === `host_${member.id}` ? 5 : 0);
        const currScore = (curr.status && curr.status !== 'not_logged_in' ? 10 : 0) + (curr.id === `host_${member.id}` ? 5 : 0);
        return currScore > bestScore ? curr : best;
      }, matches[0]);

      processedGuestIds.add(primary.id);

      // Check for necessary updates
      const needsUpdate =
        primary.name !== member.name ||
        primary.householdName !== hostingHousehold.name ||
        primary.householdId !== hostingHousehold.id ||
        primary.canVote !== member.canVote ||
        primary.shouldPayFee !== member.shouldPayFee ||
        primary.rsvpStatus !== 'coming' ||
        !primary.isHostingMember ||
        primary.hostingMemberId !== member.id;

      if (needsUpdate) {
        actions.push({
          type: 'update',
          guestId: primary.id,
          data: {
            name: member.name.trim(),
            householdName: hostingHousehold.name.trim() || 'מארחים',
            householdId: hostingHousehold.id,
            isHostingMember: true,
            hostingMemberId: member.id,
            canVote: member.canVote,
            shouldPayFee: member.shouldPayFee,
            rsvpStatus: 'coming',
            ...(primary.shouldPayFee !== member.shouldPayFee
              ? { paid: !!member.shouldPayFee }
              : {})
          }
        });
      }

      // CRITICAL: Remove all duplicate copies of this member
      const duplicates = matches.filter(g => g.id !== primary.id);
      for (const dup of duplicates) {
        if (dup.status === 'not_logged_in' || !dup.status) {
          actions.push({ type: 'remove', guestId: dup.id });
          processedGuestIds.add(dup.id);
        }
      }
    }
  }

  // 2. Remove hosting guests that are no longer active in hosting household and haven't participated
  for (const guest of currentGuests) {
    if (processedGuestIds.has(guest.id)) continue;
    if (guest.isHostingMember && guest.hostingMemberId) {
      if (!activeMemberIds.has(guest.hostingMemberId) && guest.status === 'not_logged_in') {
        actions.push({ type: 'remove', guestId: guest.id });
      }
    }
  }

  return actions;
}

/**
 * Calculates the number of guests still voting.
 * Per Requirement 6: Hosting members that are not allowed to vote (canVote === false)
 * are excluded from the count.
 */
export function calculateStillVotingCount(
  guests: Guest[],
  votes: { guestId: string }[]
): {
  stillVotingCount: number;
  stillVotingText: string;
  eligibleVotersCount: number;
  doneCount: number;
} {
  const eligibleVoters = guests.filter(
    g => g.rsvpStatus !== 'not_coming' && g.canVote !== false
  );

  const doneCount = eligibleVoters.filter(guest => {
    const guestVotesCount = votes.filter(v => v.guestId === guest.id).length;
    return guestVotesCount >= 2 || guest.status === 'done';
  }).length;

  const stillVotingCount = Math.max(0, eligibleVoters.length - doneCount);
  const stillVotingText =
    stillVotingCount === 1
      ? 'אדם 1 עדיין מצביע'
      : `${stillVotingCount} אנשים עדיין מצביעים`;

  return {
    stillVotingCount,
    stillVotingText,
    eligibleVotersCount: eligibleVoters.length,
    doneCount
  };
}

/**
 * Checks if a given chef or household chef is associated with the hosting household.
 * Used to auto-set a meal as "out-of-contest" (Requirement 5).
 */
export function isHostingChef(
  chefIdOrHouseholdId: string,
  guests: Guest[],
  hostingHouseholdId?: string
): boolean {
  if (hostingHouseholdId && chefIdOrHouseholdId === hostingHouseholdId) {
    return true;
  }
  const guest = guests.find(g => g.id === chefIdOrHouseholdId);
  if (guest?.isHostingMember) {
    return true;
  }
  if (hostingHouseholdId && guest?.householdId === hostingHouseholdId) {
    return true;
  }
  return false;
}

// In-flight concurrency lock to prevent overlapping sync executions for the same event
const inFlightSyncs = new Map<string, Promise<void>>();

/**
 * Executes sync actions against Firestore for a given event.
 * Uses deterministic document IDs (host_{memberId}) and setDoc with merge:true
 * so additions are strictly idempotent and cannot create duplicates.
 */
export async function executeHostingSync(
  eventId: string,
  hostingHousehold: HostingHousehold | null | undefined,
  currentGuests: Guest[],
  firestoreDb?: any
): Promise<void> {
  if (!eventId) return;

  // Prevent concurrent executions for the same event
  if (inFlightSyncs.has(eventId)) {
    return inFlightSyncs.get(eventId)!;
  }

  const syncPromise = (async () => {
    try {
      const actions = computeHostingSyncActions(hostingHousehold, currentGuests);
      if (actions.length === 0) return;

      // Dynamically import firestore methods if not passed
      const { setDoc, updateDoc, deleteDoc, doc, collection } = await import('firebase/firestore');
      const { db } = await import('../firebase.ts');
      const database = firestoreDb || db;

      for (const action of actions) {
        try {
          if (action.type === 'add' && action.data) {
            const docRef = action.targetDocId
              ? doc(database, 'events', eventId, 'guests', action.targetDocId)
              : doc(collection(database, 'events', eventId, 'guests'));
            await setDoc(docRef, action.data, { merge: true });
          } else if (action.type === 'update' && action.guestId && action.data) {
            await updateDoc(doc(database, 'events', eventId, 'guests', action.guestId), action.data);
          } else if (action.type === 'remove' && action.guestId) {
            await deleteDoc(doc(database, 'events', eventId, 'guests', action.guestId));
          }
        } catch (err) {
          console.error(`Failed to execute hosting sync action ${action.type}:`, err);
        }
      }
    } finally {
      inFlightSyncs.delete(eventId);
    }
  })();

  inFlightSyncs.set(eventId, syncPromise);
  return syncPromise;
}

