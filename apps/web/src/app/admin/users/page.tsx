'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Input, Loading, PageHeader, Pagination, Select, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { AdminUser, Paginated } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

export default function AdminUsersPage() {
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const list = useFetch<Paginated<AdminUser>>('/admin/users', { role: role || undefined, search: search || undefined, page, pageSize: 25 });
  const action = useAction();

  const toggle = async (u: AdminUser) => {
    const next = u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    if (next === 'BLOCKED' && !confirm(`Block ${u.email}? They will be signed out everywhere.`)) return;
    const ok = await action.run(() => api(`/admin/users/${u.id}/status`, { method: 'PATCH', body: { status: next } }));
    if (ok !== undefined) list.reload();
  };

  return (
    <div>
      <PageHeader title="Users" />
      {action.error && (
        <div className="mb-4">
          <Alert tone="error">{action.error}</Alert>
        </div>
      )}
      <Card
        actions={
          <div className="flex gap-2">
            <Input placeholder="Name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-48" />
            <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="w-auto" aria-label="Role">
              {['', 'BUYER', 'VENDOR', 'ADMIN'].map((r) => (
                <option key={r} value={r}>
                  {r || 'All roles'}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState title="No users" />
        ) : (
          <>
            <Table headers={['User', 'Role', 'Store', 'Status', 'Joined', 'Actions']}>
              {list.data.items.map((u) => (
                <tr key={u.id}>
                  <Td>
                    {u.name}
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </Td>
                  <Td>{u.role}</Td>
                  <Td>{u.vendor?.storeName ?? '—'}</Td>
                  <Td>
                    <Badge status={u.status} />
                  </Td>
                  <Td className="text-xs">{formatDate(u.createdAt)}</Td>
                  <Td>
                    {u.role !== 'ADMIN' && (
                      <Button size="sm" variant={u.status === 'ACTIVE' ? 'danger' : 'secondary'} onClick={() => toggle(u)} loading={action.busy}>
                        {u.status === 'ACTIVE' ? 'Block' : 'Unblock'}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={list.data.page} totalPages={list.data.totalPages} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
