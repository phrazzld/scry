import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";
import { createLogger } from "./lib/logger";

// This action is internal - only called via scheduler from mutations
export const sendMagicLinkEmail = internalAction({
  args: {
    email: v.string(),
    magicLinkUrl: v.string(),
  },
  handler: async (ctx, { email, magicLinkUrl }) => {
    const emailLogger = createLogger({ module: 'emailActions', function: 'sendMagicLinkEmail' });
    
    emailLogger.debug('Starting email send', { 
      event: 'email.send.start', 
      email 
    });
    
    // Initialize Resend with API key
    const resendApiKey = process.env.RESEND_API_KEY;
    emailLogger.debug('Environment configuration', { 
      event: 'email.config.check',
      hasResendKey: !!resendApiKey, 
      hasEmailFrom: !!process.env.EMAIL_FROM
    });
    
    if (!resendApiKey) {
      emailLogger.info('Development mode - magic link logged', { 
        event: 'email.dev.mode',
        email,
        magicLinkUrl 
      });
      return { success: true, devMode: true };
    }

    const resend = new Resend(resendApiKey);
    const emailFrom = process.env.EMAIL_FROM || 'Scry <noreply@scry.app>';
    emailLogger.debug('Email client initialized', { 
      event: 'email.client.init',
      from: emailFrom, 
      to: email 
    });

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

      // Log magic link URL in development for debugging
      console.log('Magic link:', magicLinkUrl);

      emailLogger.info('Email sent successfully', { 
        event: 'email.send.success',
        emailId: result.data?.id,
        to: email
      });

      return { 
        success: true, 
        emailId: result.data?.id 
      };
    } catch (error) {
      emailLogger.error('Failed to send email', error, {
        event: 'email.send.error',
        email
      });

      // Don't throw - we don't want to fail the mutation
      // Just log and return failure
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },
});