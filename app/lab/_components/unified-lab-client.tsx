'use client';

/**
 * Unified Lab Client
 *
 * Single-column, ChatGPT-style interface for AI generation testing.
 * Replaces the old 3-column layout and separate Playground.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAction, useQuery } from 'convex/react';
import { PlayIcon, PlusIcon, SettingsIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';

import { PageContainer } from '@/components/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/convex/_generated/api';
import { buildLearningSciencePrompt } from '@/convex/lib/promptTemplates';
import { loadConfigs, saveConfigs } from '@/lib/lab-storage';
import { cn } from '@/lib/utils';
import type { ExecutionResult, InfraConfig } from '@/types/lab';

/**
 * Test run - represents one input + result pair(s)
 * Can have 1 result (single config) or 2 results (comparison)
 */
interface TestRun {
  id: string;
  input: string;
  configId: string;
  configName: string;
  result: ExecutionResult | null;
  isRunning: boolean;
  // Comparison fields
  comparisonConfigId?: string;
  comparisonConfigName?: string;
  comparisonResult?: ExecutionResult | null;
  comparisonIsRunning?: boolean;
  createdAt: number;
}

/**
 * Create PROD config dynamically from runtime environment variables
 *
 * This ensures Lab always tests with the exact same configuration
 * that production uses, preventing test/prod divergence.
 */
function createProdConfig(runtimeConfig: {
  provider: 'openai' | 'google';
  model: string;
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  verbosity: 'low' | 'medium' | 'high';
}): InfraConfig {
  const now = Date.now();
  return {
    id: 'prod-baseline',
    name: 'PRODUCTION (Learning Science)',
    description: `Current production config: ${runtimeConfig.model} (${runtimeConfig.reasoningEffort} reasoning, ${runtimeConfig.verbosity} verbosity)`,
    provider: runtimeConfig.provider,
    model: runtimeConfig.model,
    reasoningEffort: runtimeConfig.reasoningEffort,
    verbosity: runtimeConfig.verbosity,
    phases: [
      {
        name: 'Learning Science Question Generation',
        template: buildLearningSciencePrompt('{{userInput}}'),
        outputType: 'questions' as const,
      },
    ],
    isProd: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function UnifiedLabClient() {
  const [input, setInput] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState('prod-baseline');
  const [comparisonConfigId, setComparisonConfigId] = useState<string | null>(null);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [configs, setConfigs] = useState<InfraConfig[]>([]);

  // Fetch actual production config from runtime environment
  const productionConfig = useQuery(api.lib.productionConfig.getProductionConfig);
  const executeConfig = useAction(api.lab.executeConfig);

  // Helper to create failed ExecutionResult for Promise.allSettled rejections
  const toFailedResult = (config: InfraConfig, input: string, cause: unknown): ExecutionResult => ({
    configId: config.id,
    configName: config.name,
    input,
    questions: [],
    rawOutput: null,
    latency: 0,
    tokenCount: 0,
    valid: false,
    errors: [cause instanceof Error ? cause.message : String(cause)],
    executedAt: Date.now(),
  });

  // Load configs when production config is available
  useEffect(() => {
    if (!productionConfig) return; // Wait for query to resolve

    let loaded = loadConfigs();
    const prodConfig = createProdConfig(productionConfig);
    const hasProd = loaded.some((c) => c.isProd);

    if (!hasProd) {
      loaded = [prodConfig, ...loaded];
    } else {
      // Replace old PROD config with fresh runtime config
      loaded = loaded.map((c) => (c.isProd ? prodConfig : c));
    }

    setConfigs(loaded);
    saveConfigs(loaded);
  }, [productionConfig]);

  const selectedConfig = configs.find((c) => c.id === selectedConfigId);

  const handleRun = async () => {
    if (!input.trim()) {
      toast.error('Input is required');
      return;
    }

    if (!selectedConfig) {
      toast.error('No config selected');
      return;
    }

    const comparisonConfig = comparisonConfigId
      ? configs.find((c) => c.id === comparisonConfigId)
      : null;

    // Create new test run (with comparison fields if in comparison mode)
    const newRun: TestRun = {
      id: Date.now().toString(),
      input: input.trim(),
      configId: selectedConfig.id,
      configName: selectedConfig.name,
      result: null,
      isRunning: true,
      comparisonConfigId: comparisonConfig?.id,
      comparisonConfigName: comparisonConfig?.name,
      comparisonResult: comparisonConfig ? null : undefined,
      comparisonIsRunning: comparisonConfig ? true : undefined,
      createdAt: Date.now(),
    };

    // Add to runs (at top)
    setTestRuns([newRun, ...testRuns]);

    // Clear input for next test
    setInput('');

    // Execute config(s) in parallel if comparison mode
    try {
      if (comparisonConfig) {
        // Execute both configs in parallel - use allSettled to handle failures independently
        const [result1Settled, result2Settled] = await Promise.allSettled([
          executeConfig({
            configId: selectedConfig.id,
            configName: selectedConfig.name,
            provider: selectedConfig.provider,
            model: selectedConfig.model,
            temperature: selectedConfig.temperature,
            // Conditionally spread provider-specific properties
            ...(selectedConfig.provider === 'google' && {
              maxTokens: selectedConfig.maxTokens,
              topP: selectedConfig.topP,
            }),
            ...(selectedConfig.provider === 'openai' && {
              reasoningEffort: selectedConfig.reasoningEffort,
              verbosity: selectedConfig.verbosity,
              maxCompletionTokens: selectedConfig.maxCompletionTokens,
            }),
            phases: selectedConfig.phases,
            testInput: newRun.input,
          }),
          executeConfig({
            configId: comparisonConfig.id,
            configName: comparisonConfig.name,
            provider: comparisonConfig.provider,
            model: comparisonConfig.model,
            temperature: comparisonConfig.temperature,
            // Conditionally spread provider-specific properties
            ...(comparisonConfig.provider === 'google' && {
              maxTokens: comparisonConfig.maxTokens,
              topP: comparisonConfig.topP,
            }),
            ...(comparisonConfig.provider === 'openai' && {
              reasoningEffort: comparisonConfig.reasoningEffort,
              verbosity: comparisonConfig.verbosity,
              maxCompletionTokens: comparisonConfig.maxCompletionTokens,
            }),
            phases: comparisonConfig.phases,
            testInput: newRun.input,
          }),
        ]);

        // Convert settled results to ExecutionResult, handling failures independently
        const result1: ExecutionResult =
          result1Settled.status === 'fulfilled'
            ? result1Settled.value
            : toFailedResult(selectedConfig, newRun.input, result1Settled.reason);

        const result2: ExecutionResult =
          result2Settled.status === 'fulfilled'
            ? result2Settled.value
            : toFailedResult(comparisonConfig, newRun.input, result2Settled.reason);

        // Update run with both results
        setTestRuns((runs) =>
          runs.map((run) =>
            run.id === newRun.id
              ? {
                  ...run,
                  result: result1,
                  isRunning: false,
                  comparisonResult: result2,
                  comparisonIsRunning: false,
                }
              : run
          )
        );

        const valid1 = result1.valid;
        const valid2 = result2.valid;

        if (valid1 && valid2) {
          toast.success(
            `Generated ${result1.questions.length} / ${result2.questions.length} questions`
          );
        } else if (!valid1 && !valid2) {
          toast.error('Both configs failed');
        } else {
          toast.warning('One config failed - see errors below');
        }
      } else {
        // Single config execution
        const result = await executeConfig({
          configId: selectedConfig.id,
          configName: selectedConfig.name,
          provider: selectedConfig.provider,
          model: selectedConfig.model,
          temperature: selectedConfig.temperature,
          // Conditionally spread provider-specific properties
          ...(selectedConfig.provider === 'google' && {
            maxTokens: selectedConfig.maxTokens,
            topP: selectedConfig.topP,
          }),
          ...(selectedConfig.provider === 'openai' && {
            reasoningEffort: selectedConfig.reasoningEffort,
            verbosity: selectedConfig.verbosity,
            maxCompletionTokens: selectedConfig.maxCompletionTokens,
          }),
          phases: selectedConfig.phases,
          testInput: newRun.input,
        });

        // Update run with result
        setTestRuns((runs) =>
          runs.map((run) =>
            run.id === newRun.id
              ? { ...run, result: result as ExecutionResult, isRunning: false }
              : run
          )
        );

        if ((result as ExecutionResult).valid) {
          toast.success(`Generated ${(result as ExecutionResult).questions.length} questions`);
        } else {
          toast.error('Generation failed - see errors below');
        }
      }
    } catch (error) {
      const failedResult: ExecutionResult = {
        configId: selectedConfig.id,
        configName: selectedConfig.name,
        input: newRun.input,
        questions: [],
        rawOutput: null,
        latency: 0,
        tokenCount: 0,
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        executedAt: Date.now(),
      };

      setTestRuns((runs) =>
        runs.map((run) =>
          run.id === newRun.id
            ? {
                ...run,
                result: failedResult,
                isRunning: false,
                comparisonResult: comparisonConfig ? failedResult : undefined,
                comparisonIsRunning: false,
              }
            : run
        )
      );

      toast.error('Execution failed');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <PageContainer className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🧪 Genesis Lab</h1>
              <p className="text-sm text-muted-foreground">AI generation testing and iteration</p>
            </div>
            <Link href="/lab/configs">
              <Button variant="outline" size="sm" className="gap-2">
                <SettingsIcon className="h-4 w-4" />
                Manage Configs
              </Button>
            </Link>
          </div>
        </PageContainer>
      </div>

      {/* Main Content - Single Column */}
      <PageContainer className="py-6">
        <div className={cn('mx-auto space-y-6', comparisonConfigId ? 'max-w-7xl' : 'max-w-3xl')}>
          {/* Input Area */}
          <Card className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-input">Test Input</Label>
              <Textarea
                id="test-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter your test prompt... (e.g., 'NATO alphabet', 'Python basics')"
                rows={3}
                className="resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleRun();
                  }
                }}
              />
            </div>

            <div className="space-y-3">
              {/* Config Selection */}
              {!comparisonConfigId ? (
                /* Single Config Mode */
                <div className="flex items-center gap-3">
                  <Label htmlFor="config-select" className="text-sm text-muted-foreground">
                    Config:
                  </Label>
                  <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    <SelectTrigger id="config-select" className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {configs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedConfig && (
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant="secondary">{selectedConfig.provider}</Badge>
                      <Badge variant="secondary">{selectedConfig.model}</Badge>
                      <Badge variant="secondary">{selectedConfig.phases.length}-phase</Badge>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Set to first non-selected config, or same config if only one exists
                      const otherConfig = configs.find((c) => c.id !== selectedConfigId);
                      setComparisonConfigId(otherConfig?.id || configs[0]?.id);
                    }}
                    className="ml-auto gap-1"
                  >
                    <PlusIcon className="h-3 w-3" />
                    Compare
                  </Button>
                </div>
              ) : (
                /* Comparison Mode - 2 Configs */
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="config-1" className="text-xs text-muted-foreground">
                      Config 1
                    </Label>
                    <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                      <SelectTrigger id="config-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {configs.map((config) => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedConfig && (
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="secondary">{selectedConfig.provider}</Badge>
                        <Badge variant="secondary">{selectedConfig.model}</Badge>
                        <Badge variant="secondary">{selectedConfig.phases.length}-phase</Badge>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 relative">
                    <Label htmlFor="config-2" className="text-xs text-muted-foreground">
                      Config 2
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setComparisonConfigId(null)}
                      className="absolute -top-1 -right-1 h-6 w-6 p-0"
                    >
                      <XIcon className="h-3 w-3" />
                    </Button>
                    <Select value={comparisonConfigId} onValueChange={setComparisonConfigId}>
                      <SelectTrigger id="config-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {configs.map((config) => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {configs.find((c) => c.id === comparisonConfigId) && (
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="secondary">
                          {configs.find((c) => c.id === comparisonConfigId)!.provider}
                        </Badge>
                        <Badge variant="secondary">
                          {configs.find((c) => c.id === comparisonConfigId)!.model}
                        </Badge>
                        <Badge variant="secondary">
                          {configs.find((c) => c.id === comparisonConfigId)!.phases.length}-phase
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleRun} disabled={!input.trim()} size="lg">
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Run Test
                </Button>
              </div>
            </div>
          </Card>

          {/* Test Runs - Conversation Style */}
          <div className="space-y-4">
            {testRuns.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="space-y-2">
                  <p className="text-muted-foreground">No tests yet</p>
                  <p className="text-sm text-muted-foreground">
                    Enter an input above and click &ldquo;Run Test&rdquo; to get started
                  </p>
                </div>
              </Card>
            ) : (
              testRuns.map((run) => <TestRunCard key={run.id} run={run} />)
            )}
          </div>

          {/* Spacer for bottom scroll */}
          <div className="h-32" />
        </div>
      </PageContainer>
    </div>
  );
}

/**
 * TestRunCard Component
 *
 * Single test run with input and results
 */
interface TestRunCardProps {
  run: TestRun;
}

function TestRunCard({ run }: TestRunCardProps) {
  const isComparison = run.comparisonConfigId !== undefined;

  return (
    <Card className="overflow-hidden">
      {/* Input */}
      <div className="p-4 bg-muted/30 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">{run.input}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isComparison ? (
                <>
                  <span>
                    {run.configName} vs {run.comparisonConfigName}
                  </span>
                  <span>•</span>
                  <span>{new Date(run.createdAt).toLocaleTimeString()}</span>
                </>
              ) : (
                <>
                  <span>{run.configName}</span>
                  {run.result && (
                    <>
                      <span>•</span>
                      <span>{new Date(run.createdAt).toLocaleTimeString()}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results - Single or Comparison */}
      {!isComparison ? (
        /* Single Config Result */
        <div className="p-4">
          {run.isRunning ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground py-8">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
              <span>Generating questions...</span>
            </div>
          ) : run.result ? (
            <ResultDisplay result={run.result} />
          ) : (
            <div className="text-sm text-muted-foreground py-4">No result</div>
          )}
        </div>
      ) : (
        /* Comparison - Two Columns */
        <div className="grid grid-cols-2 divide-x">
          <div className="p-4">
            <h3 className="text-sm font-medium mb-3">{run.configName}</h3>
            {run.isRunning ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground py-8">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                <span>Generating...</span>
              </div>
            ) : run.result ? (
              <ResultDisplay result={run.result} compact />
            ) : (
              <div className="text-sm text-muted-foreground py-4">No result</div>
            )}
          </div>

          <div className="p-4">
            <h3 className="text-sm font-medium mb-3">{run.comparisonConfigName}</h3>
            {run.comparisonIsRunning ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground py-8">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                <span>Generating...</span>
              </div>
            ) : run.comparisonResult ? (
              <ResultDisplay result={run.comparisonResult} compact />
            ) : (
              <div className="text-sm text-muted-foreground py-4">No result</div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * ResultDisplay Component
 *
 * Shows generated questions inline
 */
interface ResultDisplayProps {
  result: ExecutionResult;
  compact?: boolean;
}

function ResultDisplay({ result, compact = false }: ResultDisplayProps) {
  if (result.errors.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-red-600 font-medium">✗ Failed</span>
          <span className="text-muted-foreground">
            {result.latency}ms • {result.errors.length} error
            {result.errors.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded p-3">
          <p className="text-sm text-red-900 dark:text-red-200">{result.errors[0]}</p>
        </div>
      </div>
    );
  }

  if (result.questions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">No questions generated</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-green-600 font-medium">✓ Success</span>
        <span className="text-muted-foreground">
          {result.questions.length} questions • {result.latency}ms
          {result.tokenCount && result.tokenCount > 0 && ` • ${result.tokenCount} tokens`}
        </span>
      </div>

      {/* Questions */}
      <div className={cn('space-y-3', compact && 'space-y-2')}>
        {(result.questions as Question[]).map((question, index) => (
          <QuestionCard key={index} question={question} index={index} compact={compact} />
        ))}
      </div>
    </div>
  );
}

/**
 * QuestionCard Component
 *
 * Individual question display
 */
interface Question {
  question: string;
  answer: string;
  distractors: string[];
  type?: string;
  options?: string[];
  explanation?: string;
  [key: string]: unknown;
}

interface QuestionCardProps {
  question: Question;
  index: number;
  compact?: boolean;
}

function QuestionCard({ question, index, compact = false }: QuestionCardProps) {
  return (
    <div className={cn('border rounded-lg bg-card', compact ? 'p-2 space-y-1.5' : 'p-3 space-y-2')}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Q{index + 1}</span>
        {!compact && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {question.type || 'unknown'}
          </span>
        )}
      </div>

      <p className={cn('font-medium leading-relaxed', compact ? 'text-xs' : 'text-sm')}>
        {question.question}
      </p>

      {question.options && question.options.length > 0 && (
        <div className={cn(compact ? 'space-y-1 pt-0.5' : 'space-y-1.5 pt-1')}>
          {question.options.map((option: string, optIndex: number) => (
            <div
              key={optIndex}
              className={cn(
                'rounded border transition-colors',
                compact ? 'text-xs p-1.5' : 'text-sm p-2',
                option === question.correctAnswer
                  ? 'border-green-500 bg-green-50 dark:bg-green-950/20 font-medium'
                  : 'border-muted bg-muted/30'
              )}
            >
              {option}
              {option === question.correctAnswer && <span className="ml-2 text-green-600">✓</span>}
            </div>
          ))}
        </div>
      )}

      {!compact && question.explanation && (
        <div className="pt-2 border-t text-xs text-muted-foreground">{question.explanation}</div>
      )}
    </div>
  );
}
