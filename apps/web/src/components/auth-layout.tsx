'use client';

import type { ReactNode } from 'react';
import { CheckIcon } from './icons';
import { Logo } from './logo';

export function AuthLayout({
  title,
  subtitle,
  bullets,
  children,
}: {
  title: string;
  subtitle: string;
  bullets: string[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:items-center">
      <section className="bg-hero hidden rounded-3xl p-10 text-white lg:block">
        <Logo light />
        <h1 className="mt-10 text-4xl font-extrabold leading-tight tracking-tight">{title}</h1>
        <p className="mt-4 max-w-md text-slate-300">{subtitle}</p>
        <ul className="mt-8 space-y-3 text-sm text-slate-200">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/30 text-cyan-400">
                <CheckIcon size={14} />
              </span>
              {b}
            </li>
          ))}
        </ul>
      </section>
      <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-card">
        {children}
      </section>
    </div>
  );
}
