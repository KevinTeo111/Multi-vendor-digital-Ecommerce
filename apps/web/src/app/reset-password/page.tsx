'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { Alert, Button, Field, Input } from '@/components/ui';
import { useT } from '@/i18n/client';
import { api, ApiError, clearTokens } from '@/lib/api';

function ResetForm() {
  const t = useT();
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t('auth.passwordsMismatch'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { token, password },
        auth: false,
      });
      // Every session was revoked on the server; drop this browser's tokens too.
      clearTokens();
      router.push('/login?reset=1');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-navy-900">{t('auth.resetTitle')}</h2>
        <Alert tone="error">{t('auth.resetMissingToken')}</Alert>
        <Button onClick={() => router.push('/forgot-password')} className="w-full" arrow>
          {t('auth.requestNewLink')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-navy-900">{t('auth.resetTitle')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('auth.resetSubtitle')}</p>
      </div>
      {error && (
        <Alert tone="error">
          {error}{' '}
          <Link href="/forgot-password" className="font-semibold underline">
            {t('auth.requestNewLink')}
          </Link>
        </Alert>
      )}
      <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />
      </Field>
      <Field label={t('auth.confirmPassword')}>
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />
      </Field>
      <Button type="submit" loading={loading} className="w-full" size="lg" arrow>
        {t('auth.resetSubmit')}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useT();
  return (
    <AuthLayout
      title={t('auth.loginSideTitle')}
      subtitle={t('auth.loginSideText')}
      bullets={[t('auth.loginBullet1'), t('auth.loginBullet2'), t('auth.loginBullet3')]}
    >
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}
