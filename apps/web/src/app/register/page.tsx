'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { useAuth } from '@/components/auth-provider';
import { Alert, Button, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<'BUYER' | 'VENDOR'>(params.get('role') === 'VENDOR' ? 'VENDOR' : 'BUYER');
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
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{role === 'VENDOR' ? 'Create seller account' : 'Create your account'}</h2>
        <p className="mt-1 text-sm text-slate-500">{role === 'VENDOR' ? 'Open your store in under a minute.' : 'Buy and download digital products instantly.'}</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm">
        {(['BUYER', 'VENDOR'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-lg px-3 py-2 font-semibold transition ${role === r ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {r === 'BUYER' ? 'I want to buy' : 'I want to sell'}
          </button>
        ))}
      </div>

      <Field label="Full name">
        <Input value={form.name} onChange={set('name')} required minLength={2} autoComplete="name" placeholder="Jane Doe" />
      </Field>
      {role === 'VENDOR' && (
        <Field label="Store name" hint="Shown publicly on your storefront">
          <Input value={form.storeName} onChange={set('storeName')} required minLength={2} placeholder="Creative Studio" />
        </Field>
      )}
      <Field label="Email">
        <Input type="email" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="you@example.com" />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <Input type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" placeholder="Create a strong password" />
      </Field>
      <Button type="submit" loading={loading} className="w-full" size="lg">
        {role === 'VENDOR' ? 'Create seller account' : 'Create account'}
      </Button>
      <p className="text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Join our growing community of creators."
      subtitle="Sell your digital products, reach buyers worldwide, and manage everything from one dashboard."
      bullets={['Keep the majority of every sale', 'Automatic delivery after payment', 'Easy-to-use seller dashboard']}
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthLayout>
  );
}
