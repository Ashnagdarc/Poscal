import { PricesController } from './prices.controller';

describe('PricesController', () => {
  let controller: PricesController;
  let service: any;

  beforeEach(() => {
    service = {
      getAllPrices: jest.fn(),
      getMultiplePrices: jest.fn(),
      getPrice: jest.fn(),
      batchUpsert: jest.fn(),
      updatePrices: jest.fn(),
      updatePrice: jest.fn(),
      deletePrice: jest.fn(),
    };

    controller = new PricesController(service);
  });

  it('splits the symbols query and returns only requested rows', async () => {
    const rows = [
      { symbol: 'EUR/USD', mid_price: 1.09 },
      { symbol: 'BTC/USD', mid_price: 68000 },
    ];
    service.getMultiplePrices.mockResolvedValue(rows);

    const result = await controller.getMultiplePrices('EUR/USD,BTC/USD');

    expect(service.getMultiplePrices).toHaveBeenCalledWith(['EUR/USD', 'BTC/USD']);
    expect(result).toEqual(rows);
  });

  it('returns batch update metadata after persisting prices', async () => {
    service.batchUpsert.mockResolvedValue(undefined);

    const payload = [
      {
        symbol: 'EUR/USD',
        bid_price: 1.08995,
        ask_price: 1.09005,
        mid_price: 1.09,
        source: 'oanda',
        timestamp: Date.now(),
      },
    ];

    const result = await controller.batchUpdatePrices(payload);

    expect(service.batchUpsert).toHaveBeenCalledWith(payload);
    expect(result.updated).toBe(1);
    expect(result.uniqueSymbols).toBe(1);
    expect(typeof result.durationMs).toBe('number');
  });
});
