/**
 * Genesis Laboratory Type Definitions
 *
 * Types for the local-only generation infrastructure testing tool.
 * Defines test inputs, infrastructure configs, prompt phases, and execution results.
 */

/**
 * AI provider literal types
 */
export type AIProvider = 'google' | 'openai' | 'anthropic';

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
  name: string; // e.g., "Intent Clarification", "Question Generation"
  template: string; // Prompt template with {{variables}}
  outputTo?: string; // Variable name for next phase (e.g., "clarifiedIntent")
}

/**
 * Infrastructure configuration for generation
 */
export interface InfraConfig {
  id: string;
  name: string;
  description?: string;
  isProd: boolean; // Read-only production baseline

  // Model configuration
  provider: AIProvider;
  model: string; // e.g., 'gemini-2.5-flash', 'gpt-5-mini', 'claude-opus-4'
  temperature?: number; // Optional: 0-2 (undefined = model default)
  maxTokens?: number; // Optional: 1-65536 (undefined = model default)
  topP?: number; // Optional: 0-1 (undefined = model default)

  // Prompt chain architecture
  phases: PromptPhase[];

  createdAt: number;
  updatedAt: number;
}

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
  return (
    config.name.trim().length > 0 &&
    // Temperature is optional, but if set must be in range
    (config.temperature === undefined || (config.temperature >= 0 && config.temperature <= 2)) &&
    // MaxTokens is optional, but if set must be in range
    (config.maxTokens === undefined || (config.maxTokens >= 1 && config.maxTokens <= 65536)) &&
    // TopP is optional, but if set must be in range
    (config.topP === undefined || (config.topP >= 0 && config.topP <= 1)) &&
    config.phases.length > 0 &&
    config.phases.every(isValidPhase)
  );
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
