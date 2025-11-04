'use client';

/**
 * Config Management Dialog
 *
 * Modal for managing configurations with template-based creation.
 */
import { useState } from 'react';
import { CopyIcon, Edit2Icon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  isValidConfig,
  type AIProvider,
  type GoogleInfraConfig,
  type InfraConfig,
  type OpenAIInfraConfig,
  type PromptPhase,
} from '@/types/lab';

interface ConfigManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configs: InfraConfig[];
  onSave: (configs: InfraConfig[]) => void;
}

export function ConfigManagementDialog({
  open,
  onOpenChange,
  configs,
  onSave,
}: ConfigManagementDialogProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'create'>('library');
  const [editingConfig, setEditingConfig] = useState<InfraConfig | null>(null);

  const handleCloneConfig = (config: InfraConfig) => {
    // Generate unique clone name
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

    setEditingConfig(cloned);
    setActiveTab('create');
  };

  const handleCreateNew = () => {
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

    setEditingConfig(newConfig);
    setActiveTab('create');
  };

  const handleSaveConfig = (config: InfraConfig) => {
    const exists = configs.find((c) => c.id === config.id);
    const updated = exists
      ? configs.map((c) => (c.id === config.id ? config : c))
      : [...configs, config];

    onSave(updated);
    setEditingConfig(null);
    setActiveTab('library');
    toast.success(exists ? 'Config updated' : 'Config created');
  };

  const handleDeleteConfig = (id: string) => {
    if (confirm('Delete this configuration?')) {
      onSave(configs.filter((c) => c.id !== id));
      toast.success('Config deleted');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Configurations</DialogTitle>
          <DialogDescription>
            Create, edit, and manage your generation configurations
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'library' | 'create')}
          className="flex-1 overflow-hidden flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="library">Configurations</TabsTrigger>
            <TabsTrigger value="create">
              {editingConfig ? 'Edit Configuration' : 'New Configuration'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="flex-1 overflow-auto space-y-4 mt-4">
            {/* New Configuration Button */}
            <div className="flex justify-end">
              <Button onClick={handleCreateNew} variant="outline" size="sm" className="gap-2">
                <PlusIcon className="h-4 w-4" />
                New Configuration
              </Button>
            </div>

            {/* Config List */}
            <div>
              <div className="space-y-3">
                {configs.map((config) => (
                  <Card
                    key={config.id}
                    className={cn(
                      'p-4',
                      config.isProd && 'border-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/10'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{config.name}</span>
                          {config.isProd && (
                            <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded">
                              PROD
                            </span>
                          )}
                        </div>
                        {config.description && (
                          <p className="text-xs text-muted-foreground">{config.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{config.provider}</span>
                          <span>•</span>
                          <span>{config.model}</span>
                          <span>•</span>
                          <span>{config.phases.length}-phase</span>
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCloneConfig(config)}
                          title="Clone configuration"
                        >
                          <CopyIcon className="h-3 w-3" />
                        </Button>
                        {!config.isProd && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingConfig(config);
                                setActiveTab('create');
                              }}
                              title="Edit configuration"
                            >
                              <Edit2Icon className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteConfig(config.id)}
                              className="text-destructive hover:text-destructive"
                              title="Delete configuration"
                            >
                              <Trash2Icon className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}

                {configs.length === 0 && (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    No configurations yet. Create one to get started.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="create" className="flex-1 overflow-auto mt-4">
            {editingConfig ? (
              <ConfigEditor
                config={editingConfig}
                onSave={handleSaveConfig}
                onCancel={() => {
                  setEditingConfig(null);
                  setActiveTab('library');
                }}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Select a template from the Library tab to get started</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ConfigEditor - Simplified inline form
 */
interface ConfigEditorProps {
  config: InfraConfig;
  onSave: (config: InfraConfig) => void;
  onCancel: () => void;
}

function ConfigEditor({ config, onSave, onCancel }: ConfigEditorProps) {
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
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
            <Select value={provider} onValueChange={(v) => setProvider(v as AIProvider)}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
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
            />
          </div>
        </div>
      </div>

      {/* Pipeline Phases */}
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
                  rows={3}
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
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
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
      </div>

      <div className="flex gap-3 pt-6 border-t">
        <Button onClick={handleSave}>Save Configuration</Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
