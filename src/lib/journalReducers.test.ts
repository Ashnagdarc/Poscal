import { describe, it, expect } from 'vitest';
import { filtersReducer, initialFiltersState, modalReducer, initialModalState } from '@/lib/journalReducers';

describe('journalReducers', () => {
  describe('filtersReducer', () => {
    it('should handle SET_FILTER action', () => {
      const action = { type: 'SET_FILTER' as const, payload: 'open' as const };
      const newState = filtersReducer(initialFiltersState, action);
      
      expect(newState.filter).toBe('open');
      expect(newState.selectedAccountId).toBe('all');
    });

    it('should handle SET_ACCOUNT_ID action', () => {
      const action = { type: 'SET_ACCOUNT_ID' as const, payload: 'account-123' };
      const newState = filtersReducer(initialFiltersState, action);
      
      expect(newState.selectedAccountId).toBe('account-123');
    });

    it('should handle SET_MONTH action', () => {
      const action = { type: 'SET_MONTH' as const, payload: '5' };
      const newState = filtersReducer(initialFiltersState, action);
      
      expect(newState.selectedMonth).toBe('5');
    });

    it('should handle SET_YEAR action', () => {
      const action = { type: 'SET_YEAR' as const, payload: '2025' };
      const newState = filtersReducer(initialFiltersState, action);
      
      expect(newState.selectedYear).toBe('2025');
    });

    it('should handle SET_SEARCH_QUERY action', () => {
      const action = { type: 'SET_SEARCH_QUERY' as const, payload: 'EUR/USD' };
      const newState = filtersReducer(initialFiltersState, action);
      
      expect(newState.searchQuery).toBe('EUR/USD');
    });

    it('should handle TOGGLE_FILTERS action', () => {
      const action = { type: 'TOGGLE_FILTERS' as const };
      const newState = filtersReducer(initialFiltersState, action);
      
      expect(newState.showFilters).toBe(true);
      
      const toggledBackState = filtersReducer(newState, action);
      expect(toggledBackState.showFilters).toBe(false);
    });

    it('should handle RESET_FILTERS action', () => {
      const modifiedState = {
        filter: 'closed' as const,
        selectedAccountId: 'test-123',
        selectedMonth: '5',
        selectedYear: '2025',
        searchQuery: 'test',
        showFilters: true,
      };
      
      const action = { type: 'RESET_FILTERS' as const };
      const newState = filtersReducer(modifiedState, action);
      
      expect(newState).toEqual(initialFiltersState);
    });
  });

  describe('modalReducer', () => {
    it('should handle OPEN_ADD_TRADE action', () => {
      const action = { type: 'OPEN_ADD_TRADE' as const };
      const newState = modalReducer(initialModalState, action);
      
      expect(newState.showAddTrade).toBe(true);
    });

    it('should handle CLOSE_ADD_TRADE action', () => {
      const openState = { ...initialModalState, showAddTrade: true };
      const action = { type: 'CLOSE_ADD_TRADE' as const };
      const newState = modalReducer(openState, action);
      
      expect(newState.showAddTrade).toBe(false);
    });

    it('should handle OPEN_ANALYTICS action', () => {
      const action = { type: 'OPEN_ANALYTICS' as const };
      const newState = modalReducer(initialModalState, action);
      
      expect(newState.showAnalytics).toBe(true);
    });

    it('should handle CLOSE_ANALYTICS action', () => {
      const openState = { ...initialModalState, showAnalytics: true };
      const action = { type: 'CLOSE_ANALYTICS' as const };
      const newState = modalReducer(openState, action);
      
      expect(newState.showAnalytics).toBe(false);
    });

    it('should handle OPEN_CSV_IMPORT action', () => {
      const action = { type: 'OPEN_CSV_IMPORT' as const };
      const newState = modalReducer(initialModalState, action);
      
      expect(newState.showCSVImport).toBe(true);
    });

    it('should handle CLOSE_CSV_IMPORT action', () => {
      const openState = { ...initialModalState, showCSVImport: true };
      const action = { type: 'CLOSE_CSV_IMPORT' as const };
      const newState = modalReducer(openState, action);
      
      expect(newState.showCSVImport).toBe(false);
    });

    it('should handle SET_EDITING_TRADE action', () => {
      const trade = {
        id: 'trade-123',
        pair: 'EUR/USD',
        direction: 'long' as const,
        entry_price: 1.1000,
        exit_price: null,
        stop_loss: null,
        take_profit: null,
        position_size: null,
        risk_percent: null,
        pnl: null,
        pnl_percent: null,
        status: 'open' as const,
        notes: null,
        entry_date: null,
        created_at: '2026-01-01',
        account_id: null,
      };
      
      const action = { type: 'SET_EDITING_TRADE' as const, payload: trade };
      const newState = modalReducer(initialModalState, action);
      
      expect(newState.editingTrade).toEqual(trade);
    });

    it('should handle SET_EDITING_TRADE action to clear', () => {
      const trade = {
        id: 'trade-123',
        pair: 'EUR/USD',
        direction: 'long' as const,
        entry_price: 1.1000,
        exit_price: null,
        stop_loss: null,
        take_profit: null,
        position_size: null,
        risk_percent: null,
        pnl: null,
        pnl_percent: null,
        status: 'open' as const,
        notes: null,
        entry_date: null,
        created_at: '2026-01-01',
        account_id: null,
      };
      
      const stateWithTrade = { ...initialModalState, editingTrade: trade };
      const action = { type: 'SET_EDITING_TRADE' as const, payload: null };
      const newState = modalReducer(stateWithTrade, action);
      
      expect(newState.editingTrade).toBeNull();
    });

    it('should handle OPEN_DELETE_CONFIRM action', () => {
      const action = { type: 'OPEN_DELETE_CONFIRM' as const, payload: 'trade-456' };
      const newState = modalReducer(initialModalState, action);
      
      expect(newState.deleteConfirm).toEqual({ isOpen: true, tradeId: 'trade-456' });
    });

    it('should handle CLOSE_DELETE_CONFIRM action', () => {
      const stateWithConfirm = { ...initialModalState, deleteConfirm: { isOpen: true, tradeId: 'trade-456' } };
      const action = { type: 'CLOSE_DELETE_CONFIRM' as const };
      const newState = modalReducer(stateWithConfirm, action);
      
      expect(newState.deleteConfirm).toEqual({ isOpen: false, tradeId: null });
    });

    it('should handle OPEN_CLOSE_TRADE action', () => {
      const trade = {
        id: 'trade-789',
        pair: 'GBP/USD',
        direction: 'short' as const,
        entry_price: 1.2500,
        exit_price: null,
        stop_loss: null,
        take_profit: null,
        position_size: null,
        risk_percent: null,
        pnl: null,
        pnl_percent: null,
        status: 'open' as const,
        notes: null,
        entry_date: null,
        created_at: '2026-01-02',
        account_id: null,
      };
      const action = { type: 'OPEN_CLOSE_TRADE' as const, payload: trade };
      const newState = modalReducer(initialModalState, action);
      
      expect(newState.closeTradeModal).toEqual({ isOpen: true, trade });
    });

    it('should handle CLOSE_CLOSE_TRADE action', () => {
      const trade = {
        id: 'trade-789',
        pair: 'GBP/USD',
        direction: 'short' as const,
        entry_price: 1.2500,
        exit_price: null,
        stop_loss: null,
        take_profit: null,
        position_size: null,
        risk_percent: null,
        pnl: null,
        pnl_percent: null,
        status: 'open' as const,
        notes: null,
        entry_date: null,
        created_at: '2026-01-02',
        account_id: null,
      };
      const stateWithModal = { ...initialModalState, closeTradeModal: { isOpen: true, trade } };
      const action = { type: 'CLOSE_CLOSE_TRADE' as const };
      const newState = modalReducer(stateWithModal, action);
      
      expect(newState.closeTradeModal).toEqual({ isOpen: false, trade: null });
    });
  });
});
