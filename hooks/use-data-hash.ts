import { useEffect, useRef } from 'react';

/**
 * Simple string hash function for data comparison
 * Uses djb2 algorithm for fast, consistent hashing
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Hook to detect when data actually changes vs when polling returns identical data
 * Prevents unnecessary renders by comparing data hashes
 *
 * @param data - The data to monitor for changes
 * @returns Object with hasChanged flag and update function
 */
export function useDataHash<T>(
  data: T,
  label?: string
): {
  hasChanged: boolean;
  previousHash: number | null;
  currentHash: number | null;
  update: () => void;
} {
  const previousHashRef = useRef<number | null>(null);
  const currentHashRef = useRef<number | null>(null);

  // Calculate hash of current data
  let currentHash: number | null = null;
  let hasChanged = false;

  try {
    // Only hash if data is not null/undefined
    if (data !== null && data !== undefined) {
      const dataString = JSON.stringify(data);
      currentHash = hashString(dataString);
      currentHashRef.current = currentHash;

      // Compare with previous hash
      if (previousHashRef.current === null) {
        // First time seeing data
        hasChanged = true;
        if (process.env.NODE_ENV === 'development' && label) {
          // eslint-disable-next-line no-console
          console.log(`[${label}] Initial data hash: ${currentHash}`);
        }
      } else if (previousHashRef.current !== currentHash) {
        // Data has changed
        hasChanged = true;
        if (process.env.NODE_ENV === 'development' && label) {
          // eslint-disable-next-line no-console
          console.log(
            `[${label}] Data changed - Previous hash: ${previousHashRef.current}, New hash: ${currentHash}`
          );
        }
      } else {
        // Data unchanged
        hasChanged = false;
        if (process.env.NODE_ENV === 'development' && label) {
          // eslint-disable-next-line no-console
          console.log(`[${label}] Poll executed but data unchanged - Hash: ${currentHash}`);
        }
      }
    } else {
      // Handle null/undefined data
      currentHash = null;
      hasChanged = previousHashRef.current !== null;
      if (process.env.NODE_ENV === 'development' && label && hasChanged) {
        // eslint-disable-next-line no-console
        console.log(`[${label}] Data became null/undefined`);
      }
    }
  } catch (error) {
    // Handle circular references or other JSON.stringify errors
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${label || 'useDataHash'}] Error hashing data:`, error);
    }
    // Treat errors as "changed" to avoid missing updates
    hasChanged = true;
  }

  // Update function to manually mark the current hash as "previous"
  const update = () => {
    previousHashRef.current = currentHashRef.current;
  };

  // Auto-update previous hash when data changes
  useEffect(() => {
    if (hasChanged) {
      previousHashRef.current = currentHashRef.current;
    }
  }, [currentHash, hasChanged]);

  return {
    hasChanged,
    previousHash: previousHashRef.current,
    currentHash,
    update,
  };
}
