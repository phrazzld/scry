# Authentication Testing Guide

## 1. Start Development Servers

Open two terminal windows:

**Terminal 1 - Convex Dev Server:**
```bash
npx convex dev
```

**Terminal 2 - Next.js Dev Server:**
```bash
pnpm dev
```

## 2. Test Authentication Flow

### A. Test Magic Link Sign In

1. Navigate to http://localhost:3000
2. Click "Sign up/ log in" in the navbar
3. Enter your email address
4. Click "Send Magic Link"
5. Check the Convex dev server terminal - you'll see the magic link logged (since we're in dev mode without email sending)
6. Copy the magic link URL and open it in your browser
7. You should be redirected to the dashboard and see "Successfully signed in!"

### B. Test Profile Update

1. Once signed in, go to Settings (http://localhost:3000/settings)
2. Update your name and/or email
3. Click "Update Profile"
4. You should see "Profile updated successfully"
5. Try changing email to one that's already in use - you should see an error

### C. Test Account Deletion

1. In Settings, scroll down to "Delete Account"
2. Click "Delete Account" button
3. Enter your email to confirm
4. Click "Delete my account"
5. You should be logged out and redirected to home page

### D. Test Sign Out

1. When signed in, click your avatar/email in navbar
2. Click "Sign out"
3. You should see "Signed out successfully"

## 3. Check Convex Dashboard

You can also monitor the data in real-time:

```bash
npx convex dashboard
```

This opens the Convex dashboard where you can see:
- Users table
- Sessions table
- Magic links table
- Quiz results table

## 4. Common Test Scenarios

### Expired Magic Link
1. Send a magic link but wait before using it
2. In Convex dashboard, manually edit the `expiresAt` to a past timestamp
3. Try to use the link - should see "Magic link has expired"

### Already Used Magic Link
1. Use a magic link once successfully
2. Try to use the same link again - should see "Magic link has already been used"

### Invalid Session
1. Sign in successfully
2. In Convex dashboard, delete your session from the sessions table
3. Try to update profile or access protected pages - should be redirected to sign in

### Email Already in Use
1. Create two accounts with different emails
2. Sign in as one user
3. Try to update profile to use the other user's email
4. Should see "Email already in use"

## 5. Development Tips

### View Magic Links in Terminal
Since we're in development mode without actual email sending, magic links are logged to the Convex dev server terminal. Look for lines like:
```
Magic link for test@example.com: http://localhost:3000/auth/verify?token=...
```

### Clear All Data
To start fresh, you can clear all data in Convex dashboard:
1. Open each table (users, sessions, magicLinks, quizResults)
2. Select all records and delete them

### Test Different Email Formats
Try various email formats to test validation:
- Valid: user@example.com, test.user+tag@company.co.uk
- Invalid: notanemail, @example.com, user@, user@.com

## 6. Debugging

If something isn't working:

1. **Check Browser Console** - Look for any client-side errors
2. **Check Network Tab** - See if Convex mutations are being called
3. **Check Convex Logs** - In the dashboard, check the Logs tab
4. **Check Next.js Terminal** - Look for any server-side errors

## 7. Test with Different Browsers

Test the authentication flow in:
- Chrome (normal and incognito)
- Firefox
- Safari
- Mobile browsers (using responsive mode)

This ensures session management works correctly across different environments.