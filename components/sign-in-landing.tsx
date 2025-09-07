'use client'

import { useState } from 'react'
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
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, CheckCircle, Sparkles, Brain, Target, Zap } from 'lucide-react'
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
  
  const { sendMagicLink } = useAuth()
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: ''
    }
  })

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

  const handleResend = () => {
    if (sentEmail) {
      form.setValue('email', sentEmail)
      form.handleSubmit(onSubmit)()
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-20">
      {/* Hero Section */}
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Tagline */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Scry
          </h1>
          <p className="text-lg text-gray-600">
            Master any topic with AI-powered spaced repetition
          </p>
        </div>

        {/* Features */}
        <div className="grid gap-4 text-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Smart Learning</p>
              <p className="text-gray-600">AI generates personalized quiz questions from any topic</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-green-50 text-green-600">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Spaced Repetition</p>
              <p className="text-gray-600">Review at optimal intervals for long-term retention</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Quick Sessions</p>
              <p className="text-gray-600">Learn efficiently with bite-sized review sessions</p>
            </div>
          </div>
        </div>

        {/* Sign In Card */}
        <Card className="border-gray-200">
          <CardContent className="p-6">
            {!emailSent ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Get started
                  </h2>
                  <p className="text-sm text-gray-600">
                    Enter your email to receive a magic sign-in link
                  </p>
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="name@example.com"
                              disabled={isLoading}
                              className="h-11"
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
                      className="w-full h-11"
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending magic link...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Send magic link
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">
                      Check your email
                    </p>
                    <p className="text-sm text-gray-600">
                      We sent a magic link to <span className="font-medium">{sentEmail}</span>
                    </p>
                    <p className="text-sm text-gray-500">
                      Click the link in the email to sign in. You can close this tab.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEmailSent(false)
                      setSentEmail('')
                      form.reset()
                    }}
                    className="flex-1"
                  >
                    Try different email
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleResend}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Resend link'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          By signing in, you agree to our terms of service and privacy policy
        </p>
      </div>
    </div>
  )
}