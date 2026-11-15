# Database

MySQL 8, schema `sriya_pos` by default, `utf8mb4`. The schema is created by `server/db/migrations/001_initial_schema.sql`.

## Tables

| Table | Purpose |
| --- | --- |
| `users` | Staff accounts. `role` is `ADMIN` or `CASHIER`. `token_version` invalidates sessions. |
| `settings` | Key/value shop settings (name, address, receipt footer, printer, backup folder, selling rules). |
| `categories` | Item groups (Filters, Brake System, ...). |
| `brands` | Part manufacturers (Denso, Bosch, Toyota Genuine, ...). |
| `vehicle_makes`, `vehicle_models` | Toyota → Axio, Bajaj → RE 4S, etc., with vehicle type. |
| `products` | Spare parts. See the field list below. |
| `product_fitments` | Which vehicle models a part fits, with an optional year range. |
| `suppliers` | Companies stock is bought from. |
| `purchases`, `purchase_items` | Goods received notes (GRN). Lines keep the previous cost and any new selling price. |
| `customers` | Customers, with `credit_balance` for credit sales. |
| `customer_payments` | Payments received against a credit balance. |
| `sales`, `sale_items` | Invoices and their lines. |
| `sale_returns`, `sale_return_items` | Returns against an invoice. |
| `stock_movements` | Every stock change with the resulting balance. |
| `cash_closings` | End-of-day cash counts. |
| `audit_logs` | Activity log of important actions. |
| `schema_migrations` | Applied migration files. |

### Product fields

| Field | Notes |
| --- | --- |
| `item_code` | Internal code generated as `SM00001`. Can be typed at the till. |
| `barcode` | Optional and unique. Manufacturer barcode or one printed later. |
| `name`, `part_number` | Part number is the OEM / manufacturer number (e.g. `90915-YZZE1`). |
| `category_id`, `brand_id` | Brand is optional. |
| `part_type` | `GENUINE`, `OEM`, `AFTERMARKET`, `RECONDITIONED`, `USED` |
| `unit` | `PCS`, `SET`, `PAIR`, `KIT`, `LITRE`, `BOTTLE`, `METRE`, `BOX` |
| `cost_price`, `selling_price` | Buying price (admin only) and the default selling price. |
| `stock_qty`, `reorder_level` | Stock is changed only through the stock ledger. |
| `rack_location` | Shelf or bin, shown at the till so the cashier can find the part. |
| `warranty_months` | Printed on the receipt when set. |

## Recording price changes at the till

Each `sale_items` row stores:

- `unit_cost`: buying price at the moment of sale
- `list_price`: the system selling price at the moment of sale
- `unit_price`: the price actually charged
- `price_overridden`: `1` when `unit_price` differs from `list_price`

`sales.has_price_override` marks invoices that contain such lines. An `audit_logs` entry (`PRICE_OVERRIDE`) records who changed what. The **Reports → Price changes** tab lists every changed line with its effect (`(unit_price - list_price) × quantity`).

By default a cashier cannot sell below the buying price, either through a price change or a discount. An admin can allow it under **Settings → Shop → Selling rules**.

## Money and profit rules

- Totals are recalculated on the server from integer cents and stored as `DECIMAL(12,2)`.
- `sales.total_amount = subtotal - item_discount_total - bill_discount`
- Gross profit of a sale = `total_amount - total_cost`.
- The refund for a returned unit is its share of the line total **after** the bill discount, so a customer is never refunded more than they paid.
- Net profit = gross profit − (refunds − cost of returned items put back into stock).

## Stock rules

`server/modules/stock/stockLedger.js` is the only code that changes `products.stock_qty`. Inside a transaction it locks the product row, prevents negative stock, updates the quantity and writes a `stock_movements` row with the new balance. Movement types are `OPENING`, `PURCHASE`, `SALE`, `RETURN` and `ADJUSTMENT`.

## Migrations

- Files in `server/db/migrations/` named `NNN_description.sql` run once, in order, at start-up.
- Before applying updates to a database that already has data, a `pre-update` backup is taken automatically.
- **Never edit a migration that has been released.** Add a new file instead, for example `002_add_customer_email.sql`.
- Keep migrations additive where possible (add columns with defaults) so older backups can still be restored and upgraded.
