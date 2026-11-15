import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { SystemGate } from './features/system/SystemGate.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { Loader } from './components/ui/index.js';
import { LoginPage } from './features/auth/LoginPage.jsx';
import { ChangePasswordPage } from './features/auth/ChangePasswordPage.jsx';
import { DashboardPage } from './features/dashboard/DashboardPage.jsx';
import { PosPage } from './features/pos/PosPage.jsx';
import { SalesPage } from './features/sales/SalesPage.jsx';
import { ReturnsPage } from './features/sales/ReturnsPage.jsx';
import { ProductsPage } from './features/products/ProductsPage.jsx';
import { PurchasesPage } from './features/stock/PurchasesPage.jsx';
import { NewPurchasePage } from './features/stock/NewPurchasePage.jsx';
import { AdjustmentsPage } from './features/stock/AdjustmentsPage.jsx';
import { CustomersPage } from './features/customers/CustomersPage.jsx';
import { CategoriesPage, BrandsPage, SuppliersPage } from './features/masterData/masterDataPages.jsx';
import { VehiclesPage } from './features/masterData/VehiclesPage.jsx';
import { ReportsPage } from './features/reports/ReportsPage.jsx';
import { DayClosePage } from './features/reports/DayClosePage.jsx';
import { UsersPage } from './features/users/UsersPage.jsx';
import { SettingsPage } from './features/settings/SettingsPage.jsx';
import { AuditLogPage } from './features/settings/AuditLogPage.jsx';
import { ROLES } from '@shared/constants.js';

function RequireRole({ role, children }) {
  const { user } = useAuth();
  return user?.role === role ? children : <Navigate to="/" replace />;
}

const adminOnly = (element) => <RequireRole role={ROLES.ADMIN}>{element}</RequireRole>;

function AuthenticatedRoutes() {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div className="center-screen">
        <Loader label="Starting..." />
      </div>
    );
  if (!user) return <LoginPage />;
  if (user.mustChangePassword) return <ChangePasswordPage forced />;

  return (
    <SettingsProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="pos" element={<PosPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="returns" element={<ReturnsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="purchases" element={adminOnly(<PurchasesPage />)} />
          <Route path="purchases/new" element={adminOnly(<NewPurchasePage />)} />
          <Route path="stock-adjustments" element={adminOnly(<AdjustmentsPage />)} />
          <Route path="suppliers" element={adminOnly(<SuppliersPage />)} />
          <Route path="categories" element={adminOnly(<CategoriesPage />)} />
          <Route path="brands" element={adminOnly(<BrandsPage />)} />
          <Route path="vehicles" element={adminOnly(<VehiclesPage />)} />
          <Route path="reports" element={adminOnly(<ReportsPage />)} />
          <Route path="day-close" element={adminOnly(<DayClosePage />)} />
          <Route path="users" element={adminOnly(<UsersPage />)} />
          <Route path="settings" element={adminOnly(<SettingsPage />)} />
          <Route path="audit-log" element={adminOnly(<AuditLogPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SettingsProvider>
  );
}

export function App() {
  return (
    <SystemGate>
      <AuthProvider>
        <AuthenticatedRoutes />
      </AuthProvider>
    </SystemGate>
  );
}
