/**
 * Safe localStorage utility with error handling and type safety
 * Prevents quota exceeded errors and handles serialization safely
 */

import { logger } from './logger';

interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Safely get an item from localStorage
 */
export function getStorageItem<T>(key: string, defaultValue?: T): StorageResult<T> {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return {
        success: true,
        data: defaultValue,
      };
    }
    const parsed = JSON.parse(item) as T;
    return {
      success: true,
      data: parsed,
    };
  } catch (error) {
    logger.error(`Error reading from localStorage (${key}):`, error);
    return {
      success: false,
      data: defaultValue,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Safely set an item in localStorage
 */
export function setStorageItem<T>(key: string, value: T): StorageResult<T> {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return {
      success: true,
      data: value,
    };
  } catch (error) {
    logger.error(`Error writing to localStorage (${key}):`, error);
    
    // Check if it's a quota exceeded error
    if (
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      return {
        success: false,
        error: 'Storage quota exceeded. Please clear some data.',
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Safely remove an item from localStorage
 */
export function removeStorageItem(key: string): StorageResult<void> {
  try {
    localStorage.removeItem(key);
    return {
      success: true,
    };
  } catch (error) {
    logger.error(`Error removing from localStorage (${key}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Safely clear all localStorage
 */
export function clearStorage(): StorageResult<void> {
  try {
    localStorage.clear();
    return {
      success: true,
    };
  } catch (error) {
    logger.error('Error clearing localStorage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get storage usage information (approximation)
 */
export function getStorageInfo(): { used: number; available: boolean } {
  if (!isStorageAvailable()) {
    return { used: 0, available: false };
  }

  try {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return {
      used: Math.round(total / 1024), // KB
      available: true,
    };
  } catch {
    return { used: 0, available: false };
  }
}
