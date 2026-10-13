import React from 'react';
import { useToast } from '../../context/ToastContext';
import { CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-3 ${
              isSuccess
                ? 'bg-white/95 border-[#F4ACB7] text-[#2B1810]'
                : isWarning
                ? 'bg-[#FFF7ED] border-[#FDBA74] text-[#7C2D12]'
                : 'bg-white/95 border-[#E8DDD7] text-[#2B1810]'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle className="w-5 h-5 text-[#D86A7F]" />}
              {isWarning && <AlertTriangle className="w-5 h-5 text-amber-500" />}
              {!isSuccess && !isWarning && <Info className="w-5 h-5 text-[#C5A059]" />}
            </div>

            <div className="flex-1 text-sm font-medium leading-relaxed">
              {toast.message}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-stone-400 hover:text-stone-700 transition-colors p-0.5"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
