# Broker Profile Data

Poscal includes a pinned, adapted snapshot of the open **MetaTrader Broker Symbols** dataset to improve broker-aware position sizing before a live cTrader/MT5 contract feed is available.

- Source: https://github.com/metatraderVPS/metatrader-broker-symbols
- Data license: CC BY 4.0
- Snapshot commit: `d3732aee3b34db9c3f5e9ba84f70d6a1228385ca`
- Snapshot date: 2026-10-06
- Adaptation: Poscal keeps only supported symbols plus broker symbol name, contract size, minimum lot, lot step, and digits where supplied.

The snapshot is not treated as live broker verification. Broker/account-group settings can differ from demo-server measurements. When a selected broker profile lacks usable sizing fields for an instrument, Poscal keeps its standard instrument specification.

The runtime source priority is intended to be:

1. Live cTrader/MT5 contract specification when connected.
2. Selected open broker profile.
3. Poscal Standard specification.
