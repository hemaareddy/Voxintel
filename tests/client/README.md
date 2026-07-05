# Client tests

Create React App's Jest config hardcodes its test root to `client/src/`, so React
component tests live alongside their source there (e.g. `client/src/App.test.js`),
not in this folder — run them with `npm test` from `client/` or `npm run test:client`
from the repo root.

This folder is reserved for future integration/e2e tests (e.g. Playwright or Cypress)
that drive the app from outside `client/src/`.
