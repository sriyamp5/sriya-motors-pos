import { Router } from 'express';
import { z } from 'zod';
import { parse, parseId } from '../../core/validation.js';
import { requireRole } from '../../middleware/auth.js';
import { ROLES } from '../../../shared/constants.js';
import {
  listQuerySchema,
  booleanFlag,
  categorySchema,
  brandSchema,
  vehicleMakeSchema,
  vehicleModelSchema,
  supplierSchema,
  customerSchema,
} from '../../../shared/schemas/index.js';
import { createMasterDataService } from './createMasterDataService.js';

export const categoryService = createMasterDataService({
  table: 'categories',
  label: 'Category',
  columns: { name: 'name', description: 'description' },
  searchColumns: ['t.name', 't.description'],
  select: '(SELECT COUNT(*) FROM products p WHERE p.category_id = t.id AND p.is_active = 1) AS product_count',
});

export const brandService = createMasterDataService({
  table: 'brands',
  label: 'Brand',
  columns: { name: 'name', country: 'country' },
  searchColumns: ['t.name', 't.country'],
  select: '(SELECT COUNT(*) FROM products p WHERE p.brand_id = t.id AND p.is_active = 1) AS product_count',
});

export const vehicleMakeService = createMasterDataService({
  table: 'vehicle_makes',
  label: 'Vehicle make',
  columns: { name: 'name' },
  searchColumns: ['t.name'],
  select: '(SELECT COUNT(*) FROM vehicle_models m WHERE m.make_id = t.id AND m.is_active = 1) AS model_count',
});

export const vehicleModelService = createMasterDataService({
  table: 'vehicle_models',
  label: 'Vehicle model',
  columns: { makeId: 'make_id', name: 'name', vehicleType: 'vehicle_type' },
  searchColumns: ['t.name', 'mk.name'],
  select: 'mk.name AS make_name',
  joins: 'JOIN vehicle_makes mk ON mk.id = t.make_id',
  filters: { makeId: 't.make_id' },
  orderBy: 'mk.name, t.name',
});

export const supplierService = createMasterDataService({
  table: 'suppliers',
  label: 'Supplier',
  columns: {
    name: 'name',
    contactPerson: 'contact_person',
    phone: 'phone',
    email: 'email',
    address: 'address',
    notes: 'notes',
  },
  searchColumns: ['t.name', 't.contact_person', 't.phone'],
});

export const customerService = createMasterDataService({
  table: 'customers',
  label: 'Customer',
  columns: { name: 'name', phone: 'phone', address: 'address', vehicleNo: 'vehicle_no', notes: 'notes' },
  searchColumns: ['t.name', 't.phone', 't.vehicle_no'],
});

const masterListQuery = listQuerySchema.extend({
  makeId: z.coerce.number().int().positive().optional(),
});

const activeSchema = z.object({ isActive: booleanFlag });

/**
 * Mounts list/options/get for everyone signed in and write operations for
 * the given roles.
 */
function buildRoutes(service, schema, writeRoles) {
  const router = Router();
  const canWrite = requireRole(...writeRoles);

  router.get('/', async (req, res) => {
    res.json(await service.list(parse(masterListQuery, req.query)));
  });
  router.get('/options', async (req, res) => {
    res.json(await service.options(parse(masterListQuery, req.query)));
  });
  router.get('/:id', async (req, res) => {
    res.json(await service.get(parseId(req.params.id)));
  });
  router.post('/', canWrite, async (req, res) => {
    res.status(201).json(await service.create(req.user, parse(schema, req.body)));
  });
  router.put('/:id', canWrite, async (req, res) => {
    res.json(await service.update(req.user, parseId(req.params.id), parse(schema, req.body)));
  });
  router.patch('/:id/active', requireRole(ROLES.ADMIN), async (req, res) => {
    const { isActive } = parse(activeSchema, req.body);
    res.json(await service.setActive(req.user, parseId(req.params.id), isActive));
  });
  router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
    await service.remove(req.user, parseId(req.params.id));
    res.status(204).end();
  });
  return router;
}

const ADMIN_ONLY = [ROLES.ADMIN];
const ALL_STAFF = [ROLES.ADMIN, ROLES.CASHIER];

export const categoryRoutes = buildRoutes(categoryService, categorySchema, ADMIN_ONLY);
export const brandRoutes = buildRoutes(brandService, brandSchema, ADMIN_ONLY);
export const vehicleMakeRoutes = buildRoutes(vehicleMakeService, vehicleMakeSchema, ADMIN_ONLY);
export const vehicleModelRoutes = buildRoutes(vehicleModelService, vehicleModelSchema, ADMIN_ONLY);
export const supplierRoutes = buildRoutes(supplierService, supplierSchema, ADMIN_ONLY);
export const customerBaseRoutes = buildRoutes(customerService, customerSchema, ALL_STAFF);
