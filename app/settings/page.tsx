import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptionsMonitored as authOptions } from '@/lib/auth-monitored'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { DeleteAccountDialog } from '@/components/delete-account-dialog'
import { SessionManagement } from '@/components/session-management'
import { EmailPreferences } from '@/components/email-preferences'
import { PerformanceDashboard } from '@/components/performance-dashboard'
import { User, Shield, Settings, Activity } from 'lucide-react'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const user = session.user

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
          <p className="text-gray-600">
            Manage your account preferences and security settings
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={user.name || 'Not provided'}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-sm text-gray-500">
                    Your name is automatically synced from your authentication provider
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user.email || 'Not provided'}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-sm text-gray-500">
                    Your email address is verified and cannot be changed
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-id">User ID</Label>
                  <Input
                    id="user-id"
                    value={user.id}
                    disabled
                    className="bg-gray-50 font-mono text-xs"
                  />
                  <p className="text-sm text-gray-500">
                    Your unique user identifier
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-medium text-blue-900 mb-2">
                      Authentication Method
                    </h3>
                    <p className="text-blue-800 text-sm">
                      You are currently using email magic link authentication. 
                      This provides secure, passwordless access to your account.
                    </p>
                  </div>

                  <SessionManagement />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h3 className="font-medium text-red-900 mb-2">
                      Delete Account
                    </h3>
                    <p className="text-red-800 text-sm mb-4">
                      Permanently delete your account and all associated data. 
                      This action cannot be undone and will immediately remove:
                    </p>
                    <ul className="text-red-800 text-sm ml-4 list-disc space-y-1 mb-4">
                      <li>Your profile and account information</li>
                      <li>All quiz history and results</li>
                      <li>Account settings and preferences</li>
                      <li>All authentication sessions</li>
                    </ul>
                    <DeleteAccountDialog userEmail={user.email || ''} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <EmailPreferences />
            
            <Card>
              <CardHeader>
                <CardTitle>Quiz Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <h3 className="font-medium text-gray-900 mb-2">
                    Learning Customization
                  </h3>
                  <p className="text-gray-700 text-sm">
                    Customization options for quiz generation, difficulty preferences, and spaced repetition settings 
                    will be available in future updates.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <PerformanceDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}