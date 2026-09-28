import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/*
  Shared "what do you want to create?" glass sheet — the single source of visual truth for BOTH
  entry points (home screen "+" via CreateModal, map "+" via MapCreateActionSheet), so they always
  look identical. Apple "Liquid Glass" treatment: a frosted, layered sheet with a warm backlight,
  a vivid tinted-glass primary tile, true frosted-glass secondary tiles, and a native-style
  separate glass "ביטול" pill. Springs in/out via framer-motion (AnimatePresence handles the exit).
*/

export interface CreateActionSheetOption {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  primary?: boolean;
  onClick: () => void;
}

interface CreateActionSheetShellProps {
  isOpen: boolean;
  title: string;
  options: CreateActionSheetOption[];
  onClose: () => void;
}

const sheetSpring = { type: 'spring' as const, stiffness: 340, damping: 34 };

export function CreateActionSheetShell({ isOpen, title, options, onClose }: CreateActionSheetShellProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          dir="rtl"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          style={{ background: 'rgba(10,8,6,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        >
          <motion.div
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%', scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: '100%', scale: 0.98 }}
            transition={sheetSpring}
          >
            {/* Warm backlight glow bleeding up behind the glass — sells the "lit from within" look. */}
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                left: '10%', right: '10%', bottom: 0, height: 160,
                background: 'radial-gradient(60% 100% at 50% 100%, rgba(249,115,22,0.30) 0%, transparent 75%)',
                filter: 'blur(24px)', zIndex: -1,
              }}
            />

            <div
              className="w-full rounded-t-[32px] overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.78)',
                backdropFilter: 'blur(38px) saturate(190%)',
                WebkitBackdropFilter: 'blur(38px) saturate(190%)',
                border: '1px solid rgba(255,255,255,0.6)',
                borderBottom: 'none',
                boxShadow: '0 -24px 70px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.9)',
                paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
              }}
            >
              {/* grabber */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1.5 rounded-full" style={{ background: 'rgba(17,24,39,0.14)' }} />
              </div>

              {/* header */}
              <div className="flex items-center justify-between px-6 pt-2 pb-5">
                <h2 className="text-[22px] font-black" style={{ color: '#111827', fontFamily: 'Heebo, sans-serif' }}>
                  {title}
                </h2>
                <motion.button
                  onClick={onClose}
                  aria-label="סגור"
                  whileTap={{ scale: 0.9 }}
                  className="w-9 h-9 flex items-center justify-center rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    touchAction: 'manipulation',
                  }}
                >
                  <X className="w-[18px] h-[18px]" style={{ color: '#4B5563' }} strokeWidth={2.2} />
                </motion.button>
              </div>

              <div className="px-5 space-y-3">
                {options.map((opt, i) => (
                  <motion.button
                    key={opt.key}
                    onClick={opt.onClick}
                    whileTap={{ scale: 0.975 }}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...sheetSpring, delay: 0.05 + i * 0.06 }}
                    className="relative w-full p-5 rounded-[26px] overflow-hidden text-right"
                    style={opt.primary
                      ? {
                          background: 'linear-gradient(135deg, rgba(251,146,60,0.96), rgba(234,88,12,0.98))',
                          backdropFilter: 'blur(20px) saturate(180%)',
                          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                          boxShadow: '0 14px 34px rgba(234,88,12,0.4), inset 0 1.5px 0 rgba(255,255,255,0.55)',
                          border: '1px solid rgba(255,255,255,0.25)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.58)',
                          backdropFilter: 'blur(24px) saturate(180%)',
                          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                          border: '1px solid rgba(255,255,255,0.75)',
                          boxShadow: '0 8px 22px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
                        }}
                  >
                    {/* glass sheen sweep on the primary tile only */}
                    {opt.primary && (
                      <motion.span
                        aria-hidden
                        className="absolute top-0 bottom-0 w-1/3 pointer-events-none"
                        style={{ background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.4), transparent)' }}
                        animate={{ x: ['-160%', '260%'] }}
                        transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }}
                      />
                    )}

                    <div className="relative flex items-center gap-4">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={opt.primary
                          ? { background: 'rgba(255,255,255,0.24)', border: '1px solid rgba(255,255,255,0.35)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }
                          : { background: 'rgba(249,115,22,0.14)', border: '1px solid rgba(249,115,22,0.16)' }}
                      >
                        <opt.icon
                          className="w-7 h-7"
                          style={{ color: opt.primary ? '#fff' : '#F97316' }}
                          strokeWidth={2.3}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className="text-[18px] font-black mb-0.5"
                          style={{ color: opt.primary ? '#fff' : '#111827', fontFamily: 'Heebo, sans-serif' }}
                        >
                          {opt.title}
                        </h3>
                        <p
                          className="text-[13px]"
                          style={{ color: opt.primary ? 'rgba(255,255,255,0.92)' : '#6B7280', fontFamily: 'Rubik, sans-serif' }}
                        >
                          {opt.subtitle}
                        </p>
                      </div>
                      <ChevronLeft
                        className="w-5 h-5 flex-shrink-0"
                        style={{ color: opt.primary ? 'rgba(255,255,255,0.75)' : '#D1D5DB' }}
                        strokeWidth={2.5}
                      />
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Native-style separate glass "Cancel" pill */}
              <motion.button
                onClick={onClose}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...sheetSpring, delay: 0.05 + options.length * 0.06 }}
                className="block w-full mt-4 mx-auto"
                style={{ maxWidth: 'calc(100% - 40px)' }}
              >
                <div
                  className="w-full py-3.5 rounded-2xl font-bold text-center"
                  style={{
                    color: '#374151', fontFamily: 'Heebo, sans-serif',
                    background: 'rgba(255,255,255,0.55)',
                    border: '1px solid rgba(255,255,255,0.75)',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                  }}
                >
                  ביטול
                </div>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
