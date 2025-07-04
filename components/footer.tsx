import { Github } from 'lucide-react'

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
      <div className="px-8 md:px-16 py-4">
        <a 
          href="https://github.com/phrazzld/scry" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center size-10 rounded-lg hover:bg-gray-100 border-b-0 transition-none text-black hover:text-black"
        >
          <Github size={20} />
        </a>
      </div>
    </footer>
  )
}