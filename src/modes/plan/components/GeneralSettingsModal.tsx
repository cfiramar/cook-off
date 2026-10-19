import GeneralSettings from './GeneralSettings';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'household' | 'themes' | 'key';
}

export default function GeneralSettingsModal({ isOpen, onClose, initialTab = 'household' }: Props) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 md:p-6 cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="bg-gray-50 rounded-3xl shadow-2xl border border-gray-100 w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto admin-scroll p-4 sm:p-6 md:p-8" dir="ltr">
          <div dir="rtl" className="w-full">
            <GeneralSettings initialTab={initialTab} onClose={onClose} isModal={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
