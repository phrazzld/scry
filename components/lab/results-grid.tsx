'use client';

/**
 * Results Grid Component (Redesigned)
 *
 * Stacked expandable cards showing results for each input × config combination.
 * Improved output clarity with inline expansion.
 */
import { useState } from 'react';
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CopyIcon,
  XCircleIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { type ExecutionResult, type InfraConfig, type TestInput } from '@/types/lab';

/**
 * Error category types for better error handling
 */
type ErrorCategory =
  | 'api_key'
  | 'rate_limit'
  | 'schema_validation'
  | 'network'
  | 'configuration'
  | 'unknown';

/**
 * Categorize error message into actionable types
 */
function categorizeError(errorMessage: string): ErrorCategory {
  const msg = errorMessage.toLowerCase();

  if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('401')) {
    return 'api_key';
  }
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('quota')) {
    return 'rate_limit';
  }
  if (msg.includes('schema') || msg.includes('validation') || msg.includes('does not match')) {
    return 'schema_validation';
  }
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnrefused')) {
    return 'network';
  }
  if (
    msg.includes('provider') ||
    msg.includes('not yet supported') ||
    msg.includes('missing template')
  ) {
    return 'configuration';
  }
  return 'unknown';
}

/**
 * Get actionable hint based on error category
 */
function getErrorHint(category: ErrorCategory): string {
  switch (category) {
    case 'api_key':
      return 'Check your GOOGLE_AI_API_KEY in Convex environment variables.';
    case 'rate_limit':
      return 'Wait a moment and try again. Consider reducing test count.';
    case 'schema_validation':
      return 'AI generated invalid format. Check prompt templates. Retry may succeed.';
    case 'network':
      return 'Check your internet connection and try again.';
    case 'configuration':
      return 'Review your config settings (provider, model, prompt templates).';
    case 'unknown':
      return 'Check Convex logs for details or retry the operation.';
  }
}

/**
 * Get category display info (icon, color, label)
 */
function getCategoryDisplay(category: ErrorCategory): { label: string; className: string } {
  switch (category) {
    case 'api_key':
      return { label: 'API Configuration', className: 'text-red-600' };
    case 'rate_limit':
      return { label: 'Rate Limit', className: 'text-orange-600' };
    case 'schema_validation':
      return { label: 'Schema Validation', className: 'text-yellow-600' };
    case 'network':
      return { label: 'Network Error', className: 'text-purple-600' };
    case 'configuration':
      return { label: 'Configuration Error', className: 'text-blue-600' };
    case 'unknown':
      return { label: 'Unknown Error', className: 'text-gray-600' };
  }
}

interface ResultsGridProps {
  inputs: TestInput[];
  selectedInputIds: Set<string>;
  configs: InfraConfig[];
  selectedConfigIds: Set<string>;
  results: ExecutionResult[];
  onRunAll: () => void;
  isRunning: boolean;
  executionProgress?: { total: number; completed: number; failed: number };
}

export function ResultsGrid({
  inputs,
  selectedInputIds,
  configs,
  selectedConfigIds,
  results,
  onRunAll,
  isRunning,
  executionProgress,
}: ResultsGridProps) {
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  const selectedInputs = inputs.filter((i) => selectedInputIds.has(i.id));
  const selectedConfigs = configs.filter((c) => selectedConfigIds.has(c.id));

  // Build results map for quick lookup: `${input}_${configId}` -> result
  const resultsMap = new Map<string, ExecutionResult>();
  for (const result of results) {
    const key = `${result.input}_${result.configId}`;
    resultsMap.set(key, result);
  }

  if (selectedInputs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Select at least one input to view results</p>
      </div>
    );
  }

  if (selectedConfigs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Select at least one config to run tests</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Run Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedInputs.length} input{selectedInputs.length !== 1 ? 's' : ''} ×{' '}
          {selectedConfigs.length} config{selectedConfigs.length !== 1 ? 's' : ''} ={' '}
          {selectedInputs.length * selectedConfigs.length} test
          {selectedInputs.length * selectedConfigs.length !== 1 ? 's' : ''}
        </div>
        <Button onClick={onRunAll} disabled={isRunning} size="lg">
          {isRunning ? 'Running...' : 'Run All Tests'}
        </Button>
      </div>

      {/* Progress Indicator */}
      {isRunning && executionProgress && executionProgress.total > 0 && (
        <div className="space-y-2 px-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Progress: {executionProgress.completed} / {executionProgress.total}
            </span>
            {executionProgress.failed > 0 && (
              <span className="text-red-600">{executionProgress.failed} failed</span>
            )}
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                executionProgress.failed > 0 ? 'bg-red-500' : 'bg-primary'
              )}
              style={{
                width: `${(executionProgress.completed / executionProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Stacked Results */}
      <div className="space-y-3">
        {selectedInputs.map((input) =>
          selectedConfigs.map((config) => {
            const key = `${input.text}_${config.id}`;
            const result = resultsMap.get(key);
            const isExpanded = expandedResultId === key;

            return (
              <Card
                key={key}
                className={cn(
                  'transition-all',
                  result ? (result.valid ? 'border-green-500' : 'border-red-500') : 'border-muted'
                )}
              >
                {/* Collapsed Header */}
                <button
                  onClick={() => setExpandedResultId(isExpanded ? null : key)}
                  className="w-full p-4 text-left hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.name}</span>
                        {result && (
                          <>
                            {result.valid ? (
                              <CheckCircle2Icon className="size-4 text-green-600 shrink-0" />
                            ) : (
                              <XCircleIcon className="size-4 text-red-600 shrink-0" />
                            )}
                          </>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{input.text}</p>
                      {result && (
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {result.questions.length} questions
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {result.latency}ms
                          </Badge>
                          {result.tokenCount && result.tokenCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {result.tokenCount} tokens
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!result && <ClockIcon className="size-5 text-muted-foreground shrink-0" />}
                      {isExpanded ? (
                        <ChevronUpIcon className="size-5 text-muted-foreground" />
                      ) : (
                        <ChevronDownIcon className="size-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && result && (
                  <div className="border-t p-4 space-y-4">
                    {/* Validation Errors */}
                    {result.errors.length > 0 && <ErrorDisplay errors={result.errors} />}

                    {/* Tabbed Content */}
                    <Tabs defaultValue="cards" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="cards">Questions</TabsTrigger>
                        <TabsTrigger value="json">JSON</TabsTrigger>
                        <TabsTrigger value="metrics">Metrics</TabsTrigger>
                      </TabsList>

                      <TabsContent value="cards" className="space-y-3 mt-4">
                        {result.questions.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            No questions generated
                          </div>
                        ) : (
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          result.questions.map((question: any, index: number) => (
                            <QuestionCard key={index} question={question} index={index} />
                          ))
                        )}
                      </TabsContent>

                      <TabsContent value="json" className="mt-4">
                        <div className="rounded border bg-muted/30 p-4 overflow-auto max-h-[500px]">
                          <pre className="text-xs">{JSON.stringify(result.rawOutput, null, 2)}</pre>
                        </div>
                      </TabsContent>

                      <TabsContent value="metrics" className="mt-4">
                        <div className="space-y-3">
                          <MetricRow label="Latency" value={`${result.latency}ms`} />
                          <MetricRow
                            label="Token Count"
                            value={result.tokenCount?.toString() || 'N/A'}
                          />
                          <MetricRow
                            label="Questions Generated"
                            value={result.questions.length.toString()}
                          />
                          <MetricRow
                            label="Schema Validation"
                            value={result.valid ? 'Passed' : 'Failed'}
                            valueClassName={result.valid ? 'text-green-600' : 'text-red-600'}
                          />
                          <MetricRow
                            label="Executed At"
                            value={new Date(result.executedAt).toLocaleString()}
                          />
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Empty state */}
      {selectedInputs.length > 0 && selectedConfigs.length > 0 && results.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No results yet. Click &ldquo;Run All Tests&rdquo; to begin.</p>
        </div>
      )}
    </div>
  );
}

/**
 * ErrorDisplay Component
 *
 * Improved error display with categorization, actionable hints, and collapsible details.
 */
interface ErrorDisplayProps {
  errors: string[];
}

function ErrorDisplay({ errors }: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (errors.length === 0) return null;

  // Categorize first error (most important)
  const primaryError = errors[0];
  const category = categorizeError(primaryError);
  const { label, className } = getCategoryDisplay(category);
  const hint = getErrorHint(category);

  // Extract summary (first line or first 150 chars)
  const summary = primaryError.split('\n')[0].substring(0, 150);

  const handleCopyError = () => {
    navigator.clipboard.writeText(errors.join('\n\n'));
    toast.success('Error details copied to clipboard');
  };

  return (
    <Alert variant="destructive">
      <AlertCircleIcon className="h-4 w-4" />
      <div className="space-y-2">
        <AlertTitle className="flex items-center justify-between">
          <span className={className}>{label}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleCopyError}>
              <CopyIcon className="h-3 w-3" />
            </Button>
            {(errors.length > 1 || primaryError.length > 150) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? (
                  <ChevronUpIcon className="h-3 w-3" />
                ) : (
                  <ChevronDownIcon className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </AlertTitle>
        <AlertDescription className="space-y-2">
          {/* Summary */}
          <p className="text-sm font-medium">{summary}</p>

          {/* Actionable Hint */}
          <p className="text-xs text-muted-foreground">💡 {hint}</p>

          {/* Detailed Errors (Collapsible) */}
          {showDetails && (
            <div className="mt-3 space-y-2 border-t pt-2">
              {errors.map((error, index) => (
                <div key={index} className="text-xs font-mono bg-muted/50 p-2 rounded">
                  {error}
                </div>
              ))}
            </div>
          )}
        </AlertDescription>
      </div>
    </Alert>
  );
}

/**
 * QuestionCard Component
 *
 * Larger, more prominent question display.
 */
interface QuestionCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  question: any;
  index: number;
}

function QuestionCard({ question, index }: QuestionCardProps) {
  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">Question {index + 1}</span>
          <Badge variant="outline">{question.type || 'unknown'}</Badge>
        </div>
        <p className="text-base font-medium leading-relaxed">{question.question}</p>
        {question.options && question.options.length > 0 && (
          <div className="space-y-2">
            {question.options.map((option: string, optIndex: number) => (
              <div
                key={optIndex}
                className={cn(
                  'text-sm p-3 rounded border transition-colors',
                  option === question.correctAnswer
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20 font-medium'
                    : 'border-muted bg-muted/30'
                )}
              >
                {option}
                {option === question.correctAnswer && (
                  <span className="ml-2 text-green-600">✓ Correct</span>
                )}
              </div>
            ))}
          </div>
        )}
        {question.explanation && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">{question.explanation}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * MetricRow Component
 *
 * Simple row for displaying a metric label and value.
 */
interface MetricRowProps {
  label: string;
  value: string;
  valueClassName?: string;
}

function MetricRow({ label, value, valueClassName }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between text-sm border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium', valueClassName)}>{value}</span>
    </div>
  );
}
