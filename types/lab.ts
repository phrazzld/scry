/**
 * Genesis Laboratory Type Definitions
 *
 * Types for the local-only generation infrastructure testing tool.
 * Defines test inputs, infrastructure configs, prompt phases, and execution results.
 */

/**
 * AI provider literal types
 * Only includes actively supported providers (google, openai)
 */
export type AIProvider = 'google' | 'openai';

/**
 * Individual test input
 */
export interface TestInput {
  id: string;
  text: string; // The actual prompt text to test
  createdAt: number;
}

/**
 * Prompt phase in a multi-phase generation chain
 */
export interface PromptPhase {
  name: string; // e.g., "Phase 1: Content Analysis", "Phase 2: Pedagogical Blueprint"
  template: string; // Prompt template with {{variables}}
  outputTo?: string; // Variable name for next phase (optional for single-phase configs)
  outputType?: 'text' | 'questions'; // Output format for this phase
}

/**
 * Base infrastructure configuration (shared by all providers)
 */
interface BaseInfraConfig {
  id: string;
  name: string;
  description?: string;
  isProd: boolean; // Read-only production baseline

  // Prompt chain architecture
  phases: PromptPhase[];

  createdAt: number;
  updatedAt: number;
}

/**
 * Google AI provider configuration
 */
export interface GoogleInfraConfig extends BaseInfraConfig {
  provider: 'google';
  model: string; // e.g., 'gemini-2.5-flash', 'gemini-2.5-pro'
  temperature?: number; // Optional: 0-2 (undefined = model default)
  maxTokens?: number; // Optional: 1-65536 (undefined = model default)
  topP?: number; // Optional: 0-1 (undefined = model default)
}

/**
 * OpenAI provider configuration (with reasoning support)
 */
export interface OpenAIInfraConfig extends BaseInfraConfig {
  provider: 'openai';
  model: string; // e.g., 'gpt-5', 'gpt-5-mini', 'gpt-5-nano'
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'; // Reasoning token budget
  verbosity?: 'low' | 'medium' | 'high'; // Output conciseness
  maxCompletionTokens?: number; // Max tokens including reasoning (1-128000)
  temperature?: number; // Optional: for non-reasoning models
}

/**
 * Infrastructure configuration union (type-safe provider configs)
 */
export type InfraConfig = GoogleInfraConfig | OpenAIInfraConfig;

/**
 * Execution result for a config + input combination
 */
export interface ExecutionResult {
  configId: string;
  configName: string;
  input: string;

  // Output
  questions: unknown[]; // Generated questions (validated against schema)
  rawOutput: unknown; // Full AI response

  // Metrics
  latency: number; // ms
  tokenCount?: number;
  valid: boolean; // Schema validation passed
  errors: string[];

  // Metadata
  executedAt: number;
}

/**
 * Type guard to check if a config is the production baseline
 */
export function isProdConfig(config: InfraConfig): boolean {
  return config.isProd === true;
}

/**
 * Type guard to check if a test input is valid
 */
export function isValidTestInput(input: TestInput): boolean {
  return input.text.trim().length > 0;
}

/**
 * Type guard to check if a phase is valid
 */
export function isValidPhase(phase: PromptPhase): boolean {
  return phase.name.trim().length > 0 && phase.template.trim().length > 0;
}

/**
 * Type guard to check if a config is valid
 */
export function isValidConfig(config: InfraConfig): boolean {
  // Base validation (common to all providers)
  const baseValid =
    config.name.trim().length > 0 && config.phases.length > 0 && config.phases.every(isValidPhase);

  if (!baseValid) return false;

  // Provider-specific validation
  if (config.provider === 'google') {
    return (
      // Temperature is optional, but if set must be in range
      (config.temperature === undefined || (config.temperature >= 0 && config.temperature <= 2)) &&
      // MaxTokens is optional, but if set must be in range
      (config.maxTokens === undefined || (config.maxTokens >= 1 && config.maxTokens <= 65536)) &&
      // TopP is optional, but if set must be in range
      (config.topP === undefined || (config.topP >= 0 && config.topP <= 1))
    );
  } else if (config.provider === 'openai') {
    return (
      // maxCompletionTokens is optional, but if set must be in range
      (config.maxCompletionTokens === undefined ||
        (config.maxCompletionTokens >= 1 && config.maxCompletionTokens <= 128000)) &&
      // Temperature is optional, but if set must be in range
      (config.temperature === undefined || (config.temperature >= 0 && config.temperature <= 2)) &&
      // reasoningEffort must be one of the valid values if set
      (config.reasoningEffort === undefined ||
        ['minimal', 'low', 'medium', 'high'].includes(config.reasoningEffort)) &&
      // verbosity must be one of the valid values if set
      (config.verbosity === undefined || ['low', 'medium', 'high'].includes(config.verbosity))
    );
  }

  return false;
}

/**
 * Type guard to check if an execution result has errors
 */
export function hasExecutionErrors(result: ExecutionResult): boolean {
  return result.errors.length > 0 || !result.valid;
}

/**
 * Type guard to check if an execution result is successful
 */
export function isSuccessfulExecution(result: ExecutionResult): boolean {
  return result.valid && result.errors.length === 0 && result.questions.length > 0;
}

/**
 * Get unique models used across all phases in a config
 * Used to detect multi-model architectures
 */
export function getUniqueModels(config: InfraConfig): string[] {
  const models = new Set<string>();
  models.add(config.model); // Add base model
  // Could add phase-specific models here in the future if needed
  return Array.from(models);
}

/**
 * Check if a config uses multiple different models
 */
export function isMultiModelConfig(config: InfraConfig): boolean {
  // For now, detect based on PROD_CONFIG_METADATA structure
  // Phase 2 uses gpt-5, others use gpt-5-mini
  return config.phases.length >= 5 && config.name.includes('5-Phase');
}
