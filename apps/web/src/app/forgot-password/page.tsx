'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { Alert, Button, Field, Input } from '@/components/ui';
import { useT } from '@/i18n/client';
import { api, ApiError } from '@/lib/api';

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email }, auth: false });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.forgotFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.loginSideTitle')}
      subtitle={t('auth.loginSideText')}
      bullets={[t('auth.loginBullet1'), t('auth.loginBullet2'), t('auth.loginBullet3')]}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-navy-900">{t('auth.forgotTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('auth.forgotSubtitle')}</p>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        {sent ? (
          <Alert tone="success">{t('auth.forgotSent')}</Alert>
        ) : (
          <>
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
            <Button type="submit" loading={loading} className="w-full" size="lg" arrow>
              {t('auth.forgotSubmit')}
            </Button>
          </>
        )}
        <p className="text-center text-sm">
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
