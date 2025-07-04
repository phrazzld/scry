import Link from 'next/link'

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="px-8 md:px-16 py-4">
        <Link href="/" className="text-xl font-bold font-mono text-black hover:text-black">
          scry
        </Link>
      </div>
    </nav>
  )
}