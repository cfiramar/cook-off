import React from 'react';

interface ViewSplashOverlayProps {
  isFadingOut: boolean;
}

export const ViewSplashOverlay: React.FC<ViewSplashOverlayProps> = ({ isFadingOut }) => {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030712] select-none transition-opacity duration-600 ease-out pointer-events-none ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      {/* Background ambient lighting */}
      <div className="absolute w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute w-[300px] h-[300px] bg-orange-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Centered App Icon with glow and pulse */}
      <div className="relative flex flex-col items-center justify-center">
        <div className="relative group">
          {/* Subtle outer glow matching icon's flame & purple gradient */}
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-orange-500 rounded-[2.5rem] blur-xl opacity-60 animate-pulse" />
          
          <img
            src="/icon.png"
            alt="Cook-Off"
            className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 object-contain rounded-[2rem] shadow-2xl drop-shadow-[0_15px_35px_rgba(0,0,0,0.8)]"
          />
        </div>
      </div>
    </div>
  );
};

export default ViewSplashOverlay;
