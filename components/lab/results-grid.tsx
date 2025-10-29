'use client';

/**
 * Results Grid Component
 *
 * Matrix display of execution results (inputs � configs).
 * Includes ResultCell with tabbed views (JSON | Cards | Metrics).
 */
import { useState } from 'react';
import { AlertCircleIcon, CheckCircle2Icon, ClockIcon, XCircleIcon } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { type ExecutionResult, type InfraConfig, type InputSet } from '@/types/lab';

interface ResultsGridProps {
  inputSet: InputSet | null;
  configs: InfraConfig[];
  enabledConfigIds: Set<string>;
  results: ExecutionResult[];
  onRunAll: () => void;
  isRunning: boolean;
}

export function ResultsGrid({
  inputSet,
  configs,
  enabledConfigIds,
  results,
  onRunAll,
  isRunning,
}: ResultsGridProps) {
  const [selectedResult, setSelectedResult] = useState<ExecutionResult | null>(null);

  const enabledConfigs = configs.filter((c) => enabledConfigIds.has(c.id));

  // Build results map for quick lookup: `${input}_${configId}` -> result
  const resultsMap = new Map<string, ExecutionResult>();
  for (const result of results) {
    const key = `${result.input}_${result.configId}`;
    resultsMap.set(key, result);
  }

  if (!inputSet || inputSet.inputs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Select an input set to view results</p>
      </div>
    );
  }

  if (enabledConfigs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Enable at least one config to run tests</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Run Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {inputSet.inputs.length} input{inputSet.inputs.length !== 1 ? 's' : ''} �{' '}
          {enabledConfigs.length} config{enabledConfigs.length !== 1 ? 's' : ''} ={' '}
          {inputSet.inputs.length * enabledConfigs.length} test
          {inputSet.inputs.length * enabledConfigs.length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={onRunAll}
          disabled={isRunning}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded border transition-colors',
            isRunning
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {isRunning ? 'Running...' : 'Run All Tests'}
        </button>
      </div>

      {/* Results Matrix */}
      <div className="space-y-3">
        {inputSet.inputs.map((input, inputIndex) => (
          <Card key={inputIndex} className="p-3">
            <div className="space-y-2">
              {/* Input Label */}
              <div className="text-sm font-medium border-b pb-2">
                Input {inputIndex + 1}: {input.substring(0, 60)}
                {input.length > 60 ? '...' : ''}
              </div>

              {/* Config Results */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {enabledConfigs.map((config) => {
                  const key = `${input}_${config.id}`;
                  const result = resultsMap.get(key);

                  return (
                    <button
                      key={config.id}
                      onClick={() => result && setSelectedResult(result)}
                      className={cn(
                        'p-2 text-left rounded border transition-colors',
                        result
                          ? result.valid
                            ? 'border-green-500 bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30'
                            : 'border-red-500 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30'
                          : 'border-muted bg-muted/30 hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">{config.name}</span>
                        {result ? (
                          result.valid ? (
                            <CheckCircle2Icon className="size-4 text-green-600 shrink-0" />
                          ) : (
                            <XCircleIcon className="size-4 text-red-600 shrink-0" />
                          )
                        ) : (
                          <ClockIcon className="size-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      {result && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {result.questions.length} questions · {result.latency}ms
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Selected Result Detail */}
      {selectedResult && (
        <Card className="p-4">
          <ResultCell result={selectedResult} onClose={() => setSelectedResult(null)} />
        </Card>
      )}
    </div>
  );
}

/**
 * ResultCell Component
 *
 * Detailed view of a single execution result with tabbed display.
 */
interface ResultCellProps {
  result: ExecutionResult;
  onClose: () => void;
}

function ResultCell({ result, onClose }: ResultCellProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{result.configName}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Input: {result.input.substring(0, 80)}
            {result.input.length > 80 ? '...' : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <XCircleIcon className="size-5" />
        </button>
      </div>

      {/* Metrics Summary */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={result.valid ? 'default' : 'destructive'}>
          {result.valid ? 'Valid' : 'Invalid'}
        </Badge>
        <Badge variant="outline">{result.questions.length} questions</Badge>
        <Badge variant="outline">{result.latency}ms</Badge>
        {result.tokenCount && result.tokenCount > 0 && (
          <Badge variant="outline">{result.tokenCount} tokens</Badge>
        )}
        {result.errors.length > 0 && (
          <Badge variant="destructive">
            {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Validation Errors */}
      {result.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {result.errors.map((error, index) => (
                <div key={index} className="text-xs">
                  · {error}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabbed Content */}
      <Tabs defaultValue="cards">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="space-y-2 mt-3">
          {result.questions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No questions generated
            </div>
          ) : (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result.questions.map((question: any, index: number) => (
              <QuestionPreviewCard key={index} question={question} index={index} />
            ))
          )}
        </TabsContent>

        <TabsContent value="json" className="mt-3">
          <div className="rounded border bg-muted/30 p-3 overflow-auto max-h-[500px]">
            <pre className="text-xs">{JSON.stringify(result.rawOutput, null, 2)}</pre>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="mt-3">
          <div className="space-y-3">
            <MetricRow label="Latency" value={`${result.latency}ms`} />
            <MetricRow label="Token Count" value={result.tokenCount?.toString() || 'N/A'} />
            <MetricRow label="Questions Generated" value={result.questions.length.toString()} />
            <MetricRow
              label="Schema Validation"
              value={result.valid ? 'Passed' : 'Failed'}
              valueClassName={result.valid ? 'text-green-600' : 'text-red-600'}
            />
            <MetricRow label="Executed At" value={new Date(result.executedAt).toLocaleString()} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * QuestionPreviewCard Component
 *
 * Simple card preview of a generated question.
 */
interface QuestionPreviewCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  question: any;
  index: number;
}

function QuestionPreviewCard({ question, index }: QuestionPreviewCardProps) {
  return (
    <Card className="p-3">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Q{index + 1}</span>
          <Badge variant="outline" className="text-xs">
            {question.type || 'unknown'}
          </Badge>
        </div>
        <p className="text-sm font-medium">{question.question}</p>
        {question.options && question.options.length > 0 && (
          <div className="space-y-1">
            {question.options.map((option: string, optIndex: number) => (
              <div
                key={optIndex}
                className={cn(
                  'text-xs p-2 rounded border',
                  option === question.correctAnswer
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                    : 'border-muted bg-muted/30'
                )}
              >
                {option}
                {option === question.correctAnswer && <span className="ml-2 text-green-600"></span>}
              </div>
            ))}
          </div>
        )}
        {question.explanation && (
          <p className="text-xs text-muted-foreground">{question.explanation}</p>
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
