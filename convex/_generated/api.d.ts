/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as aiGeneration from "../aiGeneration.js";
import type * as clerk from "../clerk.js";
import type * as cron from "../cron.js";
import type * as deployments from "../deployments.js";
import type * as fsrs from "../fsrs.js";
import type * as generationJobs from "../generationJobs.js";
import type * as http from "../http.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_validation from "../lib/validation.js";
import type * as migrations from "../migrations.js";
import type * as questionsBulk from "../questionsBulk.js";
import type * as questionsCrud from "../questionsCrud.js";
import type * as questionsInteractions from "../questionsInteractions.js";
import type * as questionsLibrary from "../questionsLibrary.js";
import type * as questionsRelated from "../questionsRelated.js";
import type * as rateLimit from "../rateLimit.js";
import type * as scheduling from "../scheduling.js";
import type * as schemaVersion from "../schemaVersion.js";
import type * as spacedRepetition from "../spacedRepetition.js";
import type * as system from "../system.js";
import type * as types from "../types.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  aiGeneration: typeof aiGeneration;
  clerk: typeof clerk;
  cron: typeof cron;
  deployments: typeof deployments;
  fsrs: typeof fsrs;
  generationJobs: typeof generationJobs;
  http: typeof http;
  "lib/logger": typeof lib_logger;
  "lib/validation": typeof lib_validation;
  migrations: typeof migrations;
  questionsBulk: typeof questionsBulk;
  questionsCrud: typeof questionsCrud;
  questionsInteractions: typeof questionsInteractions;
  questionsLibrary: typeof questionsLibrary;
  questionsRelated: typeof questionsRelated;
  rateLimit: typeof rateLimit;
  scheduling: typeof scheduling;
  schemaVersion: typeof schemaVersion;
  spacedRepetition: typeof spacedRepetition;
  system: typeof system;
  types: typeof types;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
