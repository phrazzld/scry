'use client'

import { useState } from 'react'
import { Github } from 'lucide-react'
import { KeyboardIndicator } from '@/components/keyboard-indicator'
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'

export function Footer() {
  const [showHelp, setShowHelp] = useState(false)
  const { shortcuts } = useKeyboardShortcuts([], true)

  return (
    <>
      <footer className="mt-auto bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <a 
              href="https://github.com/phrazzld/scry" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center size-10 rounded-lg hover:bg-gray-100 border-b-0 transition-none text-black hover:text-black"
            >
              <Github size={20} />
            </a>
            
            <KeyboardIndicator onClick={() => setShowHelp(true)} />
          </div>
        </div>
      </footer>
      
      <KeyboardShortcutsHelp
        open={showHelp}
        onOpenChange={setShowHelp}
        shortcuts={shortcuts}
      />
    </>
  )
}