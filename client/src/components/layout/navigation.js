import {
  LayoutDashboard,
  ScanBarcode,
  Receipt,
  Undo2,
  Package,
  Truck,
  ClipboardList,
  Users,
  Factory,
  Tags,
  Award,
  Car,
  BarChart3,
  Wallet,
  UserCog,
  Settings,
  History,
} from 'lucide-react';
import { ROLES } from '@shared/constants.js';

const ALL = [ROLES.ADMIN, ROLES.CASHIER];
const ADMIN = [ROLES.ADMIN];

/** Sidebar structure. Items are filtered by the signed-in user's role. */
export const NAVIGATION = [
  {
    title: null,
    items: [
      { to: '/pos', label: 'New sale', icon: ScanBarcode, roles: ALL, primary: true, shortcut: 'F1' },
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ALL, end: true },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/sales', label: 'Sales history', icon: Receipt, roles: ALL },
      { to: '/returns', label: 'Returns', icon: Undo2, roles: ALL },
      { to: '/customers', label: 'Customers', icon: Users, roles: ALL },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { to: '/products', label: 'Items', icon: Package, roles: ALL, badge: 'lowStock' },
      { to: '/purchases', label: 'Receive stock', icon: Truck, roles: ADMIN },
      { to: '/stock-adjustments', label: 'Stock adjustments', icon: ClipboardList, roles: ADMIN },
      { to: '/suppliers', label: 'Suppliers', icon: Factory, roles: ADMIN },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { to: '/categories', label: 'Categories', icon: Tags, roles: ADMIN },
      { to: '/brands', label: 'Brands', icon: Award, roles: ADMIN },
      { to: '/vehicles', label: 'Vehicles', icon: Car, roles: ADMIN },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3, roles: ADMIN },
      { to: '/day-close', label: 'Day end', icon: Wallet, roles: ADMIN },
      { to: '/users', label: 'Users', icon: UserCog, roles: ADMIN },
      { to: '/audit-log', label: 'Activity log', icon: History, roles: ADMIN },
      { to: '/settings', label: 'Settings', icon: Settings, roles: ADMIN },
    ],
  },
];

/** Page titles for the top bar. */
export const PAGE_TITLES = {
  '/': 'Dashboard',
  '/pos': 'New sale',
  '/sales': 'Sales history',
  '/returns': 'Returns',
  '/customers': 'Customers',
  '/products': 'Items',
  '/purchases': 'Receive stock',
  '/purchases/new': 'Receive stock',
  '/stock-adjustments': 'Stock adjustments',
  '/suppliers': 'Suppliers',
  '/categories': 'Categories',
  '/brands': 'Brands',
  '/vehicles': 'Vehicles',
  '/reports': 'Reports',
  '/day-close': 'Day end',
  '/users': 'Users',
  '/audit-log': 'Activity log',
  '/settings': 'Settings',
};
