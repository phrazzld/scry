'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/convex/_generated/api';

interface DeleteAccountDialogProps {
  userEmail: string;
}

export function DeleteAccountDialog({ userEmail }: DeleteAccountDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { user } = useUser();
  const clerk = useClerk();
  const deleteUserData = useMutation(api.users.deleteUserData);

  const handleDeleteAccount = async () => {
    if (!confirmationEmail) {
      toast.error('Please enter your email to confirm account deletion');
      return;
    }

    if (confirmationEmail.toLowerCase() !== userEmail.toLowerCase()) {
      toast.error('Email confirmation does not match your account email');
      return;
    }

    setIsDeleting(true);

    try {
      // Delete user data from Convex
      if (user?.id) {
        await deleteUserData({ userId: user.id });
      }

      // Delete user from Clerk
      await clerk.signOut();
      await user?.delete();

      const result = { success: true };

      if (!result.success) {
        setIsDeleting(false);
        return;
      }

      // Success - show success message and redirect
      toast.success('Account successfully deleted');

      // Redirect to home page
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error('An unexpected error occurred. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!isDeleting) {
      setIsOpen(open);
      if (!open) {
        setConfirmationEmail('');
      }
    }
  };

  const isEmailValid = confirmationEmail.toLowerCase() === userEmail.toLowerCase();

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full" disabled={isDeleting}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-error">Delete Account</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <div className="text-sm">
              <strong className="text-error">Warning:</strong> This action cannot be undone. This
              will permanently delete your account and remove all your data from our servers.
            </div>
            <div className="text-sm">
              <strong>What will be deleted:</strong>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>Your profile information</li>
                <li>All your review history and results</li>
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
                  confirmationEmail && !isEmailValid ? 'border-error-border focus:border-error' : ''
                }`}
                disabled={isDeleting}
              />
              {confirmationEmail && !isEmailValid && (
                <p className="text-xs text-error">Email does not match your account email</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAccount}
            disabled={!isEmailValid || isDeleting}
            className="bg-error hover:bg-error/90 focus:ring-error"
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
  );
}
