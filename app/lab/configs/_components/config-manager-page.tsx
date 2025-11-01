'use client';

/**
 * Config Manager Page
 *
 * Full-page configuration management interface.
 * Provides maximum space for editing complex multi-phase configs.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { PageContainer } from '@/components/page-container';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildLearningSciencePrompt, PROD_CONFIG_METADATA } from '@/convex/lib/promptTemplates';
import { loadConfigs, saveConfigs } from '@/lib/lab-storage';
import {
  isValidConfig,
  type AIProvider,
  type GoogleInfraConfig,
  type InfraConfig,
  type OpenAIInfraConfig,
  type PromptPhase,
} from '@/types/lab';

/**
 * Create PROD config
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
        outputType: 'questions',
      },
    ],
    isProd: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function ConfigManagerPage() {
  const [configs, setConfigs] = useState<InfraConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);

  // Load configs on mount
  useEffect(() => {
    let loaded = loadConfigs();
    const prodConfig = createProdConfig();
    const hasProd = loaded.some((c) => c.isProd);

    if (!hasProd) {
      loaded = [prodConfig, ...loaded];
    } else {
      loaded = loaded.map((c) => (c.isProd ? prodConfig : c));
    }

    setConfigs(loaded);
    saveConfigs(loaded);

    // Select first config by default
    if (loaded.length > 0 && !selectedConfigId) {
      setSelectedConfigId(loaded[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedConfig = configs.find((c) => c.id === selectedConfigId);

  const handleSave = (updatedConfig: InfraConfig) => {
    const exists = configs.find((c) => c.id === updatedConfig.id);
    const updated = exists
      ? configs.map((c) => (c.id === updatedConfig.id ? updatedConfig : c))
      : [...configs, updatedConfig];

    setConfigs(updated);
    saveConfigs(updated);
    toast.success(exists ? 'Config updated' : 'Config created');
  };

  const handleClone = (config: InfraConfig) => {
    let cloneName = `${config.name} (Clone)`;
    let counter = 1;
    while (configs.some((c) => c.name === cloneName)) {
      cloneName = `${config.name} (Clone ${counter})`;
      counter++;
    }

    const cloned: InfraConfig = {
      ...config,
      id: Date.now().toString(),
      name: cloneName,
      isProd: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updated = [...configs, cloned];
    setConfigs(updated);
    saveConfigs(updated);
    setSelectedConfigId(cloned.id);
    toast.success('Config cloned');
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this configuration?')) {
      const updated = configs.filter((c) => c.id !== id);
      setConfigs(updated);
      saveConfigs(updated);

      // Select first remaining config
      if (selectedConfigId === id && updated.length > 0) {
        setSelectedConfigId(updated[0].id);
      }

      toast.success('Config deleted');
    }
  };

  const handleNew = () => {
    const newConfig: InfraConfig = {
      id: Date.now().toString(),
      name: 'New Configuration',
      description: undefined,
      provider: 'google',
      model: 'gemini-2.5-flash',
      temperature: undefined,
      maxTokens: undefined,
      phases: [
        {
          name: 'Generation',
          template: 'Generate questions about: {{userInput}}',
        },
      ],
      isProd: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updated = [...configs, newConfig];
    setConfigs(updated);
    saveConfigs(updated);
    setSelectedConfigId(newConfig.id);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <PageContainer className="py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold mb-0">Config Management</h1>
            <Link href="/lab">
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to Lab
              </Button>
            </Link>
          </div>
        </PageContainer>
      </div>

      {/* Config Tabs + Editor */}
      <PageContainer className="py-4">
        <div className="space-y-4">
          {/* Horizontal Config Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {configs.map((config) => (
              <Button
                key={config.id}
                variant={selectedConfigId === config.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedConfigId(config.id)}
                className="shrink-0"
              >
                {config.name}
                {config.isProd && ' ★'}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={handleNew} className="shrink-0 gap-1">
              <PlusIcon className="h-3 w-3" />
              New Config
            </Button>
          </div>

          {/* Editor */}
          {selectedConfig ? (
            <Card className="p-5">
              <div className="flex items-start justify-between mb-5">
                <h2 className="text-lg font-semibold">
                  {selectedConfig.isProd ? 'View Configuration' : 'Edit Configuration'}
                </h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleClone(selectedConfig)}
                    className="gap-1"
                  >
                    <CopyIcon className="h-3 w-3" />
                    Clone
                  </Button>
                  {!selectedConfig.isProd && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(selectedConfig.id)}
                      className="gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2Icon className="h-3 w-3" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              <ConfigEditor
                config={selectedConfig}
                onSave={handleSave}
                disabled={selectedConfig.isProd}
              />
            </Card>
          ) : (
            <Card className="p-12 text-center text-muted-foreground">
              No configuration selected
            </Card>
          )}
        </div>
      </PageContainer>
    </div>
  );
}

/**
 * ConfigEditor - Full-width inline form
 */
interface ConfigEditorProps {
  config: InfraConfig;
  onSave: (config: InfraConfig) => void;
  disabled?: boolean;
}

function ConfigEditor({ config, onSave, disabled = false }: ConfigEditorProps) {
  const [name, setName] = useState(config.name);
  const [description, setDescription] = useState(config.description || '');
  const [provider, setProvider] = useState<AIProvider>(config.provider);
  const [model, setModel] = useState(config.model);
  const [temperature, setTemperature] = useState(config.temperature?.toString() || '');
  const [maxTokens, setMaxTokens] = useState(
    config.provider === 'google' && config.maxTokens !== undefined
      ? config.maxTokens.toString()
      : ''
  );
  const [phases, setPhases] = useState<PromptPhase[]>(config.phases);

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    const tempNum = temperature ? parseFloat(temperature) : undefined;
    const tokensNum = maxTokens ? parseInt(maxTokens, 10) : undefined;

    // Build provider-specific config based on provider selection
    let updated: InfraConfig;
    if (provider === 'google') {
      const googleConfig: GoogleInfraConfig = {
        ...config,
        provider: 'google',
        name: name.trim(),
        description: description.trim() || undefined,
        model: model.trim(),
        temperature: tempNum,
        maxTokens: tokensNum,
        topP: config.provider === 'google' ? config.topP : undefined,
        phases,
        updatedAt: Date.now(),
      };
      updated = googleConfig;
    } else {
      const openaiConfig: OpenAIInfraConfig = {
        ...config,
        provider: 'openai',
        name: name.trim(),
        description: description.trim() || undefined,
        model: model.trim(),
        temperature: tempNum,
        reasoningEffort: config.provider === 'openai' ? config.reasoningEffort : undefined,
        verbosity: config.provider === 'openai' ? config.verbosity : undefined,
        maxCompletionTokens: config.provider === 'openai' ? config.maxCompletionTokens : undefined,
        phases,
        updatedAt: Date.now(),
      };
      updated = openaiConfig;
    }

    if (!isValidConfig(updated)) {
      toast.error('Invalid configuration');
      return;
    }

    onSave(updated);
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Basic Information</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Configuration name"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Model Configuration */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Model Configuration</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as AIProvider)}
              disabled={disabled}
            >
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gemini-2.5-flash"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Generation Parameters */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Generation Parameters</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="temperature">Temperature</Label>
            <Input
              id="temperature"
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="Model default"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxTokens">Max Tokens</Label>
            <Input
              id="maxTokens"
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              placeholder="Model default"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Pipeline Phases - FULL WIDTH */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Pipeline Phases ({phases.length})</h3>
        <div className="space-y-3">
          {phases.map((phase, idx) => (
            <Card key={idx} className="p-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor={`phase-name-${idx}`}>Phase {idx + 1} Name</Label>
                <Input
                  id={`phase-name-${idx}`}
                  value={phase.name}
                  onChange={(e) => {
                    const updated = [...phases];
                    updated[idx] = { ...phase, name: e.target.value };
                    setPhases(updated);
                  }}
                  placeholder={`Phase ${idx + 1} name`}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`phase-template-${idx}`}>Prompt Template</Label>
                <Textarea
                  id={`phase-template-${idx}`}
                  value={phase.template}
                  onChange={(e) => {
                    const updated = [...phases];
                    updated[idx] = { ...phase, template: e.target.value };
                    setPhases(updated);
                  }}
                  placeholder="Prompt template (use {{variable}} for substitution)"
                  rows={8}
                  disabled={disabled}
                  className="font-mono text-sm"
                />
              </div>
              {idx < phases.length - 1 && (
                <div className="space-y-2">
                  <Label htmlFor={`phase-output-${idx}`}>Output Variable</Label>
                  <Input
                    id={`phase-output-${idx}`}
                    value={phase.outputTo || ''}
                    onChange={(e) => {
                      const updated = [...phases];
                      updated[idx] = { ...phase, outputTo: e.target.value || undefined };
                      setPhases(updated);
                    }}
                    placeholder="Variable name (e.g., analysis)"
                    disabled={disabled}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
        {!disabled && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPhases([...phases, { name: `Phase ${phases.length + 1}`, template: '' }])
              }
            >
              <PlusIcon className="h-3 w-3 mr-1" />
              Add Phase
            </Button>
            {phases.length > 1 && (
              <Button variant="outline" size="sm" onClick={() => setPhases(phases.slice(0, -1))}>
                <Trash2Icon className="h-3 w-3 mr-1" />
                Remove Last Phase
              </Button>
            )}
          </div>
        )}
      </div>

      {!disabled && (
        <div className="flex gap-3 pt-6 border-t">
          <Button onClick={handleSave}>Save Configuration</Button>
        </div>
      )}
    </div>
  );
}
