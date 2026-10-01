'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PageContainer } from '@/components/page-container';
import { RequireRole } from '@/components/require-role';
import { useToast } from '@/components/toasts';
import { Alert, Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { useT } from '@/i18n/client';
import { api, ApiError, setTokens } from '@/lib/api';

function ChangePasswordForm() {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError(t('auth.passwordsMismatch'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // The server revokes every session and hands this one a fresh pair.
      const tokens = await api<{ accessToken: string; refreshToken: string }>(
        '/auth/change-password',
        { method: 'POST', body: { currentPassword: current, newPassword: next } },
      );
      setTokens(tokens);
      // The toast lives in the root layout, so the confirmation survives the navigation.
      toast.push(t('auth.changeDone'), { tone: 'success' });
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.changeFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title={t('auth.changeTitle')} description={t('auth.changeSubtitle')} />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label={t('auth.currentPassword')}>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}>
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
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
          <Button type="submit" loading={loading} className="w-full" arrow>
            {t('auth.changeSubmit')}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <RequireRole roles={['BUYER', 'VENDOR', 'ADMIN']}>
      <PageContainer>
        <ChangePasswordForm />
      </PageContainer>
    </RequireRole>
  );
}
