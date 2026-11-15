import { Link } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  ScanBarcode,
  Boxes,
  BookUser,
  Tag,
  BarChart3,
  Undo2,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { formatMoney, formatTime } from '@/lib/format.js';
import { Badge, Button, Card, EmptyState, ErrorState, Loader, PageHeader, StatCard } from '@/components/ui/index.js';
import { PaymentBadge } from '@/features/sales/saleLabels.jsx';
import { TrendChart } from './TrendChart.jsx';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

function LowStockList({ items }) {
  if (!items.length)
    return <EmptyState icon={Boxes} title="Stock levels look good" message="No items are at their low stock level." />;
  return (
    <div>
      {items.map((p) => (
        <div key={p.id} className="list-row">
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="strong truncate">{p.name}</div>
            <div className="small muted">
              {[p.itemCode, p.partNumber, p.rackLocation && `Rack ${p.rackLocation}`].filter(Boolean).join(' · ')}
            </div>
          </div>
          <Badge tone={p.stockQty <= 0 ? 'danger' : 'warning'}>{p.stockQty <= 0 ? 'Out' : `${p.stockQty} left`}</Badge>
        </div>
      ))}
    </div>
  );
}

function RecentSales({ sales }) {
  if (!sales.length)
    return <EmptyState icon={ShoppingBag} title="No sales yet" message="Completed bills will appear here." />;
  return (
    <div>
      {sales.map((s) => (
        <div key={s.id} className="list-row">
          <span className="mono strong" style={{ width: 96 }}>
            {s.invoiceNo}
          </span>
          <span className="grow small text-2 truncate">
            {s.customerName || 'Walk-in'} · {s.cashierName}
          </span>
          <PaymentBadge method={s.paymentMethod} />
          <span className="small muted" style={{ width: 64, textAlign: 'right' }}>
            {formatTime(s.createdAt)}
          </span>
          <span className="num strong" style={{ width: 110, textAlign: 'right' }}>
            {formatMoney(s.totalAmount, false)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { data, loading, error, reload } = useApi('/reports/dashboard');

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const { today, stock } = data;

  return (
    <div className="page">
      <PageHeader
        title={`${greeting()}, ${user.fullName.split(' ')[0]}`}
        description={isAdmin ? 'Here is how the shop is doing today.' : 'Your sales today.'}
        actions={
          <Link to="/pos">
            <Button variant="accent" size="lg" icon={ScanBarcode}>
              New sale
            </Button>
          </Link>
        }
      />

      <div className="grid-4">
        <StatCard
          icon={Wallet}
          label={isAdmin ? "Today's sales" : 'My sales today'}
          value={formatMoney(today.revenue)}
          sub={`${today.salesCount} bill(s) · ${today.itemsSold} item(s)`}
        />
        {isAdmin ? (
          <StatCard
            icon={TrendingUp}
            tone="success"
            label="Today's profit"
            value={formatMoney(today.netProfit)}
            sub={
              today.refunds > 0
                ? `After ${formatMoney(today.refunds)} in returns`
                : `Gross ${formatMoney(today.grossProfit)}`
            }
          />
        ) : (
          <StatCard
            icon={Undo2}
            tone="accent"
            label="Returns today"
            value={today.returnCount}
            sub={formatMoney(today.refunds)}
          />
        )}
        <StatCard
          icon={AlertTriangle}
          tone={stock.outCount > 0 ? 'danger' : 'warning'}
          label="Low / out of stock"
          value={`${stock.lowCount} / ${stock.outCount}`}
          sub={`of ${stock.itemCount} active items`}
        />
        {isAdmin ? (
          <StatCard
            icon={BookUser}
            tone="accent"
            label="Credit outstanding"
            value={formatMoney(data.credit.outstanding)}
            sub={`${data.credit.debtors} customer(s)`}
          />
        ) : (
          <StatCard icon={Boxes} label="Active items" value={stock.itemCount} />
        )}
      </div>

      {isAdmin && (
        <div className="grid-3">
          <StatCard
            icon={Boxes}
            label="Stock value (cost)"
            value={formatMoney(stock.costValue)}
            sub={`Retail value ${formatMoney(stock.retailValue)}`}
          />
          <StatCard
            icon={Tag}
            tone="accent"
            label="Price changes today"
            value={today.priceOverrides}
            sub={
              today.priceOverrides ? `Net effect ${formatMoney(today.priceOverrideImpact)}` : 'All sold at system price'
            }
          />
          <StatCard
            icon={Undo2}
            tone="warning"
            label="Returns today"
            value={today.returnCount}
            sub={formatMoney(today.refunds)}
          />
        </div>
      )}

      <div className="dashboard-grid">
        <div className="stack-lg">
          {isAdmin && (
            <Card
              title="Last 14 days"
              icon={BarChart3}
              actions={
                <Link to="/reports" className="small">
                  Full reports →
                </Link>
              }
            >
              <TrendChart data={data.trend} />
            </Card>
          )}
          <Card
            title="Recent sales"
            icon={ShoppingBag}
            flush
            actions={
              <Link to="/sales" className="small">
                All sales →
              </Link>
            }
          >
            <RecentSales sales={data.recentSales} />
          </Card>
        </div>
        <div className="stack-lg">
          <Card
            title="Needs restocking"
            icon={AlertTriangle}
            flush
            actions={
              <Link to="/products" className="small">
                Items →
              </Link>
            }
          >
            <LowStockList items={data.lowStock} />
          </Card>
          {isAdmin && data.topProducts.length > 0 && (
            <Card title="Best sellers · 7 days" icon={TrendingUp} flush>
              {data.topProducts.map((p, index) => (
                <div key={p.productId} className="list-row">
                  <span className="muted num" style={{ width: 18 }}>
                    {index + 1}
                  </span>
                  <span className="grow strong truncate">{p.productName}</span>
                  <span className="small muted num">{p.quantity} sold</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
