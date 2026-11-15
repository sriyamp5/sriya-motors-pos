import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { authenticate, requirePasswordChanged, requireRole } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { serviceUnavailable } from './core/errors.js';
import { getDbState, DB_STATUS } from './db/database.js';
import { ROLES } from '../shared/constants.js';
import { systemRoutes } from './modules/system/systemRoutes.js';
import { authRoutes } from './modules/auth/authRoutes.js';
import { userRoutes } from './modules/users/userRoutes.js';
import {
  categoryRoutes,
  brandRoutes,
  vehicleMakeRoutes,
  vehicleModelRoutes,
  supplierRoutes,
} from './modules/masterData/masterDataRoutes.js';
import { customerRoutes } from './modules/customers/customerRoutes.js';
import { productRoutes, stockRoutes } from './modules/products/productRoutes.js';
import { purchaseRoutes } from './modules/purchases/purchaseRoutes.js';
import { saleRoutes, returnRoutes } from './modules/sales/saleRoutes.js';
import { reportRoutes, cashClosingRoutes } from './modules/reports/reportRoutes.js';
import { settingsRoutes, backupRoutes, auditRoutes } from './modules/settings/settingsRoutes.js';

/** Rejects API calls with a clear message while the database is unavailable. */
function requireDatabase(_req, _res, next) {
  const state = getDbState();
  if (state.status !== DB_STATUS.READY) {
    throw serviceUnavailable(state.message, 'DB_UNAVAILABLE');
  }
  next();
}

/**
 * @param {object} options
 * @param {string} [options.staticDir] built client to serve (production)
 */
export function createApp({ staticDir } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  // Public endpoints.
  app.use('/api/system', systemRoutes);
  app.use('/api', requireDatabase);
  app.use('/api/auth', authRoutes);

  // Everything below requires a signed-in user who has set their own password.
  const secured = express.Router();
  secured.use(authenticate, requirePasswordChanged);

  const adminOnly = requireRole(ROLES.ADMIN);

  secured.use('/users', adminOnly, userRoutes);
  secured.use('/categories', categoryRoutes);
  secured.use('/brands', brandRoutes);
  secured.use('/vehicle-makes', vehicleMakeRoutes);
  secured.use('/vehicle-models', vehicleModelRoutes);
  secured.use('/suppliers', supplierRoutes);
  secured.use('/customers', customerRoutes);
  secured.use('/products', productRoutes);
  secured.use('/stock', stockRoutes);
  secured.use('/purchases', adminOnly, purchaseRoutes);
  secured.use('/sales', saleRoutes);
  secured.use('/returns', returnRoutes);
  secured.use('/reports', reportRoutes);
  secured.use('/cash-closings', cashClosingRoutes);
  secured.use('/settings', settingsRoutes);
  secured.use('/backups', backupRoutes);
  secured.use('/audit-logs', auditRoutes);

  app.use('/api', secured);
  app.use('/api', notFoundHandler);

  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    // Client-side routing: unknown paths return the single page app.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
