'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'

interface DeleteAccountDialogProps {
  userEmail: string
}

export function DeleteAccountDialog({ userEmail }: DeleteAccountDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const { deleteAccount } = useAuth()

  const handleDeleteAccount = async () => {
    if (!confirmationEmail) {
      toast.error('Please enter your email to confirm account deletion')
      return
    }

    if (confirmationEmail.toLowerCase() !== userEmail.toLowerCase()) {
      toast.error('Email confirmation does not match your account email')
      return
    }

    setIsDeleting(true)

    try {
      const result = await deleteAccount(confirmationEmail)

      if (!result.success) {
        setIsDeleting(false)
        return
      }

      // Success - show success message and redirect
      toast.success('Account successfully deleted')
      
      // Redirect to home page
      router.push('/')
      router.refresh()
      
    } catch (error) {
      console.error('Delete account error:', error)
      toast.error('An unexpected error occurred. Please try again.')
      setIsDeleting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!isDeleting) {
      setIsOpen(open)
      if (!open) {
        setConfirmationEmail('')
      }
    }
  }

  const isEmailValid = confirmationEmail.toLowerCase() === userEmail.toLowerCase()

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="destructive" 
          className="w-full"
          disabled={isDeleting}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600">
            Delete Account
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <div className="text-sm">
              <strong className="text-red-600">Warning:</strong> This action cannot be undone. 
              This will permanently delete your account and remove all your data from our servers.
            </div>
            <div className="text-sm">
              <strong>What will be deleted:</strong>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>Your profile information</li>
                <li>All your quiz history and results</li>
                <li>Your account settings and preferences</li>
                <li>All associated authentication data</li>
              </ul>
            </div>
            <div className="pt-4 space-y-2">
              <Label htmlFor="confirmation-email" className="text-sm font-medium">
                Type your email address to confirm:
              </Label>
              <Input
                id="confirmation-email"
                type="email"
                placeholder={userEmail}
                value={confirmationEmail}
                onChange={(e) => setConfirmationEmail(e.target.value)}
                className={`${
                  confirmationEmail && !isEmailValid 
                    ? 'border-red-300 focus:border-red-500' 
                    : ''
                }`}
                disabled={isDeleting}
              />
              {confirmationEmail && !isEmailValid && (
                <p className="text-xs text-red-600">
                  Email does not match your account email
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAccount}
            disabled={!isEmailValid || isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}