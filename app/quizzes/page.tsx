import { QuizHistoryPageClient } from './quiz-history-client'

export default async function QuizzesPage() {
  // For now, return a client-side component that checks auth
  // This is a temporary solution until server-side auth is implemented
  return <QuizHistoryPageClient />
}