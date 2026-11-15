import { useEffect, useState } from 'react';
import {
  Store,
  Printer,
  DatabaseBackup,
  RefreshCw,
  Info,
  Save,
  FolderOpen,
  Download,
  RotateCcw,
  CheckCircle2,
  WifiOff,
  FileUp,
} from 'lucide-react';
import { shopSettingsSchema } from '@shared/schemas/index.js';
import { api } from '@/api/client.js';
import { useApi } from '@/hooks/useApi.js';
import { useForm } from '@/hooks/useForm.js';
import { useToast } from '@/context/ToastContext.jsx';
import { useShopSettings } from '@/context/SettingsContext.jsx';
import { formatBytes, formatDateTime } from '@/lib/format.js';
import { buildReceiptHtml } from '@/lib/receipt.js';
import { printDocument } from '@/lib/printing.js';
import { useUpdateStatus } from '@/components/layout/UpdateBanner.jsx';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  Loader,
  Modal,
  SelectInput,
  Switch,
  Tabs,
  TextArea,
  TextInput,
} from '@/components/ui/index.js';

const isDesktop = Boolean(window.desktop);

const SAMPLE_SALE = {
  invoiceNo: 'INV-TEST',
  createdAt: new Date().toISOString(),
  cashierName: 'Test print',
  paymentMethod: 'CASH',
  subtotal: 1500,
  itemDiscountTotal: 0,
  billDiscount: 0,
  totalAmount: 1500,
  amountTendered: 2000,
  changeAmount: 500,
  items: [
    { productName: 'Test item', partNumber: '00000', quantity: 1, unitPrice: 1500, discount: 0, lineTotal: 1500 },
  ],
};

/* ------------------------------------------------------------- Shop --- */

function ShopSettings({ form }) {
  return (
    <div className="settings-grid">
      <Card title="Shop details" icon={Store}>
        <div className="stack">
          <TextInput label="Shop name" required {...form.bind('shopName')} />
          <TextArea label="Address" rows={2} {...form.bind('shopAddress')} />
          <div className="grid-2">
            <TextInput label="Phone" {...form.bind('shopPhone')} />
            <TextInput label="Email" {...form.bind('shopEmail')} />
          </div>
          <TextArea
            label="Receipt footer"
            rows={2}
            hint="Printed at the bottom of every receipt, e.g. return policy."
            {...form.bind('receiptFooter')}
          />
        </div>
      </Card>
      <Card title="Selling rules" icon={Info}>
        <Switch
          checked={form.values.allowBelowCostSale}
          onChange={(v) => form.setValue('allowBelowCostSale', v)}
          label="Allow cashiers to sell below buying price"
          description="When off, a cashier cannot change a price or give a discount that makes the item sell at a loss. Admins can always do so."
        />
        <p className="small muted mt-3">
          Cashiers may change the selling price at the till (for example Rs. 1,500 to Rs. 1,700). Every change is saved
          with the system price and the charged price, and appears under Reports → Price changes.
        </p>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------- Printer --- */

function PrinterSettings({ form }) {
  const toast = useToast();
  const [printers, setPrinters] = useState([]);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    window.desktop
      ?.listPrinters()
      .then(setPrinters)
      .catch(() => setPrinters([]));
  }, []);

  const testPrint = async () => {
    setTesting(true);
    const result = await printDocument(buildReceiptHtml(SAMPLE_SALE, form.values), {
      printerName: form.values.receiptPrinter,
      silent: form.values.silentPrint,
    });
    setTesting(false);
    if (result.success) toast.success('Test receipt sent');
    else if (result.reason !== 'cancelled')
      toast.error('Printing failed', result.reason ?? 'Check the printer is on and connected.');
  };

  return (
    <Card title="Receipt printer" icon={Printer}>
      <div className="stack" style={{ maxWidth: 560 }}>
        {!isDesktop && (
          <Alert tone="info">
            Printer selection is available in the installed desktop application. In a browser the print dialog is used.
          </Alert>
        )}
        <SelectInput
          label="Printer"
          placeholder="Windows default printer"
          options={printers.map((p) => ({
            value: p.name,
            label: `${p.displayName}${p.isDefault ? ' (default)' : ''}`,
          }))}
          {...form.bind('receiptPrinter')}
          disabled={!isDesktop}
          hint="Choose the 80 mm thermal receipt printer."
        />
        <Switch
          checked={form.values.silentPrint}
          onChange={(v) => form.setValue('silentPrint', v)}
          label="Print without asking"
          description="Receipts go straight to the printer without showing the print dialog."
          disabled={!isDesktop}
        />
        <div>
          <Button icon={Printer} onClick={testPrint} loading={testing}>
            Print a test receipt
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------- Backup --- */

function RestoreModal({ target, onClose, onDone }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const restore = async () => {
    setBusy(true);
    try {
      await api.post('/backups/restore', { ...target, confirm });
      toast.success('Backup restored', 'The system will reload now.');
      onDone();
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      toast.fromError(error, 'Restore failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      size="sm"
      title="Restore backup?"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={restore} loading={busy} disabled={confirm !== 'RESTORE'}>
            Restore
          </Button>
        </>
      }
    >
      <div className="stack">
        <Alert tone="danger" title="All current data will be replaced">
          Everything will go back to how it was in <strong>{target.fileName ?? target.filePath}</strong>. A backup of
          the current data is taken first.
        </Alert>
        <TextInput
          label='Type "RESTORE" to confirm'
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
        />
      </div>
    </Modal>
  );
}

function BackupSettings({ form }) {
  const toast = useToast();
  const { data, loading, reload } = useApi('/backups');
  const [creating, setCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);

  const backupNow = async () => {
    setCreating(true);
    try {
      const result = await api.post('/backups');
      toast.success('Backup created', `${result.fileName} (${formatBytes(result.size)})`);
      if (result.usingFallback)
        toast.warning(
          'Backup folder not available',
          'Saved to the default folder instead. Is the external drive connected?',
        );
      reload();
    } catch (error) {
      toast.fromError(error, 'Backup failed');
    } finally {
      setCreating(false);
    }
  };

  const chooseFolder = async () => {
    const folder = await window.desktop?.selectFolder();
    if (folder) form.setValue('backupDir', folder);
  };

  const chooseFile = async () => {
    const filePath = await window.desktop?.selectBackupFile();
    if (filePath) setRestoreTarget({ filePath });
  };

  return (
    <div className="stack-lg">
      <div className="settings-grid">
        <Card title="Backup settings" icon={DatabaseBackup}>
          <div className="stack">
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <TextInput
                className="grow"
                label="Backup folder"
                placeholder="Default folder in the application data"
                hint="Choose a folder on a pen drive or external disk for extra safety."
                {...form.bind('backupDir')}
              />
              {isDesktop && (
                <Button icon={FolderOpen} onClick={chooseFolder} style={{ marginBottom: 22 }}>
                  Browse
                </Button>
              )}
            </div>
            <TextInput label="Number of backups to keep" inputMode="numeric" {...form.bind('backupKeepCount')} />
            <p className="small muted">
              A backup is made automatically every day while the system is open, and before every update.
            </p>
          </div>
        </Card>
        <Card title="Status" icon={CheckCircle2}>
          {loading && !data ? (
            <Loader />
          ) : (
            <div className="stack">
              <dl className="dl">
                <dt>Last backup</dt>
                <dd>
                  {data?.lastBackupAt ? formatDateTime(data.lastBackupAt) : <span className="text-warning">Never</span>}
                </dd>
                <dt>Saving to</dt>
                <dd className="small mono" style={{ wordBreak: 'break-all' }}>
                  {data?.dir}
                </dd>
              </dl>
              {data?.usingFallback && (
                <Alert tone="warning">The chosen backup folder is not reachable, so the default folder is used.</Alert>
              )}
              <div className="row-wrap">
                <Button variant="primary" icon={Download} onClick={backupNow} loading={creating}>
                  Back up now
                </Button>
                {isDesktop && data?.dir && (
                  <Button icon={FolderOpen} onClick={() => window.desktop.openPath(data.dir)}>
                    Open folder
                  </Button>
                )}
                {isDesktop && (
                  <Button icon={FileUp} onClick={chooseFile}>
                    Restore from file…
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Available backups" flush>
        <DataTable
          compact
          rows={data?.files}
          rowKey={(f) => f.fileName}
          columns={[
            { key: 'name', header: 'File', render: (f) => <span className="mono">{f.fileName}</span> },
            { key: 'date', header: 'Created', render: (f) => formatDateTime(f.createdAt) },
            { key: 'size', header: 'Size', align: 'right', render: (f) => formatBytes(f.size) },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (f) => (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={RotateCcw}
                  onClick={() => setRestoreTarget({ fileName: f.fileName })}
                >
                  Restore
                </Button>
              ),
            },
          ]}
        />
      </Card>
      {restoreTarget && (
        <RestoreModal
          target={restoreTarget}
          onClose={() => setRestoreTarget(null)}
          onDone={() => setRestoreTarget(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------- Updates --- */

const UPDATE_MESSAGES = {
  idle: 'Not checked yet.',
  checking: 'Checking for updates…',
  'up-to-date': 'The system is up to date.',
  downloading: 'Downloading the update…',
  downloaded: 'An update is ready to install.',
  offline: 'No internet connection. Updates are checked automatically when the internet is available.',
  error: 'Could not check for updates.',
  disabled: 'Updates are only available in the installed application.',
};

function UpdateSettings() {
  const status = useUpdateStatus();
  const [checking, setChecking] = useState(false);

  if (!isDesktop) {
    return (
      <Card title="Software updates" icon={RefreshCw}>
        <Alert tone="info">Updates are managed by the installed desktop application.</Alert>
      </Card>
    );
  }

  const check = async () => {
    setChecking(true);
    try {
      await window.desktop.updates.check();
    } finally {
      setChecking(false);
    }
  };

  const state = status?.state ?? 'idle';
  return (
    <Card title="Software updates" icon={RefreshCw}>
      <div className="stack" style={{ maxWidth: 560 }}>
        <dl className="dl">
          <dt>Installed version</dt>
          <dd>v{status?.currentVersion}</dd>
          <dt>Status</dt>
          <dd className="row">
            {state === 'offline' && <WifiOff size={15} className="muted" />}
            {UPDATE_MESSAGES[state]}
            {state === 'downloading' && status.progress ? <Badge tone="info">{status.progress}%</Badge> : null}
          </dd>
          {status?.checkedAt && (
            <>
              <dt>Last checked</dt>
              <dd>{formatDateTime(status.checkedAt)}</dd>
            </>
          )}
        </dl>
        {status?.message && state === 'error' && <Alert tone="warning">{status.message}</Alert>}
        <div className="row-wrap">
          <Button
            icon={RefreshCw}
            onClick={check}
            loading={checking || state === 'checking'}
            disabled={!status?.enabled || state === 'downloading'}
          >
            Check for updates
          </Button>
          {state === 'downloaded' && (
            <Button variant="primary" icon={RotateCcw} onClick={() => window.desktop.updates.install()}>
              Restart and install v{status.version}
            </Button>
          )}
        </div>
        <p className="small muted">
          The system checks for updates by itself when connected to the internet. Your data is backed up automatically
          before any database change.
        </p>
      </div>
    </Card>
  );
}

function AboutSettings() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    window.desktop
      ?.getInfo()
      .then(setInfo)
      .catch(() => {});
  }, []);
  return (
    <Card title="About" icon={Info}>
      <dl className="dl">
        <dt>Application</dt>
        <dd>Sriya Motors POS {info && `v${info.version}`}</dd>
        <dt>Company</dt>
        <dd>Sriya Motors (Pvt) Ltd</dd>
        {info && (
          <>
            <dt>Data folder</dt>
            <dd className="mono small">{info.dataDir}</dd>
            <dt>Log file</dt>
            <dd className="mono small">{info.logsDir}</dd>
          </>
        )}
      </dl>
      {info && (
        <div className="row mt-3">
          <Button icon={FolderOpen} onClick={() => window.desktop.openPath(info.dataDir)}>
            Open data folder
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------- Page --- */

const TABS = [
  { value: 'shop', label: 'Shop', icon: Store },
  { value: 'printer', label: 'Printer', icon: Printer },
  { value: 'backup', label: 'Backup', icon: DatabaseBackup },
  { value: 'updates', label: 'Updates', icon: RefreshCw },
  { value: 'about', label: 'About', icon: Info },
];

const SAVABLE_TABS = new Set(['shop', 'printer', 'backup']);

export function SettingsPage() {
  const toast = useToast();
  const { reload: reloadShopSettings } = useShopSettings();
  const [tab, setTab] = useState('shop');
  const { data, loading } = useApi('/settings');
  const form = useForm(shopSettingsSchema, null);

  useEffect(() => {
    if (data) form.reset({ ...data, backupKeepCount: String(data.backupKeepCount) });
    // Reset only when fresh settings arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const save = form.handleSubmit(async (values) => {
    const updated = await api.put('/settings', values);
    form.reset({ ...updated, backupKeepCount: String(updated.backupKeepCount) });
    reloadShopSettings();
    toast.success('Settings saved');
  });

  if (loading || !form.values) return <Loader />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Shop information, printing, backups and updates.</p>
        </div>
        {SAVABLE_TABS.has(tab) && (
          <Button variant="primary" icon={Save} onClick={save} loading={form.submitting}>
            Save settings
          </Button>
        )}
      </div>
      <div>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        {tab === 'shop' && <ShopSettings form={form} />}
        {tab === 'printer' && <PrinterSettings form={form} />}
        {tab === 'backup' && <BackupSettings form={form} />}
        {tab === 'updates' && <UpdateSettings />}
        {tab === 'about' && <AboutSettings />}
      </div>
    </div>
  );
}
