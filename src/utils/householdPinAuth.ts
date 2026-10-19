import type { Guest } from '../hooks/useFirebaseData';

/**
 * Returns other guests belonging to the same household as the provided guest.
 */
export function getHouseholdSiblings(guest: Guest, allGuests: Guest[]): Guest[] {
  const hId = guest.householdId?.trim();
  const hName = guest.householdName?.trim().toLowerCase();

  if (!hId && !hName) {
    return [];
  }

  return allGuests.filter(other => {
    if (other.id === guest.id) return false;

    const matchesId = Boolean(hId && other.householdId?.trim() === hId);
    const matchesName = Boolean(
      hName && other.householdName?.trim().toLowerCase() === hName
    );

    return matchesId || matchesName;
  });
}

/**
 * Returns all valid PINs for a guest, including PINs of all members in the same household.
 * This enables household members to use each other's PIN codes.
 */
export function getValidPinsForGuest(guest: Guest, allGuests: Guest[]): Set<string> {
  const validPins = new Set<string>();

  if (guest.pin && guest.pin.trim()) {
    validPins.add(guest.pin.trim());
  }

  const siblings = getHouseholdSiblings(guest, allGuests);
  for (const sibling of siblings) {
    if (sibling.pin && sibling.pin.trim()) {
      validPins.add(sibling.pin.trim());
    }
  }

  return validPins;
}

/**
 * Validates whether a given PIN input matches either the guest's own PIN or
 * any PIN assigned to a member of their household.
 */
export function isGuestPinValid(
  pinInput: string,
  guest: Guest,
  allGuests: Guest[]
): boolean {
  const validPins = getValidPinsForGuest(guest, allGuests);
  // If neither the guest nor anyone in their household has a PIN configured, allow access
  if (validPins.size === 0) {
    return true;
  }
  return validPins.has(pinInput.trim());
}

/**
 * Returns a contextual tip/hint for the login screen informing voters about
 * using their phone digits or household members' codes.
 */
export function getLoginHintText(guest: Guest, allGuests: Guest[]): string {
  const siblings = getHouseholdSiblings(guest, allGuests);

  if (siblings.length === 1) {
    return `4 ספרות של הטלפון שלכם (או של ${siblings[0].name})`;
  }

  if (siblings.length > 1) {
    return '4 ספרות של הטלפון שלכם (או של בני הבית)';
  }

  return '4 ספרות אחרונות של הטלפון';
}
