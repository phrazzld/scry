 
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

// This action is internal - only called via scheduler from mutations
export const sendMagicLinkEmail = internalAction({
  args: {
    email: v.string(),
    magicLinkUrl: v.string(),
  },
  handler: async (ctx, { email, magicLinkUrl }) => {
    console.log('[EMAIL_ACTION] Starting sendMagicLinkEmail', { email, timestamp: Date.now() });
    // Initialize Resend with API key
    const resendApiKey = process.env.RESEND_API_KEY;
    console.log('[EMAIL_ACTION] Env vars:', { 
      hasResendKey: !!resendApiKey, 
      hasEmailFrom: !!process.env.EMAIL_FROM,
      resendKeyPrefix: resendApiKey ? resendApiKey.substring(0, 7) : 'none'
    });
    
    if (!resendApiKey) {
      console.log(`[DEV] Magic link for ${email}: ${magicLinkUrl}`);
      return { success: true, devMode: true };
    }

    console.log('[EMAIL_ACTION] Initializing Resend client');
    const resend = new Resend(resendApiKey);
    const emailFrom = process.env.EMAIL_FROM || 'Scry <noreply@scry.app>';
    console.log('[EMAIL_ACTION] Email configuration:', { from: emailFrom, to: email });

    try {
      const result = await resend.emails.send({
        from: emailFrom,
        to: email,
        subject: 'Sign in to Scry',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Sign in to Scry</h2>
            <p>Click the link below to sign in to your account:</p>
            <a href="${magicLinkUrl}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px;">
              Sign In
            </a>
            <p style="margin-top: 20px; color: #666;">
              Or copy and paste this URL into your browser:<br>
              <code>${magicLinkUrl}</code>
            </p>
            <p style="margin-top: 20px; color: #666;">
              This link will expire in 1 hour.
            </p>
          </div>
        `,
      });

      console.log('[EMAIL_ACTION] Email sent successfully', { 
        emailId: result.data?.id,
        to: email,
        timestamp: Date.now(),
        result: result
      });

      return { 
        success: true, 
        emailId: result.data?.id 
      };
    } catch (error) {
      console.error('[EMAIL_ACTION] Failed to send email:', error);
      
      // Log detailed error information
      if (error instanceof Error) {
        console.error('[EMAIL_ACTION] Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
          fullError: JSON.stringify(error, null, 2)
        });
      } else {
        console.error('[EMAIL_ACTION] Unknown error type:', typeof error, error);
      }

      // Don't throw - we don't want to fail the mutation
      // Just log and return failure
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },
});