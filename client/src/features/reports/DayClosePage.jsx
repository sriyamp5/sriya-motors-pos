import { useState } from 'react';
import { Lock, CheckCircle2, Banknote } from 'lucide-react';
import { cashClosingSchema } from '@shared/schemas/index.js';
import { fromCents, toCents } from '@shared/money.js';
import { api } from '@/api/client.js';
import { useApi } from '@/hooks/useApi.js';
import { useForm } from '@/hooks/useForm.js';
import { useToast } from '@/context/ToastContext.jsx';
import { formatDate, formatMoney, todayIso } from '@/lib/format.js';
import { Alert, Button, Card, DataTable, Loader, MoneyInput, PageHeader, TextArea } from '@/components/ui/index.js';

function SummaryRow({ label, value, tone, strong }) {
  return (
    <div className={`total-row ${tone ?? ''}`} style={strong ? { fontWeight: 700, color: 'var(--text)' } : undefined}>
      <span>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

/**
 * End-of-day cash check: the system calculates how much cash should be in
 * the drawer and the admin records what was counted.
 */
export function DayClosePage() {
  const toast = useToast();
  const [date, setDate] = useState(todayIso());
  const summary = useApi('/cash-closings/summary', { date });
  const history = useApi('/cash-closings');
  const form = useForm(cashClosingSchema, { businessDate: date, openingFloat: '0', countedCash: '', notes: '' });

  const s = summary.data;
  const expected = s ? fromCents(toCents(form.values.openingFloat) + toCents(s.expectedCashExcludingFloat)) : 0;
  const difference =
    form.values.countedCash === '' ? null : fromCents(toCents(form.values.countedCash) - toCents(expected));

  const submit = form.handleSubmit(async (values) => {
    await api.post('/cash-closings', { ...values, businessDate: date });
    toast.success('Day closed', formatDate(date));
    summary.reload();
    history.reload();
  });

  const closing = s?.closing;

  return (
    <div className="page">
      <PageHeader
        title="Day end"
        description="Count the cash in the drawer and compare it with the system."
        actions={
          <input
            type="date"
            className="input"
            style={{ width: 170 }}
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
          />
        }
      />

      {!s ? (
        <Loader />
      ) : (
        <div className="settings-grid">
          <Card title={`Summary · ${formatDate(date)}`} icon={Banknote}>
            <div className="stack-sm">
              <SummaryRow label="Bills" value={s.salesCount} />
              <SummaryRow label="Total sales" value={formatMoney(s.totalSales)} strong />
              <SummaryRow label="Card sales" value={formatMoney(s.cardSales)} />
              <SummaryRow label="Credit sales" value={formatMoney(s.creditSales)} />
              <div className="divider" />
              <SummaryRow label="Cash sales" value={formatMoney(s.cashSales)} />
              <SummaryRow label="Credit payments received in cash" value={formatMoney(s.cashCollections)} />
              <SummaryRow label="Cash refunds" value={`- ${formatMoney(s.cashRefunds)}`} tone="text-danger" />
              <SummaryRow label="Cash taken today" value={formatMoney(s.expectedCashExcludingFloat)} strong />
            </div>
          </Card>

          {closing ? (
            <Card title="Day closed" icon={CheckCircle2}>
              <div className="stack-sm">
                <SummaryRow label="Opening cash" value={formatMoney(closing.openingFloat)} />
                <SummaryRow label="Expected in drawer" value={formatMoney(closing.expectedCash)} />
                <SummaryRow label="Counted" value={formatMoney(closing.countedCash)} strong />
                <SummaryRow
                  label="Difference"
                  value={formatMoney(closing.difference)}
                  tone={closing.difference === 0 ? 'text-success' : 'text-danger'}
                  strong
                />
                {closing.notes && <p className="text-2 mt-2">{closing.notes}</p>}
                <p className="small muted mt-2">Closed by {closing.closedByName}</p>
              </div>
            </Card>
          ) : (
            <Card title="Count the cash" icon={Lock}>
              <form className="stack" onSubmit={submit} noValidate>
                <div className="grid-2">
                  <MoneyInput
                    label="Opening cash (float)"
                    hint="Cash in the drawer at opening."
                    {...form.bind('openingFloat')}
                  />
                  <MoneyInput label="Counted cash" required data-autofocus {...form.bind('countedCash')} />
                </div>
                <SummaryRow label="Expected in drawer" value={formatMoney(expected)} strong />
                {difference !== null && (
                  <Alert
                    tone={difference === 0 ? 'success' : 'warning'}
                    title={difference === 0 ? 'Cash matches' : difference > 0 ? 'Cash over' : 'Cash short'}
                  >
                    Difference: {formatMoney(difference)}
                  </Alert>
                )}
                <TextArea label="Notes" rows={2} placeholder="Explain any difference" {...form.bind('notes')} />
                <Button type="submit" variant="primary" icon={Lock} loading={form.submitting}>
                  Close the day
                </Button>
              </form>
            </Card>
          )}
        </div>
      )}

      <Card title="Previous days" flush>
        <DataTable
          rows={history.data}
          loading={history.loading}
          error={history.error}
          onRetry={history.reload}
          columns={[
            { key: 'date', header: 'Date', render: (c) => formatDate(c.businessDate) },
            {
              key: 'expected',
              header: 'Expected',
              align: 'right',
              render: (c) => <span className="num">{formatMoney(c.expectedCash, false)}</span>,
            },
            {
              key: 'counted',
              header: 'Counted',
              align: 'right',
              render: (c) => <span className="num">{formatMoney(c.countedCash, false)}</span>,
            },
            {
              key: 'diff',
              header: 'Difference',
              align: 'right',
              render: (c) => (
                <span className={`num strong ${c.difference === 0 ? 'text-success' : 'text-danger'}`}>
                  {formatMoney(c.difference, false)}
                </span>
              ),
            },
            { key: 'by', header: 'Closed by', render: (c) => c.closedByName },
            { key: 'notes', header: 'Notes', render: (c) => <span className="small text-2">{c.notes}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
