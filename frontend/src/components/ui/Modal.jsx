// src/components/ui/Modal.jsx
import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, children, ariaLabel = 'Dialog' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-label={ariaLabel}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      {/* panel */}
      <div className="relative max-h-[90vh] w-[min(1000px,92vw)] rounded-2xl bg-[rgb(18,18,18)] ring-1 ring-zinc-800 shadow-xl overflow-hidden">
       {/* close button */}
       <button
          onClick={onClose}
          className="absolute right-4 top-4 z-50
             w-10 h-10 flex items-center justify-center
             rounded-full bg-zinc-700 hover:bg-zinc-600
             text-white font-bold text-xl shadow-lg"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
       <div className="max-h-[90vh] overflow-y-auto">{children}</div>
     </div>
    </div>
  );
}
