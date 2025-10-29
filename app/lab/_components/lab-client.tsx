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
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Input sets: {inputSets.length}</p>
              <p className="text-sm text-muted-foreground">
                Selected: {selectedInputSetId ? '1 set' : 'None'}
              </p>
            </div>
          </div>

          {/* Center Panel: Configs (35%) */}
          <div className="lg:col-span-4 border rounded-lg p-4 overflow-y-auto">
            <h2 className="font-semibold mb-4">Infrastructure Configs</h2>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Configs: {configs.length}</p>
              <p className="text-sm text-muted-foreground">Enabled: {enabledConfigIds.size}</p>
            </div>
          </div>

          {/* Right Panel: Results (40%) */}
          <div className="lg:col-span-5 border rounded-lg p-4 overflow-y-auto">
            <h2 className="font-semibold mb-4">Results</h2>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Results: {results.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
