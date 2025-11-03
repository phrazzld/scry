'use client';

/**
 * Config Editor Component
 *
 * Form for creating and editing infrastructure configurations.
 * Includes PromptPhaseEditor sub-component for managing multi-phase prompt chains.
 */
import { useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

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
import { cn } from '@/lib/utils';
import {
  isValidConfig,
  type AIProvider,
  type GoogleInfraConfig,
  type InfraConfig,
  type OpenAIInfraConfig,
  type PromptPhase,
} from '@/types/lab';

interface ConfigEditorProps {
  config?: InfraConfig; // Existing config to edit (undefined for create)
  onSave: (config: InfraConfig) => void;
  onCancel: () => void;
}

export function ConfigEditor({ config, onSave, onCancel }: ConfigEditorProps) {
  const isEditing = !!config;

  // Form state
  const [name, setName] = useState(config?.name || '');
  const [description, setDescription] = useState(config?.description || '');
  const [provider, setProvider] = useState<AIProvider>(config?.provider || 'google');
  const [model, setModel] = useState(config?.model || 'gemini-2.5-flash');
  const [temperature, setTemperature] = useState(
    config?.temperature !== undefined ? config.temperature.toString() : ''
  );
  const [maxTokens, setMaxTokens] = useState(
    config?.provider === 'google' && config.maxTokens !== undefined
      ? config.maxTokens.toString()
      : ''
  );
  const [topP, setTopP] = useState(
    config?.provider === 'google' && config.topP !== undefined ? config.topP.toString() : ''
  );
  const [phases, setPhases] = useState<PromptPhase[]>(
    config?.phases || [
      {
        name: 'Phase 1',
        template: '',
        outputTo: undefined,
      },
    ]
  );

  const handleSave = () => {
    // Validation
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    // Temperature is optional (empty = model default)
    const tempNum = temperature ? parseFloat(temperature) : undefined;
    if (temperature && (isNaN(tempNum!) || tempNum! < 0 || tempNum! > 2)) {
      toast.error('Temperature must be between 0 and 2 (or leave empty for model default)');
      return;
    }

    // MaxTokens is optional (empty = model default)
    const tokensNum = maxTokens ? parseInt(maxTokens, 10) : undefined;
    if (maxTokens && (isNaN(tokensNum!) || tokensNum! < 1 || tokensNum! > 65536)) {
      toast.error('Max tokens must be between 1 and 65536 (or leave empty for model default)');
      return;
    }

    // TopP is optional (empty = model default)
    const topPNum = topP ? parseFloat(topP) : undefined;
    if (topP && (isNaN(topPNum!) || topPNum! < 0 || topPNum! > 1)) {
      toast.error('Top P must be between 0 and 1 (or leave empty for model default)');
      return;
    }

    if (phases.length === 0) {
      toast.error('At least one phase is required');
      return;
    }

    // Validate all phases
    for (let i = 0; i < phases.length; i++) {
      if (!phases[i].name.trim()) {
        toast.error(`Phase ${i + 1}: Name is required`);
        return;
      }
      if (!phases[i].template.trim()) {
        toast.error(`Phase ${i + 1}: Template is required`);
        return;
      }
    }

    // Build provider-specific config based on provider selection
    const baseFields = {
      id: config?.id || Date.now().toString(),
      name: name.trim(),
      description: description.trim() || undefined,
      isProd: config?.isProd || false,
      model: model.trim(),
      phases: phases.map((p) => ({
        name: p.name.trim(),
        template: p.template.trim(),
        outputTo: p.outputTo?.trim() || undefined,
      })),
      createdAt: config?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    let newConfig: InfraConfig;
    if (provider === 'google') {
      const googleConfig: GoogleInfraConfig = {
        ...baseFields,
        provider: 'google',
        temperature: tempNum,
        maxTokens: tokensNum,
        topP: topPNum,
      };
      newConfig = googleConfig;
    } else {
      // OpenAI config - preserve existing OpenAI-specific parameters
      const openaiConfig: OpenAIInfraConfig = {
        ...baseFields,
        provider: 'openai',
        temperature: tempNum,
        // Preserve OpenAI-specific fields not shown in editor (only when editing OpenAI config)
        ...(config?.provider === 'openai' && {
          maxCompletionTokens: config.maxCompletionTokens,
          reasoningEffort: config.reasoningEffort,
          verbosity: config.verbosity,
        }),
      };
      newConfig = openaiConfig;
    }

    if (!isValidConfig(newConfig)) {
      toast.error('Invalid configuration');
      return;
    }

    onSave(newConfig);
    toast.success(isEditing ? 'Config updated' : 'Config created');
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{isEditing ? 'Edit Config' : 'New Config'}</h3>
        {config?.isProd && (
          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
            PROD
          </span>
        )}
      </div>

      {/* Basic Info */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="config-name">Name *</Label>
          <Input
            id="config-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., 3-Phase Gemini Pro"
            autoFocus
            disabled={config?.isProd}
          />
        </div>

        <div>
          <Label htmlFor="config-description">Description</Label>
          <Input
            id="config-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            disabled={config?.isProd}
          />
        </div>
      </div>

      {/* Model Configuration */}
      <div className="space-y-3 pt-2 border-t">
        <h4 className="text-sm font-medium">Model Configuration</h4>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="config-provider">Provider *</Label>
            <Select
              value={provider}
              onValueChange={(value) => setProvider(value as AIProvider)}
              disabled={config?.isProd}
            >
              <SelectTrigger id="config-provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="config-model">Model *</Label>
            <Input
              id="config-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g., gemini-2.5-flash"
              disabled={config?.isProd}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="config-temperature">Temperature</Label>
            <Input
              id="config-temperature"
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              disabled={config?.isProd}
              placeholder="Model default"
            />
            <p className="text-xs text-muted-foreground mt-1">0-2 (empty = default)</p>
          </div>

          <div>
            <Label htmlFor="config-max-tokens">Max Tokens</Label>
            <Input
              id="config-max-tokens"
              type="number"
              min="1"
              max="65536"
              step="1"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              disabled={config?.isProd}
              placeholder="Model default"
            />
            <p className="text-xs text-muted-foreground mt-1">1-65536 (empty = default)</p>
          </div>

          <div>
            <Label htmlFor="config-top-p">Top P</Label>
            <Input
              id="config-top-p"
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={topP}
              onChange={(e) => setTopP(e.target.value)}
              placeholder="Model default"
              disabled={config?.isProd}
            />
            <p className="text-xs text-muted-foreground mt-1">0-1 (empty = default)</p>
          </div>
        </div>
      </div>

      {/* Prompt Phases */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Prompt Phases</h4>
          {!config?.isProd && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setPhases([
                  ...phases,
                  {
                    name: `Phase ${phases.length + 1}`,
                    template: '',
                    outputTo: undefined,
                  },
                ])
              }
              className="h-7 gap-1"
            >
              <PlusIcon className="h-3 w-3" />
              Add Phase
            </Button>
          )}
        </div>

        <PromptPhaseEditor phases={phases} onChange={setPhases} disabled={config?.isProd} />
      </div>

      {/* Actions */}
      {!config?.isProd && (
        <div className="flex gap-2 pt-2 border-t">
          <Button onClick={handleSave}>{isEditing ? 'Save Changes' : 'Create Config'}</Button>
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
        </div>
      )}

      {config?.isProd && (
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Production config is read-only. Clone to create an editable version.
        </p>
      )}
    </Card>
  );
}

/**
 * PromptPhaseEditor Sub-component
 *
 * Manages dynamic array of prompt phases with add/remove functionality.
 */
interface PromptPhaseEditorProps {
  phases: PromptPhase[];
  onChange: (phases: PromptPhase[]) => void;
  disabled?: boolean;
}

function PromptPhaseEditor({ phases, onChange, disabled }: PromptPhaseEditorProps) {
  const handlePhaseChange = (index: number, updates: Partial<PromptPhase>) => {
    const newPhases = [...phases];
    newPhases[index] = { ...newPhases[index], ...updates };
    onChange(newPhases);
  };

  const handleRemovePhase = (index: number) => {
    if (phases.length === 1) {
      toast.error('At least one phase is required');
      return;
    }
    const newPhases = phases.filter((_, i) => i !== index);
    onChange(newPhases);
  };

  return (
    <div className="space-y-3">
      {phases.map((phase, index) => (
        <Card key={index} className={cn('p-3 space-y-2', disabled && 'bg-muted/30')}>
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium">Phase {index + 1}</h5>
            {!disabled && phases.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemovePhase(index)}
                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
              >
                <Trash2Icon className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div>
            <Label htmlFor={`phase-${index}-name`}>Phase Name *</Label>
            <Input
              id={`phase-${index}-name`}
              value={phase.name}
              onChange={(e) => handlePhaseChange(index, { name: e.target.value })}
              placeholder="e.g., Intent Clarification"
              disabled={disabled}
            />
          </div>

          <div>
            <Label htmlFor={`phase-${index}-template`}>Prompt Template *</Label>
            <Textarea
              id={`phase-${index}-template`}
              value={phase.template}
              onChange={(e) => handlePhaseChange(index, { template: e.target.value })}
              placeholder="Enter prompt template. Use {{variableName}} for variables..."
              rows={6}
              className="font-mono text-xs"
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Variables: {'{{userInput}}'}, {'{{clarifiedIntent}}'}, etc.
            </p>
          </div>

          {index < phases.length - 1 && (
            <div>
              <Label htmlFor={`phase-${index}-output`}>Output Variable Name</Label>
              <Input
                id={`phase-${index}-output`}
                value={phase.outputTo || ''}
                onChange={(e) =>
                  handlePhaseChange(index, { outputTo: e.target.value || undefined })
                }
                placeholder="e.g., clarifiedIntent"
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used as {'{{' + (phase.outputTo || 'outputName') + '}'} in next phase
              </p>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
