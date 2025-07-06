'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { signIn } from 'next-auth/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

const emailFormSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
})

type EmailFormValues = z.infer<typeof emailFormSchema>

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [emailSent, setEmailSent] = React.useState(false)
  const [sentEmail, setSentEmail] = React.useState('')
  
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: ''
    }
  })
  
  // Reset success state when modal is closed
  React.useEffect(() => {
    if (!open) {
      setEmailSent(false)
      setSentEmail('')
      form.reset()
    }
  }, [open, form])

  const handleSubmit = async (values: EmailFormValues) => {
    setIsLoading(true)
    
    try {
      const result = await signIn('email', {
        email: values.email,
        redirect: false,
        callbackUrl: window.location.href
      })
      
      if (result?.error) {
        // Handle specific email-related errors
        if (result.error.includes('email') || result.error.includes('Email')) {
          form.setError('email', {
            type: 'manual',
            message: result.error
          })
        } else {
          // Show general errors as toast
          toast.error('Authentication Error', {
            description: result.error
          })
        }
      } else {
        // Success - show check your email message
        setEmailSent(true)
        setSentEmail(values.email)
      }
    } catch (error) {
      console.error('Sign in error:', error)
      // Show network or unexpected errors as toast
      toast.error('Something went wrong', {
        description: 'Please check your connection and try again.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{emailSent ? 'Check your email' : 'Welcome to Scry'}</DialogTitle>
          <DialogDescription>
            {emailSent 
              ? 'We sent you a magic link to sign in'
              : 'Sign in to save your quiz progress and access your learning history.'
            }
          </DialogDescription>
        </DialogHeader>
        
        {emailSent ? (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Email sent!</AlertTitle>
              <AlertDescription>
                We&apos;ve sent a magic link to <strong>{sentEmail}</strong>. 
                Click the link in the email to sign in to your account.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">
                Didn&apos;t receive the email? Check your spam folder or try again.
              </p>
              
              <Button
                variant="outline"
                onClick={() => {
                  setEmailSent(false)
                  setSentEmail('')
                  form.reset()
                }}
                className="w-full"
              >
                Try another email
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin" className="space-y-4">
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">
                Enter your email to sign in to your account
              </p>
            </div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Enter your email"
                          type="email"
                          autoComplete="email"
                          {...field}
                          disabled={isLoading}
                          className="h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button
                  type="submit"
                  variant="default"
                  className="w-full h-11"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending magic link...
                    </>
                  ) : (
                    'Continue with Email'
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="signup" className="space-y-4">
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">
                Create a new account to start tracking your learning
              </p>
            </div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Enter your email"
                          type="email"
                          autoComplete="email"
                          {...field}
                          disabled={isLoading}
                          className="h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button
                  type="submit"
                  variant="default"
                  className="w-full h-11"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending magic link...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}