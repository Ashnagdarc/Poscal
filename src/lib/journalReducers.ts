import { Reducer } from 'react';

/**
 * State management reducers for Journal page
 * Replaces multiple useState calls for better performance
 */

// Filter State
export interface FiltersState {
  filter: 'all' | 'open' | 'closed';
  selectedMonth: string;
  selectedYear: string;
  searchQuery: string;
  showFilters: boolean;
}

export type FiltersAction =
  | { type: 'SET_FILTER'; payload: 'all' | 'open' | 'closed' }
  | { type: 'SET_MONTH'; payload: string }
  | { type: 'SET_YEAR'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'TOGGLE_FILTERS' }
  | { type: 'RESET_FILTERS' };

export const initialFiltersState: FiltersState = {
  filter: 'all',
  selectedMonth: 'all',
  selectedYear: 'all',
  searchQuery: '',
  showFilters: false,
};

export const filtersReducer: Reducer<FiltersState, FiltersAction> = (state, action) => {
  switch (action.type) {
    case 'SET_FILTER':
      return { ...state, filter: action.payload };
    case 'SET_MONTH':
      return { ...state, selectedMonth: action.payload };
    case 'SET_YEAR':
      return { ...state, selectedYear: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'TOGGLE_FILTERS':
      return { ...state, showFilters: !state.showFilters };
    case 'RESET_FILTERS':
      return initialFiltersState;
    default:
      return state;
  }
};

// Modal State
interface Trade {
  id: string;
  pair: string;
  direction: 'long' | 'short';
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number | null;
  risk_percent: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  status: 'open' | 'closed' | 'cancelled';
  notes: string | null;
  entry_date: string | null;
  created_at: string;
  screenshot_urls?: string[];
  account_id: string | null;
  account_name?: string;
}

export interface ModalState {
  showAddTrade: boolean;
  showAnalytics: boolean;
  showCSVImport: boolean;
  editingTrade: Trade | null;
  deleteConfirm: {
    isOpen: boolean;
    tradeId: string | null;
  };
  closeTradeModal: {
    isOpen: boolean;
    trade: Trade | null;
  };
}

export type ModalAction =
  | { type: 'OPEN_ADD_TRADE' }
  | { type: 'CLOSE_ADD_TRADE' }
  | { type: 'OPEN_ANALYTICS' }
  | { type: 'CLOSE_ANALYTICS' }
  | { type: 'OPEN_CSV_IMPORT' }
  | { type: 'CLOSE_CSV_IMPORT' }
  | { type: 'SET_EDITING_TRADE'; payload: Trade | null }
  | { type: 'OPEN_DELETE_CONFIRM'; payload: string }
  | { type: 'CLOSE_DELETE_CONFIRM' }
  | { type: 'OPEN_CLOSE_TRADE'; payload: Trade }
  | { type: 'CLOSE_CLOSE_TRADE' }
  | { type: 'RESET_MODALS' };

export const initialModalState: ModalState = {
  showAddTrade: false,
  showAnalytics: false,
  showCSVImport: false,
  editingTrade: null,
  deleteConfirm: {
    isOpen: false,
    tradeId: null,
  },
  closeTradeModal: {
    isOpen: false,
    trade: null,
  },
};

export const modalReducer: Reducer<ModalState, ModalAction> = (state, action) => {
  switch (action.type) {
    case 'OPEN_ADD_TRADE':
      return { ...state, showAddTrade: true };
    case 'CLOSE_ADD_TRADE':
      return { ...state, showAddTrade: false, editingTrade: null };
    case 'OPEN_ANALYTICS':
      return { ...state, showAnalytics: true };
    case 'CLOSE_ANALYTICS':
      return { ...state, showAnalytics: false };
    case 'OPEN_CSV_IMPORT':
      return { ...state, showCSVImport: true };
    case 'CLOSE_CSV_IMPORT':
      return { ...state, showCSVImport: false };
    case 'SET_EDITING_TRADE':
      return { ...state, editingTrade: action.payload, showAddTrade: !!action.payload };
    case 'OPEN_DELETE_CONFIRM':
      return { ...state, deleteConfirm: { isOpen: true, tradeId: action.payload } };
    case 'CLOSE_DELETE_CONFIRM':
      return { ...state, deleteConfirm: { isOpen: false, tradeId: null } };
    case 'OPEN_CLOSE_TRADE':
      return { ...state, closeTradeModal: { isOpen: true, trade: action.payload } };
    case 'CLOSE_CLOSE_TRADE':
      return { ...state, closeTradeModal: { isOpen: false, trade: null } };
    case 'RESET_MODALS':
      return initialModalState;
    default:
      return state;
  }
};
