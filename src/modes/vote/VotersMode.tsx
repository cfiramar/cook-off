import { useState, useEffect, useMemo } from 'react';
import { useFirebaseData } from '../../hooks/useFirebaseData';
import WelcomeScreen from './components/WelcomeScreen';
import GuideScreen from './components/GuideScreen';
import LoginScreen from './components/LoginScreen';
import VotingGrid from './components/VotingGrid';
import { useParams } from 'react-router-dom';
import { getThemeStyles } from '../../utils/theme';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

type Step = 'welcome' | 'guide' | 'login' | 'voting';

export default function VotersMode() {
  const { eventId } = useParams<{ eventId: string }>();
  const { eventInfo, guests, meals, votes, generalSettings, loading, error } = useFirebaseData(eventId);
  const [step, setStep] = useState<Step>('welcome');
  const [loggedInGuestId, setLoggedInGuestId] = useState<string | null>(null);

  // Progressive Background Loading
  const [highResLoaded, setHighResLoaded] = useState(false);

  const themeStyles = useMemo(() => {
    return getThemeStyles(
      eventInfo?.activeThemeId, 
      [
        ...(generalSettings?.themes || []),
        ...(eventInfo?.themes || [])
      ],
      { isMobile: true }
    );
  }, [eventInfo?.activeThemeId, generalSettings?.themes, eventInfo?.themes]);

  const { backgroundImage, backgroundSize, backgroundPosition, ...containerStyles } = themeStyles as any;

  // Extract raw image URL from theme
  const highResUrl = useMemo(() => {
    if (!backgroundImage) return null;
    const match = /url\(['"]?(.*?)['"]?\)/.exec(backgroundImage as string);
    return match ? match[1] : null;
  }, [backgroundImage]);

  const lowResUrl = useMemo(() => {
    if (!highResUrl) return null;
    if (highResUrl.includes('spooky_kitchen_bg')) {
      return '/spooky_kitchen_bg_low.webp';
    }
    return highResUrl;
  }, [highResUrl]);

  useEffect(() => {
    if (!highResUrl) return;
    setHighResLoaded(false);

    const img = new Image();
    img.src = highResUrl;
    img.onload = () => {
      setHighResLoaded(true);
    };
    img.onerror = () => {
      // High-res failed; keep low-res fallback
      console.warn('High-res background failed to load, keeping low-res fallback');
    };
  }, [highResUrl]);

  // Lock body scrolling strictly while in VotersMode, restore on unmount (keeping HostMode freely scrollable)
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  // Auto-login if we have a saved session
  useEffect(() => {
    const savedGuest = localStorage.getItem('guestId');
    if (savedGuest && guests.some(g => g.id === savedGuest)) {
      const guestObj = guests.find(g => g.id === savedGuest);
      // If guest is not allowed to vote, clear session
      if (guestObj?.canVote === false) {
        localStorage.removeItem('guestId');
        setLoggedInGuestId(null);
        setStep('login');
        return;
      }

      setLoggedInGuestId(savedGuest);
      setStep('voting');

      // Ensure Firestore status is updated from 'not_logged_in' to 'voting' or 'done'
      if (guestObj && guestObj.status === 'not_logged_in' && eventId) {
        const guestVotesCount = votes.filter(v => v.guestId === savedGuest).length;
        const newStatus = guestVotesCount >= 2 ? 'done' : 'voting';
        const guestRef = doc(db, 'events', eventId, 'guests', savedGuest);
        updateDoc(guestRef, { status: newStatus }).catch(console.error);
      }
    }
  }, [guests, votes, eventId]);

  const handleLogin = async (guestId: string) => {
    localStorage.setItem('guestId', guestId);
    setLoggedInGuestId(guestId);
    setStep('voting');

    if (eventId) {
      const guestVotesCount = votes.filter(v => v.guestId === guestId).length;
      const newStatus = guestVotesCount >= 2 ? 'done' : 'voting';
      const guestRef = doc(db, 'events', eventId, 'guests', guestId);
      await updateDoc(guestRef, { status: newStatus });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('guestId');
    setLoggedInGuestId(null);
    setStep('login');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex justify-center items-center bg-black/90 z-50">
        <div className="animate-pulse text-theme-primary text-2xl font-semibold">טוען נתונים...</div>
      </div>
    );
  }

  if (error || !eventId) {
    return (
      <div className="fixed inset-0 flex flex-col justify-center items-center bg-black z-50">
        <h2 className="text-2xl text-red-500 mb-4">{error || "אירוע לא נמצא"}</h2>
      </div>
    );
  }

  const loggedInGuest = guests.find(g => g.id === loggedInGuestId);

  return (
    <div 
      style={containerStyles} 
      className="fixed inset-0 w-full h-[100dvh] flex flex-col overflow-hidden select-none bg-theme-bg overscroll-none"
    >
      {/* 1. Low-Res Background Layer (instant fallback) */}
      {lowResUrl && (
        <div 
          className="fixed inset-0 z-0 pointer-events-none bg-cover bg-center bg-no-repeat"
          style={{
            backgroundColor: (containerStyles as any)['--theme-bg'] || '#0F0F0F',
            backgroundImage: `url('${lowResUrl}')`,
            backgroundSize: backgroundSize || 'cover',
            backgroundPosition: backgroundPosition || 'center',
          }}
        />
      )}

      {/* 2. High-Res Background Layer (gracefully transitions in once loaded) */}
      {highResUrl && (
        <div 
          className={`fixed inset-0 z-0 pointer-events-none bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ease-out ${
            highResLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            backgroundImage: `url('${highResUrl}')`,
            backgroundSize: backgroundSize || 'cover',
            backgroundPosition: backgroundPosition || 'center',
          }}
        />
      )}
      
      {/* Fixed Dark Overlay for text readability when background image is present */}
      {(lowResUrl || highResUrl) && (
        <div className="fixed inset-0 bg-black/50 z-0 pointer-events-none" />
      )}

      {/* Centered Mobile Shell with safe area support */}
      <div className="relative z-10 flex-1 max-w-md mx-auto w-full h-full flex flex-col min-h-0 overflow-hidden md:border-x md:border-white/10 md:shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <div className="relative z-10 flex-1 flex flex-col h-full min-h-0 overflow-hidden">
          {step === 'welcome' && <WelcomeScreen onNext={() => setStep('guide')} eventInfo={eventInfo} />}
          {step === 'guide' && <GuideScreen onNext={() => setStep('login')} />}
          {step === 'login' && <LoginScreen guests={guests} onLogin={handleLogin} />}
          {step === 'voting' && loggedInGuest && eventInfo && (
            <VotingGrid 
              guest={loggedInGuest} 
              meals={meals} 
              existingVotes={votes} 
              eventId={eventId}
              onLogout={handleLogout}
              eventInfo={eventInfo}
            />
          )}
        </div>
      </div>
    </div>
  );
}
