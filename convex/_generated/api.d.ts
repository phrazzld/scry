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
import type * as clerk from "../clerk.js";
import type * as cron from "../cron.js";
import type * as deployments from "../deployments.js";
import type * as fsrs from "../fsrs.js";
import type * as http from "../http.js";
import type * as lib_logger from "../lib/logger.js";
import type * as migrations from "../migrations.js";
import type * as questions from "../questions.js";
import type * as quiz from "../quiz.js";
import type * as rateLimit from "../rateLimit.js";
import type * as spacedRepetition from "../spacedRepetition.js";
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
  clerk: typeof clerk;
  cron: typeof cron;
  deployments: typeof deployments;
  fsrs: typeof fsrs;
  http: typeof http;
  "lib/logger": typeof lib_logger;
  migrations: typeof migrations;
  questions: typeof questions;
  quiz: typeof quiz;
  rateLimit: typeof rateLimit;
  spacedRepetition: typeof spacedRepetition;
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
