import { Router } from 'express';
import { z } from 'zod';
import { parse, parseId } from '../../core/validation.js';
import { requireRole } from '../../middleware/auth.js';
import { ROLES } from '../../../shared/constants.js';
import {
  listQuerySchema,
  booleanFlag,
  createProductSchema,
  updateProductSchema,
  stockAdjustmentSchema,
} from '../../../shared/schemas/index.js';
import * as productService from './productService.js';

const optionalPositiveInt = z.coerce.number().int().positive().optional();

const productListQuery = listQuerySchema.extend({
  categoryId: optionalPositiveInt,
  brandId: optionalPositiveInt,
  makeId: optionalPositiveInt,
  vehicleModelId: optionalPositiveInt,
  stock: z.enum(['low', 'out', 'available', 'reorder']).optional(),
  sort: z.enum(['name', 'newest', 'stockAsc', 'priceAsc', 'priceDesc']).optional(),
});

const adminOnly = requireRole(ROLES.ADMIN);

export const productRoutes = Router();

productRoutes.get('/', async (req, res) => {
  res.json(await productService.listProducts(parse(productListQuery, req.query), req.user.role));
});

productRoutes.get('/lookup/:code', async (req, res) => {
  const code = String(req.params.code ?? '').trim();
  res.json(await productService.findByCode(code, req.user.role));
});

productRoutes.get('/:id', async (req, res) => {
  res.json(await productService.getProduct(parseId(req.params.id), req.user.role));
});

productRoutes.get('/:id/movements', adminOnly, async (req, res) => {
  res.json(await productService.listMovements(parseId(req.params.id), parse(listQuerySchema, req.query)));
});

productRoutes.post('/', adminOnly, async (req, res) => {
  res.status(201).json(await productService.createProduct(req.user, parse(createProductSchema, req.body)));
});

productRoutes.put('/:id', adminOnly, async (req, res) => {
  res.json(await productService.updateProduct(req.user, parseId(req.params.id), parse(updateProductSchema, req.body)));
});

productRoutes.patch('/:id/active', adminOnly, async (req, res) => {
  const { isActive } = parse(z.object({ isActive: booleanFlag }), req.body);
  res.json(await productService.setProductActive(req.user, parseId(req.params.id), isActive));
});

productRoutes.delete('/:id', adminOnly, async (req, res) => {
  await productService.deleteProduct(req.user, parseId(req.params.id));
  res.status(204).end();
});

export const stockRoutes = Router();

stockRoutes.get('/adjustments', adminOnly, async (req, res) => {
  res.json(await productService.listAdjustments(parse(listQuerySchema, req.query)));
});

stockRoutes.post('/adjustments', adminOnly, async (req, res) => {
  res.status(201).json(await productService.adjustStock(req.user, parse(stockAdjustmentSchema, req.body)));
});
