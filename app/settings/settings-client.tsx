'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { DeleteAccountDialog } from '@/components/delete-account-dialog'

export function SettingsPageClient() {
  const { user, isSignedIn, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/')
    }
  }, [isSignedIn, isLoaded, router])

  if (!isLoaded) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isSignedIn || !user) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your account preferences and security settings
          </p>
        </div>

        <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-info-background rounded-lg border border-info-border">
                    <h3 className="font-medium text-info mb-2">
                      Authentication Method
                    </h3>
                    <p className="text-info text-sm">
                      You are currently using Clerk authentication. 
                      This provides secure access to your account.
                    </p>
                  </div>

                </div>
              </CardContent>
            </Card>

            <Card className="border-error-border">
              <CardHeader>
                <CardTitle className="text-error">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-error-background rounded-lg border border-error-border">
                    <h3 className="font-medium text-error mb-2">
                      Delete Account
                    </h3>
                    <p className="text-error text-sm mb-4">
                      Permanently delete your account and all associated data. 
                      This action cannot be undone and will immediately remove:
                    </p>
                    <ul className="text-error text-sm ml-4 list-disc space-y-1 mb-4">
                      <li>Your profile and account information</li>
                      <li>All review history and results</li>
                      <li>Account settings and preferences</li>
                      <li>All authentication sessions</li>
                    </ul>
                    <DeleteAccountDialog userEmail={user.primaryEmailAddress?.emailAddress || ''} />
                  </div>
                </div>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  )
}