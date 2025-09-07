'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

const emailFormSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
})

type EmailFormValues = z.infer<typeof emailFormSchema>

export function SignInLanding() {
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [isVisible, setIsVisible] = useState({
    wordmark: false,
    headlines: false,
    form: false
  })
  
  const { sendMagicLink } = useAuth()
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: ''
    }
  })

  useEffect(() => {
    // Trigger fade-in sequence
    setIsVisible(prev => ({ ...prev, wordmark: true }))
    
    const timer1 = setTimeout(() => {
      setIsVisible(prev => ({ ...prev, headlines: true }))
    }, 200)
    
    const timer2 = setTimeout(() => {
      setIsVisible(prev => ({ ...prev, form: true }))
    }, 400)
    
    // Auto-focus email input after fade-in completes
    const timer3 = setTimeout(() => {
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
      if (emailInput) {
        emailInput.focus()
      }
    }, 600)
    
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [])

  async function onSubmit(data: EmailFormValues) {
    try {
      setIsLoading(true)
      await sendMagicLink(data.email)
      setSentEmail(data.email)
      setEmailSent(true)
      toast.success('Magic link sent! Check your email.')
    } catch (error) {
      console.error('Failed to send magic link:', error)
      toast.error('Failed to send magic link. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr] p-5 md:p-4 gradient-bg">
      {/* Left column - wordmark */}
      <div className="hidden md:block">
        <span className={`text-xs tracking-[0.2em] text-gray-600 font-mono transition-opacity duration-500 ${isVisible.wordmark ? 'opacity-100' : 'opacity-0'}`}>
          SCRY
        </span>
      </div>
      
      {/* Middle column - content */}
      <div className="space-y-8">
        {/* Headlines */}
        <div className={`text-center space-y-2 transition-opacity duration-500 ${isVisible.headlines ? 'opacity-100' : 'opacity-0'}`}>
          <h1 className="font-serif text-3xl md:text-5xl leading-none">
            Master any topic.
          </h1>
          <h2 className="font-serif text-3xl md:text-5xl leading-none">
            Remember everything.
          </h2>
          <p className="text-sm text-gray-600 mt-4">
            AI-powered spaced repetition
          </p>
        </div>

        {/* Sign In Form */}
        <div className={`transition-opacity duration-500 ${isVisible.form ? 'opacity-100' : 'opacity-0'}`}>
          {!emailSent ? (
            <div className="space-y-4">
              <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 md:items-start">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="name@example.com"
                                disabled={isLoading}
                                className="border-0 border-b border-gray-300 bg-transparent px-0 py-3 text-lg min-h-[44px] focus:border-gray-900 focus:border-b-2 focus:outline-none focus:ring-0"
                                enterKeyHint="go"
                                aria-label="Email address"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="md:mt-3 min-h-[44px]"
                        size="default"
                        aria-label="Send magic link"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Send
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Send magic link
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-lg">Check your email</p>
                <p className="font-mono text-gray-600">{sentEmail}</p>
              </div>
              <div>
                <button
                  onClick={() => {
                    setEmailSent(false)
                    setSentEmail('')
                    form.reset()
                  }}
                  className="text-sm text-gray-600 underline hover:text-gray-900 transition-colors"
                >
                  Use different email
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Right column - empty */}
      <div className="hidden md:block"></div>
    </div>
  )
}