import { Router } from 'express';
import { z } from 'zod';
import { parse, parseId } from '../../core/validation.js';
import { listQuerySchema, createPurchaseSchema } from '../../../shared/schemas/index.js';
import * as purchaseService from './purchaseService.js';

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

const purchaseListQuery = listQuerySchema.extend({
  from: dateParam,
  to: dateParam,
  supplierId: z.coerce.number().int().positive().optional(),
});

export const purchaseRoutes = Router();

purchaseRoutes.get('/', async (req, res) => {
  res.json(await purchaseService.listPurchases(parse(purchaseListQuery, req.query)));
});

purchaseRoutes.get('/:id', async (req, res) => {
  res.json(await purchaseService.getPurchase(parseId(req.params.id)));
});

purchaseRoutes.post('/', async (req, res) => {
  res.status(201).json(await purchaseService.createPurchase(req.user, parse(createPurchaseSchema, req.body)));
});
