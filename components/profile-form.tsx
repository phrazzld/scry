'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, User } from 'lucide-react'
import { toast } from 'sonner'

const profileFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email address'),
  image: z.string().url('Invalid image URL').optional().nullable()
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

export function ProfileForm() {
  const { data: session, update } = useSession()
  const [isLoading, setIsLoading] = React.useState(false)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: session?.user?.name || '',
      email: session?.user?.email || '',
      image: session?.user?.image || null
    }
  })

  // Update form when session changes
  React.useEffect(() => {
    if (session?.user) {
      form.setValue('name', session.user.name || '')
      form.setValue('email', session.user.email || '')
      form.setValue('image', session.user.image || null)
      setImagePreview(session.user.image || null)
    }
  }, [session, form])

  const onSubmit = async (data: ProfileFormValues) => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update profile')
      }

      // Update the session with new data
      await update({
        ...session,
        user: {
          ...session?.user,
          name: result.user.name,
          email: result.user.email,
          image: result.user.image
        }
      })

      toast.success('Profile updated', {
        description: 'Your profile has been updated successfully.'
      })

    } catch (error) {
      console.error('Profile update error:', error)
      toast.error('Update failed', {
        description: error instanceof Error ? error.message : 'Failed to update profile'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    form.setValue('image', value || null)
    setImagePreview(value || null)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (!session?.user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ml-2">Loading profile...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Update your personal information and profile picture
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Profile Picture Section */}
            <div className="space-y-4">
              <FormLabel>Profile Picture</FormLabel>
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={imagePreview || undefined} alt="Profile" />
                  <AvatarFallback className="text-lg">
                    {session.user.name ? getInitials(session.user.name) : <User className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <FormField
                    control={form.control}
                    name="image"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="https://example.com/image.jpg"
                            onChange={handleImageChange}
                            value={field.value || ''}
                            className="max-w-md"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter a URL for your profile picture
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Name Field */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your name" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your display name used throughout the application
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email Field */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Your email address used for authentication and notifications
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email change warning */}
            {form.watch('email') !== session.user.email && (
              <Alert>
                <AlertDescription>
                  Changing your email address will require verification. You&apos;ll need to verify 
                  the new email before you can use it to sign in.
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset()
                  setImagePreview(session.user.image || null)
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !form.formState.isDirty}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Profile'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}