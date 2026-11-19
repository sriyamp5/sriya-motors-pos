# Importing vehicles, brands and items from Excel

Large lists (for example a supplier's item list) can be loaded from CSV files instead of typing each item. The import uses the same checks as the **Items** screen, gives item codes in the order of the file (SM00001, SM00002 …), and never creates the same item twice.

Always import in this order, because items refer to vehicles and brands by name:

1. **vehicles.csv**
2. **brands.csv**
3. **items.csv**

## File format

Save each file from Excel with **File → Save As → CSV UTF-8 (Comma delimited) (\*.csv)**. Column names must match; their order does not matter, and extra columns (such as `Sheet`, `Row`, `Check`) are ignored.

| File | Columns |
|---|---|
| vehicles.csv | `Make`, `Model`, `Vehicle type` (CAR, VAN, SUV, CAB, LORRY, BUS, THREE_WHEELER, MOTORCYCLE, TRACTOR, OTHER) |
| brands.csv | `Brand`, `Country` (optional) |
| items.csv | `Item name`, `Part number`, `Category`, `Brand`, `Part type`, `Unit`, `Vehicles`, `Buying price`, `Selling price`, `Opening stock`, `Low stock level`, `Rack`, `Description` |

Notes for **items.csv**:

- **Category** must already exist (for example `Other`). **Brand** may be empty.
- **Vehicles**: `Make: Model` pairs separated by `;`, for example `Suzuki: Alto 800; Suzuki: Alto K10`.
- **Part type**: GENUINE, OEM, AFTERMARKET, RECONDITIONED or USED (empty = AFTERMARKET).
- **Unit**: PCS, SET, PAIR, KIT … (empty = PCS).
- **Selling price** must be more than 0. **Opening stock** and **Low stock level** may be 0.
- An item is treated as already existing when both its name and part number match an existing item; it is skipped.

## Steps on the online server

1. Check the CSV files in Excel and correct anything marked in the `Check` column.
2. Make sure the server runs the latest version: `sudo bash /opt/sriya-pos/deploy/update.sh`.
3. From your laptop (PowerShell), upload the files:

   ```powershell
   scp vehicles.csv brands.csv items.csv posadmin@SERVER_IP:/tmp/
   ```

4. On the server, check each file first (nothing is saved), then import it with `--apply`:

   ```bash
   cd /opt/sriya-pos
   sudo -u sriya node --env-file=.env server/scripts/importCatalog.js vehicles /tmp/vehicles.csv
   sudo -u sriya node --env-file=.env server/scripts/importCatalog.js vehicles /tmp/vehicles.csv --apply

   sudo -u sriya node --env-file=.env server/scripts/importCatalog.js brands /tmp/brands.csv
   sudo -u sriya node --env-file=.env server/scripts/importCatalog.js brands /tmp/brands.csv --apply

   sudo -u sriya node --env-file=.env server/scripts/importCatalog.js items /tmp/items.csv
   sudo -u sriya node --env-file=.env server/scripts/importCatalog.js items /tmp/items.csv --apply
   ```

   The check prints how many rows will be added and lists every row with a problem (line number and reason). Rows with problems are not imported; fix them in Excel, upload again and re-run. Rows already imported are skipped.

5. Remove the uploaded files: `rm /tmp/vehicles.csv /tmp/brands.csv /tmp/items.csv`.
6. Open **Items** in the POS to see the new items.

Every `--apply` run takes a database backup first (`…-pre-import.sql.gz` in **Settings → Backup**). To undo an import, restore that backup.

## Desktop app (shop laptop)

The same command works from the project folder on a development computer:

```bash
npm run import:catalog -- items path/to/items.csv --apply
```
