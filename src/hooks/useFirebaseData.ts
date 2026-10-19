import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface ThemeConfig {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  backgroundImageUrl: string;
  mobileBackgroundImageUrl?: string;
  surfaceColor?: string;
  textColor?: string;
  fontFamily?: string;
}

export interface EventInfo {
  id?: string;
  title: string;
  subtitle: string;
  startButtonText: string;
  activeThemeId: string;
  themes: ThemeConfig[];
  deletedThemeIds?: string[];
  date: string;
  hostPin: string;
  timerStatus: 'idle' | 'running' | 'ended';
  timerEndTime: number | null;
  timerDuration?: number | null;
  revealState: 'none' | '3rd' | '2nd' | '1st' | 'emblem' | 'results' | 'background';
  entryFee?: number;
  isFree?: boolean;
  showMealsCarousel?: boolean;
  showFlavorTexts?: boolean;
  showStage?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
}

export interface Guest {
  id: string;
  name: string;
  pin: string;
  status: 'not_logged_in' | 'voting' | 'done';
  rsvpStatus?: 'coming' | 'maybe' | 'not_coming';
  paid?: boolean;
  householdId?: string;
  householdName?: string;
  labels?: string[];
  notes?: string;
  householdNotes?: string;
  order?: number;
  paidAlertDismissed?: boolean;
  isHostingMember?: boolean;
  hostingMemberId?: string;
  canVote?: boolean;
  shouldPayFee?: boolean;
}

export type MealCategory = 'מתאבן' | 'סלט' | 'מלוח' | 'קינוח';

export interface Meal {
  id: string;
  name: string;
  description: string;
  category?: MealCategory;
  imageUrl: string;
  lowResImageUrl?: string;
  chefIds: string[];
  householdChefIds?: string[];
  isNonParticipating?: boolean;
}

export interface Vote {
  id: string;
  guestId: string;
  mealId: string;
  points: number;
}

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
  groceryKeySettings?: Record<string, number>;
  defaultGroceryKeySettings?: Record<string, number>;
}

export function useFirebaseData(eventId: string | undefined) {
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubEvent = onSnapshot(
      doc(db, 'events', eventId),
      (docSnap) => {
        if (docSnap.exists()) {
          setEventInfo({ id: docSnap.id, ...docSnap.data() } as EventInfo);
          setError(null);
        } else {
          setEventInfo(null);
          setError("אירוע לא נמצא");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to event:", err);
        setError(err.message || "שגיאה בטעינת נתוני אירוע");
        setLoading(false);
      }
    );

    const unsubGuests = onSnapshot(
      collection(db, 'events', eventId, 'guests'),
      (snapshot) => {
        setGuests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Guest)));
      },
      (err) => {
        console.error("Error listening to guests:", err);
      }
    );

    const unsubMeals = onSnapshot(
      collection(db, 'events', eventId, 'meals'),
      (snapshot) => {
        setMeals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Meal)));
      },
      (err) => {
        console.error("Error listening to meals:", err);
      }
    );

    const unsubVotes = onSnapshot(
      collection(db, 'events', eventId, 'votes'),
      (snapshot) => {
        setVotes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vote)));
      },
      (err) => {
        console.error("Error listening to votes:", err);
      }
    );

    const unsubGeneral = onSnapshot(
      doc(db, 'settings', 'general'),
      (docSnap) => {
        if (docSnap.exists()) {
          setGeneralSettings(docSnap.data() as GeneralSettings);
        } else {
          setGeneralSettings(null);
        }
      },
      (err) => {
        console.error("Error listening to general settings:", err);
      }
    );

    return () => {
      unsubEvent();
      unsubGuests();
      unsubMeals();
      unsubVotes();
      unsubGeneral();
    };
  }, [eventId]);

  return { eventInfo, guests, meals, votes, generalSettings, loading, error };
}

export function useGeneralSettings() {
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      doc(db, 'settings', 'general'),
      (docSnap) => {
        if (docSnap.exists()) {
          setGeneralSettings(docSnap.data() as GeneralSettings);
        } else {
          setGeneralSettings({
            themes: [],
            deletedThemeIds: [],
            hostingHousehold: null
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to general settings:", err);
        setError(err.message || "שגיאה בטעינת הגדרות כלליות");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const saveGeneralSettings = useCallback(async (newSettings: Partial<GeneralSettings>) => {
    try {
      await setDoc(doc(db, 'settings', 'general'), newSettings, { merge: true });
    } catch (err: any) {
      console.error("Error saving general settings:", err);
      throw err;
    }
  }, []);

  const saveThemes = useCallback(async (themes: ThemeConfig[], deletedThemeIds: string[]) => {
    await saveGeneralSettings({ themes, deletedThemeIds });
  }, [saveGeneralSettings]);

  const saveHostingHousehold = useCallback(async (hostingHousehold: HostingHousehold | null) => {
    await saveGeneralSettings({ hostingHousehold });
  }, [saveGeneralSettings]);

  const saveGroceryKeySettings = useCallback(async (groceryKeySettings: Record<string, number>) => {
    await saveGeneralSettings({ groceryKeySettings });
  }, [saveGeneralSettings]);

  const saveDefaultGroceryKeySettings = useCallback(async (defaultGroceryKeySettings: Record<string, number>) => {
    await saveGeneralSettings({
      defaultGroceryKeySettings,
      groceryKeySettings: defaultGroceryKeySettings
    });
  }, [saveGeneralSettings]);

  return {
    generalSettings,
    loading,
    error,
    saveGeneralSettings,
    saveThemes,
    saveHostingHousehold,
    saveGroceryKeySettings,
    saveDefaultGroceryKeySettings
  };
}

export function useAllEvents() {
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      collection(db, 'events'),
      (snapshot) => {
        setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EventInfo)));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Error listening to all events:", err);
        setError(err.message || "שגיאה בטעינת אירועים");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { events, loading, error };
}
