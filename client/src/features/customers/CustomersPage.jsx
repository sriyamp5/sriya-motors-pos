import { useState } from 'react';
import { Wallet, BookOpen } from 'lucide-react';
import { customerSchema, customerPaymentSchema } from '@shared/schemas/index.js';
import { api } from '@/api/client.js';
import { useApi } from '@/hooks/useApi.js';
import { useForm } from '@/hooks/useForm.js';
import { useToast } from '@/context/ToastContext.jsx';
import { formatDateTime, formatMoney } from '@/lib/format.js';
import {
  Badge,
  Button,
  DataTable,
  Loader,
  Modal,
  MoneyInput,
  SelectInput,
  StatCard,
  TextInput,
} from '@/components/ui/index.js';
import { MasterDataPage } from '@/features/masterData/MasterDataPage.jsx';

const ENTRY_LABELS = { SALE: 'Credit sale', PAYMENT: 'Payment', REFUND: 'Return' };

/** Credit statement with a form to record a payment against the balance. */
function CustomerAccountModal({ customer, onClose, onChanged }) {
  const toast = useToast();
  const { data, loading, reload } = useApi(`/customers/${customer.id}/statement`);
  const form = useForm(customerPaymentSchema, { amount: '', method: 'CASH', reference: '', note: '' });
  const balance = data?.customer.creditBalance ?? customer.creditBalance;

  const submit = form.handleSubmit(async (values) => {
    const result = await api.post(`/customers/${customer.id}/payments`, values);
    toast.success('Payment recorded', `New balance ${formatMoney(result.balance)}`);
    form.reset({ amount: '', method: 'CASH', reference: '', note: '' });
    reload();
    onChanged();
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={customer.name}
      description={[customer.phone, customer.vehicleNo].filter(Boolean).join(' · ')}
    >
      <div className="stack">
        <StatCard
          icon={Wallet}
          tone={balance > 0 ? 'warning' : 'success'}
          label="Balance due"
          value={formatMoney(balance)}
        />

        {balance > 0 && (
          <form className="card card-body" onSubmit={submit} noValidate>
            <div className="form-section-title" style={{ marginBottom: 10 }}>
              Receive payment
            </div>
            <div className="grid-4" style={{ alignItems: 'start' }}>
              <MoneyInput label="Amount" required {...form.bind('amount')} />
              <SelectInput
                label="Method"
                options={[
                  { value: 'CASH', label: 'Cash' },
                  { value: 'CARD', label: 'Card' },
                ]}
                {...form.bind('method')}
              />
              <TextInput label="Reference" placeholder="Optional" {...form.bind('reference')} />
              <div className="field">
                <span className="field-label">&nbsp;</span>
                <Button type="submit" variant="primary" loading={form.submitting}>
                  Record payment
                </Button>
              </div>
            </div>
          </form>
        )}

        <div className="card">
          {loading && !data ? (
            <Loader />
          ) : (
            <DataTable
              compact
              rowKey={(e) => `${e.entryType}-${e.referenceId}`}
              rows={data?.entries}
              columns={[
                { key: 'date', header: 'Date', render: (e) => formatDateTime(e.createdAt) },
                {
                  key: 'type',
                  header: 'Type',
                  render: (e) => (
                    <Badge tone={e.entryType === 'SALE' ? 'accent' : 'success'}>{ENTRY_LABELS[e.entryType]}</Badge>
                  ),
                },
                {
                  key: 'ref',
                  header: 'Reference',
                  render: (e) => <span className="mono">{e.referenceNo ?? '—'}</span>,
                },
                {
                  key: 'debit',
                  header: 'Charged',
                  align: 'right',
                  render: (e) => (e.debit ? <span className="num">{formatMoney(e.debit, false)}</span> : ''),
                },
                {
                  key: 'credit',
                  header: 'Paid / returned',
                  align: 'right',
                  render: (e) =>
                    e.credit ? <span className="num text-success">{formatMoney(e.credit, false)}</span> : '',
                },
              ]}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

export function CustomersPage() {
  const [account, setAccount] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <MasterDataPage
        key={refreshKey}
        title="Customers"
        description="Regular and credit customers. Credit customers are also created automatically at the till."
        entityLabel="Customer"
        basePath="/customers"
        schema={customerSchema}
        writeRoles={['ADMIN', 'CASHIER']}
        emptyValues={{ name: '', phone: '', address: '', vehicleNo: '', notes: '' }}
        fields={[
          { name: 'name', label: 'Customer / garage name', required: true, span: 2 },
          { name: 'phone', label: 'Phone', placeholder: '0771234567' },
          { name: 'vehicleNo', label: 'Vehicle number', placeholder: 'e.g. CAB-1234' },
          { name: 'address', label: 'Address', span: 2 },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
        ]}
        columns={[
          { key: 'name', header: 'Name', render: (r) => <span className="strong">{r.name}</span> },
          { key: 'phone', header: 'Phone' },
          { key: 'vehicleNo', header: 'Vehicle' },
          {
            key: 'creditBalance',
            header: 'Balance due',
            align: 'right',
            render: (r) =>
              r.creditBalance > 0 ? (
                <span className="num strong text-warning">{formatMoney(r.creditBalance, false)}</span>
              ) : (
                <span className="muted">—</span>
              ),
          },
        ]}
        rowActions={(r) => (
          <Button size="sm" variant="ghost" iconOnly icon={BookOpen} title="Account" onClick={() => setAccount(r)} />
        )}
      />
      {account && (
        <CustomerAccountModal
          customer={account}
          onClose={() => setAccount(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </>
  );
}
