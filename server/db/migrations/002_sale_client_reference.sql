-- A unique reference created by the till for every checkout. If the network
-- drops after the server saved a sale but before the till received the reply,
-- the till sends the same reference again and gets the saved invoice back
-- instead of creating a duplicate sale.
ALTER TABLE sales
  ADD COLUMN client_ref VARCHAR(40) NULL AFTER invoice_no,
  ADD UNIQUE KEY uq_sales_client_ref (client_ref);
