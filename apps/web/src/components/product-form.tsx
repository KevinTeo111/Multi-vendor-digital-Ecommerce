'use client';

import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui';
import type { Category, VendorProduct } from '@/lib/types';

export interface ProductFormValues {
  title: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  demoUrl?: string;
  version?: string;
  tags?: string[];
}

export function ProductForm({
  categories,
  initial,
  onSubmit,
  busy,
  error,
  submitLabel = 'Save',
}: {
  categories: Category[];
  initial?: Partial<VendorProduct>;
  onSubmit: (values: ProductFormValues) => void;
  busy?: boolean;
  error?: string | null;
  submitLabel?: string;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    categoryId: initial?.categoryId ?? categories[0]?.id ?? '',
    shortDescription: initial?.shortDescription ?? '',
    description: initial?.description ?? '',
    price: initial ? (initial.priceCents ?? 0) / 100 : 0,
    demoUrl: initial?.demoUrl ?? '',
    version: initial?.version ?? '',
    tags: (initial?.tags ?? []).join(', '),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: form.title,
      categoryId: form.categoryId,
      shortDescription: form.shortDescription,
      description: form.description,
      priceCents: Math.round(Number(form.price) * 100),
      demoUrl: form.demoUrl || undefined,
      version: form.version || undefined,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Title">
        <Input value={form.title} onChange={set('title')} required minLength={3} maxLength={140} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <Select value={form.categoryId} onChange={set('categoryId')} required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Price" hint="0 for free products">
          <Input type="number" min={0} step="0.01" value={form.price} onChange={set('price')} required />
        </Field>
      </div>
      <Field label="Short description" hint="Shown in listings, 10 to 300 characters">
        <Input value={form.shortDescription} onChange={set('shortDescription')} required minLength={10} maxLength={300} />
      </Field>
      <Field label="Full description">
        <Textarea value={form.description} onChange={set('description')} required minLength={20} rows={10} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Demo URL (optional)">
          <Input type="url" value={form.demoUrl} onChange={set('demoUrl')} placeholder="https://" />
        </Field>
        <Field label="Version (optional)">
          <Input value={form.version} onChange={set('version')} placeholder="1.0.0" />
        </Field>
        <Field label="Tags" hint="Comma separated">
          <Input value={form.tags} onChange={set('tags')} placeholder="react, template" />
        </Field>
      </div>
      <Button type="submit" loading={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
