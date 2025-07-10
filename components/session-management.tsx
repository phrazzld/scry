'use client'

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { 
  Monitor, 
  Shield, 
  LogOut
} from 'lucide-react'

export function SessionManagement() {
  const { user, signOut } = useAuth()

  return (
    <div className="space-y-4">
      {/* Current Session Info */}
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <Monitor className="w-5 h-5 text-green-600 mr-2" />
            <h3 className="font-medium text-green-900">Current Session</h3>
          </div>
          <div className="flex items-center">
            <Shield className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-xs text-green-700">Secure</span>
          </div>
        </div>
        <div className="text-green-800 text-sm space-y-1">
          <p><strong>User:</strong> {user?.name || user?.email || 'Unknown'}</p>
          <p><strong>Authentication:</strong> Email Magic Link</p>
          <p><strong>Status:</strong> Active</p>
        </div>
      </div>

      {/* Session Management Notice */}
      <div className="p-4 bg-gray-50 rounded-lg border">
        <p className="text-sm text-gray-600">
          Session management has been simplified with Convex authentication. 
          Your session is managed automatically and expires after 30 days of inactivity.
        </p>
      </div>

      {/* Sign Out Current Session */}
      <div className="pt-4 border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => signOut()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}