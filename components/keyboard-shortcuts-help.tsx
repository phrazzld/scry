'use client';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ShortcutDefinition } from '@/hooks/use-keyboard-shortcuts';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: ShortcutDefinition[];
}

function formatShortcut(shortcut: ShortcutDefinition): string {
  const parts = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');

  // Format special keys
  let key = shortcut.key;
  if (key === ' ') key = 'Space';
  if (key === 'ArrowRight') key = '→';
  if (key === 'ArrowLeft') key = '←';
  if (key === 'ArrowUp') key = '↑';
  if (key === 'ArrowDown') key = '↓';
  if (key === 'Escape') key = 'Esc';
  if (key === 'Delete') key = 'Del';

  parts.push(key);
  return parts.join('+');
}

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
  shortcuts,
}: KeyboardShortcutsHelpProps) {
  // Group shortcuts by context
  const globalShortcuts = shortcuts.filter((s) => s.context === 'global' || !s.context);
  const reviewShortcuts = shortcuts.filter((s) => s.context === 'review');
  const editingShortcuts = shortcuts.filter((s) => s.context === 'editing');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Quick keyboard commands for power users</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Global shortcuts */}
          {globalShortcuts.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground">Global Shortcuts</h3>
              <div className="space-y-2">
                {globalShortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-1">
                    <span className="text-sm">{shortcut.description}</span>
                    <Badge variant="secondary" className="font-mono">
                      {formatShortcut(shortcut)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review shortcuts */}
          {reviewShortcuts.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground">Review Mode</h3>
              <div className="space-y-2">
                {reviewShortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-1">
                    <span className="text-sm">{shortcut.description}</span>
                    <Badge variant="secondary" className="font-mono">
                      {formatShortcut(shortcut)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Editing shortcuts */}
          {editingShortcuts.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground">Editing Mode</h3>
              <div className="space-y-2">
                {editingShortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-1">
                    <span className="text-sm">{shortcut.description}</span>
                    <Badge variant="secondary" className="font-mono">
                      {formatShortcut(shortcut)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Press{' '}
            <Badge variant="outline" className="mx-1 font-mono">
              ?
            </Badge>{' '}
            at any time to toggle this help
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
