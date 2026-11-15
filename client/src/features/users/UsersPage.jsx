import { useState } from 'react';
import { Plus, Pencil, KeyRound, UserCog } from 'lucide-react';
import { createUserSchema, updateUserSchema, resetPasswordSchema } from '@shared/schemas/index.js';
import { ROLE_LABELS, PASSWORD_MIN_LENGTH } from '@shared/constants.js';
import { api } from '@/api/client.js';
import { useApi } from '@/hooks/useApi.js';
import { useForm } from '@/hooks/useForm.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { formatDateTime, initials } from '@/lib/format.js';
import {
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Modal,
  PageHeader,
  SelectInput,
  Switch,
  TextInput,
  toOptions,
} from '@/components/ui/index.js';

function CreateUserModal({ onClose, onSaved }) {
  const toast = useToast();
  const form = useForm(createUserSchema, {
    fullName: '',
    username: '',
    role: 'CASHIER',
    password: '',
    confirmPassword: '',
  });
  const submit = form.handleSubmit(async (data) => {
    const user = await api.post('/users', data);
    toast.success('User created', `${user.fullName} can now sign in as "${user.username}".`);
    onSaved();
  });
  return (
    <Modal
      open
      onClose={onClose}
      busy={form.submitting}
      title="Add user"
      description="The user will be asked to choose their own password on first sign-in."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={form.submitting}>
            Create user
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        <TextInput label="Full name" required {...form.bind('fullName')} />
        <div className="grid-2">
          <TextInput
            label="User name"
            required
            autoComplete="off"
            hint="Letters, numbers, dot, dash"
            {...form.bind('username')}
          />
          <SelectInput label="Role" required options={toOptions(ROLE_LABELS)} {...form.bind('role')} />
        </div>
        <div className="grid-2">
          <TextInput
            label="Temporary password"
            required
            type="password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
            {...form.bind('password')}
          />
          <TextInput
            label="Confirm password"
            required
            type="password"
            autoComplete="new-password"
            {...form.bind('confirmPassword')}
          />
        </div>
        {form.values.role === 'ADMIN' && (
          <Alert tone="warning">Admins can see buying prices, profit and reports, and manage users.</Alert>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const toast = useToast();
  const { user: me } = useAuth();
  const form = useForm(updateUserSchema, { fullName: user.fullName, role: user.role, isActive: user.isActive });
  const isSelf = me.id === user.id;
  const submit = form.handleSubmit(async (data) => {
    await api.put(`/users/${user.id}`, data);
    toast.success('User updated', data.fullName);
    onSaved();
  });
  return (
    <Modal
      open
      onClose={onClose}
      busy={form.submitting}
      title={`Edit ${user.username}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={form.submitting}>
            Save changes
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        <TextInput label="Full name" required {...form.bind('fullName')} />
        <SelectInput
          label="Role"
          required
          options={toOptions(ROLE_LABELS)}
          {...form.bind('role')}
          disabled={isSelf}
          hint={isSelf ? 'You cannot change your own role.' : undefined}
        />
        <Switch
          checked={form.values.isActive}
          onChange={(v) => form.setValue('isActive', v)}
          label="Account active"
          description={isSelf ? 'You cannot deactivate your own account.' : 'Inactive users cannot sign in.'}
          disabled={isSelf}
        />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }) {
  const toast = useToast();
  const form = useForm(resetPasswordSchema, { newPassword: '', confirmPassword: '' });
  const submit = form.handleSubmit(async (data) => {
    await api.post(`/users/${user.id}/reset-password`, data);
    toast.success('Password reset', `${user.fullName} must choose a new password at next sign-in.`);
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      busy={form.submitting}
      size="sm"
      title={`Reset password · ${user.username}`}
      description="Give the user this temporary password. They will be signed out and must set their own."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={form.submitting}>
            Reset password
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        <TextInput
          label="Temporary password"
          required
          type="password"
          autoComplete="new-password"
          {...form.bind('newPassword')}
        />
        <TextInput
          label="Confirm password"
          required
          type="password"
          autoComplete="new-password"
          {...form.bind('confirmPassword')}
        />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const [modal, setModal] = useState(null);
  const { data, loading, error, reload } = useApi('/users', { includeInactive: true, pageSize: 200 });

  const close = () => setModal(null);
  const saved = () => {
    close();
    reload();
  };

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (u) => (
        <div className="row" style={{ gap: 12 }}>
          <span className="avatar">{initials(u.fullName)}</span>
          <div>
            <div className="strong">
              {u.fullName} {u.id === me.id && <span className="muted small">(you)</span>}
            </div>
            <div className="small muted">{u.username}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => <Badge tone={u.role === 'ADMIN' ? 'primary' : 'default'}>{ROLE_LABELS[u.role]}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <div className="row">
          {u.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
          {u.mustChangePassword && <Badge tone="warning">Must set password</Badge>}
        </div>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last sign-in',
      render: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="muted">Never</span>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) => (
        <div className="actions" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => setModal({ type: 'reset', user: u })}>
            Reset password
          </Button>
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            icon={Pencil}
            title="Edit"
            onClick={() => setModal({ type: 'edit', user: u })}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Users"
        description="Admins manage the shop; cashiers sell and handle returns. Cashiers never see buying prices or profit."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setModal({ type: 'create' })}>
            Add user
          </Button>
        }
      />
      <div className="card">
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(u) => setModal({ type: 'edit', user: u })}
          rowClassName={(u) => (!u.isActive ? 'inactive' : '')}
          empty={<EmptyState icon={UserCog} title="No users" />}
        />
      </div>
      {modal?.type === 'create' && <CreateUserModal onClose={close} onSaved={saved} />}
      {modal?.type === 'edit' && <EditUserModal user={modal.user} onClose={close} onSaved={saved} />}
      {modal?.type === 'reset' && <ResetPasswordModal user={modal.user} onClose={close} />}
    </div>
  );
}
