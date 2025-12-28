import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AccountCurrency {
  code: string;
  symbol: string;
  name: string;
}

export const ACCOUNT_CURRENCIES: AccountCurrency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
];

interface CurrencyContextType {
  currency: AccountCurrency;
  setCurrency: (currency: AccountCurrency) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState<AccountCurrency>(ACCOUNT_CURRENCIES[0]);

  useEffect(() => {
    const savedCurrency = localStorage.getItem('accountCurrency');
    if (savedCurrency) {
      const parsed = JSON.parse(savedCurrency);
      const found = ACCOUNT_CURRENCIES.find(c => c.code === parsed.code);
      if (found) setCurrencyState(found);
    }
  }, []);

  const setCurrency = (newCurrency: AccountCurrency) => {
    setCurrencyState(newCurrency);
    localStorage.setItem('accountCurrency', JSON.stringify(newCurrency));
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
