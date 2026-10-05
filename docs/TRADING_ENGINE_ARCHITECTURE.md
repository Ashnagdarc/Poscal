# Trading Engine Architecture

## Source priority

Position sizing must consume a normalized instrument contract. The calculation engine must not hard-code symbol-specific formulas.

Resolution priority:

1. Broker or platform contract override
2. Connected MT5 or cTrader specification
3. Custom user specification
4. Poscal fallback specification

The current product ships the Poscal fallback registry and an override contract that provider integrations can populate.

## Canonical risk model

The engine sizes from ticks and price distance:

1. risk amount = account balance × risk %
2. price distance = absolute entry-to-stop distance
3. ticks to stop = price distance / tick size
4. tick value USD = native tick value × profit-currency-to-USD rate
5. loss per standard lot = ticks to stop × tick value USD
6. raw lots = risk amount USD / loss per standard lot
7. final lots = raw lots floored to the instrument volume step and bounded by min/max volume

Pips and points are input/display units only. They are converted to price distance before risk math.

## Instrument contract

Each resolved instrument supplies:

- contract size
- tick size
- native tick value per standard lot
- pip/point size for display/input
- min lot
- max lot
- lot step
- base currency
- quote currency
- profit currency
- specification source

## Currency conversion

Profit-currency conversion and account-currency conversion are separate concerns. The engine resolves direct or inverse USD pairs and can use the instrument entry price itself for USD-base FX pairs such as USD/JPY.

## Broker-specific CFDs

Metals, indices, commodities, and crypto CFDs can differ by broker. Poscal fallback values are estimates and the result UI labels them as such. A broker/provider override can replace contract size, tick size, tick value, and volume rules without changing calculation code.

## Regression requirement

Any production incident involving position sizing must become an independent regression fixture. The XAU/USD case of a $900 risk budget and 112.2 pips must remain 0.80 lots under the Poscal fallback gold contract.
