'use client';

import { CouponManager } from '@/components/coupon-manager';
import { Loading, PageHeader } from '@/components/ui';
import { useT } from '@/i18n/client';
import type { AdminVendor, Paginated, VendorProduct } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

export default function AdminCouponsPage() {
  const t = useT();
  const products = useFetch<Paginated<VendorProduct>>('/admin/products', {
    status: 'APPROVED',
    pageSize: 100,
  });
  const sellers = useFetch<Paginated<AdminVendor>>('/admin/vendors', {
    status: 'ACTIVE',
    pageSize: 100,
  });

  return (
    <div>
      <PageHeader title={t('coupon.title')} description={t('coupon.adminDescription')} />
      {!products.data || !sellers.data ? (
        <Loading />
      ) : (
        <CouponManager
          basePath="/admin/coupons"
          products={products.data.items.map((p) => ({
            id: p.id,
            label: p.vendor ? `${p.title} · ${p.vendor.storeName}` : p.title,
          }))}
          sellers={sellers.data.items.map((v) => ({ id: v.id, label: v.storeName }))}
        />
      )}
    </div>
  );
}
