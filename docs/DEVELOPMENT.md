# Development guide

## Setup

1. Install Node.js 24+ and MySQL 8.
2. `npm install`
3. Copy `.env.example` to `.env` and set the MySQL connection.
4. `npm run dev`, then open <http://localhost:5173>.

`.env` is read by the development server, the tests and the desktop app in development mode. The installed app ignores it and uses the data folder configuration instead.

## Running modes

| Command | Use |
| --- | --- |
| `npm run dev` | Day-to-day UI and API work with hot reload |
| `npm run dev:client` + `npm run dev:electron` | Test desktop-only features (printing, updates UI, dialogs) |
| `npm start` | Production build in the desktop window |
| `npm run dist` | Windows installer in `release/` |

## Tests

```bash
npm test
```

`server/tests/api.test.js` starts the real server against a fresh `<DB_NAME>_test` database and walks through the main workflow: forced password change, user management, item validation, cost hiding for cashiers, goods received, price changes at the till, returns and refunds, credit sales and payments, day closing, delete protection, and backup/restore. Add a test there for every bug you fix.

## Conventions

- **Validation** lives in `shared/schemas`. Use the same schema in the form (`useForm(schema, ...)`) and in the route (`parse(schema, req.body)`).
- **Errors**: throw `AppError` helpers from `server/core/errors.js` with a message a shop user can understand. Never send raw database errors to the client.
- **Stock**: always change stock through `applyStockChange` inside a transaction.
- **Money**: use `toCents`/`fromCents` from `shared/money.js` for arithmetic.
- **Role-sensitive data**: remove cost and profit fields on the server for cashiers (see `presentProduct` and `presentSale`).
- **Audit**: record important actions with `recordAudit`.
- **Schema changes**: add a new migration file. Do not edit released ones.
- **UI**: build from `components/ui`, use the CSS tokens in `styles/tokens.css`, and check both light and dark themes.

## Adding a new screen

1. Add the service and routes under `server/modules/<area>/` and mount them in `server/app.js`.
2. Add schemas to `shared/schemas/index.js`.
3. Add the page under `client/src/features/<area>/`, a route in `client/src/App.jsx`, and a menu entry with its roles in `client/src/components/layout/navigation.js`.

## Adding a new master list

Simple reference tables can reuse `createMasterDataService` (server) and `MasterDataPage` (client). See categories and brands for examples.
