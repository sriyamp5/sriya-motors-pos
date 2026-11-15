import { useState } from 'react';
import { Plus, Pencil, Power, Trash2 } from 'lucide-react';
import { api } from '@/api/client.js';
import { useApi } from '@/hooks/useApi.js';
import { useDebounce } from '@/hooks/useCommon.js';
import { useForm } from '@/hooks/useForm.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  SelectInput,
  Switch,
  TextArea,
  TextInput,
} from '@/components/ui/index.js';

/**
 * Form for one record. `fields` describe the inputs:
 * { name, label, required?, type?: 'text'|'textarea'|'select', options?, placeholder?, span? }
 */
function RecordFormModal({ title, basePath, schema, fields, emptyValues, record, onClose, onSaved, entityLabel }) {
  const toast = useToast();
  const toValues = (r) =>
    Object.fromEntries(Object.keys(emptyValues).map((k) => [k, r?.[k] == null ? '' : String(r[k])]));
  const form = useForm(schema, record ? toValues(record) : emptyValues);

  const submit = form.handleSubmit(async (data) => {
    const saved = record ? await api.put(`${basePath}/${record.id}`, data) : await api.post(basePath, data);
    toast.success(record ? `${entityLabel} updated` : `${entityLabel} added`, saved.name);
    onSaved(saved);
  });

  return (
    <Modal
      open
      onClose={onClose}
      busy={form.submitting}
      title={title}
      size={fields.length > 3 ? 'md' : 'sm'}
      footer={
        <>
          <Button onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={form.submitting}>
            {record ? 'Save changes' : 'Add'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className={fields.length > 3 ? 'grid-2' : 'stack'}>
        {fields.map((field) => {
          const common = {
            label: field.label,
            required: field.required,
            placeholder: field.placeholder,
            ...form.bind(field.name),
          };
          const className = field.span === 2 && fields.length > 3 ? 'span-2' : '';
          if (field.type === 'textarea')
            return <TextArea key={field.name} {...common} className={className} rows={2} />;
          if (field.type === 'select') {
            return (
              <SelectInput
                key={field.name}
                {...common}
                className={className}
                options={field.options}
                placeholder={field.placeholder ?? 'Select'}
              />
            );
          }
          return <TextInput key={field.name} {...common} className={className} />;
        })}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function MasterDataPage({
  title,
  description,
  entityLabel,
  basePath,
  schema,
  fields,
  emptyValues,
  columns,
  writeRoles = ['ADMIN'],
  filters = {},
  toolbarExtra,
  onRowClick,
  rowActions,
  embedded = false,
}) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const debouncedSearch = useDebounce(search);
  const canWrite = writeRoles.includes(user.role);

  const { data, loading, error, reload } = useApi(basePath, {
    search: debouncedSearch,
    page,
    pageSize: 25,
    includeInactive,
    ...filters,
  });

  const run = async (action, successTitle, record) => {
    try {
      await action();
      toast.success(successTitle, record.name);
      reload();
    } catch (err) {
      toast.fromError(err, 'Action failed');
      throw err;
    }
  };

  const tableColumns = [
    ...columns,
    {
      key: 'status',
      header: 'Status',
      render: (r) => (r.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="actions" onClick={(e) => e.stopPropagation()}>
          {rowActions?.(r)}
          {canWrite && (
            <Button size="sm" variant="ghost" iconOnly icon={Pencil} title="Edit" onClick={() => setEditing(r)} />
          )}
          {isAdmin && (
            <>
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon={Power}
                title={r.isActive ? 'Deactivate' : 'Activate'}
                onClick={() => setConfirm({ type: 'active', record: r })}
              />
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon={Trash2}
                title="Delete"
                onClick={() => setConfirm({ type: 'delete', record: r })}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  const table = (
    <div className="card">
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={`Search ${title.toLowerCase()}`}
        />
        {toolbarExtra}
        <span className="row" style={{ marginLeft: 'auto', gap: 14 }}>
          {isAdmin && (
            <Switch
              checked={includeInactive}
              onChange={(v) => {
                setIncludeInactive(v);
                setPage(1);
              }}
              label="Show inactive"
            />
          )}
          {embedded && canWrite && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              Add {entityLabel.toLowerCase()}
            </Button>
          )}
        </span>
      </div>
      <DataTable
        columns={tableColumns}
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={reload}
        onRowClick={onRowClick ?? (canWrite ? (r) => setEditing(r) : undefined)}
        rowClassName={(r) => (!r.isActive ? 'inactive' : '')}
        empty={
          <EmptyState
            title={search ? 'No matches' : `No ${title.toLowerCase()} yet`}
            action={
              canWrite &&
              !search && (
                <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
                  Add {entityLabel.toLowerCase()}
                </Button>
              )
            }
          />
        }
      />
      {data && <Pagination {...data} onChange={setPage} />}
    </div>
  );

  return (
    <div className={embedded ? 'stack' : 'page'}>
      {!embedded && (
        <PageHeader
          title={title}
          description={description}
          actions={
            canWrite && (
              <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
                Add {entityLabel.toLowerCase()}
              </Button>
            )
          }
        />
      )}
      {table}

      {editing && (
        <RecordFormModal
          title={editing === 'new' ? `Add ${entityLabel.toLowerCase()}` : `Edit ${entityLabel.toLowerCase()}`}
          basePath={basePath}
          schema={schema}
          fields={fields}
          emptyValues={emptyValues}
          record={editing === 'new' ? null : editing}
          entityLabel={entityLabel}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={confirm?.type === 'active'}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          run(
            () => api.patch(`${basePath}/${confirm.record.id}/active`, { isActive: !confirm.record.isActive }),
            confirm.record.isActive ? `${entityLabel} deactivated` : `${entityLabel} activated`,
            confirm.record,
          )
        }
        title={
          confirm?.record.isActive
            ? `Deactivate ${entityLabel.toLowerCase()}?`
            : `Activate ${entityLabel.toLowerCase()}?`
        }
        message={
          confirm?.record.isActive
            ? `"${confirm?.record.name}" will be hidden from selection lists. Existing records keep it.`
            : `"${confirm?.record.name}" will be available again.`
        }
        confirmLabel={confirm?.record.isActive ? 'Deactivate' : 'Activate'}
        danger={confirm?.record.isActive}
      />
      <ConfirmDialog
        open={confirm?.type === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          run(() => api.delete(`${basePath}/${confirm.record.id}`), `${entityLabel} deleted`, confirm.record)
        }
        title={`Delete ${entityLabel.toLowerCase()}?`}
        message={`"${confirm?.record.name}" will be permanently deleted. If it is used by other records, deactivate it instead.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
