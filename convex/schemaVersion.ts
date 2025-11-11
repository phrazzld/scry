/**
 * Schema Version Tracking
 *
 * This file defines the current schema version for the Convex backend.
 * It enables deployment validation to catch frontend/backend mismatches.
 *
 * Semantic Versioning Rules:
 * - MAJOR: Breaking schema changes (new required fields, removed tables, changed types)
 * - MINOR: Backwards-compatible additions (new optional fields, new tables, new indexes)
 * - PATCH: Documentation, comments, or non-functional changes
 *
 * Examples:
 * - Adding optional field to table: 2.1.0 → 2.2.0
 * - Adding new table: 2.1.0 → 2.2.0
 * - Making optional field required: 2.1.0 → 3.0.0
 * - Removing table: 2.1.0 → 3.0.0
 * - Renaming field: 2.1.0 → 3.0.0
 * - Fixing typos in comments: 2.1.0 → 2.1.1
 *
 * When to Increment:
 * - Update this version BEFORE deploying schema changes
 * - Update FRONTEND_VERSION in lib/deployment-check.ts to match
 * - Deploy backend first, then frontend (atomic deployment)
 */

export const SCHEMA_VERSION = '2.7.0';
