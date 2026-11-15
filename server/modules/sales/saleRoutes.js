import { Router } from 'express';
import { z } from 'zod';
import { parse, parseId } from '../../core/validation.js';
import { listQuerySchema, createSaleSchema, createReturnSchema } from '../../../shared/schemas/index.js';
import { PAYMENT_METHODS, SALE_STATUSES } from '../../../shared/constants.js';
import * as saleService from './saleService.js';
import * as returnService from './returnService.js';

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

const saleListQuery = listQuerySchema.extend({
  from: dateParam,
  to: dateParam,
  paymentMethod: z.enum(Object.values(PAYMENT_METHODS)).optional(),
  status: z.enum(Object.values(SALE_STATUSES)).optional(),
  cashierId: z.coerce.number().int().positive().optional(),
  overriddenOnly: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
});

const returnListQuery = listQuerySchema.extend({ from: dateParam, to: dateParam });

export const saleRoutes = Router();

saleRoutes.get('/', async (req, res) => {
  res.json(await saleService.listSales(parse(saleListQuery, req.query), req.user));
});

saleRoutes.get('/invoice/:invoiceNo', async (req, res) => {
  res.json(await saleService.findSaleByInvoice(String(req.params.invoiceNo), req.user.role));
});

saleRoutes.get('/:id', async (req, res) => {
  res.json(await saleService.getSale(parseId(req.params.id), req.user.role));
});

saleRoutes.post('/', async (req, res) => {
  res.status(201).json(await saleService.createSale(req.user, parse(createSaleSchema, req.body)));
});

export const returnRoutes = Router();

returnRoutes.get('/', async (req, res) => {
  res.json(await returnService.listReturns(parse(returnListQuery, req.query)));
});

returnRoutes.get('/:id', async (req, res) => {
  res.json(await returnService.getReturn(parseId(req.params.id)));
});

returnRoutes.post('/', async (req, res) => {
  res.status(201).json(await returnService.createReturn(req.user, parse(createReturnSchema, req.body)));
});
