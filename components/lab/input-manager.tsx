'use client';

/**
 * Input Manager Component
 *
 * Simplified input management - individual inputs (not sets).
 * Add one at a time with inline editing and checkbox selection.
 */
import { useState } from 'react';
import { Edit2Icon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { isValidTestInput, type TestInput } from '@/types/lab';

interface InputManagerProps {
  inputs: TestInput[];
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onCreate: (input: TestInput) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

export function InputManager({
  inputs,
  selectedIds,
  onToggleSelected,
  onCreate,
  onEdit,
  onDelete,
}: InputManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formText, setFormText] = useState('');

  const handleCreate = () => {
    if (!formText.trim()) {
      toast.error('Input text is required');
      return;
    }

    const newInput: TestInput = {
      id: Date.now().toString(),
      text: formText.trim(),
      createdAt: Date.now(),
    };

    if (!isValidTestInput(newInput)) {
      toast.error('Invalid input');
      return;
    }

    onCreate(newInput);
    toast.success('Input added');

    // Reset form
    setFormText('');
    setIsCreating(false);
  };

  const handleEdit = (id: string) => {
    if (!formText.trim()) {
      toast.error('Input text is required');
      return;
    }

    onEdit(id, formText.trim());
    toast.success('Input updated');

    // Reset form
    setFormText('');
    setEditingId(null);
  };

  const startEdit = (input: TestInput) => {
    setFormText(input.text);
    setEditingId(input.id);
    setIsCreating(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this input?')) {
      onDelete(id);
      toast.success('Input deleted');
    }
  };

  return (
    <div className="space-y-2">
      {/* List of inputs */}
      {inputs.map((input) => (
        <Card
          key={input.id}
          className={cn(
            'p-3 transition-all hover:shadow-sm',
            selectedIds.has(input.id) && 'border-primary bg-primary/5'
          )}
        >
          {editingId === input.id ? (
            // Edit mode
            <div className="space-y-2">
              <Textarea
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder="Enter test prompt..."
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <Button onClick={() => handleEdit(input.id)} size="sm">
                  Save
                </Button>
                <Button onClick={() => setEditingId(null)} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // View mode
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={selectedIds.has(input.id)}
                  onCheckedChange={() => onToggleSelected(input.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{input.text}</p>
                </div>
              </div>
              <div className="flex gap-1 pl-6">
                <Button
                  onClick={() => startEdit(input)}
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                >
                  <Edit2Icon className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  onClick={() => handleDelete(input.id)}
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2Icon className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}

      {/* Create new input */}
      {isCreating ? (
        <Card className="p-3">
          <div className="space-y-2">
            <Textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="Enter test prompt..."
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={handleCreate} size="sm">
                Add
              </Button>
              <Button
                onClick={() => {
                  setIsCreating(false);
                  setFormText('');
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
          Add Input
        </Button>
      )}

      {/* Empty state */}
      {inputs.length === 0 && !isCreating && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <p>No test inputs yet.</p>
          <p>Add one to get started.</p>
        </div>
      )}
    </div>
  );
}
