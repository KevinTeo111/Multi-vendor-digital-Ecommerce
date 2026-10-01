'use client';

import { useState } from 'react';
import {
  FilterBar,
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Table,
  Td,
} from '@/components/ui';
import { useLocale } from '@/i18n/client';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { AdminUser } from '@/lib/types';
import { useAction, usePagedList } from '@/lib/use-fetch';

export default function AdminUsersPage() {
  const { t, status: statusLabel } = useLocale();
  const list = usePagedList<AdminUser>('/admin/users', { role: '', search: '' });
  const action = useAction();
  const [resetLink, setResetLink] = useState<{
    email: string;
    url: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const createResetLink = async (u: AdminUser) => {
    const link = await action.run(() =>
      api<{ url: string; expiresAt: string }>(`/admin/users/${u.id}/password-reset-link`, {
        method: 'POST',
      }),
    );
    if (link) {
      setCopied(false);
      setResetLink({ email: u.email, ...link });
    }
  };

  const copyResetLink = async () => {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink.url);
      setCopied(true);
    } catch {
      /* clipboard blocked: the link stays selectable in the dialog */
    }
  };

  const toggle = async (u: AdminUser) => {
    const next = u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    if (next === 'BLOCKED' && !confirm(t('admin.blockConfirm', { email: u.email }))) return;
    const ok = await action.run(() =>
      api(`/admin/users/${u.id}/status`, { method: 'PATCH', body: { status: next } }),
    );
    if (ok !== undefined) list.reload();
  };

  return (
    <div>
      <PageHeader title={t('admin.usersTitle')} />
      {action.error && (
        <div className="mb-4">
          <Alert tone="error">{action.error}</Alert>
        </div>
      )}
      <Card
        actions={
          <FilterBar>
            <Input
              placeholder={t('admin.searchUser')}
              value={list.filters.search}
              onChange={(e) => list.setFilter('search', e.target.value)}
              className="sm:w-56"
            />
            <Select
              value={list.filters.role}
              onChange={(e) => list.setFilter('role', e.target.value)}
              className="sm:w-auto"
              aria-label={t('admin.role')}
            >
              {['', 'BUYER', 'VENDOR', 'ADMIN'].map((r) => (
                <option key={r} value={r}>
                  {r ? statusLabel(r) : t('admin.allRoles')}
                </option>
              ))}
            </Select>
          </FilterBar>
        }
      >
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState title={t('admin.noUsers')} />
        ) : (
          <>
            <Table
              headers={[
                t('admin.user'),
                t('admin.role'),
                t('admin.store'),
                t('common.status'),
                t('admin.joined'),
                t('common.actions'),
              ]}
            >
              {list.data.items.map((u) => (
                <tr key={u.id}>
                  <Td>
                    {u.name}
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </Td>
                  <Td>{statusLabel(u.role)}</Td>
                  <Td>{u.vendor?.storeName ?? '—'}</Td>
                  <Td>
                    <Badge status={u.status} />
                  </Td>
                  <Td className="text-xs">{formatDate(u.createdAt)}</Td>
                  <Td>
                    {u.role !== 'ADMIN' && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={u.status === 'ACTIVE' ? 'danger' : 'secondary'}
                          onClick={() => toggle(u)}
                          loading={action.busy}
                        >
                          {u.status === 'ACTIVE' ? t('admin.blockUser') : t('admin.unblockUser')}
                        </Button>
                        {u.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => createResetLink(u)}
                            loading={action.busy}
                          >
                            {t('admin.resetLink')}
                          </Button>
                        )}
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              onChange={list.setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={resetLink !== null}
        title={t('admin.resetLinkTitle')}
        onClose={() => setResetLink(null)}
      >
        {resetLink && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {t('admin.resetLinkHint', {
                email: resetLink.email,
                time: formatDate(resetLink.expiresAt, true),
              })}
            </p>
            <Input readOnly value={resetLink.url} onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={copyResetLink} className="w-full">
              {copied ? t('admin.resetLinkCopied') : t('admin.resetLinkCopy')}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
