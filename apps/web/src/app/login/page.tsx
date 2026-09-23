'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { useAuth } from '@/components/auth-provider';
import { Alert, Button, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';

function LoginForm() {
  const { login } = useAuth();
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
      router.push(next ?? (user.role === 'ADMIN' ? '/admin' : user.role === 'VENDOR' ? '/vendor' : '/'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
        <p className="mt-1 text-sm text-slate-500">Sign in to your account to continue.</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
      </Field>
      <Field label="Password">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" />
      </Field>
      <Button type="submit" loading={loading} className="w-full" size="lg">
        Sign in
      </Button>
      <p className="text-center text-sm text-slate-500">
        No account?{' '}
        <Link href="/register" className="font-semibold text-brand-600 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout
      title="Your digital products, one place."
      subtitle="Buy once and download forever, or open your own store and start earning from your work."
      bullets={['Instant, protected downloads', 'Every listing reviewed by our team', 'Secure payments']}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
