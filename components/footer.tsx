import { Github } from 'lucide-react'

export function Footer() {
  return (
    <footer className="mt-auto bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
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