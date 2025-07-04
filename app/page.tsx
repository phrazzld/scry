import { TopicInput } from '@/components/topic-input'

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-grow flex items-center">
        <div className="w-full max-w-7xl mx-auto px-8 md:px-16">
          <div className="max-w-xl">
            <h1 className="text-6xl md:text-7xl font-bold mb-4 tracking-tight">
              Scry.
            </h1>
            <p className="text-2xl md:text-3xl font-light mb-12 text-gray-700">
              Remember everything.
            </p>
            <TopicInput />
          </div>
        </div>
      </main>
    </div>
  )
}