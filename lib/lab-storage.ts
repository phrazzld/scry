/**
 * Genesis Laboratory localStorage Persistence
 *
 * Handles saving/loading lab state (input sets, configs, results) to localStorage.
 * Follows lib/storage.ts safeStorage pattern with JSON serialization.
 */

import type { ExecutionResult, InfraConfig, InputSet } from '@/types/lab';

import { safeStorage } from './storage';

// Storage keys
const STORAGE_KEYS = {
  INPUT_SETS: 'scry-lab-input-sets',
  CONFIGS: 'scry-lab-configs',
  RESULTS: 'scry-lab-results',
} as const;

/**
 * Save input sets to localStorage
 * @returns true if save succeeded, false otherwise
 */
export function saveInputSets(sets: InputSet[]): boolean {
  try {
    const json = JSON.stringify(sets);
    return safeStorage.setItem(STORAGE_KEYS.INPUT_SETS, json);
  } catch (error) {
    console.error('Failed to save input sets:', error);
    return false;
  }
}

/**
 * Load input sets from localStorage
 * @returns Array of input sets, empty array if none found or error
 */
export function loadInputSets(): InputSet[] {
  try {
    const json = safeStorage.getItem(STORAGE_KEYS.INPUT_SETS);
    if (!json) {
      return [];
    }
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load input sets:', error);
    return [];
  }
}

/**
 * Save infrastructure configs to localStorage
 * @returns true if save succeeded, false otherwise
 */
export function saveConfigs(configs: InfraConfig[]): boolean {
  try {
    const json = JSON.stringify(configs);
    return safeStorage.setItem(STORAGE_KEYS.CONFIGS, json);
  } catch (error) {
    console.error('Failed to save configs:', error);
    return false;
  }
}

/**
 * Load infrastructure configs from localStorage
 * @returns Array of configs, empty array if none found or error
 */
export function loadConfigs(): InfraConfig[] {
  try {
    const json = safeStorage.getItem(STORAGE_KEYS.CONFIGS);
    if (!json) {
      return [];
    }
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load configs:', error);
    return [];
  }
}

/**
 * Save execution results to localStorage
 * @returns true if save succeeded, false otherwise
 */
export function saveResults(results: ExecutionResult[]): boolean {
  try {
    const json = JSON.stringify(results);
    return safeStorage.setItem(STORAGE_KEYS.RESULTS, json);
  } catch (error) {
    console.error('Failed to save results:', error);
    return false;
  }
}

/**
 * Load execution results from localStorage
 * @returns Array of results, empty array if none found or error
 */
export function loadResults(): ExecutionResult[] {
  try {
    const json = safeStorage.getItem(STORAGE_KEYS.RESULTS);
    if (!json) {
      return [];
    }
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load results:', error);
    return [];
  }
}

/**
 * Clear all execution results from localStorage
 */
export function clearResults(): void {
  safeStorage.removeItem(STORAGE_KEYS.RESULTS);
}

/**
 * Clear all lab data from localStorage
 */
export function clearAllLabData(): void {
  safeStorage.removeItem(STORAGE_KEYS.INPUT_SETS);
  safeStorage.removeItem(STORAGE_KEYS.CONFIGS);
  safeStorage.removeItem(STORAGE_KEYS.RESULTS);
}

/**
 * Get approximate size of lab data in localStorage (in bytes)
 * Used for quota warning
 */
export function getLabDataSize(): number {
  try {
    const inputSetsJson = safeStorage.getItem(STORAGE_KEYS.INPUT_SETS) || '';
    const configsJson = safeStorage.getItem(STORAGE_KEYS.CONFIGS) || '';
    const resultsJson = safeStorage.getItem(STORAGE_KEYS.RESULTS) || '';

    // Approximate size in bytes (UTF-16 encoding, 2 bytes per char)
    return (inputSetsJson.length + configsJson.length + resultsJson.length) * 2;
  } catch {
    return 0;
  }
}

/**
 * Check if lab data is approaching localStorage quota
 * @param warnThresholdBytes Warning threshold (default 8MB for 10MB quota)
 * @returns true if approaching quota
 */
export function isApproachingQuota(warnThresholdBytes: number = 8 * 1024 * 1024): boolean {
  return getLabDataSize() >= warnThresholdBytes;
}
