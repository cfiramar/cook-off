import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

type ModalType = 'alert' | 'confirm';

interface ModalOptions {
  type: ModalType;
  title?: string;
  message: string;
  onConfirm?: () => void;
}

interface ToastItem {
  id: string;
  title?: string;
  message: string;
}

interface PopupContextType {
  showAlert: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

export function PopupProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalOptions | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Show error/alert modal - only interrupts user when action failed or needs confirmation
  const showAlert = (message: string, title?: string) => setModal({ type: 'alert', message, title });

  // Confirmation modal
  const showConfirm = (message: string, onConfirm: () => void, title?: string) => setModal({ type: 'confirm', message, onConfirm, title });

  // Non-blocking Toast that slides in from the bottom for successful actions
  const showSuccess = (message: string, title?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts(prev => [...prev, { id, title, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const closeModal = () => setModal(null);

  const handleConfirm = () => {
    if (modal?.onConfirm) modal.onConfirm();
    closeModal();
  };

  return (
    <PopupContext.Provider value={{ showAlert, showSuccess, showConfirm }}>
      {children}

      {/* Floating Success Toasts at Bottom of Page (Centered & Mobile-Optimized) */}
      <div 
        className="fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 max-w-sm w-[92vw] pointer-events-none"
        dir="rtl"
      >
        {toasts.map(toast => (
          <ToastCard 
            key={toast.id} 
            toast={toast} 
            onDismiss={() => removeToast(toast.id)} 
          />
        ))}
      </div>

      {/* Error / Confirm Modal - Only interrupts for failure or confirmation */}
      {modal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer" 
          dir="rtl"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-sm w-full relative transform transition-all animate-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={closeModal} 
              className="absolute top-4 left-4 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="flex flex-col items-center text-center mt-2">
              {modal.type === 'alert' && <AlertCircle size={48} className="text-red-500 mb-4" />}
              {modal.type === 'confirm' && <AlertCircle size={48} className="text-orange-500 mb-4" />}
              
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {modal.title || (modal.type === 'alert' ? 'שגיאה' : 'אישור פעולה')}
              </h3>
              <p className="text-gray-600 mb-8 text-sm leading-relaxed">{modal.message}</p>
              
              <div className="flex gap-3 w-full">
                {modal.type === 'confirm' ? (
                  <>
                    <button 
                      onClick={closeModal}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-xl transition-colors text-sm"
                    >
                      ביטול
                    </button>
                    <button 
                      onClick={handleConfirm}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors text-sm shadow-md"
                    >
                      אישור
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={closeModal}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-colors text-sm shadow-md"
                  >
                    הבנתי
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PopupContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 1800);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div 
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      className="pointer-events-auto cursor-pointer select-none bg-gray-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-gray-700/60 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 fade-in duration-200 transform transition-all active:scale-95 hover:border-gray-500 w-full"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 size={18} />
        </div>
        <div>
          {toast.title && <div className="text-xs font-bold text-emerald-400">{toast.title}</div>}
          <div className="text-xs font-medium text-gray-100 leading-snug">{toast.message}</div>
        </div>
      </div>

      <div className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
        <X size={14} />
      </div>
    </div>
  );
}

export const usePopup = () => {
  const context = useContext(PopupContext);
  if (!context) throw new Error('usePopup must be used within PopupProvider');
  return context;
};
