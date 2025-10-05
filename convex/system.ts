/**
 * System Queries
 *
 * Public queries for system-level information.
 * These queries do not require authentication and provide
 * metadata about the backend deployment.
 */

import { query } from './_generated/server';
import { SCHEMA_VERSION } from './schemaVersion';

/**
 * Get Schema Version
 *
 * Returns the current backend schema version for deployment validation.
 * Frontend can call this to verify compatibility.
 *
 * @public No authentication required
 * @returns {string} Semantic version string (e.g., "2.0.0")
 */
export const getSchemaVersion = query({
  handler: async () => {
    return SCHEMA_VERSION;
  },
});
