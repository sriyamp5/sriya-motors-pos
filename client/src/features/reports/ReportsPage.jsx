import { useState } from 'react';
import {
  Download,
  CalendarDays,
  Receipt,
  TrendingUp,
  Tag,
  Users,
  Boxes,
  ShoppingCart,
  PackageX,
  Wallet,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi.js';
import { formatDate, formatDateTime, formatMoney, todayIso, daysAgoIso, firstOfMonthIso } from '@/lib/format.js';
import { downloadCsv } from '@/lib/csv.js';
import { Badge, Button, DataTable, EmptyState, PageHeader, StatCard, Tabs } from '@/components/ui/index.js';

const PRESETS = [
  { label: 'Today', from: todayIso },
  { label: '7 days', from: () => daysAgoIso(6) },
  { label: 'This month', from: firstOfMonthIso },
  { label: '30 days', from: () => daysAgoIso(29) },
  { label: '90 days', from: () => daysAgoIso(89) },
];

const m = (v) => formatMoney(v, false);
const moneyCell = (key, className = '') => ({
  render: (r) => <span className={`num ${className}`}>{m(r[key])}</span>,
  align: 'right',
});

function ReportTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  footer,
  csvName,
  csvColumns,
  emptyTitle = 'No data for this period',
}) {
  return (
    <div className="card">
      {csvColumns && rows?.length > 0 && (
        <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
          <Button size="sm" icon={Download} onClick={() => downloadCsv(csvName, csvColumns, rows)}>
            Export to Excel (CSV)
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={onRetry}
        footer={footer}
        rowKey={(r) => r.id ?? r.day ?? r.productId}
        empty={<EmptyState title={emptyTitle} />}
      />
    </div>
  );
}

function SalesSummary({ range }) {
  const { data, loading, error, reload } = useApi('/reports/sales-summary', range);
  const t = data?.totals;
  return (
    <div className="stack">
      {t && (
        <div className="grid-4">
          <StatCard
            icon={Receipt}
            label="Sales"
            value={formatMoney(t.revenue)}
            sub={`${t.salesCount} bills · discounts ${formatMoney(t.discounts)}`}
          />
          <StatCard
            icon={TrendingUp}
            tone="success"
            label="Net profit"
            value={formatMoney(t.netProfit)}
            sub={`Gross ${formatMoney(t.grossProfit)}`}
          />
          <StatCard
            icon={Tag}
            tone="warning"
            label="Returns"
            value={formatMoney(t.refunds)}
            sub={`Net sales ${formatMoney(t.netRevenue)}`}
          />
          <StatCard
            icon={Boxes}
            tone="accent"
            label="Cash / Card / Credit"
            value={formatMoney(t.cash)}
            sub={`${formatMoney(t.card)} card · ${formatMoney(t.credit)} credit`}
          />
        </div>
      )}
      <ReportTable
        rows={data?.rows}
        loading={loading}
        error={error}
        onRetry={reload}
        csvName={`sales-summary-${range.from}-to-${range.to}.csv`}
        csvColumns={[
          { header: 'Date', value: (r) => r.day },
          { header: 'Bills', value: (r) => r.salesCount },
          { header: 'Sales', value: (r) => r.revenue },
          { header: 'Cost', value: (r) => r.cost },
          { header: 'Discounts', value: (r) => r.discounts },
          { header: 'Returns', value: (r) => r.refunds },
          { header: 'Net profit', value: (r) => r.netProfit },
        ]}
        columns={[
          { key: 'day', header: 'Date', render: (r) => formatDate(r.day) },
          {
            key: 'salesCount',
            header: 'Bills',
            align: 'right',
            render: (r) => <span className="num">{r.salesCount}</span>,
          },
          { key: 'cash', header: 'Cash', ...moneyCell('cash', 'text-2') },
          { key: 'card', header: 'Card', ...moneyCell('card', 'text-2') },
          { key: 'credit', header: 'Credit', ...moneyCell('credit', 'text-2') },
          { key: 'revenue', header: 'Sales', ...moneyCell('revenue', 'strong') },
          { key: 'cost', header: 'Cost', ...moneyCell('cost', 'muted') },
          { key: 'refunds', header: 'Returns', ...moneyCell('refunds', 'text-danger') },
          { key: 'netProfit', header: 'Net profit', ...moneyCell('netProfit', 'strong text-success') },
        ]}
        footer={
          t && (
            <tr>
              <td>Total</td>
              <td className="text-right num">{t.salesCount}</td>
              <td className="text-right num">{m(t.cash)}</td>
              <td className="text-right num">{m(t.card)}</td>
              <td className="text-right num">{m(t.credit)}</td>
              <td className="text-right num">{m(t.revenue)}</td>
              <td className="text-right num">{m(t.cost)}</td>
              <td className="text-right num">{m(t.refunds)}</td>
              <td className="text-right num">{m(t.netProfit)}</td>
            </tr>
          )
        }
      />
    </div>
  );
}

function ProductProfit({ range }) {
  const { data, loading, error, reload } = useApi('/reports/product-profit', range);
  return (
    <ReportTable
      rows={data}
      loading={loading}
      error={error}
      onRetry={reload}
      csvName={`item-profit-${range.from}-to-${range.to}.csv`}
      csvColumns={[
        { header: 'Item code', value: (r) => r.itemCode },
        { header: 'Item', value: (r) => r.productName },
        { header: 'Part number', value: (r) => r.partNumber },
        { header: 'Qty sold', value: (r) => r.quantity },
        { header: 'Sales', value: (r) => r.revenue },
        { header: 'Cost', value: (r) => r.cost },
        { header: 'Profit', value: (r) => r.profit },
        { header: 'Margin %', value: (r) => r.marginPercent },
      ]}
      columns={[
        {
          key: 'item',
          header: 'Item',
          render: (r) => (
            <div>
              <div className="strong">{r.productName}</div>
              <div className="small muted">{[r.itemCode, r.partNumber].filter(Boolean).join(' · ')}</div>
            </div>
          ),
        },
        {
          key: 'quantity',
          header: 'Qty sold',
          align: 'right',
          render: (r) => <span className="num">{r.quantity}</span>,
        },
        { key: 'revenue', header: 'Sales', ...moneyCell('revenue') },
        { key: 'cost', header: 'Cost', ...moneyCell('cost', 'muted') },
        { key: 'profit', header: 'Profit', ...moneyCell('profit', 'strong text-success') },
        {
          key: 'margin',
          header: 'Margin',
          align: 'right',
          render: (r) => <span className="num">{r.marginPercent}%</span>,
        },
      ]}
    />
  );
}

function PriceOverrides({ range }) {
  const { data, loading, error, reload } = useApi('/reports/price-overrides', range);
  const t = data?.totals;
  return (
    <div className="stack">
      {t && (
        <div className="grid-4">
          <StatCard icon={Tag} label="Price changes" value={t.count} sub="Lines sold at a different price" />
          <StatCard icon={TrendingUp} tone="success" label="Sold above system price" value={formatMoney(t.increase)} />
          <StatCard
            icon={TrendingUp}
            tone="danger"
            label="Sold below system price"
            value={formatMoney(Math.abs(t.decrease))}
          />
          <StatCard icon={Receipt} tone="accent" label="Net effect" value={formatMoney(t.net)} />
        </div>
      )}
      <ReportTable
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={reload}
        csvName={`price-changes-${range.from}-to-${range.to}.csv`}
        csvColumns={[
          { header: 'Date', value: (r) => r.createdAt },
          { header: 'Invoice', value: (r) => r.invoiceNo },
          { header: 'Cashier', value: (r) => r.cashierName },
          { header: 'Item', value: (r) => r.productName },
          { header: 'Qty', value: (r) => r.quantity },
          { header: 'Buying price', value: (r) => r.unitCost },
          { header: 'System price', value: (r) => r.listPrice },
          { header: 'Charged price', value: (r) => r.unitPrice },
          { header: 'Effect', value: (r) => r.impact },
        ]}
        columns={[
          { key: 'date', header: 'Date', render: (r) => <span className="nowrap">{formatDateTime(r.createdAt)}</span> },
          { key: 'invoice', header: 'Invoice', render: (r) => <span className="mono">{r.invoiceNo}</span> },
          { key: 'cashier', header: 'Cashier', render: (r) => r.cashierName },
          { key: 'item', header: 'Item', render: (r) => <span className="strong">{r.productName}</span> },
          { key: 'qty', header: 'Qty', align: 'right', render: (r) => <span className="num">{r.quantity}</span> },
          { key: 'cost', header: 'Buying', ...moneyCell('unitCost', 'muted') },
          { key: 'list', header: 'System price', ...moneyCell('listPrice') },
          { key: 'charged', header: 'Charged', ...moneyCell('unitPrice', 'strong') },
          {
            key: 'impact',
            header: 'Effect',
            align: 'right',
            render: (r) => (
              <span className={`num strong ${r.impact >= 0 ? 'text-success' : 'text-danger'}`}>
                {r.impact >= 0 ? '+' : ''}
                {m(r.impact)}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

function CashierPerformance({ range }) {
  const { data, loading, error, reload } = useApi('/reports/cashiers', range);
  return (
    <ReportTable
      rows={data}
      loading={loading}
      error={error}
      onRetry={reload}
      columns={[
        {
          key: 'name',
          header: 'Staff',
          render: (r) => (
            <div>
              <div className="strong">{r.fullName}</div>
              <div className="small muted">{r.username}</div>
            </div>
          ),
        },
        {
          key: 'salesCount',
          header: 'Bills',
          align: 'right',
          render: (r) => <span className="num">{r.salesCount}</span>,
        },
        { key: 'revenue', header: 'Sales', ...moneyCell('revenue', 'strong') },
        { key: 'grossProfit', header: 'Gross profit', ...moneyCell('grossProfit', 'text-success') },
        {
          key: 'overrideBills',
          header: 'Bills with price changes',
          align: 'right',
          render: (r) => <span className="num">{r.overrideBills}</span>,
        },
      ]}
    />
  );
}

function StockValuation() {
  const { data, loading, error, reload } = useApi('/reports/stock-valuation');
  const t = data?.totals;
  return (
    <div className="stack">
      {t && (
        <div className="grid-3">
          <StatCard icon={Boxes} label="Stock at cost" value={formatMoney(t.costValue)} sub={`${t.quantity} units`} />
          <StatCard icon={Tag} tone="accent" label="Stock at selling price" value={formatMoney(t.retailValue)} />
          <StatCard icon={TrendingUp} tone="success" label="Potential profit" value={formatMoney(t.potentialProfit)} />
        </div>
      )}
      <ReportTable
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={reload}
        columns={[
          { key: 'category', header: 'Category', render: (r) => <span className="strong">{r.categoryName}</span> },
          { key: 'items', header: 'Items', align: 'right', render: (r) => <span className="num">{r.itemCount}</span> },
          { key: 'qty', header: 'Units', align: 'right', render: (r) => <span className="num">{r.quantity}</span> },
          { key: 'cost', header: 'At cost', ...moneyCell('costValue') },
          { key: 'retail', header: 'At selling price', ...moneyCell('retailValue') },
          { key: 'profit', header: 'Potential profit', ...moneyCell('potentialProfit', 'text-success') },
        ]}
      />
    </div>
  );
}

/** Item name with code, part number and brand underneath. */
function ItemCell({ r }) {
  return (
    <div>
      <div className="strong">{r.name}</div>
      <div className="small muted">{[r.itemCode, r.partNumber, r.brandName].filter(Boolean).join(' · ')}</div>
    </div>
  );
}

function ReorderList() {
  const { data, loading, error, reload } = useApi('/reports/reorder');
  const t = data?.totals;
  return (
    <div className="stack">
      {t && (
        <div className="grid-3">
          <StatCard icon={ShoppingCart} label="Items to order" value={t.itemCount} />
          <StatCard icon={PackageX} tone="danger" label="Out of stock" value={t.outOfStock} />
          <StatCard
            icon={Wallet}
            tone="accent"
            label="Estimated order cost"
            value={formatMoney(t.estimatedCost)}
            sub="At the last buying price"
          />
        </div>
      )}
      <p className="small muted">
        Items at or below their low stock level, grouped by the supplier they were last bought from. Suggested quantity
        brings stock up to twice the low stock level, or covers the last {data?.salesDays ?? 30} days of sales if that
        is more. Change the low stock level of an item on the Items page.
      </p>
      <ReportTable
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyTitle="Nothing to reorder. All items are above their low stock level."
        csvName={`reorder-list-${todayIso()}.csv`}
        csvColumns={[
          { header: 'Supplier', value: (r) => r.supplierName ?? '' },
          { header: 'Item code', value: (r) => r.itemCode },
          { header: 'Item', value: (r) => r.name },
          { header: 'Part number', value: (r) => r.partNumber },
          { header: 'Brand', value: (r) => r.brandName },
          { header: 'Rack', value: (r) => r.rackLocation },
          { header: 'In stock', value: (r) => r.stockQty },
          { header: 'Low stock level', value: (r) => r.reorderLevel },
          { header: `Sold (${data?.salesDays ?? 30} days)`, value: (r) => r.soldRecently },
          { header: 'Order qty', value: (r) => r.suggestedQty },
          { header: 'Last buying price', value: (r) => r.lastCost ?? r.costPrice },
          { header: 'Estimated cost', value: (r) => r.estimatedCost },
        ]}
        columns={[
          {
            key: 'supplier',
            header: 'Last supplier',
            render: (r) => r.supplierName ?? <span className="muted">Not bought yet</span>,
          },
          { key: 'item', header: 'Item', render: (r) => <ItemCell r={r} /> },
          { key: 'rack', header: 'Rack', render: (r) => r.rackLocation || <span className="muted">—</span> },
          {
            key: 'stock',
            header: 'In stock',
            align: 'right',
            render: (r) =>
              r.stockQty <= 0 ? <Badge tone="danger">Out</Badge> : <span className="num">{r.stockQty}</span>,
          },
          {
            key: 'level',
            header: 'Low level',
            align: 'right',
            render: (r) => <span className="num muted">{r.reorderLevel}</span>,
          },
          {
            key: 'sold',
            header: `Sold ${data?.salesDays ?? 30}d`,
            align: 'right',
            render: (r) => <span className="num">{r.soldRecently}</span>,
          },
          {
            key: 'order',
            header: 'Order qty',
            align: 'right',
            render: (r) => <span className="num strong">{r.suggestedQty}</span>,
          },
          { key: 'cost', header: 'Est. cost', ...moneyCell('estimatedCost') },
        ]}
      />
    </div>
  );
}

const IDLE_PERIODS = [30, 60, 90, 180, 365];

function NonMovingStock() {
  const [days, setDays] = useState(90);
  const { data, loading, error, reload } = useApi('/reports/non-moving', { days });
  const t = data?.totals;
  return (
    <div className="stack">
      <div className="row-wrap">
        <span className="muted">Not sold in the last</span>
        <div className="segmented">
          {IDLE_PERIODS.map((d) => (
            <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {t && (
        <div className="grid-3">
          <StatCard
            icon={PackageX}
            tone="warning"
            label="Items not selling"
            value={t.itemCount}
            sub={`${t.neverSold} never sold · ${t.quantity} units`}
          />
          <StatCard
            icon={Wallet}
            tone="danger"
            label="Money held in these items"
            value={formatMoney(t.costValue)}
            sub="At buying price"
          />
          <StatCard icon={CalendarDays} label="Period" value={`${data.days} days`} sub="Without a single sale" />
        </div>
      )}
      <p className="small muted">
        Items in stock with no sale in the selected period, largest amount of money first. Consider a discount, a return
        to the supplier, or not reordering them. Items added during the period are not counted until it has passed.
      </p>
      <ReportTable
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyTitle="Every item in stock has sold in this period."
        csvName={`not-selling-${days}-days-${todayIso()}.csv`}
        csvColumns={[
          { header: 'Item code', value: (r) => r.itemCode },
          { header: 'Item', value: (r) => r.name },
          { header: 'Part number', value: (r) => r.partNumber },
          { header: 'Brand', value: (r) => r.brandName },
          { header: 'Category', value: (r) => r.categoryName },
          { header: 'Rack', value: (r) => r.rackLocation },
          { header: 'In stock', value: (r) => r.stockQty },
          { header: 'Buying price', value: (r) => r.costPrice },
          { header: 'Value at cost', value: (r) => r.costValue },
          { header: 'Last sold', value: (r) => (r.lastSoldAt ? formatDate(r.lastSoldAt) : 'Never') },
          { header: 'Days without sale', value: (r) => r.idleDays },
        ]}
        columns={[
          { key: 'item', header: 'Item', render: (r) => <ItemCell r={r} /> },
          { key: 'category', header: 'Category', render: (r) => r.categoryName },
          { key: 'rack', header: 'Rack', render: (r) => r.rackLocation || <span className="muted">—</span> },
          {
            key: 'stock',
            header: 'In stock',
            align: 'right',
            render: (r) => <span className="num">{r.stockQty}</span>,
          },
          { key: 'value', header: 'Value at cost', ...moneyCell('costValue', 'strong') },
          {
            key: 'last',
            header: 'Last sold',
            render: (r) => (r.lastSoldAt ? formatDate(r.lastSoldAt) : <Badge tone="warning">Never sold</Badge>),
          },
          {
            key: 'idle',
            header: 'Days idle',
            align: 'right',
            render: (r) => <span className="num">{r.idleDays}</span>,
          },
        ]}
      />
    </div>
  );
}

const TABS = [
  { value: 'sales', label: 'Sales & profit', icon: Receipt },
  { value: 'items', label: 'Profit by item', icon: TrendingUp },
  { value: 'overrides', label: 'Price changes', icon: Tag },
  { value: 'cashiers', label: 'Staff', icon: Users },
  { value: 'stock', label: 'Stock value', icon: Boxes },
  { value: 'reorder', label: 'Reorder list', icon: ShoppingCart },
  { value: 'nonMoving', label: 'Not selling', icon: PackageX },
];

/** Tabs that show current stock rather than a date range. */
const STOCK_TABS = new Set(['stock', 'reorder', 'nonMoving']);

export function ReportsPage() {
  const [tab, setTab] = useState('sales');
  const [range, setRange] = useState({ from: daysAgoIso(6), to: todayIso() });

  return (
    <div className="page">
      <PageHeader title="Reports" description="Sales, profit and stock figures. Visible to admins only." />
      <div>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        {!STOCK_TABS.has(tab) && (
          <div className="row-wrap" style={{ marginBottom: 16 }}>
            <CalendarDays size={16} className="muted" />
            <input
              type="date"
              className="input"
              style={{ width: 160 }}
              value={range.from}
              max={range.to}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
            <span className="muted">to</span>
            <input
              type="date"
              className="input"
              style={{ width: 160 }}
              value={range.to}
              min={range.from}
              max={todayIso()}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
            <div className="segmented">
              {PRESETS.map((p) => {
                const from = p.from();
                const active = range.from === from && range.to === todayIso();
                return (
                  <button
                    key={p.label}
                    className={active ? 'active' : ''}
                    onClick={() => setRange({ from, to: todayIso() })}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {tab === 'sales' && <SalesSummary range={range} />}
        {tab === 'items' && <ProductProfit range={range} />}
        {tab === 'overrides' && <PriceOverrides range={range} />}
        {tab === 'cashiers' && <CashierPerformance range={range} />}
        {tab === 'stock' && <StockValuation />}
        {tab === 'reorder' && <ReorderList />}
        {tab === 'nonMoving' && <NonMovingStock />}
      </div>
    </div>
  );
}
