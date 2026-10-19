import { motion } from 'framer-motion';

import type { EventInfo } from '../../../hooks/useFirebaseData';

interface Props {
  onNext: () => void;
  eventInfo: EventInfo | null;
}

export default function WelcomeScreen({ onNext, eventInfo }: Props) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center p-6 text-center h-full relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="z-10"
      >
        <h1 className="text-5xl md:text-7xl font-theme-main text-theme-primary mb-6 drop-shadow-lg">
          {eventInfo?.title || 'ברוכים הבאים'}
        </h1>
        <div className="bg-black/60 backdrop-blur-md px-8 py-4 rounded-2xl inline-block mb-12 border border-white/10 shadow-xl">
          <h2 className="text-3xl md:text-4xl font-bold text-theme-secondary drop-shadow-lg">
            {eventInfo?.subtitle || ''}
          </h2>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onNext}
          className="btn-primary text-xl px-12 py-4 animate-pulse hover:animate-none"
        >
          {eventInfo?.startButtonText || 'התחלה'}
        </motion.button>
      </motion.div>
      
      {/* Decorative background elements can go here if needed */}
    </div>
  );
}
