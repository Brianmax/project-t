// ── Form inputs ────────────────────────────────────────────────────────────────

export const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-on-surface ' +
  'placeholder:text-on-surface-faint outline-none transition-all duration-200 ' +
  'hover:border-on-surface-ghost focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 ' +
  'dark:focus:ring-primary-400/15 ' +
  'disabled:bg-surface-alt disabled:text-on-surface-faint disabled:cursor-not-allowed';

export const labelCls =
  'block text-[13px] font-semibold text-on-surface-medium mb-1.5 tracking-wide';

// ── Buttons ────────────────────────────────────────────────────────────────────

export const btnPrimaryCls =
  'w-full py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 active:scale-[0.99] ' +
  'disabled:bg-surface-raised disabled:text-on-surface-faint disabled:cursor-not-allowed ' +
  'text-white text-sm font-semibold rounded-xl ' +
  'shadow-sm shadow-primary-600/20 hover:shadow-md hover:shadow-primary-600/25 ' +
  'transition-all duration-150 cursor-pointer';

// Alias kept for backward compatibility
export { btnPrimaryCls as btnCls };

export const btnSecondaryCls =
  'py-2.5 px-4 border border-border text-on-surface-medium text-sm font-medium rounded-xl ' +
  'hover:bg-surface-alt hover:text-on-surface hover:border-border-ring active:scale-[0.99] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer';

export const btnDangerCls =
  'py-2.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-[0.99] ' +
  'text-white text-sm font-semibold rounded-xl ' +
  'shadow-sm shadow-red-600/20 hover:shadow-md hover:shadow-red-600/25 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer';

// ── Cards ──────────────────────────────────────────────────────────────────────

export const cardCls =
  'bg-surface rounded-2xl border border-border p-5 ' +
  'hover:shadow-lg hover:shadow-shadow hover:-translate-y-0.5 transition-all duration-200';
