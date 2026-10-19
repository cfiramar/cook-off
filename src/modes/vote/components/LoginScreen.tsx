import { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import type { Guest } from '../../../hooks/useFirebaseData';
import { motion } from 'framer-motion';
import PinPad from '../../../components/ui/PinPad';
import { usePopup } from '../../../components/ui/PopupProvider';
import { ArrowRight, Users } from 'lucide-react';
import {
  isGuestPinValid,
  getValidPinsForGuest,
  getHouseholdSiblings,
  getLoginHintText
} from '../../../utils/householdPinAuth';

interface Props {
  guests: Guest[];
  onLogin: (guestId: string) => void;
}

export default function LoginScreen({ guests, onLogin }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [pin, setPin] = useState('');
  const [isError, setIsError] = useState(false);
  const { showAlert } = usePopup();

  const activeGuests = useMemo(
    () => guests.filter(g => g.rsvpStatus !== 'not_coming' && g.canVote !== false),
    [guests]
  );

  const fuse = useMemo(() => new Fuse(activeGuests, {
    keys: ['name'],
    threshold: 0.4
  }), [activeGuests]);

  const results = useMemo(() => {
    if (searchTerm.length < 2) return [];
    return fuse.search(searchTerm).map(result => result.item);
  }, [searchTerm, fuse]);

  const selectedGuestSiblings = useMemo(
    () => (selectedGuest ? getHouseholdSiblings(selectedGuest, guests) : []),
    [selectedGuest, guests]
  );

  const handleGuestSelect = (guest: Guest) => {
    const validPins = getValidPinsForGuest(guest, guests);
    // If neither the guest nor anyone in their household has a PIN, login directly
    if (validPins.size === 0) {
      onLogin(guest.id);
    } else {
      setSelectedGuest(guest);
      setPin('');
      setIsError(false);
    }
  };

  const handlePinComplete = (completedPin: string) => {
    if (!selectedGuest) return;

    if (isGuestPinValid(completedPin, selectedGuest, guests)) {
      onLogin(selectedGuest.id);
    } else {
      setIsError(true);
      const siblings = getHouseholdSiblings(selectedGuest, guests);
      showAlert(
        siblings.length > 0
          ? 'קוד שגוי, אנא נסו שנית (או הזינו את קוד של בן/בת הזוג)'
          : 'קוד שגוי, אנא נסו שנית'
      );
      setTimeout(() => {
        setPin('');
        setIsError(false);
      }, 550);
    }
  };

  if (selectedGuest) {
    return (
      <div className="flex-1 flex flex-col px-4 py-2 sm:py-4 w-full max-w-md mx-auto relative h-full justify-between items-center overflow-hidden select-none">
        {/* Top Back Navigation Bar */}
        <div className="w-full shrink-0 flex items-center justify-between pt-1 sm:pt-2">
          <button
            type="button"
            onClick={() => {
              setSelectedGuest(null);
              setPin('');
              setIsError(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/15 text-white/90 text-xs sm:text-sm font-semibold transition-all active:scale-95 shadow-md cursor-pointer"
            title="חזור לבחירת משתמש"
            aria-label="חזור"
          >
            <ArrowRight size={16} />
            <span>בחירת אורח</span>
          </button>
        </div>

        {/* Guest Profile & Greeting Badge */}
        <div className="w-full shrink-0 flex flex-col items-center my-1 sm:my-2">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/[0.08] border border-white/20 flex items-center justify-center text-white font-extrabold text-2xl sm:text-3xl shadow-xl backdrop-blur-xl mb-2">
            {selectedGuest.name.charAt(0)}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white text-center leading-tight drop-shadow-md">
            {selectedGuest.name}
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 font-medium tracking-wide mt-0.5">
            הקלידו 4 ספרות קוד אישי
          </p>
          {selectedGuestSiblings.length > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 backdrop-blur-sm shadow-xs">
              <Users size={12} className="shrink-0" />
              <span>
                ניתן להזין גם את הקוד של בן/בת הזוג
              </span>
            </div>
          )}
        </div>

        {/* Center: Modern Glassmorphic PinPad */}
        <div className="w-full flex-1 flex flex-col justify-center items-center my-auto">
          <div className="w-full max-w-[310px] sm:max-w-[345px] p-3.5 sm:p-5 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col items-center">
            <PinPad
              pin={pin}
              onPinChange={setPin}
              onComplete={handlePinComplete}
              isError={isError}
            />
          </div>
        </div>

        {/* Bottom Modern Hint Pill */}
        <div className="w-full shrink-0 pb-2 text-center">
          <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-[11px] sm:text-xs text-gray-300 shadow-md">
            <span>{getLoginHintText(selectedGuest, guests)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 w-full max-w-md mx-auto relative h-full min-h-0 overflow-hidden">
      <h2 className="text-3xl font-bold text-theme-primary mb-6 mt-10 text-center">מי אתם?</h2>

      <div className="mb-6 relative z-10">
        <input
          type="search"
          name="filter_query_random_guest"
          id="filter_query_random_guest"
          placeholder="חפש את שמך..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoComplete="one-time-code"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          inputMode="search"
          className="input-field text-xl py-4 shadow-xl"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pb-8 z-0 overscroll-contain">
        {searchTerm.length < 2 ? (
          <p className="text-center text-gray-500 mt-10">הקלידו לפחות 2 אותיות לחיפוש.</p>
        ) : results.length > 0 ? (
          results.map(guest => (
            <motion.button
              key={guest.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleGuestSelect(guest)}
              className="w-full text-right bg-theme-surface bg-opacity-80 p-4 rounded-xl border border-gray-700 hover:border-theme-primary transition-colors"
            >
              <span className="text-xl">{guest.name}</span>
            </motion.button>
          ))
        ) : (
          <p className="text-center text-gray-500 mt-10">לא נמצא אורח בשם זה.</p>
        )}
      </div>
    </div>
  );
}
