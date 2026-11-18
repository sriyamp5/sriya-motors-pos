import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../../core/validation.js';
import { requireRole } from '../../middleware/auth.js';
import { ROLES } from '../../../shared/constants.js';
import { cashClosingSchema, isoDate } from '../../../shared/schemas/index.js';
import * as reportService from './reportService.js';

const rangeSchema = z
  .object({ from: isoDate('From date'), to: isoDate('To date') })
  .refine((r) => r.from <= r.to, { path: ['to'], message: 'To date must be after from date' });

const adminOnly = requireRole(ROLES.ADMIN);

export const reportRoutes = Router();

reportRoutes.get('/dashboard', async (req, res) => {
  res.json(await reportService.getDashboard(req.user));
});

reportRoutes.get('/sales-summary', adminOnly, async (req, res) => {
  res.json(await reportService.getSalesSummary(parse(rangeSchema, req.query)));
});

reportRoutes.get('/product-profit', adminOnly, async (req, res) => {
  res.json(await reportService.getProductProfit(parse(rangeSchema, req.query)));
});

reportRoutes.get('/price-overrides', adminOnly, async (req, res) => {
  res.json(await reportService.getPriceOverrides(parse(rangeSchema, req.query)));
});

reportRoutes.get('/cashiers', adminOnly, async (req, res) => {
  res.json(await reportService.getCashierPerformance(parse(rangeSchema, req.query)));
});

reportRoutes.get('/reorder', adminOnly, async (_req, res) => {
  res.json(await reportService.getReorderList());
});

const nonMovingSchema = z.object({
  days: z.coerce
    .number({ error: 'Enter the number of days' })
    .int()
    .min(7, 'At least 7 days')
    .max(730, 'At most 730 days')
    .default(90),
});

reportRoutes.get('/non-moving', adminOnly, async (req, res) => {
  res.json(await reportService.getNonMovingStock(parse(nonMovingSchema, req.query)));
});

reportRoutes.get('/stock-valuation', adminOnly, async (_req, res) => {
  res.json(await reportService.getStockValuation());
});

export const cashClosingRoutes = Router();

cashClosingRoutes.use(adminOnly);

cashClosingRoutes.get('/', async (_req, res) => {
  res.json(await reportService.listClosings());
});

cashClosingRoutes.get('/summary', async (req, res) => {
  const { date } = parse(z.object({ date: isoDate('Date') }), req.query);
  res.json(await reportService.getDaySummary(date));
});

cashClosingRoutes.post('/', async (req, res) => {
  res.status(201).json(await reportService.closeDay(req.user, parse(cashClosingSchema, req.body)));
});
