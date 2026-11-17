import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, KeyRound, ChevronDown, Monitor } from 'lucide-react';
import { useAuth } from '@/context/AuthContext.jsx';
import { useTheme } from '@/context/ThemeContext.jsx';
import { useHotkeys, useNow } from '@/hooks/useCommon.js';
import { api } from '@/api/client.js';
import { initials } from '@/lib/format.js';
import { ROLE_LABELS } from '@shared/constants.js';
import { Button } from '@/components/ui/index.js';
import { NAVIGATION, PAGE_TITLES } from './navigation.js';
import { UpdateBanner } from './UpdateBanner.jsx';
import { ConnectionBanner } from './ConnectionBanner.jsx';
import { serverVersion } from '@/lib/runtime.js';
import { ChangePasswordModal } from '@/features/auth/ChangePasswordPage.jsx';
import logoMark from '@/assets/logo-mark.png';

const LOW_STOCK_POLL_MS = 2 * 60 * 1000;

/** Polls the number of items at or below their low stock level for the sidebar badge. */
function useLowStockCount() {
  const [count, setCount] = useState(0);
  const location = useLocation();
  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get('/products', { stock: 'reorder', pageSize: 1 })
        .then((r) => active && setCount(r.total))
        .catch(() => {});
    load();
    const timer = setInterval(load, LOW_STOCK_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [location.pathname]);
  return count;
}

function Sidebar() {
  const { user } = useAuth();
  const lowStock = useLowStockCount();
  // The desktop app reports its installed version; the online version gets it from the server.
  const [version, setVersion] = useState(serverVersion);

  useEffect(() => {
    window.desktop
      ?.getInfo()
      .then((info) => setVersion(info.version))
      .catch(() => {});
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={logoMark} alt="" />
        <div>
          <div className="sidebar-brand-name">
            SRIYA <span>MOTORS</span>
          </div>
          <div className="sidebar-brand-sub">POINT OF SALE</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAVIGATION.map((section, index) => {
          const items = section.items.filter((item) => item.roles.includes(user.role));
          if (!items.length) return null;
          return (
            <div key={section.title ?? index} className={section.title ? 'nav-section' : ''}>
              {section.title && <div className="nav-section-title">{section.title}</div>}
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    ['nav-link', item.primary && 'nav-link-primary', isActive && 'active'].filter(Boolean).join(' ')
                  }
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className="nav-badge" style={{ background: 'rgba(0,0,0,.18)' }}>
                      {item.shortcut}
                    </span>
                  )}
                  {item.badge === 'lowStock' && lowStock > 0 && (
                    <span className="nav-badge" title="Items at or below low stock level">
                      {lowStock}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <span>Sriya Motors (Pvt) Ltd</span>
        {version && <span>v{version}</span>}
      </div>
    </aside>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'Same as Windows', icon: Monitor },
  ];

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="user-button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <span className="avatar">{initials(user.fullName)}</span>
        <span className="user-meta">
          <div className="user-name">{user.fullName}</div>
          <div className="user-role">{ROLE_LABELS[user.role]}</div>
        </span>
        <ChevronDown size={16} className="muted" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-label">Appearance</div>
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              className="menu-item"
              onClick={() => {
                setPreference(value);
                setOpen(false);
              }}
              role="menuitemradio"
              aria-checked={preference === value}
            >
              <Icon size={16} />
              {label}
              {preference === value && (
                <span className="text-accent" style={{ marginLeft: 'auto' }}>
                  ●
                </span>
              )}
            </button>
          ))}
          <div className="divider" />
          <button
            className="menu-item"
            onClick={() => {
              setOpen(false);
              setChangingPassword(true);
            }}
          >
            <KeyRound size={16} /> Change password
          </button>
          <button className="menu-item danger" onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
      <ChangePasswordModal open={changingPassword} onClose={() => setChangingPassword(false)} />
    </div>
  );
}

function Topbar() {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const now = useNow();
  const title = PAGE_TITLES[location.pathname] ?? '';

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-actions">
        <span className="topbar-clock">
          {now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} ·{' '}
          {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </span>
        <Button
          variant="ghost"
          iconOnly
          icon={theme === 'dark' ? Sun : Moon}
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        />
        <UserMenu />
      </div>
    </header>
  );
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isPos = location.pathname === '/pos';

  useHotkeys({
    F1: (e) => {
      e.preventDefault();
      navigate('/pos');
    },
  });

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <Topbar />
        <ConnectionBanner />
        <UpdateBanner />
        <main className={`content ${isPos ? 'flush' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
