'use client';

/**
 * Config Manager Component
 *
 * Manages CRUD operations for infrastructure configurations.
 * Lists configs with enable/disable toggles and edit/delete actions.
 */
import { useState } from 'react';
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  Edit2Icon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';

import { ConfigEditor } from '@/components/lab/config-editor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { isMultiModelConfig, type InfraConfig } from '@/types/lab';

interface ConfigManagerProps {
  configs: InfraConfig[];
  enabledIds: Set<string>;
  onToggleEnabled: (id: string) => void;
  onCreate: (config: InfraConfig) => void;
  onEdit: (config: InfraConfig) => void;
  onDelete: (id: string) => void;
}

export function ConfigManager({
  configs,
  enabledIds,
  onToggleEnabled,
  onCreate,
  onEdit,
  onDelete,
}: ConfigManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingConfig, setEditingConfig] = useState<InfraConfig | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCreate = (config: InfraConfig) => {
    onCreate(config);
    setIsCreating(false);
  };

  const handleEdit = (config: InfraConfig) => {
    onEdit(config);
    setEditingConfig(null);
  };

  const handleDelete = (id: string) => {
    const config = configs.find((c) => c.id === id);
    if (config?.isProd) {
      toast.error('Cannot delete production config');
      return;
    }
    if (confirm('Delete this config?')) {
      onDelete(id);
      toast.success('Config deleted');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleStartEdit = (config: InfraConfig) => {
    if (config.isProd) {
      toast.info('Production config is read-only');
      return;
    }
    setEditingConfig(config);
    setIsCreating(false);
  };

  return (
    <div className="space-y-3">
      {/* Create/Edit Form */}
      {(isCreating || editingConfig) && (
        <ConfigEditor
          config={editingConfig || undefined}
          onSave={editingConfig ? handleEdit : handleCreate}
          onCancel={() => {
            setIsCreating(false);
            setEditingConfig(null);
          }}
        />
      )}

      {/* List of configs */}
      {configs.map((config) => {
        const isEnabled = enabledIds.has(config.id);
        const isExpanded = expandedId === config.id;

        return (
          <Card
            key={config.id}
            className={cn(
              'transition-all hover:shadow-md hover:border-primary/50',
              isEnabled && 'border-green-500 dark:border-green-600',
              config.isProd &&
                'border-l-4 border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/10 border-yellow-200 dark:border-yellow-900'
            )}
          >
            <div className="p-3 space-y-2">
              {/* Header */}
              <div className="flex items-start gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Checkbox
                    id={`config-${config.id}`}
                    checked={isEnabled}
                    onCheckedChange={() => onToggleEnabled(config.id)}
                    disabled={isCreating || editingConfig !== null}
                  />
                  <button
                    onClick={() => toggleExpand(config.id)}
                    className="flex-1 text-left group"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                        {config.name}
                      </h3>
                      {config.isProd && (
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                          ⭐ BASELINE
                        </span>
                      )}
                      {isEnabled && (
                        <CheckCircle2Icon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    {config.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {config.description}
                      </p>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => toggleExpand(config.id)}
                  className="p-0.5 hover:bg-muted rounded shrink-0"
                >
                  {isExpanded ? (
                    <ChevronUpIcon className="h-4 w-4" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Metadata */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{config.provider}</span>
                  <span>•</span>
                  <span>{isMultiModelConfig(config) ? 'mixed models' : config.model}</span>
                  <span>•</span>
                  <span>{config.phases.length}-phase</span>
                  {config.temperature !== undefined && (
                    <>
                      <span>•</span>
                      <span>T={config.temperature}</span>
                    </>
                  )}
                </div>
                {!isExpanded && (
                  <div className="text-xs text-muted-foreground/70 truncate">
                    {config.phases.map((p) => p.name).join(' → ')}
                  </div>
                )}
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-xs space-y-1">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Google-specific parameters */}
                      {config.provider === 'google' && (
                        <>
                          {config.maxTokens !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Max Tokens:</span>{' '}
                              {config.maxTokens}
                            </div>
                          )}
                          {config.topP !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Top P:</span> {config.topP}
                            </div>
                          )}
                        </>
                      )}
                      {/* OpenAI-specific parameters */}
                      {config.provider === 'openai' && (
                        <>
                          {config.reasoningEffort && (
                            <div>
                              <span className="text-muted-foreground">Reasoning:</span>{' '}
                              {config.reasoningEffort}
                            </div>
                          )}
                          {config.verbosity && (
                            <div>
                              <span className="text-muted-foreground">Verbosity:</span>{' '}
                              {config.verbosity}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-medium">Phases:</h4>
                    {config.phases.map((phase, idx) => {
                      // Get model for this phase (multi-model configs use different models per phase)
                      const phaseModel =
                        isMultiModelConfig(config) && phase.name.includes('Phase 2')
                          ? 'gpt-5'
                          : config.model;
                      const isDifferentModel =
                        isMultiModelConfig(config) && phaseModel !== config.model;

                      // Get reasoning effort for this phase if OpenAI
                      const reasoning =
                        config.provider === 'openai' && config.reasoningEffort
                          ? phase.name.includes('Phase 2') ||
                            phase.name.includes('Phase 3') ||
                            phase.name.includes('Phase 5')
                            ? 'high'
                            : 'medium'
                          : null;

                      return (
                        <div
                          key={idx}
                          className={cn(
                            'text-xs rounded px-2 py-1.5',
                            isDifferentModel
                              ? 'bg-purple-100/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900'
                              : 'bg-muted/50'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {idx + 1}. {phase.name}
                            </span>
                            <div className="flex items-center gap-1">
                              {phase.outputType && (
                                <span
                                  className={cn(
                                    'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                    phase.outputType === 'text' &&
                                      'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
                                    phase.outputType === 'questions' &&
                                      'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                                  )}
                                >
                                  {phase.outputType === 'text' && '📄 text'}
                                  {phase.outputType === 'questions' && '❓ questions'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                            <span
                              className={
                                isDifferentModel
                                  ? 'font-medium text-purple-600 dark:text-purple-400'
                                  : ''
                              }
                            >
                              → {phaseModel}
                            </span>
                            {reasoning && (
                              <>
                                <span>•</span>
                                <span
                                  className={cn(
                                    'px-1 rounded text-[10px]',
                                    reasoning === 'high'
                                      ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                      : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                  )}
                                >
                                  {reasoning}
                                </span>
                              </>
                            )}
                            {phase.outputTo && (
                              <>
                                <span>•</span>
                                <span className="text-[10px]">{`→ {{${phase.outputTo}}}`}</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={() => handleStartEdit(config)}
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={isCreating || editingConfig !== null}
                    >
                      <Edit2Icon className="h-3 w-3" />
                      {config.isProd ? 'View' : 'Edit'}
                    </Button>
                    {!config.isProd && (
                      <Button
                        onClick={() => handleDelete(config.id)}
                        variant="outline"
                        size="sm"
                        className="gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        disabled={isCreating || editingConfig !== null}
                      >
                        <Trash2Icon className="h-3 w-3" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {/* Create Button */}
      {!isCreating && !editingConfig && (
        <Button
          onClick={() => setIsCreating(true)}
          variant="outline"
          className="w-full gap-2"
          size="sm"
        >
          <PlusIcon className="h-4 w-4" />
          New Config
        </Button>
      )}

      {/* Empty state */}
      {configs.length === 0 && !isCreating && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <p>No configs yet.</p>
          <p>Create one to get started.</p>
        </div>
      )}
    </div>
  );
}
