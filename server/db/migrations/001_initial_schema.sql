-- Sriya Motors POS - initial schema
-- Money columns use DECIMAL(12,2). Quantities are whole units.
-- IF NOT EXISTS lets an interrupted first run (e.g. power cut) complete on the next start.

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  username VARCHAR(30) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('ADMIN','CASHIER') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(60) PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB;

-- Manufacturer of the part itself (Denso, Bosch, NGK, Toyota Genuine ...).
CREATE TABLE IF NOT EXISTS brands (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  country VARCHAR(60) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_brands_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicle_makes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vehicle_makes_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicle_models (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  make_id INT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  vehicle_type ENUM('CAR','VAN','SUV','CAB','LORRY','BUS','THREE_WHEELER','MOTORCYCLE','TRACTOR','OTHER') NOT NULL DEFAULT 'CAR',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vehicle_models_make_name (make_id, name),
  CONSTRAINT fk_vehicle_models_make FOREIGN KEY (make_id) REFERENCES vehicle_makes (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100) NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  address VARCHAR(255) NULL,
  notes VARCHAR(500) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_suppliers_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NULL,
  address VARCHAR(255) NULL,
  vehicle_no VARCHAR(20) NULL,
  notes VARCHAR(500) NULL,
  credit_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customers_phone (phone),
  KEY ix_customers_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(20) NULL,
  barcode VARCHAR(64) NULL,
  name VARCHAR(150) NOT NULL,
  part_number VARCHAR(60) NULL,
  category_id INT UNSIGNED NOT NULL,
  brand_id INT UNSIGNED NULL,
  part_type ENUM('GENUINE','OEM','AFTERMARKET','RECONDITIONED','USED') NOT NULL DEFAULT 'AFTERMARKET',
  unit ENUM('PCS','SET','PAIR','KIT','LITRE','BOTTLE','METRE','BOX') NOT NULL DEFAULT 'PCS',
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(12,2) NOT NULL,
  stock_qty INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 0,
  rack_location VARCHAR(50) NULL,
  warranty_months SMALLINT UNSIGNED NULL,
  description VARCHAR(1000) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_products_item_code (item_code),
  UNIQUE KEY uq_products_barcode (barcode),
  KEY ix_products_name (name),
  KEY ix_products_part_number (part_number),
  KEY ix_products_category (category_id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands (id),
  CONSTRAINT fk_products_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB;

-- Which vehicles a part fits, optionally limited to a year range.
CREATE TABLE IF NOT EXISTS product_fitments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  vehicle_model_id INT UNSIGNED NOT NULL,
  year_from SMALLINT UNSIGNED NULL,
  year_to SMALLINT UNSIGNED NULL,
  KEY ix_fitments_product (product_id),
  KEY ix_fitments_model (vehicle_model_id),
  CONSTRAINT fk_fitments_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_fitments_model FOREIGN KEY (vehicle_model_id) REFERENCES vehicle_models (id)
) ENGINE=InnoDB;

-- Goods received from suppliers (GRN).
CREATE TABLE IF NOT EXISTS purchases (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  grn_no VARCHAR(20) NULL,
  supplier_id INT UNSIGNED NOT NULL,
  supplier_invoice_no VARCHAR(60) NULL,
  purchase_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_purchases_grn_no (grn_no),
  KEY ix_purchases_date (purchase_date),
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
  CONSTRAINT fk_purchases_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  previous_cost DECIMAL(12,2) NOT NULL,
  new_selling_price DECIMAL(12,2) NULL,
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases (id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_items_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_no VARCHAR(20) NULL,
  customer_id INT UNSIGNED NULL,
  customer_name VARCHAR(150) NULL,
  customer_phone VARCHAR(20) NULL,
  vehicle_no VARCHAR(20) NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  item_discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  bill_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  total_cost DECIMAL(12,2) NOT NULL,
  payment_method ENUM('CASH','CARD','CREDIT') NOT NULL,
  amount_tendered DECIMAL(12,2) NOT NULL DEFAULT 0,
  change_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  card_reference VARCHAR(40) NULL,
  has_price_override TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('COMPLETED','PARTIALLY_RETURNED','RETURNED') NOT NULL DEFAULT 'COMPLETED',
  notes VARCHAR(255) NULL,
  cashier_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sales_invoice_no (invoice_no),
  KEY ix_sales_created_at (created_at),
  KEY ix_sales_cashier (cashier_id),
  CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT fk_sales_cashier FOREIGN KEY (cashier_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- list_price is the system price at the time of sale; unit_price is what was
-- actually charged. A difference means the cashier changed the price.
CREATE TABLE IF NOT EXISTS sale_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  part_number VARCHAR(60) NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  list_price DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL,
  price_overridden TINYINT(1) NOT NULL DEFAULT 0,
  returned_qty INT NOT NULL DEFAULT 0,
  KEY ix_sale_items_product (product_id),
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sale_returns (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_no VARCHAR(20) NULL,
  sale_id INT UNSIGNED NOT NULL,
  refund_method ENUM('CASH','CARD','CREDIT') NOT NULL,
  refund_amount DECIMAL(12,2) NOT NULL,
  cost_reversed DECIMAL(12,2) NOT NULL DEFAULT 0,
  reason VARCHAR(255) NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sale_returns_return_no (return_no),
  KEY ix_sale_returns_created_at (created_at),
  CONSTRAINT fk_sale_returns_sale FOREIGN KEY (sale_id) REFERENCES sales (id),
  CONSTRAINT fk_sale_returns_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sale_return_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_id INT UNSIGNED NOT NULL,
  sale_item_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  unit_refund DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  restocked TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_return_items_return FOREIGN KEY (return_id) REFERENCES sale_returns (id) ON DELETE CASCADE,
  CONSTRAINT fk_return_items_sale_item FOREIGN KEY (sale_item_id) REFERENCES sale_items (id),
  CONSTRAINT fk_return_items_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB;

-- Payments received against a customer's credit balance.
CREATE TABLE IF NOT EXISTS customer_payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method ENUM('CASH','CARD') NOT NULL,
  reference VARCHAR(60) NULL,
  note VARCHAR(255) NULL,
  received_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_customer_payments_created_at (created_at),
  CONSTRAINT fk_customer_payments_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT fk_customer_payments_user FOREIGN KEY (received_by) REFERENCES users (id)
) ENGINE=InnoDB;

-- Every change to stock_qty is recorded here with the resulting balance.
CREATE TABLE IF NOT EXISTS stock_movements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  movement_type ENUM('OPENING','PURCHASE','SALE','RETURN','ADJUSTMENT') NOT NULL,
  quantity INT NOT NULL,
  balance_after INT NOT NULL,
  unit_cost DECIMAL(12,2) NULL,
  reference_type VARCHAR(20) NULL,
  reference_id INT UNSIGNED NULL,
  reference_no VARCHAR(20) NULL,
  note VARCHAR(255) NULL,
  user_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_stock_movements_product (product_id, created_at),
  CONSTRAINT fk_stock_movements_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_stock_movements_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- End-of-day cash count.
CREATE TABLE IF NOT EXISTS cash_closings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_date DATE NOT NULL,
  opening_float DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash_collections DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash_refunds DECIMAL(12,2) NOT NULL DEFAULT 0,
  expected_cash DECIMAL(12,2) NOT NULL,
  counted_cash DECIMAL(12,2) NOT NULL,
  difference DECIMAL(12,2) NOT NULL,
  card_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  credit_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  closed_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cash_closings_date (business_date),
  CONSTRAINT fk_cash_closings_user FOREIGN KEY (closed_by) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NULL,
  entity_id INT UNSIGNED NULL,
  summary VARCHAR(255) NOT NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_audit_logs_created_at (created_at),
  KEY ix_audit_logs_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;
