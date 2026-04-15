import { PricesService } from './prices.service';

describe('PricesService', () => {
  let service: PricesService;
  let repository: any;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((value) => value),
      delete: jest.fn(),
      query: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    service = new PricesService(repository);
  });

  it('batchUpsert persists bid, ask, mid, and timestamp values', async () => {
    await service.batchUpsert([
      {
        symbol: 'EUR/USD',
        bid_price: 1.08995,
        ask_price: 1.09005,
        mid_price: 1.09,
        timestamp: 1713000000000,
        source: 'oanda',
      },
      {
        symbol: 'BTC/USD',
        bid_price: 67996,
        ask_price: 68004,
        mid_price: 68000,
        timestamp: 1713000001000,
        source: 'finnhub',
      },
    ]);

    expect(repository.query).toHaveBeenCalledTimes(1);
    const [sql, params] = repository.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO price_cache');
    expect(params).toEqual([
      'EUR/USD', 1.08995, 1.09005, 1.09, 1713000000000,
      'BTC/USD', 67996, 68004, 68000, 1713000001000,
    ]);
  });

  it('returns only requested rows from getMultiplePrices', async () => {
    const rows = [
      { symbol: 'EUR/USD', mid_price: 1.09 },
      { symbol: 'BTC/USD', mid_price: 68000 },
    ];
    const getMany = jest.fn().mockResolvedValue(rows);
    const where = jest.fn().mockReturnValue({ getMany });
    repository.createQueryBuilder.mockReturnValue({ where });

    const result = await service.getMultiplePrices(['EUR/USD', 'BTC/USD']);

    expect(repository.createQueryBuilder).toHaveBeenCalledWith('price');
    expect(where).toHaveBeenCalledWith('price.symbol IN (:...symbols)', { symbols: ['EUR/USD', 'BTC/USD'] });
    expect(result).toEqual(rows);
  });

  it('returns stale cached prices when requested', async () => {
    const staleRow = {
      symbol: 'EUR/USD',
      bid_price: 1.08995,
      ask_price: 1.09005,
      mid_price: 1.09,
      updated_at: new Date('2026-04-13T09:00:00.000Z'),
      timestamp: 1712998800000,
    };
    repository.findOne.mockResolvedValue(staleRow);

    const result = await service.getPrice('EUR/USD');

    expect(result).toEqual(staleRow);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { symbol: 'EUR/USD' } });
  });
});
