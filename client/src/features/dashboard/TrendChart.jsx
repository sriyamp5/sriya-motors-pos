import { useMemo, useState } from 'react';
import { formatDate, formatMoney } from '@/lib/format.js';

const HEIGHT = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 64 };
const VIEW_WIDTH = 760;

/** Rounds the axis maximum up to a readable value (1, 2 or 5 × 10^n). */
function niceMax(value) {
  if (value <= 0) return 1000;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * power >= value);
  return step * power;
}

const compact = (v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

/** Path for a bar with 4px rounded top corners, anchored to the baseline. */
function barPath(x, y, width, height) {
  if (height <= 0) return '';
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

/**
 * Daily sales and gross profit for the last two weeks as grouped bars on one
 * rupee axis. Hovering a day shows exact values.
 */
export function TrendChart({ data }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const { max, ticks } = useMemo(() => {
    const top = niceMax(Math.max(...data.map((d) => Math.max(d.revenue, d.profit)), 0));
    return { max: top, ticks: [0, 1, 2, 3, 4, 5].map((i) => (top * i) / 5) };
  }, [data]);

  const plotWidth = VIEW_WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotWidth / data.length;
  const barWidth = Math.min(16, (slot - 10) / 2);
  const y = (v) => PAD.top + plotHeight - (Math.max(v, 0) / max) * plotHeight;

  return (
    <div className="stack-sm">
      <div className="row-between">
        <div className="legend">
          <span>
            <i style={{ background: 'var(--chart-1)' }} /> Sales
          </span>
          <span>
            <i style={{ background: 'var(--chart-2)' }} /> Gross profit
          </span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {showTable ? (
        <div className="table-wrap" style={{ maxHeight: HEIGHT }}>
          <table className="table table-compact">
            <thead>
              <tr>
                <th>Day</th>
                <th className="text-right">Bills</th>
                <th className="text-right">Sales</th>
                <th className="text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day}>
                  <td>{formatDate(d.day)}</td>
                  <td className="text-right num">{d.salesCount}</td>
                  <td className="text-right num">{formatMoney(d.revenue, false)}</td>
                  <td className="text-right num">{formatMoney(d.profit, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg
            className="chart"
            viewBox={`0 0 ${VIEW_WIDTH} ${HEIGHT}`}
            role="img"
            aria-label="Sales and gross profit for the last 14 days"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid-line" x1={PAD.left} x2={VIEW_WIDTH - PAD.right} y1={y(t)} y2={y(t)} />
                <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
                  {compact(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x0 = PAD.left + i * slot + (slot - barWidth * 2 - 2) / 2;
              const label = new Date(d.day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
              return (
                <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect
                    className="bar-hit"
                    x={PAD.left + i * slot}
                    y={PAD.top}
                    width={slot}
                    height={plotHeight}
                    rx={4}
                  />
                  <path
                    className="bar-revenue"
                    d={barPath(x0, y(d.revenue), barWidth, PAD.top + plotHeight - y(d.revenue))}
                  />
                  <path
                    className="bar-profit"
                    d={barPath(x0 + barWidth + 2, y(d.profit), barWidth, PAD.top + plotHeight - y(d.profit))}
                  />
                  {(i % 2 === data.length % 2 || data.length <= 7) && (
                    <text x={PAD.left + i * slot + slot / 2} y={HEIGHT - 8} textAnchor="middle">
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div
              className="chart-tooltip"
              style={{
                left: `${((PAD.left + hover * slot + slot / 2) / VIEW_WIDTH) * 100}%`,
                top: 0,
                transform: hover > data.length / 2 ? 'translateX(-105%)' : 'translateX(5%)',
              }}
            >
              <div className="strong">{formatDate(data[hover].day)}</div>
              <div>
                Sales: <strong className="num">{formatMoney(data[hover].revenue)}</strong>
              </div>
              <div>
                Profit: <strong className="num">{formatMoney(data[hover].profit)}</strong>
              </div>
              <div className="muted">{data[hover].salesCount} bill(s)</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
