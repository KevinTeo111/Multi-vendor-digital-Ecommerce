'use client';

import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { PurchaseVerification } from '@/lib/types';
import { useAction } from '@/lib/use-fetch';

export default function VendorLicensesPage() {
  const t = useT();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<PurchaseVerification | null>(null);
  const action = useAction();

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null);
    const found = await action.run(() =>
      api<PurchaseVerification>('/vendor/sales/verify', { query: { code: code.trim() } }),
    );
    if (found) setResult(found);
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t('licence.verifyTitle')} description={t('licence.verifyDescription')} />
      <Card>
        <form onSubmit={verify} className="space-y-4">
          <Field label={t('licence.purchaseCode')}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="A1B2-C3D4-E5F6-7890"
              className="font-mono uppercase"
              required
              minLength={8}
            />
          </Field>
          <Button type="submit" loading={action.busy} className="w-full" arrow>
            {t('licence.verifyButton')}
          </Button>
        </form>
        {action.error && (
          <div className="mt-4">
            <Alert tone="error">{action.error}</Alert>
          </div>
        )}
        {result && (
          <div className="mt-4">
            <Alert tone={result.valid ? 'success' : 'error'}>
              <strong>
                {result.valid
                  ? t('licence.valid')
                  : t('licence.revoked', { date: formatDate(result.refundedAt) })}
              </strong>
              <div className="mt-1">
                {result.productTitle} ·{' '}
                {result.licenseType === 'EXTENDED' ? t('licence.extended') : t('licence.regular')}
              </div>
              <div className="mt-1 text-xs">
                {t('licence.soldTo', {
                  buyer: result.buyerName,
                  date: formatDate(result.paidAt),
                  order: result.orderNumber,
                })}
              </div>
            </Alert>
          </div>
        )}
      </Card>
    </div>
  );
}
