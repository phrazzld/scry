'use client';

/**
 * Playground Client
 *
 * Fast iteration mode for testing single inputs against multiple configs.
 * Side-by-side comparison with streaming results (future enhancement).
 */
import { useState } from 'react';
import Link from 'next/link';
import { useAction } from 'convex/react';
import { ArrowLeftIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';

import { PageContainer } from '@/components/page-container';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/convex/_generated/api';
import { buildLearningSciencePrompt, PROD_CONFIG_METADATA } from '@/convex/lib/promptTemplates';
import { loadConfigs } from '@/lib/lab-storage';
import { cn } from '@/lib/utils';
import type { ExecutionResult, InfraConfig } from '@/types/lab';

/**
 * Create PROD config (1-phase learning science architecture)
 */
function createProdConfig(): InfraConfig {
  const now = Date.now();
  return {
    id: 'prod-baseline',
    name: 'PRODUCTION (Learning Science)',
    description: '1-phase GPT-5 with comprehensive learning science principles',
    provider: PROD_CONFIG_METADATA.provider,
    model: PROD_CONFIG_METADATA.model,
    reasoningEffort: PROD_CONFIG_METADATA.reasoningEffort,
    verbosity: PROD_CONFIG_METADATA.verbosity,
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

export function PlaygroundClient() {
  const [input, setInput] = useState('');
  const [selectedConfigIds, setSelectedConfigIds] = useState<string[]>(['prod-baseline']);
  const [results, setResults] = useState<Record<string, ExecutionResult | null>>({});
  const [isRunning, setIsRunning] = useState(false);

  // Load configs (ensure PROD exists)
  const [allConfigs] = useState<InfraConfig[]>(() => {
    let loaded = loadConfigs();
    const prodConfig = createProdConfig();
    const hasProd = loaded.some((c) => c.isProd);

    if (!hasProd) {
      loaded = [prodConfig, ...loaded];
    } else {
      loaded = loaded.map((c) => (c.isProd ? prodConfig : c));
    }

    return loaded;
  });

  const executeConfig = useAction(api.lab.executeConfig);

  const handleAddConfig = (configId: string) => {
    if (selectedConfigIds.includes(configId)) {
      toast.error('Config already selected');
      return;
    }
    if (selectedConfigIds.length >= 3) {
      toast.error('Maximum 3 configs for side-by-side comparison');
      return;
    }
    setSelectedConfigIds([...selectedConfigIds, configId]);
  };

  const handleRemoveConfig = (configId: string) => {
    setSelectedConfigIds(selectedConfigIds.filter((id) => id !== configId));
    const newResults = { ...results };
    delete newResults[configId];
    setResults(newResults);
  };

  const handleRun = async () => {
    if (!input.trim()) {
      toast.error('Input is required');
      return;
    }

    if (selectedConfigIds.length === 0) {
      toast.error('Select at least one config');
      return;
    }

    setIsRunning(true);
    setResults({}); // Clear previous results

    const executionPromises = selectedConfigIds.map(async (configId) => {
      const config = allConfigs.find((c) => c.id === configId);
      if (!config) return { configId, result: null };

      try {
        const result = await executeConfig({
          configId: config.id,
          configName: config.name,
          provider: config.provider,
          model: config.model,
          temperature: config.temperature,
          // Conditionally spread provider-specific properties
          ...(config.provider === 'google' && {
            maxTokens: config.maxTokens,
            topP: config.topP,
          }),
          ...(config.provider === 'openai' && {
            reasoningEffort: config.reasoningEffort,
            verbosity: config.verbosity,
            maxCompletionTokens: config.maxCompletionTokens,
          }),
          phases: config.phases,
          testInput: input.trim(),
        });

        return { configId, result: result as ExecutionResult };
      } catch (error) {
        const failedResult: ExecutionResult = {
          configId: config.id,
          configName: config.name,
          input: input.trim(),
          questions: [],
          rawOutput: null,
          latency: 0,
          tokenCount: 0,
          valid: false,
          errors: [error instanceof Error ? error.message : String(error)],
          executedAt: Date.now(),
        };
        return { configId, result: failedResult };
      }
    });

    try {
      const allResults = await Promise.all(executionPromises);

      const resultsMap: Record<string, ExecutionResult | null> = {};
      for (const { configId, result } of allResults) {
        resultsMap[configId] = result;
      }

      setResults(resultsMap);

      const successCount = allResults.filter((r) => r.result?.valid).length;
      toast.success(`Execution complete: ${successCount}/${allResults.length} passed`);
    } catch {
      toast.error('Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const availableConfigs = allConfigs.filter((c) => !selectedConfigIds.includes(c.id));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <PageContainer className="py-4">
          <div className="flex items-center gap-4">
            <Link href="/lab">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Lab
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">⚡ Playground</h1>
              <p className="text-sm text-muted-foreground">
                Fast iteration - test one input against multiple configs
              </p>
            </div>
          </div>
        </PageContainer>
      </div>

      {/* Main Content */}
      <PageContainer className="py-6">
        <div className="space-y-6 max-w-6xl mx-auto">
          {/* Input Section */}
          <Card className="p-4">
            <div className="space-y-3">
              <Label htmlFor="playground-input">Test Input</Label>
              <Textarea
                id="playground-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter your test prompt..."
                rows={4}
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {selectedConfigIds.length} config{selectedConfigIds.length !== 1 ? 's' : ''}{' '}
                  selected
                </div>
                <Button onClick={handleRun} disabled={isRunning} size="lg">
                  {isRunning ? 'Running...' : 'Run Comparison'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Config Selection */}
          <div className="flex items-center gap-2 flex-wrap">
            {selectedConfigIds.map((configId) => {
              const config = allConfigs.find((c) => c.id === configId);
              if (!config) return null;

              return (
                <div
                  key={configId}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary rounded-md"
                >
                  <span className="text-sm font-medium">{config.name}</span>
                  {selectedConfigIds.length > 1 && (
                    <button
                      onClick={() => handleRemoveConfig(configId)}
                      className="hover:bg-primary/20 rounded p-0.5"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {availableConfigs.length > 0 && selectedConfigIds.length < 3 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddConfig(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="text-sm border rounded px-2 py-1.5 bg-background"
                defaultValue=""
              >
                <option value="" disabled>
                  + Add config
                </option>
                {availableConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Results - Side by Side */}
          {Object.keys(results).length > 0 && (
            <div
              className={cn(
                'grid gap-6',
                selectedConfigIds.length === 1 && 'grid-cols-1',
                selectedConfigIds.length === 2 && 'grid-cols-2',
                selectedConfigIds.length === 3 && 'grid-cols-3'
              )}
            >
              {selectedConfigIds.map((configId) => {
                const config = allConfigs.find((c) => c.id === configId);
                const result = results[configId];

                if (!config) return null;

                return <ResultColumn key={configId} config={config} result={result} />;
              })}
            </div>
          )}

          {/* Empty State */}
          {Object.keys(results).length === 0 && !isRunning && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                Enter a test input and click &ldquo;Run Comparison&rdquo; to see results
              </p>
            </Card>
          )}
        </div>
      </PageContainer>
    </div>
  );
}

/**
 * ResultColumn Component
 *
 * Single column showing results for one config
 */
interface ResultColumnProps {
  config: InfraConfig;
  result: ExecutionResult | null;
}

function ResultColumn({ config, result }: ResultColumnProps) {
  if (!result) {
    return (
      <Card className="p-4">
        <h3 className="font-semibold mb-4">{config.name}</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Running...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-4', result.valid ? 'border-green-500' : 'border-red-500')}>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h3 className="font-semibold">{config.name}</h3>
          <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
            <span>{result.questions.length} questions</span>
            <span>•</span>
            <span>{result.latency}ms</span>
            {result.tokenCount && result.tokenCount > 0 && (
              <>
                <span>•</span>
                <span>{result.tokenCount} tokens</span>
              </>
            )}
          </div>
        </div>

        {/* Errors */}
        {result.errors.length > 0 && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded text-xs">
            <p className="font-medium text-red-900 dark:text-red-200">Error</p>
            <p className="text-red-700 dark:text-red-300 mt-1">{result.errors[0]}</p>
          </div>
        )}

        {/* Questions */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {result.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No questions generated</p>
          ) : (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result.questions.map((question: any, index: number) => (
              <Card key={index} className="p-3 bg-muted/30">
                <div className="space-y-2">
                  <p className="text-sm font-medium">{question.question}</p>
                  {question.options && question.options.length > 0 && (
                    <div className="space-y-1">
                      {question.options.map((option: string, optIndex: number) => (
                        <div
                          key={optIndex}
                          className={cn(
                            'text-xs p-2 rounded border',
                            option === question.correctAnswer
                              ? 'border-green-500 bg-green-50 dark:bg-green-950/20 font-medium'
                              : 'border-muted'
                          )}
                        >
                          {option}
                          {option === question.correctAnswer && (
                            <span className="ml-2 text-green-600">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
