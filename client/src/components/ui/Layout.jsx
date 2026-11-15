export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row-wrap">{actions}</div>}
    </div>
  );
}

export function Card({ title, icon: Icon, actions, children, flush = false, footer, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          <h2>
            {Icon && <Icon size={18} className="muted" />}
            {title}
          </h2>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={`card-body ${flush ? 'flush' : ''}`}>{children}</div>
      {footer && <footer className="card-footer">{footer}</footer>}
    </section>
  );
}

export function StatCard({ label, value, sub, icon: Icon, tone }) {
  return (
    <div className="card stat-card">
      {Icon && (
        <div className={`stat-icon ${tone ?? ''}`}>
          <Icon size={20} />
        </div>
      )}
      <div className="grow">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(({ value: tabValue, label, icon: Icon }) => (
        <button
          key={tabValue}
          role="tab"
          aria-selected={value === tabValue}
          className={`tab ${value === tabValue ? 'active' : ''}`}
          onClick={() => onChange(tabValue)}
        >
          {Icon && <Icon size={16} />}
          {label}
        </button>
      ))}
    </div>
  );
}
