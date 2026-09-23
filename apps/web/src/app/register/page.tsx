'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
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
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1 text-sm dark:bg-slate-800">
        {(['BUYER', 'VENDOR'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded px-3 py-1.5 font-medium ${role === r ? 'bg-white shadow dark:bg-slate-900' : 'text-slate-500'}`}
          >
            {r === 'BUYER' ? 'I want to buy' : 'I want to sell'}
          </button>
        ))}
      </div>

      <Field label="Full name">
        <Input value={form.name} onChange={set('name')} required minLength={2} autoComplete="name" />
      </Field>
      {role === 'VENDOR' && (
        <Field label="Store name" hint="Shown publicly on your storefront">
          <Input value={form.storeName} onChange={set('storeName')} required minLength={2} />
        </Field>
      )}
      <Field label="Email">
        <Input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <Input type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
      </Field>
      <Button type="submit" loading={loading} className="w-full">
        Create account
      </Button>
      <p className="text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link href="/login" className="text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Create your account</h1>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
