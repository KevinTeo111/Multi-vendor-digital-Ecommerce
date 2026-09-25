'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { useAuth } from '@/components/auth-provider';
import { Alert, Button, Field, Input } from '@/components/ui';
import { useT } from '@/i18n/client';
import { ApiError } from '@/lib/api';

function LoginForm() {
  const { login } = useAuth();
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(email, password);
      const next = params.get('next');
      router.push(
        next ?? (user.role === 'ADMIN' ? '/admin' : user.role === 'VENDOR' ? '/vendor' : '/'),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-navy-900">{t('auth.loginTitle')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('auth.loginSubtitle')}</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={t('auth.email')}>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="voce@exemplo.com"
        />
      </Field>
      <Field label={t('auth.password')}>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </Field>
      <Button type="submit" loading={loading} className="w-full" size="lg" arrow>
        {t('auth.loginSubmit')}
      </Button>
      <p className="text-center text-sm text-slate-500">
        {t('auth.noAccount')}{' '}
        <Link href="/register" className="font-semibold text-brand-600 hover:underline">
          {t('auth.createOne')}
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  const t = useT();
  return (
    <AuthLayout
      title={t('auth.loginSideTitle')}
      subtitle={t('auth.loginSideText')}
      bullets={[t('auth.loginBullet1'), t('auth.loginBullet2'), t('auth.loginBullet3')]}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
