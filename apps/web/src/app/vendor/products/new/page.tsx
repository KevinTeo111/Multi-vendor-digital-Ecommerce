'use client';

import { useRouter } from 'next/navigation';
import { ProductForm, type ProductFormValues } from '@/components/product-form';
import { Card, Loading, PageHeader } from '@/components/ui';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import type { Category, VendorProduct } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

export default function NewProductPage() {
  const router = useRouter();
  const t = useT();
  const categories = useFetch<Category[]>('/categories');
  const action = useAction();

  const create = async (values: ProductFormValues) => {
    const product = await action.run(() => api<VendorProduct>('/vendor/products', { method: 'POST', body: values }));
    if (product) router.push(`/vendor/products/${product.id}`);
  };

  if (!categories.data) return <Loading />;

  return (
    <div>
      <PageHeader title={t('vendor.newProductTitle')} description={t('vendor.newProductDescription')} />
      <Card>
        <ProductForm categories={categories.data} onSubmit={create} busy={action.busy} error={action.error} submitLabel={t('vendor.createDraft')} />
      </Card>
    </div>
  );
}
