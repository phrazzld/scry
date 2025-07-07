import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { generateQuizWithAI } from '@/lib/ai-client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SimpleQuestion } from '@/types/quiz'

const requestSchema = z.object({
  topic: z.string().min(3).max(500),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
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
    
    const { topic, difficulty } = validationResult.data
    
    // Check for authenticated session
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null
    
    // Generate 10 multiple choice questions
    const questions: SimpleQuestion[] = await generateQuizWithAI(topic)
    
    // Save quiz result if user is authenticated
    let quizResultId = null
    if (userId) {
      try {
        const quizResult = await prisma.quizResult.create({
          data: {
            userId,
            topic,
            difficulty,
            score: 0, // Initial score, will be updated when quiz is completed
            totalQuestions: questions.length,
            answers: [], // Empty initially, will be filled when quiz is submitted
          }
        })
        quizResultId = quizResult.id
      } catch (dbError) {
        console.error('Failed to save quiz result:', dbError)
        // Continue without saving - don't fail the entire request
      }
    }
    
    return new Response(
      JSON.stringify({ 
        questions,
        quizResultId, // Include quiz result ID for future updates
        userId, // Include userId in response for debugging/frontend use
        authenticated: !!session
      }),
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