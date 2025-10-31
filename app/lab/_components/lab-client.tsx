'use client';

/**
 * Genesis Laboratory Main Client
 *
 * Core UI for testing generation infrastructure configurations.
 * Manages state for input sets, configs, and execution results.
 * Orchestrates parallel execution and persistence.
 */
import { useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { toast } from 'sonner';

import { ConfigManager } from '@/components/lab/config-manager';
import { InputManager } from '@/components/lab/input-manager';
import { ResultsGrid } from '@/components/lab/results-grid';
import { PageContainer } from '@/components/page-container';
import { api } from '@/convex/_generated/api';
import {
  buildIntentClarificationPrompt,
  buildQuestionPromptFromIntent,
  PROD_CONFIG_METADATA,
} from '@/convex/lib/promptTemplates';
import {
  clearResults,
  isApproachingQuota,
  loadConfigs,
  loadInputs,
  loadResults,
  saveConfigs,
  saveInputs,
  saveResults,
} from '@/lib/lab-storage';
import type { ExecutionResult, InfraConfig, TestInput } from '@/types/lab';

/**
 * Create PROD baseline config using shared production prompts
 *
 * This references the exact same prompt templates used in production,
 * ensuring the lab always shows the current production infrastructure.
 */
function createProdConfig(): InfraConfig {
  const now = Date.now();
  return {
    id: 'prod-baseline',
    name: 'PRODUCTION (Current)',
    description: 'Live production infrastructure - reflects actual prompts used in app',
    provider: PROD_CONFIG_METADATA.provider,
    model: PROD_CONFIG_METADATA.model,
    // Production omits temperature/maxTokens/topP (uses model defaults)
    // DO NOT add them - structured output is sensitive to parameter overrides
    phases: [
      {
        name: 'Intent Clarification',
        template: buildIntentClarificationPrompt('{{userInput}}'),
        outputTo: 'clarifiedIntent',
      },
      {
        name: 'Question Generation',
        template: buildQuestionPromptFromIntent('{{clarifiedIntent}}'),
        // Final phase - no outputTo
      },
    ],
    isProd: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function LabClient() {
  // State
  const [inputs, setInputs] = useState<TestInput[]>([]);
  const [configs, setConfigs] = useState<InfraConfig[]>([]);
  const [results, setResults] = useState<ExecutionResult[]>([]);
  const [selectedInputIds, setSelectedInputIds] = useState<Set<string>>(new Set());
  const [selectedConfigIds, setSelectedConfigIds] = useState<Set<string>>(new Set());

  // Load state from localStorage on mount
  useEffect(() => {
    const loadedInputs = loadInputs();
    let loadedConfigs = loadConfigs();
    const loadedResults = loadResults();

    // Ensure PROD baseline config always exists (using shared production prompts)
    const prodConfig = createProdConfig();
    const hasProdConfig = loadedConfigs.some((c) => c.isProd);

    if (!hasProdConfig) {
      // No PROD config - add it as first config
      loadedConfigs = [prodConfig, ...loadedConfigs];
    } else {
      // PROD config exists - update it to match current production (single source of truth)
      loadedConfigs = loadedConfigs.map((c) => (c.isProd ? prodConfig : c));
    }

    setInputs(loadedInputs);
    setConfigs(loadedConfigs);
    setResults(loadedResults);

    // Select all inputs and configs by default
    setSelectedInputIds(new Set(loadedInputs.map((i) => i.id)));
    setSelectedConfigIds(new Set(loadedConfigs.map((c) => c.id)));

    // Check quota warning
    if (isApproachingQuota()) {
      toast.warning('Storage quota warning', {
        description: 'Lab data is approaching 8MB. Consider clearing old results.',
      });
    }
  }, []);

  // Persist state to localStorage on change
  useEffect(() => {
    saveInputs(inputs);
  }, [inputs]);

  useEffect(() => {
    saveConfigs(configs);
  }, [configs]);

  useEffect(() => {
    saveResults(results);
  }, [results]);

  const handleClearResults = () => {
    clearResults();
    setResults([]);
    toast.success('Results cleared');
  };

  // Export/Import handlers
  const handleExportData = () => {
    const exportData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      inputs,
      configs: configs.filter((c) => !c.isProd), // Don't export PROD config
      results,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lab-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Data exported', {
      description: `${inputs.length} inputs, ${configs.length} configs`,
    });
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);

        // Validate structure
        if (!importData.version || !importData.inputs || !importData.configs) {
          toast.error('Invalid import file', {
            description: 'Missing required fields',
          });
          return;
        }

        // Import inputs
        if (Array.isArray(importData.inputs)) {
          setInputs([...inputs, ...importData.inputs]);
        }

        // Import configs (exclude PROD)
        if (Array.isArray(importData.configs)) {
          const nonProdConfigs = importData.configs.filter((c: InfraConfig) => !c.isProd);
          setConfigs([...configs, ...nonProdConfigs]);
        }

        // Optionally import results
        if (Array.isArray(importData.results)) {
          setResults([...results, ...importData.results]);
        }

        toast.success('Data imported', {
          description: `Added ${importData.inputs.length} inputs, ${importData.configs.length} configs`,
        });
      } catch (error) {
        toast.error('Import failed', {
          description: error instanceof Error ? error.message : 'Invalid JSON file',
        });
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be imported again
    event.target.value = '';
  };

  // Input handlers
  const handleToggleInput = (id: string) => {
    const newSelectedIds = new Set(selectedInputIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
    } else {
      newSelectedIds.add(id);
    }
    setSelectedInputIds(newSelectedIds);
  };

  const handleCreateInput = (input: TestInput) => {
    setInputs([...inputs, input]);
    // Auto-select new input
    setSelectedInputIds(new Set([...selectedInputIds, input.id]));
  };

  const handleEditInput = (id: string, text: string) => {
    setInputs(inputs.map((i) => (i.id === id ? { ...i, text } : i)));
  };

  const handleDeleteInput = (id: string) => {
    setInputs(inputs.filter((i) => i.id !== id));
    const newSelectedIds = new Set(selectedInputIds);
    newSelectedIds.delete(id);
    setSelectedInputIds(newSelectedIds);
  };

  // Config handlers
  const handleToggleConfig = (id: string) => {
    const newSelectedIds = new Set(selectedConfigIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
    } else {
      newSelectedIds.add(id);
    }
    setSelectedConfigIds(newSelectedIds);
  };

  const handleCreateConfig = (config: InfraConfig) => {
    setConfigs([...configs, config]);
    setSelectedConfigIds(new Set([...selectedConfigIds, config.id]));
  };

  const handleEditConfig = (config: InfraConfig) => {
    setConfigs(configs.map((c) => (c.id === config.id ? config : c)));
  };

  const handleDeleteConfig = (id: string) => {
    setConfigs(configs.filter((c) => c.id !== id));
    const newSelectedIds = new Set(selectedConfigIds);
    newSelectedIds.delete(id);
    setSelectedConfigIds(newSelectedIds);
  };

  // Execution handlers
  const [isRunning, setIsRunning] = useState(false);
  const [executionProgress, setExecutionProgress] = useState({ total: 0, completed: 0, failed: 0 });
  const executeConfig = useAction(api.lab.executeConfig);

  const handleRunAll = async () => {
    const selectedInputs = inputs.filter((i) => selectedInputIds.has(i.id));
    if (selectedInputs.length === 0) {
      toast.error('No inputs selected');
      return;
    }

    const selectedConfigs = configs.filter((c) => selectedConfigIds.has(c.id));
    if (selectedConfigs.length === 0) {
      toast.error('No configs selected');
      return;
    }

    const totalTests = selectedInputs.length * selectedConfigs.length;
    setIsRunning(true);
    setExecutionProgress({ total: totalTests, completed: 0, failed: 0 });

    toast.info('Starting execution...', {
      description: `Running ${selectedInputs.length} × ${selectedConfigs.length} tests`,
    });

    // Create promises for all config × input combinations
    const executionPromises: Promise<ExecutionResult>[] = [];

    for (const input of selectedInputs) {
      for (const config of selectedConfigs) {
        const promise = executeConfig({
          configId: config.id,
          configName: config.name,
          provider: config.provider,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          topP: config.topP,
          phases: config.phases,
          testInput: input.text,
        })
          .then((result) => {
            // Update progress on success
            setExecutionProgress((prev) => ({
              ...prev,
              completed: prev.completed + 1,
            }));
            return result as ExecutionResult;
          })
          .catch((error) => {
            // Handle individual execution failure
            setExecutionProgress((prev) => ({
              ...prev,
              completed: prev.completed + 1,
              failed: prev.failed + 1,
            }));
            // Return a failed result
            return {
              configId: config.id,
              configName: config.name,
              input: input.text,
              questions: [],
              rawOutput: null,
              latency: 0,
              tokenCount: 0,
              valid: false,
              errors: [error instanceof Error ? error.message : String(error)],
              executedAt: Date.now(),
            } as ExecutionResult;
          });

        executionPromises.push(promise);
      }
    }

    try {
      // Execute all in parallel
      const newResults = await Promise.all(executionPromises);

      // Update results state
      setResults([...results, ...newResults]);

      const successCount = newResults.filter((r) => r.valid).length;
      const failCount = newResults.filter((r) => !r.valid).length;

      toast.success('Execution complete', {
        description: `${successCount} passed, ${failCount} failed`,
      });
    } catch (error) {
      toast.error('Execution failed', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsRunning(false);
      setExecutionProgress({ total: 0, completed: 0, failed: 0 });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <PageContainer className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🧪 Genesis Laboratory</h1>
              <p className="text-sm text-muted-foreground">
                Test generation infrastructure configurations
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href="/lab/playground"
                className="px-3 py-1.5 text-sm border rounded hover:bg-accent"
              >
                ⚡ Playground
              </a>
              <button
                onClick={handleExportData}
                className="px-3 py-1.5 text-sm border rounded hover:bg-accent"
              >
                Export Data
              </button>
              <label className="px-3 py-1.5 text-sm border rounded hover:bg-accent cursor-pointer">
                Import Data
                <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
              </label>
              <button
                onClick={handleClearResults}
                className="px-3 py-1.5 text-sm border rounded hover:bg-accent"
              >
                Clear Results
              </button>
            </div>
          </div>
        </PageContainer>
      </div>

      {/* 3-Panel Layout */}
      <PageContainer className="py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
          {/* Left Panel: Test Inputs (25%) */}
          <div className="lg:col-span-3 border rounded-lg p-4 overflow-y-auto">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm">
                1
              </span>
              Test Inputs
            </h2>
            <InputManager
              inputs={inputs}
              selectedIds={selectedInputIds}
              onToggleSelected={handleToggleInput}
              onCreate={handleCreateInput}
              onEdit={handleEditInput}
              onDelete={handleDeleteInput}
            />
          </div>

          {/* Center Panel: Infrastructure Configs (35%) */}
          <div className="lg:col-span-4 border rounded-lg p-4 overflow-y-auto">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm">
                2
              </span>
              Infrastructure Configs
            </h2>
            <ConfigManager
              configs={configs}
              enabledIds={selectedConfigIds}
              onToggleEnabled={handleToggleConfig}
              onCreate={handleCreateConfig}
              onEdit={handleEditConfig}
              onDelete={handleDeleteConfig}
            />
          </div>

          {/* Right Panel: Results (40%) */}
          <div className="lg:col-span-5 border rounded-lg p-4 overflow-y-auto">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm">
                3
              </span>
              Results
            </h2>
            <ResultsGrid
              inputs={inputs}
              selectedInputIds={selectedInputIds}
              configs={configs}
              selectedConfigIds={selectedConfigIds}
              results={results}
              onRunAll={handleRunAll}
              isRunning={isRunning}
              executionProgress={executionProgress}
            />
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
