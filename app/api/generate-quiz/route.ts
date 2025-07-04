import { NextRequest } from 'next/server'
import { z } from 'zod'
import { generateQuizWithAI } from '@/lib/ai-client'
import type { SimpleQuestion } from '@/types/quiz'

const requestSchema = z.object({
  topic: z.string().min(3).max(500),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validationResult = requestSchema.safeParse(body)
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid topic' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    const { topic } = validationResult.data
    
    // Generate 10 multiple choice questions
    const questions: SimpleQuestion[] = await generateQuizWithAI(topic)
    
    return new Response(
      JSON.stringify({ questions }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Quiz generation error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate quiz' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}