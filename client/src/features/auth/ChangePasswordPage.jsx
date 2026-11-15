import { KeyRound, LogOut } from 'lucide-react';
import { changePasswordSchema } from '@shared/schemas/index.js';
import { PASSWORD_MIN_LENGTH } from '@shared/constants.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useForm } from '@/hooks/useForm.js';
import { useToast } from '@/context/ToastContext.jsx';
import { Alert, Button, Modal, TextInput } from '@/components/ui/index.js';
import logo from '@/assets/logo.jpg';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

function PasswordFields({ form }) {
  return (
    <div className="stack">
      <TextInput
        label="Current password"
        type="password"
        autoComplete="current-password"
        {...form.bind('currentPassword')}
      />
      <TextInput
        label="New password"
        type="password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        {...form.bind('newPassword')}
      />
      <TextInput
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        {...form.bind('confirmPassword')}
      />
    </div>
  );
}

/** Full screen shown on first sign-in or after an admin reset the password. */
export function ChangePasswordPage() {
  const { user, changePassword, signOut } = useAuth();
  const toast = useToast();
  const form = useForm(changePasswordSchema, EMPTY);

  const submit = form.handleSubmit(async (values) => {
    await changePassword(values);
    toast.success('Password changed', 'You can now use the system.');
  });

  return (
    <div className="center-screen">
      <form className="card" style={{ width: 460 }} onSubmit={submit} noValidate>
        <div className="card-body stack">
          <img src={logo} alt="" style={{ width: 120, margin: '0 auto' }} />
          <div className="text-center">
            <h2>Set your own password</h2>
            <p className="muted mt-1">
              Hello {user.fullName}. For security, please choose a new password before continuing.
            </p>
          </div>
          {user.username === 'admin' && (
            <Alert tone="warning" title="Default admin account">
              The default password must be changed. Keep the new password safe — it controls the whole shop system.
            </Alert>
          )}
          <PasswordFields form={form} />
        </div>
        <div className="card-footer">
          <Button icon={LogOut} variant="ghost" onClick={signOut}>
            Sign out
          </Button>
          <Button type="submit" variant="primary" icon={KeyRound} loading={form.submitting}>
            Save password
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Voluntary password change from the user menu. */
export function ChangePasswordModal({ open, onClose }) {
  const { changePassword } = useAuth();
  const toast = useToast();
  const form = useForm(changePasswordSchema, EMPTY);

  const close = () => {
    form.reset(EMPTY);
    onClose();
  };

  const submit = form.handleSubmit(async (values) => {
    await changePassword(values);
    toast.success('Password changed');
    close();
  });

  return (
    <Modal
      open={open}
      onClose={close}
      title="Change password"
      size="sm"
      busy={form.submitting}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={form.submitting}>
            Save password
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <PasswordFields form={form} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
