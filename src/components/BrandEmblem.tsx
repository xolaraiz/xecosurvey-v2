import React, { useState } from 'react';
import { ShieldCheck, Sun } from 'lucide-react';

interface BrandEmblemProps {
  variant: 'xolaraiz' | 'xeco' | 'crixiszafe';
  className?: string;
}

const BASE = import.meta.env.BASE_URL || '/';

const EMBLEM_CONFIG = {
  xolaraiz: {
    src: `${BASE}assets/aistudio/1795001766217_50c5de98.png`,
    alt: 'XOLARAIZ™ — Save Bills, Save Beings, Going Net Zero',
    fallbackLabel: 'XOLARAIZ™',
  },
  xeco: {
    src: `${BASE}assets/aistudio/XECO_Solar_45eb0890.jpg`,
    alt: 'XECO Solar — Excellent & Economical Smart Solar Solutions',
    fallbackLabel: 'XECO Solar',
  },
  crixiszafe: {
    src: `${BASE}assets/aistudio/CriXisZafe__b7ee4039.jpg`,
    alt: 'CriXisZafe™ — Caring for the Planet, Safeguarding Families',
    fallbackLabel: 'CriXisZafe™',
  },
};

export const BrandEmblem: React.FC<BrandEmblemProps> = ({ variant, className = 'w-12 h-12' }) => {
  const [errored, setErrored] = useState(false);
  const cfg = EMBLEM_CONFIG[variant];

  if (errored) {
    return (
      <div
        className={`${className} rounded-full bg-slate-900 text-amber-400 border border-amber-500/40 flex flex-col items-center justify-center p-1 text-center shrink-0`}
        aria-label={cfg.alt}
      >
        {variant === 'crixiszafe' ? (
          <ShieldCheck className="w-5 h-5" />
        ) : (
          <Sun className="w-5 h-5" />
        )}
        <span className="text-[9px] font-semibold leading-tight mt-0.5">{cfg.fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      src={cfg.src}
      alt={cfg.alt}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={`${className} rounded-full object-cover border border-amber-500/30 bg-slate-950 shrink-0`}
    />
  );
};
