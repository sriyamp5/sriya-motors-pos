import { Database, PlugZap } from 'lucide-react';
import { databaseConfigSchema } from '@shared/schemas/index.js';
import { api } from '@/api/client.js';
import { useForm } from '@/hooks/useForm.js';
import { useToast } from '@/context/ToastContext.jsx';
import { Alert, Button, TextInput } from '@/components/ui/index.js';
import logo from '@/assets/logo.jpg';

/**
 * First-run screen where the installer enters the MySQL connection details.
 * The database itself is created automatically.
 */
export function DatabaseSetupPage({ status, onConnected, onCancel }) {
  const toast = useToast();
  const form = useForm(databaseConfigSchema, {
    host: status?.host || '127.0.0.1',
    port: String(status?.port || 3306),
    user: status?.user || 'root',
    password: '',
    database: status?.name || 'sriya_pos',
  });

  const submit = form.handleSubmit(async (values) => {
    await api.post('/system/database', values);
    toast.success('Database connected', 'The system is preparing the database.');
    onConnected();
  });

  return (
    <div className="center-screen">
      <form className="card" style={{ width: 520 }} onSubmit={submit} noValidate>
        <div className="card-header">
          <div className="row" style={{ gap: 14 }}>
            <img src={logo} alt="" style={{ width: 54, borderRadius: 8 }} />
            <div>
              <h2>Database setup</h2>
              <p className="muted small">Connect the POS to the MySQL server on this computer.</p>
            </div>
          </div>
        </div>
        <div className="card-body stack">
          {status?.status === 'error' && (
            <Alert tone="danger" title="Connection failed">
              {status.message}
            </Alert>
          )}
          <div className="grid-3">
            <TextInput className="span-2" label="Host" required {...form.bind('host')} />
            <TextInput label="Port" required inputMode="numeric" {...form.bind('port')} />
          </div>
          <div className="grid-2">
            <TextInput label="MySQL user" required autoComplete="off" {...form.bind('user')} />
            <TextInput label="Password" type="password" autoComplete="off" {...form.bind('password')} />
          </div>
          <TextInput
            label="Database name"
            required
            hint="Created automatically if it does not exist."
            {...form.bind('database')}
          />
          <Alert tone="info">
            <Database size={13} style={{ verticalAlign: -2 }} /> Use the password chosen when MySQL Server was
            installed.
          </Alert>
        </div>
        <div className="card-footer">
          {onCancel && <Button onClick={onCancel}>Back</Button>}
          <Button type="submit" variant="primary" icon={PlugZap} loading={form.submitting}>
            Connect
          </Button>
        </div>
      </form>
    </div>
  );
}
