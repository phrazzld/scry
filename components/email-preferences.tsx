'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Loader2, Mail, Bell, Shield, User } from 'lucide-react'
import { toast } from 'sonner'

interface EmailPreferences {
  marketingEmails: boolean
  quizReminders: boolean
  securityNotifications: boolean
  accountUpdates: boolean
}

const defaultPreferences: EmailPreferences = {
  marketingEmails: false,
  quizReminders: true,
  securityNotifications: true,
  accountUpdates: true,
}

export function EmailPreferences() {
  const [preferences, setPreferences] = useState<EmailPreferences>(defaultPreferences)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch current preferences on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/email-preferences')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch preferences')
        }

        setPreferences(data.preferences)
      } catch (error) {
        console.error('Error fetching email preferences:', error)
        toast.error('Failed to load email preferences')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPreferences()
  }, [])

  const handlePreferenceChange = (key: keyof EmailPreferences, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    
    try {
      const response = await fetch('/api/email-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save preferences')
      }

      toast.success('Email preferences updated successfully')
    } catch (error) {
      console.error('Error saving email preferences:', error)
      toast.error('Failed to save email preferences')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {/* Marketing Emails */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex items-start space-x-3">
              <Mail className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="space-y-1">
                <Label 
                  htmlFor="marketing-emails" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Marketing Emails
                </Label>
                <p className="text-sm text-gray-500">
                  Receive updates about new features, product announcements, and educational content
                </p>
              </div>
            </div>
            <Switch
              id="marketing-emails"
              checked={preferences.marketingEmails}
              onCheckedChange={(checked) => handlePreferenceChange('marketingEmails', checked)}
            />
          </div>

          {/* Quiz Reminders */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex items-start space-x-3">
              <Bell className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="space-y-1">
                <Label 
                  htmlFor="quiz-reminders" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Quiz Reminders
                </Label>
                <p className="text-sm text-gray-500">
                  Get reminded to continue your learning journey with personalized quiz suggestions
                </p>
              </div>
            </div>
            <Switch
              id="quiz-reminders"
              checked={preferences.quizReminders}
              onCheckedChange={(checked) => handlePreferenceChange('quizReminders', checked)}
            />
          </div>

          {/* Security Notifications */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="space-y-1">
                <Label 
                  htmlFor="security-notifications" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Security Notifications
                </Label>
                <p className="text-sm text-gray-500">
                  Important alerts about login attempts, password changes, and account security
                </p>
              </div>
            </div>
            <Switch
              id="security-notifications"
              checked={preferences.securityNotifications}
              onCheckedChange={(checked) => handlePreferenceChange('securityNotifications', checked)}
            />
          </div>

          {/* Account Updates */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex items-start space-x-3">
              <User className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="space-y-1">
                <Label 
                  htmlFor="account-updates" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Account Updates
                </Label>
                <p className="text-sm text-gray-500">
                  Notifications about changes to your profile, settings, and account activity
                </p>
              </div>
            </div>
            <Switch
              id="account-updates"
              checked={preferences.accountUpdates}
              onCheckedChange={(checked) => handlePreferenceChange('accountUpdates', checked)}
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}