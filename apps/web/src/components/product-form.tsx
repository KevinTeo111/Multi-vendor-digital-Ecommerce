'use client';

import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { useT } from '@/i18n/client';
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
  submitLabel,
}: {
  categories: Category[];
  initial?: Partial<VendorProduct>;
  onSubmit: (values: ProductFormValues) => void;
  busy?: boolean;
  error?: string | null;
  submitLabel?: string;
}) {
  const t = useT();
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

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
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
        .map((x) => x.trim())
        .filter(Boolean),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={t('vendor.formTitle')}>
        <Input value={form.title} onChange={set('title')} required minLength={3} maxLength={140} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('vendor.formCategory')}>
          <Select value={form.categoryId} onChange={set('categoryId')} required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('vendor.formPrice')} hint={t('vendor.formPriceHint')}>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.price}
            onChange={set('price')}
            required
          />
        </Field>
      </div>
      <Field label={t('vendor.formShort')} hint={t('vendor.formShortHint')}>
        <Input
          value={form.shortDescription}
          onChange={set('shortDescription')}
          required
          minLength={10}
          maxLength={300}
        />
      </Field>
      <Field label={t('vendor.formDescription')}>
        <Textarea
          value={form.description}
          onChange={set('description')}
          required
          minLength={20}
          rows={10}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('vendor.formDemo')}>
          <Input type="url" value={form.demoUrl} onChange={set('demoUrl')} placeholder="https://" />
        </Field>
        <Field label={t('vendor.formVersion')}>
          <Input value={form.version} onChange={set('version')} placeholder="1.0.0" />
        </Field>
        <Field label={t('vendor.formTags')} hint={t('vendor.formTagsHint')}>
          <Input value={form.tags} onChange={set('tags')} placeholder="react, template" />
        </Field>
      </div>
      <Button type="submit" loading={busy} arrow>
        {submitLabel ?? t('common.save')}
      </Button>
    </form>
  );
}
