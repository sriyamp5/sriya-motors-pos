# Architecture

## Overview

```
┌──────────────────────── Sriya Motors POS (Electron) ────────────────────────┐
│                                                                              │
│  Main process                              Window (React UI)                 │
│  ├─ starts Express API on 127.0.0.1:4600 ◄─ fetch /api/...                   │
│  ├─ receipt printing (hidden window)     ◄─ window.desktop.print()           │
│  ├─ auto-update (GitHub Releases)        ─► update banner / settings         │
│  └─ dialogs, open folder                 ◄─ window.desktop.*                 │
│                                                                              │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │ mysql2 pool
        ┌──────▼──────┐
        │  MySQL 8    │  Windows service on the same laptop
        └─────────────┘
```

- The API listens only on `127.0.0.1`, so nothing on the shop network can reach it.
- If port 4600 is taken, the next free port is used automatically.
- The UI uses hash routing, so the same build works when served by the API or loaded in a browser during development.

## Start-up sequence and resilience

The shop staff must be able to switch the laptop on and start selling without technical help. Start-up is therefore designed so that no single failure stops the application from opening:

1. Electron takes a single-instance lock. A second double-click focuses the existing window.
2. The API server starts immediately. It does not wait for the database.
3. The database connects in the background (`server/db/database.js`):
   - **MySQL still starting** after Windows boots (`ECONNREFUSED`): retries every 4 seconds while the UI shows "Starting the system".
   - **Wrong password or host**: stops retrying and shows the database setup screen.
   - **Not configured yet** (first run): shows the database setup screen. The database is created automatically.
4. Once connected: a safety backup is taken if schema updates are pending, migrations are applied, base data is seeded, and the daily backup schedule starts.
5. Any API call that hits a lost connection returns `503 DB_UNAVAILABLE`. The UI then re-checks the status and shows the waiting screen until the database is back.

Other safeguards:

- The bill being prepared at the till is saved in local storage after every change, so a refresh, crash or power cut does not lose it.
- A React error boundary replaces a broken screen with a reload button.
- The Electron window reloads itself if the renderer process crashes.
- The barcode scanner is just a keyboard. If it fails, manual search works the same way, and nothing in the system depends on the scanner being present.
- Logs are written to `<data folder>/logs` (server) and the Electron log file. Old logs are removed after 30 days.

## Data folder

| Mode | Location |
| --- | --- |
| Installed app | `%APPDATA%\Sriya Motors POS` |
| Development | `<project>/.data` |

It contains `config.json` (database connection, token secret, port), `logs/` and `backups/`. Updates replace only the program files, never this folder.

## Server structure

Each business area under `server/modules/` has a `*Routes.js` file (HTTP, parsing and validation) and a `*Service.js` file (business rules and SQL). Services never touch `req`/`res`.

| Module | Responsibility |
| --- | --- |
| `auth` | sign in, lockout after 5 failures, password change |
| `users` | user management with last-admin protection |
| `masterData` | generic CRUD for categories, brands, vehicle makes and models, suppliers, customers |
| `customers` | credit statement and payments |
| `products` | items, barcode lookup, fitments, stock adjustments, stock history |
| `stock/stockLedger.js` | **the only place that changes stock** |
| `purchases` | goods received notes |
| `sales` | checkout and returns |
| `reports` | dashboard, reports and day-end cash closing |
| `settings`, `backup`, `audit`, `system` | configuration, backups, activity log, status and first-run setup |

### Error handling

- Services throw `AppError` (`server/core/errors.js`) with an HTTP status, a stable `code` and a message that can be shown to the user.
- `server/middleware/errorHandler.js` converts MySQL errors into plain messages (duplicate barcode, record in use, busy, lost connection) and hides unexpected errors behind a generic message while logging the full stack.
- Validation errors return `422` with `details.fields`, which the UI shows under the matching inputs.

## Two ways to run: desktop and online

The same code runs in two modes. Nothing about the desktop app changes when the online version is used.

| | Desktop app (default) | Online version (`SRIYA_MODE=web`) |
|---|---|---|
| Entry point | `electron/main.js` | `server/web.js` (`npm run start:web`) |
| Where it runs | Shop laptop, API on 127.0.0.1 | Linux server behind Caddy and Cloudflare (HTTPS) |
| Needs internet | Only for updates | Always |
| Settings | Setup screen, `config.json` | Environment file `.env` only; setup screen disabled |
| Printing | Silent, chosen printer | Browser print (silent with Chrome `--kiosk-printing`) |
| Updates | GitHub Releases + update button | `deploy/update.sh` on the server |
| Backups | Any folder, restore from file | Server folder (`BACKUP_DIR`), download from Settings |

Online mode also adds security headers with a Content Security Policy (`server/core/security.js`) and a sign-in limit per IP address. The status endpoint does not show database details, and the server listens on a fixed port.

Checkout requests carry a `clientRef`, a unique reference per bill (`sales.client_ref`, migration 002). If the reply to a sale is lost on the network, sending the same bill again returns the saved invoice and does not create a second sale. This works in both modes.

See [HOSTING.md](HOSTING.md) for the server setup.

### Security

- Passwords are hashed with bcrypt. JWT tokens expire after 14 hours.
- Each request re-reads the user, so deactivation, role changes and password resets take effect immediately (`token_version`).
- Cashiers never receive buying prices or profit from the API. This is enforced on the server, not just hidden in the UI.
- Important actions are written to the activity log (`audit_logs`).

## Client structure

- `features/<area>/`: screens and their modals
- `components/ui/`: buttons, inputs, modal, table, toasts and other building blocks
- `hooks/useForm.js`: form state validated with the same Zod schema as the server
- `hooks/useApi.js`: data loading with stale-response protection
- `hooks/useBarcodeScanner.js`: detects scanner input by keystroke timing
- `styles/tokens.css`: colour and spacing tokens for light and dark themes

## Key decisions

| Decision | Reason |
| --- | --- |
| Electron with the API inside | One icon to start; the same code can later be split into a network server for more tills. |
| MySQL | Chosen by the client; familiar and easy to move to a central server for multiple branches later. |
| Shared Zod schemas | One definition of every rule, so the client and server can never disagree. |
| Money in integer cents in code, `DECIMAL(12,2)` in the database | Avoids floating point rounding errors. |
| Server recalculates every bill | The till only sends product, quantity, price and discount; totals, cost and profit are computed from the database. |
| "Last cost" method | Receiving goods sets the buying price to the latest supplier price. Each sale stores the cost at that moment, so profit history never changes. |
| Soft delete (deactivate) | Records with history are kept for reports; hard delete is allowed only when unused. |
