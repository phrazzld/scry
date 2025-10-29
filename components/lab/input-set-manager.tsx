'use client';

/**
 * Input Set Manager Component
 *
 * Manages CRUD operations for test input sets.
 * Follows generation-task-card.tsx pattern with Card wrapper and collapsible sections.
 */
import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, Edit2Icon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { isValidInputSet, type InputSet } from '@/types/lab';

interface InputSetManagerProps {
  sets: InputSet[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (set: InputSet) => void;
  onEdit: (id: string, updates: Partial<InputSet>) => void;
  onDelete: (id: string) => void;
}

export function InputSetManager({
  sets,
  selectedId,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: InputSetManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formInputs, setFormInputs] = useState('');

  const handleCreate = () => {
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }

    const inputs = formInputs
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (inputs.length === 0) {
      toast.error('At least one input is required');
      return;
    }

    if (inputs.length > 10) {
      toast.error('Maximum 10 inputs allowed');
      return;
    }

    const newSet: InputSet = {
      id: Date.now().toString(),
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      inputs,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!isValidInputSet(newSet)) {
      toast.error('Invalid input set');
      return;
    }

    onCreate(newSet);
    toast.success('Input set created');

    // Reset form
    setFormName('');
    setFormDescription('');
    setFormInputs('');
    setIsCreating(false);
  };

  const handleEdit = (id: string) => {
    const set = sets.find((s) => s.id === id);
    if (!set) return;

    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }

    const inputs = formInputs
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (inputs.length === 0) {
      toast.error('At least one input is required');
      return;
    }

    if (inputs.length > 10) {
      toast.error('Maximum 10 inputs allowed');
      return;
    }

    const updates: Partial<InputSet> = {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      inputs,
      updatedAt: Date.now(),
    };

    onEdit(id, updates);
    toast.success('Input set updated');

    // Reset form
    setFormName('');
    setFormDescription('');
    setFormInputs('');
    setEditingId(null);
  };

  const startEdit = (set: InputSet) => {
    setFormName(set.name);
    setFormDescription(set.description || '');
    setFormInputs(set.inputs.join('\n'));
    setEditingId(set.id);
    setIsCreating(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this input set?')) {
      onDelete(id);
      toast.success('Input set deleted');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-3">
      {/* List of sets */}
      {sets.map((set) => (
        <Card
          key={set.id}
          className={cn(
            'p-3 transition-all hover:shadow-md hover:border-primary/50',
            selectedId === set.id && 'border-primary'
          )}
        >
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => onSelect(set.id)}
                className="flex-1 text-left font-medium hover:text-primary transition-colors"
              >
                {set.name}
              </button>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpand(set.id)}
                  className="h-7 w-7 p-0"
                >
                  {expandedId === set.id ? (
                    <ChevronUpIcon className="h-4 w-4" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{set.inputs.length} inputs</span>
              {set.description && <span>• {set.description}</span>}
            </div>

            {/* Expanded content */}
            {expandedId === set.id && (
              <div className="space-y-2 pt-2 border-t">
                {editingId === set.id ? (
                  // Edit form
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor={`edit-name-${set.id}`}>Name</Label>
                      <Input
                        id={`edit-name-${set.id}`}
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Input set name"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-desc-${set.id}`}>Description (optional)</Label>
                      <Input
                        id={`edit-desc-${set.id}`}
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Brief description"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-inputs-${set.id}`}>Inputs (one per line, max 10)</Label>
                      <Textarea
                        id={`edit-inputs-${set.id}`}
                        value={formInputs}
                        onChange={(e) => setFormInputs(e.target.value)}
                        placeholder="Enter test prompts, one per line..."
                        rows={5}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleEdit(set.id)} size="sm">
                        Save
                      </Button>
                      <Button onClick={() => setEditingId(null)} variant="outline" size="sm">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="space-y-1">
                      {set.inputs.map((input, idx) => (
                        <div
                          key={idx}
                          className="text-sm p-2 bg-muted rounded border text-muted-foreground"
                        >
                          {idx + 1}. {input}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => startEdit(set)}
                        variant="outline"
                        size="sm"
                        className="gap-1"
                      >
                        <Edit2Icon className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDelete(set.id)}
                        variant="outline"
                        size="sm"
                        className="gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2Icon className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </Card>
      ))}

      {/* Create new set */}
      {isCreating ? (
        <Card className="p-3">
          <div className="space-y-3">
            <h3 className="font-medium">New Input Set</h3>
            <div>
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Input set name"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="create-desc">Description (optional)</Label>
              <Input
                id="create-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description"
              />
            </div>
            <div>
              <Label htmlFor="create-inputs">Inputs (one per line, max 10)</Label>
              <Textarea
                id="create-inputs"
                value={formInputs}
                onChange={(e) => setFormInputs(e.target.value)}
                placeholder="Enter test prompts, one per line..."
                rows={5}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} size="sm">
                Create
              </Button>
              <Button
                onClick={() => {
                  setIsCreating(false);
                  setFormName('');
                  setFormDescription('');
                  setFormInputs('');
                }}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          onClick={() => setIsCreating(true)}
          variant="outline"
          className="w-full gap-2"
          size="sm"
        >
          <PlusIcon className="h-4 w-4" />
          New Input Set
        </Button>
      )}

      {/* Empty state */}
      {sets.length === 0 && !isCreating && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <p>No input sets yet.</p>
          <p>Create one to get started.</p>
        </div>
      )}
    </div>
  );
}
