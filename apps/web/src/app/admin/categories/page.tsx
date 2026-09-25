'use client';

import { useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Select,
  Table,
  Td,
} from '@/components/ui';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

export default function AdminCategoriesPage() {
  const t = useT();
  const list = useFetch<Category[]>('/categories');
  const action = useAction();
  const [editing, setEditing] = useState<{
    id: string | null;
    name: string;
    parentId: string;
    sortOrder: string;
  } | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const body = {
      name: editing.name,
      parentId: editing.parentId || null,
      sortOrder: Number(editing.sortOrder),
    };
    const ok = await action.run(() =>
      editing.id
        ? api(`/admin/categories/${editing.id}`, { method: 'PATCH', body })
        : api('/admin/categories', { method: 'POST', body }),
    );
    if (ok !== undefined) {
      setEditing(null);
      list.reload();
    }
  };

  const remove = async (c: Category) => {
    if (!confirm(t('admin.deleteCategoryConfirm', { name: c.name }))) return;
    const ok = await action.run(() => api(`/admin/categories/${c.id}`, { method: 'DELETE' }));
    if (ok !== undefined) list.reload();
  };

  if (!list.data) return <Loading />;
  const byId = new Map(list.data.map((c) => [c.id, c]));

  return (
    <div>
      <PageHeader
        title={t('admin.categoriesTitle')}
        actions={
          <Button
            onClick={() => setEditing({ id: null, name: '', parentId: '', sortOrder: '0' })}
            arrow
          >
            {t('admin.newCategory')}
          </Button>
        }
      />
      {action.error && !editing && (
        <div className="mb-4">
          <Alert tone="error">{action.error}</Alert>
        </div>
      )}
      <Card>
        <Table
          headers={[
            t('admin.name'),
            t('admin.slug'),
            t('admin.parent'),
            t('admin.products'),
            t('admin.order'),
            '',
          ]}
        >
          {list.data.map((c) => (
            <tr key={c.id}>
              <Td className="font-medium text-navy-900">{c.name}</Td>
              <Td className="text-xs text-slate-500">{c.slug}</Td>
              <Td>{c.parentId ? byId.get(c.parentId)?.name : '—'}</Td>
              <Td>{c.productCount ?? 0}</Td>
              <Td>{c.sortOrder}</Td>
              <Td>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setEditing({
                        id: c.id,
                        name: c.name,
                        parentId: c.parentId ?? '',
                        sortOrder: String(c.sortOrder),
                      })
                    }
                  >
                    {t('common.edit')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c)}>
                    {t('common.delete')}
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal
        open={editing !== null}
        title={editing?.id ? t('admin.editCategory') : t('admin.newCategory')}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form onSubmit={save} className="space-y-3">
            {action.error && <Alert tone="error">{action.error}</Alert>}
            <Field label={t('admin.name')}>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                required
                minLength={2}
              />
            </Field>
            <Field label={t('admin.parent')}>
              <Select
                value={editing.parentId}
                onChange={(e) => setEditing({ ...editing, parentId: e.target.value })}
              >
                <option value="">{t('admin.topLevel')}</option>
                {list.data
                  .filter((c) => c.id !== editing.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={t('admin.sortOrder')}>
              <Input
                type="number"
                min={0}
                value={editing.sortOrder}
                onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={action.busy}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
