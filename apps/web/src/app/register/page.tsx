'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { useAuth } from '@/components/auth-provider';
import { Alert, Button, Field, Input } from '@/components/ui';
import { useT } from '@/i18n/client';
import { ApiError } from '@/lib/api';

function RegisterForm() {
  const { register } = useAuth();
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<'BUYER' | 'VENDOR'>(
    params.get('role') === 'VENDOR' ? 'VENDOR' : 'BUYER',
  );
  const [form, setForm] = useState({ name: '', email: '', password: '', storeName: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register({ ...form, role, storeName: role === 'VENDOR' ? form.storeName : undefined });
      const plan = params.get('plan');
      router.push(role === 'VENDOR' ? `/vendor/subscription${plan ? `?plan=${plan}` : ''}` : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-navy-900">
          {role === 'VENDOR' ? t('auth.registerTitleSeller') : t('auth.registerTitleBuyer')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {role === 'VENDOR' ? t('auth.registerSubtitleSeller') : t('auth.registerSubtitleBuyer')}
        </p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1 text-sm">
        {(['BUYER', 'VENDOR'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-full px-3 py-2 font-semibold transition ${role === r ? 'bg-brand-500 text-white shadow' : 'text-slate-500 hover:text-navy-900'}`}
          >
            {r === 'BUYER' ? t('auth.wantBuy') : t('auth.wantSell')}
          </button>
        ))}
      </div>

      <Field label={t('auth.fullName')}>
        <Input
          value={form.name}
          onChange={set('name')}
          required
          minLength={2}
          autoComplete="name"
        />
      </Field>
      {role === 'VENDOR' && (
        <Field label={t('auth.storeName')} hint={t('auth.storeNameHint')}>
          <Input value={form.storeName} onChange={set('storeName')} required minLength={2} />
        </Field>
      )}
      <Field label={t('auth.email')}>
        <Input
          type="email"
          value={form.email}
          onChange={set('email')}
          required
          autoComplete="email"
        />
      </Field>
      <Field label={t('auth.password')} hint={t('auth.passwordHint')}>
        <Input
          type="password"
          value={form.password}
          onChange={set('password')}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
      <Button type="submit" loading={loading} className="w-full" size="lg" arrow>
        {role === 'VENDOR' ? t('auth.registerSubmitSeller') : t('auth.registerSubmitBuyer')}
      </Button>
      <p className="text-center text-sm text-slate-500">
        {t('auth.alreadyRegistered')}{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          {t('common.signIn')}
        </Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  const t = useT();
  return (
    <AuthLayout
      title={t('auth.registerSideTitle')}
      subtitle={t('auth.registerSideText')}
      bullets={[t('auth.registerBullet1'), t('auth.registerBullet2'), t('auth.registerBullet3')]}
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthLayout>
  );
}
