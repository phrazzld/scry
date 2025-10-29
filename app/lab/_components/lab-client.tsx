'use client';

/**
 * Genesis Laboratory Main Client
 *
 * Core UI for testing generation infrastructure configurations.
 * Manages state for input sets, configs, and execution results.
 * Orchestrates parallel execution and persistence.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ConfigManager } from '@/components/lab/config-manager';
import { InputSetManager } from '@/components/lab/input-set-manager';
import { ResultsGrid } from '@/components/lab/results-grid';
import {
  clearResults,
  isApproachingQuota,
  loadConfigs,
  loadInputSets,
  loadResults,
  saveConfigs,
  saveInputSets,
  saveResults,
} from '@/lib/lab-storage';
import type { ExecutionResult, InfraConfig, InputSet } from '@/types/lab';

export function LabClient() {
  // State
  const [inputSets, setInputSets] = useState<InputSet[]>([]);
  const [configs, setConfigs] = useState<InfraConfig[]>([]);
  const [results, setResults] = useState<ExecutionResult[]>([]);
  const [selectedInputSetId, setSelectedInputSetId] = useState<string | null>(null);
  const [enabledConfigIds, setEnabledConfigIds] = useState<Set<string>>(new Set());

  // Load state from localStorage on mount
  useEffect(() => {
    const loadedSets = loadInputSets();
    const loadedConfigs = loadConfigs();
    const loadedResults = loadResults();

    setInputSets(loadedSets);
    setConfigs(loadedConfigs);
    setResults(loadedResults);

    // Select first input set by default
    if (loadedSets.length > 0) {
      setSelectedInputSetId(loadedSets[0].id);
    }

    // Enable all configs by default
    setEnabledConfigIds(new Set(loadedConfigs.map((c) => c.id)));

    // Check quota warning
    if (isApproachingQuota()) {
      toast.warning('Storage quota warning', {
        description: 'Lab data is approaching 8MB. Consider clearing old results.',
      });
    }
  }, []);

  // Persist state to localStorage on change
  useEffect(() => {
    saveInputSets(inputSets);
  }, [inputSets]);

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

  // Input set handlers
  const handleCreateInputSet = (set: InputSet) => {
    setInputSets([...inputSets, set]);
  };

  const handleEditInputSet = (id: string, updates: Partial<InputSet>) => {
    setInputSets(inputSets.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleDeleteInputSet = (id: string) => {
    setInputSets(inputSets.filter((s) => s.id !== id));
    if (selectedInputSetId === id) {
      setSelectedInputSetId(null);
    }
  };

  // Config handlers
  const handleToggleConfig = (id: string) => {
    const newEnabledIds = new Set(enabledConfigIds);
    if (newEnabledIds.has(id)) {
      newEnabledIds.delete(id);
    } else {
      newEnabledIds.add(id);
    }
    setEnabledConfigIds(newEnabledIds);
  };

  const handleCreateConfig = (config: InfraConfig) => {
    setConfigs([...configs, config]);
    setEnabledConfigIds(new Set([...enabledConfigIds, config.id]));
  };

  const handleEditConfig = (config: InfraConfig) => {
    setConfigs(configs.map((c) => (c.id === config.id ? config : c)));
  };

  const handleDeleteConfig = (id: string) => {
    setConfigs(configs.filter((c) => c.id !== id));
    const newEnabledIds = new Set(enabledConfigIds);
    newEnabledIds.delete(id);
    setEnabledConfigIds(newEnabledIds);
  };

  // Execution handlers
  const [isRunning, setIsRunning] = useState(false);

  const handleRunAll = async () => {
    const selectedSet = inputSets.find((s) => s.id === selectedInputSetId);
    if (!selectedSet || selectedSet.inputs.length === 0) {
      toast.error('No input set selected');
      return;
    }

    const enabledConfigs = configs.filter((c) => enabledConfigIds.has(c.id));
    if (enabledConfigs.length === 0) {
      toast.error('No configs enabled');
      return;
    }

    setIsRunning(true);
    toast.info('Starting execution...', {
      description: `Running ${selectedSet.inputs.length} × ${enabledConfigs.length} tests`,
    });

    // Note: This would call convex actions in production
    // For now, just simulate execution
    toast.warning('Execution not yet wired to Convex actions', {
      description: 'Backend integration pending',
    });

    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🧪 Genesis Laboratory</h1>
              <p className="text-sm text-muted-foreground">
                Test generation infrastructure configurations
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClearResults}
                className="px-3 py-1.5 text-sm border rounded hover:bg-accent"
              >
                Clear Results
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
          {/* Left Panel: Input Sets (25%) */}
          <div className="lg:col-span-3 border rounded-lg p-4 overflow-y-auto">
            <h2 className="font-semibold mb-4">Test Inputs</h2>
            <InputSetManager
              sets={inputSets}
              selectedId={selectedInputSetId}
              onSelect={setSelectedInputSetId}
              onCreate={handleCreateInputSet}
              onEdit={handleEditInputSet}
              onDelete={handleDeleteInputSet}
            />
          </div>

          {/* Center Panel: Configs (35%) */}
          <div className="lg:col-span-4 border rounded-lg p-4 overflow-y-auto">
            <h2 className="font-semibold mb-4">Infrastructure Configs</h2>
            <ConfigManager
              configs={configs}
              enabledIds={enabledConfigIds}
              onToggleEnabled={handleToggleConfig}
              onCreate={handleCreateConfig}
              onEdit={handleEditConfig}
              onDelete={handleDeleteConfig}
            />
          </div>

          {/* Right Panel: Results (40%) */}
          <div className="lg:col-span-5 border rounded-lg p-4 overflow-y-auto">
            <h2 className="font-semibold mb-4">Results</h2>
            <ResultsGrid
              inputSet={inputSets.find((s) => s.id === selectedInputSetId) || null}
              configs={configs}
              enabledConfigIds={enabledConfigIds}
              results={results}
              onRunAll={handleRunAll}
              isRunning={isRunning}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
