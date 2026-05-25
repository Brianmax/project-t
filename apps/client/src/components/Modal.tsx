import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xl backdrop-saturate-150 animate-fade-in p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className={cn(
          'bg-surface rounded-2xl shadow-2xl shadow-black/25',
          'w-full max-w-[462px]',
          'max-h-[calc(100vh-2rem)] sm:max-h-[88vh]',
          'flex flex-col animate-slide-up',
          'ring-1 ring-black/[0.06] dark:ring-white/[0.06] overflow-hidden',
        )}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-5 border-b border-border">
          <h3 className="text-[15px] font-bold text-on-surface tracking-tight">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-faint hover:text-on-surface-medium hover:bg-surface-raised active:scale-95 transition-all duration-150"
            aria-label="Cerrar"
          >
            <X size={17} />
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
