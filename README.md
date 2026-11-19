# Sriya Motors POS

Point of sale and inventory system for **Sriya Motors (Pvt) Ltd**, a vehicle spare parts shop in Sri Lanka.

It runs fully offline on the shop laptop as a Windows desktop application. The internet is used only to download software updates.

## Features

- Barcode billing with a USB scanner, plus search by name, part number, brand, vehicle model or rack
- Bill review before payment; cash (with change calculation), card and credit sales
- Cashiers can change the selling price at the till. The system price and the charged price are both stored, and admins see every change in reports.
- Automatic stock reduction, low stock alerts, goods received (GRN), stock adjustments with reasons and a full stock history per item
- Returns and refunds against the original invoice, with restocking
- Credit customer accounts with payments
- Daily sales and profit reports, profit by item, price change report, staff report, stock value, and end-of-day cash count
- Two roles: **Admin** (everything) and **Cashier** (selling, returns, customers; never sees buying prices or profit). Multiple admins are supported.
- Receipt printing on 80 mm thermal printers, silent or with a dialog
- Automatic daily database backups, manual backup and restore
- One-click software updates from GitHub Releases
- Light and dark themes in the brand colours

## Technology

| Part | Choice |
| --- | --- |
| Desktop shell | Electron (Windows installer via electron-builder) |
| Interface | React 19 + Vite, plain CSS design tokens, lucide icons |
| API | Node.js 24 + Express 5, running inside the Electron process |
| Database | MySQL 8 (local Windows service) |
| Validation | Zod schemas shared by the client and the server |
| Updates | electron-updater with GitHub Releases |

## Quick start (development)

Requirements: Node.js 24+, MySQL 8 running locally.

```bash
npm install
cp .env.example .env        # then set DB_PASSWORD (and DB_PORT if not 3306)
npm run dev                 # API on :4600 and the UI on http://localhost:5173
npm run db:seed-demo        # optional: sample brands, vehicles, suppliers and parts
```

Sign in with **admin / admin123**. You must choose a new password on the first sign-in.

To run the desktop window during development, keep `npm run dev:client` running and start `npm run dev:electron` in a second terminal. Stop `npm run dev:server` first, because the desktop app starts its own API server on port 4600.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API server (auto-restart) + Vite dev server |
| `npm run dev:electron` | Desktop window against the Vite dev server |
| `npm start` | Build the UI and open the desktop app |
| `npm test` | End-to-end API tests against a throw-away `<db>_test` database |
| `npm run db:seed-demo` | Load demo data into an empty database |
| `npm run dist` | Build the Windows installer into `release/` |
| `npm run release` | Build and publish the installer to GitHub Releases (see docs) |

## Project layout

```
client/            React user interface (Vite root)
  src/api/         fetch wrapper and error handling
  src/components/  shared UI components and the app layout
  src/features/    one folder per screen (pos, sales, products, reports, ...)
  src/hooks/       data loading, forms, barcode scanner, shortcuts
electron/          desktop shell: window, printing, auto-update, preload bridge
server/
  config/          configuration stored in the data folder
  core/            errors, logger, validation and SQL helpers
  db/              connection, migrations (SQL files), base seed data
  middleware/      authentication, roles, error handler
  modules/         one folder per business area (routes + service)
  scripts/         maintenance scripts
  tests/           end-to-end API tests
shared/            constants, money maths and Zod schemas used by both sides
build/             application icon
deploy/            server files for the online version (service, Caddy, update script)
docs/              documentation
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): how the parts fit together and the main design decisions
- [Database](docs/DATABASE.md): tables, money and stock rules, migrations
- [Installing on the shop laptop](docs/INSTALLATION.md) (desktop app, works without internet)
- [Hosting online](docs/HOSTING.md): server, domain and HTTPS step by step (Hetzner + Cloudflare)
- [Releases and automatic updates](docs/RELEASES_AND_UPDATES.md)
- [Backup and restore](docs/BACKUP_AND_RESTORE.md)
- [Importing vehicles, brands and items from Excel](docs/IMPORTING_ITEMS.md)
- [User guide](docs/USER_GUIDE.md) for shop staff
- [Development guide](docs/DEVELOPMENT.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
