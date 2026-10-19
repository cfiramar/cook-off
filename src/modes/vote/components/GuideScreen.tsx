import { motion } from 'framer-motion';

interface Props {
  onNext: () => void;
}

export default function GuideScreen({ onNext }: Props) {
  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden p-4 sm:p-6 text-center select-none">
      {/* Fixed Header */}
      <div className="shrink-0 pt-2 pb-4">
        <h2 className="text-2xl sm:text-3xl font-black text-theme-primary drop-shadow-md">
          איך מצביעים?
        </h2>
      </div>

      {/* Scrollable Instructions Container (scrolls internally only if height is insufficient) */}
      <div className="flex-1 min-h-0 overflow-y-auto w-full max-w-md mx-auto text-right overscroll-contain pr-0.5">
        <div className="space-y-4 sm:space-y-5 bg-black/60 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-gray-800 shadow-xl">
          <motion.div
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-start gap-3.5"
          >
            <div className="bg-theme-secondary text-white w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 font-bold mt-0.5 text-sm sm:text-base shadow-sm">
              1
            </div>
            <div className="flex-1 text-right">
              <p className="text-base sm:text-lg leading-snug">
                התחברו למערכת: חפשו את שמכם, והזינו את <strong className="text-theme-primary">4 הספרות האחרונות</strong> של מספר הטלפון שלכם.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-start gap-3.5"
          >
            <div className="bg-theme-secondary text-white w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 font-bold mt-0.5 text-sm sm:text-base shadow-sm">
              2
            </div>
            <p className="text-base sm:text-lg leading-snug">
              עליכם לבחור את <strong className="text-theme-primary">המקום הראשון</strong> ואת <strong className="text-theme-primary">המקום השני</strong> שלכם.
            </p>
          </motion.div>

          <motion.div
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-start gap-3.5"
          >
            <div className="bg-theme-secondary text-white w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 font-bold mt-0.5 text-sm sm:text-base shadow-sm">
              3
            </div>
            <p className="text-base sm:text-lg leading-snug">
              לחיצה ראשונה על מנה תבחר בה כמקום ראשון, ולחיצה שנייה על מנה אחרת תבחר בה כמקום שני.
            </p>
          </motion.div>

          <motion.div
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-start gap-3.5"
          >
            <div className="bg-theme-secondary text-white w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 font-bold mt-0.5 text-sm sm:text-base shadow-sm">
              4
            </div>
            <p className="text-base sm:text-lg leading-snug text-red-400 font-medium">
              שימו לב: אינכם יכולים להצביע למנה שהכנתם בעצמכם או למנות שהוגדרו מחוץ לתחרות!
            </p>
          </motion.div>
        </div>
      </div>

      {/* Fixed Bottom Action Button */}
      <div className="shrink-0 pt-4 pb-2 w-full max-w-md mx-auto">
        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          onClick={onNext}
          className="btn-primary w-full py-3.5 text-lg sm:text-xl font-bold shadow-lg cursor-pointer"
        >
          הבנתי, בואו נתחיל!
        </motion.button>
      </div>
    </div>
  );
}
