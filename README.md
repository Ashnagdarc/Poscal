# Poscal

Poscal is an open source position size calculator.

## Product Scope

- Deterministic position sizing
- Required inputs: broker, symbol, balance, risk percent, entry, stop loss, take profit
- Optional live quotes for market orders only
- Optional authenticated storage for settings, broker profiles, profile, and saved calculations via Convex

## Repository Scope

- `src/`: React frontend
- `src/domain/`: pure TypeScript calculation and instrument modules
- `convex/`: minimal auth, profile, and calculator-history backend

## Development

```bash
npm install
npm run convex:codegen
npm run dev
```

If you do not want authenticated storage locally, omit `VITE_CONVEX_URL` and the app runs in local-only mode.

## Validation

```bash
npm test
npm run build
```
