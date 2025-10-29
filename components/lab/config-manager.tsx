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
import { type InfraConfig } from '@/types/lab';

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
              'transition-colors',
              isEnabled && 'border-green-500 dark:border-green-600',
              config.isProd &&
                'bg-blue-50/30 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900'
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
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded">
                          PROD
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{config.provider}</span>
                <span>•</span>
                <span>{config.model}</span>
                <span>•</span>
                <span>{config.phases.length}-phase</span>
                <span>•</span>
                <span>T={config.temperature}</span>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-xs space-y-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Max Tokens:</span>{' '}
                        {config.maxTokens}
                      </div>
                      {config.topP !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Top P:</span> {config.topP}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-medium">Phases:</h4>
                    {config.phases.map((phase, idx) => (
                      <div key={idx} className="text-xs bg-muted/50 rounded px-2 py-1.5">
                        <span className="font-medium">
                          {idx + 1}. {phase.name}
                        </span>
                        {phase.outputTo && (
                          <span className="text-muted-foreground ml-2">
                            � {'{{' + phase.outputTo + '}}'}
                          </span>
                        )}
                      </div>
                    ))}
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
