import { useState, useCallback } from 'react';
import { Delete } from 'lucide-react';

interface Props {
  pin: string;
  onPinChange: (newPin: string) => void;
  onComplete: (completedPin: string) => void;
  maxLength?: number;
  isError?: boolean;
}

/**
 * Triggers safe mobile haptic vibration feedback
 */
function triggerHaptic(type: 'digit' | 'delete' | 'error' | 'clear') {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      if (type === 'digit') {
        navigator.vibrate(15);
      } else if (type === 'delete') {
        navigator.vibrate(25);
      } else if (type === 'clear') {
        navigator.vibrate(30);
      } else if (type === 'error') {
        navigator.vibrate([40, 50, 40]);
      }
    } catch (_) {}
  }
}

export default function PinPad({ 
  pin, 
  onPinChange, 
  onComplete, 
  maxLength = 4,
  isError = false 
}: Props) {
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const flashKey = useCallback((key: string) => {
    setPressedKey(key);
    setTimeout(() => {
      setPressedKey((current) => (current === key ? null : current));
    }, 150);
  }, []);

  const handleDigitTap = (digit: string) => {
    triggerHaptic('digit');
    flashKey(digit);

    const newPin = pin + digit;
    if (newPin.length < maxLength) {
      onPinChange(newPin);
    } else if (newPin.length === maxLength) {
      onPinChange(newPin);
      setTimeout(() => {
        onComplete(newPin);
      }, 120);
    }
  };

  const handleBackspace = () => {
    if (pin.length === 0) return;
    triggerHaptic('delete');
    flashKey('backspace');
    onPinChange(pin.slice(0, -1));
  };

  const handleClear = () => {
    if (pin.length === 0) return;
    triggerHaptic('clear');
    flashKey('clear');
    onPinChange('');
  };

  return (
    <div className="w-full max-w-[290px] sm:max-w-[325px] mx-auto flex flex-col items-center select-none">
      {/* Modern PIN Display Slots */}
      <div 
        className={`flex gap-2.5 sm:gap-3.5 mb-5 sm:mb-6 justify-center w-full transition-transform duration-200 ${
          isError ? 'animate-shake' : ''
        }`} 
        dir="ltr"
      >
        {Array.from({ length: maxLength }).map((_, i) => {
          const isFilled = pin.length > i;
          const isCurrent = pin.length === i;

          return (
            <div 
              key={i} 
              className={`w-13 h-14 sm:w-15 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl font-black transition-all duration-200 backdrop-blur-xl ${
                isError
                  ? 'border-2 border-red-500 bg-red-500/25 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.5)] scale-105'
                  : isFilled
                  ? 'border-2 border-white/80 bg-white/[0.14] text-white scale-105 shadow-[0_0_20px_rgba(255,255,255,0.18)]'
                  : isCurrent
                  ? 'border-2 border-white/45 bg-white/[0.07] text-transparent shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                  : 'border border-white/12 bg-white/[0.03] text-transparent'
              }`}
            >
              {isFilled ? (
                <span className="drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] animate-scale-up">
                  {pin[i]}
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-white/20" />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Keypad Grid (3x4) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 w-full" dir="ltr">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
          const numStr = num.toString();
          const isPressed = pressedKey === numStr;

          return (
            <button
              key={num}
              type="button"
              onClick={() => handleDigitTap(numStr)}
              className={`w-full aspect-square rounded-full flex items-center justify-center text-2xl sm:text-3xl font-extrabold transition-all duration-150 shadow-md cursor-pointer backdrop-blur-md ${
                isPressed
                  ? 'bg-white text-zinc-950 border-2 border-white scale-90 shadow-[0_0_24px_rgba(255,255,255,0.6)]'
                  : 'bg-white/[0.08] hover:bg-white/[0.18] active:bg-white/30 text-white border border-white/15 active:border-white/40 active:scale-90'
              }`}
            >
              {num}
            </button>
          );
        })}

        {/* Bottom Left: Reset / Clear button when digits entered */}
        {pin.length > 0 ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="נקה הכל"
            className={`w-full aspect-square rounded-full flex flex-col items-center justify-center transition-all duration-150 backdrop-blur-md shadow-md cursor-pointer ${
              pressedKey === 'clear'
                ? 'bg-white/30 scale-90 border-2 border-white'
                : 'bg-white/[0.06] hover:bg-white/[0.14] active:bg-white/25 border border-white/15 text-gray-300 hover:text-white active:scale-90'
            }`}
          >
            <span className="text-xs sm:text-sm font-bold tracking-wide">איפוס</span>
          </button>
        ) : (
          <div className="w-full aspect-square" />
        )}

        {/* Bottom Center: 0 */}
        <button
          type="button"
          onClick={() => handleDigitTap('0')}
          className={`w-full aspect-square rounded-full flex items-center justify-center text-2xl sm:text-3xl font-extrabold transition-all duration-150 shadow-md cursor-pointer backdrop-blur-md ${
            pressedKey === '0'
              ? 'bg-white text-zinc-950 border-2 border-white scale-90 shadow-[0_0_24px_rgba(255,255,255,0.6)]'
              : 'bg-white/[0.08] hover:bg-white/[0.18] active:bg-white/30 text-white border border-white/15 active:border-white/40 active:scale-90'
          }`}
        >
          0
        </button>

        {/* Bottom Right: Prominent, High-Contrast Backspace Button */}
        <button
          type="button"
          onClick={handleBackspace}
          disabled={pin.length === 0}
          aria-label="מחק ספרה אחרונה"
          className={`w-full aspect-square rounded-full flex flex-col items-center justify-center transition-all duration-150 shadow-lg select-none backdrop-blur-md ${
            pin.length > 0
              ? pressedKey === 'backspace'
                ? 'bg-white text-zinc-950 border-2 border-white scale-90 shadow-[0_0_24px_rgba(255,255,255,0.6)]'
                : 'bg-white/[0.12] hover:bg-white/[0.22] active:bg-white/35 border-2 border-white/30 text-white shadow-md active:scale-90 cursor-pointer'
              : 'bg-white/[0.03] border border-white/10 text-gray-600 opacity-30 cursor-not-allowed'
          }`}
        >
          <div className="-translate-x-0.5">
            <Delete size={26} className="transition-transform" />
          </div>
          <span className="text-[10px] font-black tracking-tight mt-0.5">מחק</span>
        </button>
      </div>
    </div>
  );
}
