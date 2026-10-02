'use client';

import { CouponManager } from '@/components/coupon-manager';
import { Loading, PageHeader } from '@/components/ui';
import { useT } from '@/i18n/client';
import type { Paginated, VendorProduct } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

export default function VendorCouponsPage() {
  const t = useT();
  const products = useFetch<Paginated<VendorProduct>>('/vendor/products', {
    status: 'APPROVED',
    pageSize: 100,
  });

  return (
    <div>
      <PageHeader title={t('coupon.title')} description={t('coupon.vendorDescription')} />
      {!products.data ? (
        <Loading />
      ) : (
        <CouponManager
          basePath="/vendor/coupons"
          products={products.data.items.map((p) => ({ id: p.id, label: p.title }))}
        />
      )}
    </div>
  );
}
