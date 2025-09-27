import { httpRouter } from 'convex/server';
import { Webhook } from 'svix';

import { internal } from './_generated/api';
import { httpAction } from './_generated/server';

// Type definitions for Clerk webhook events
interface EmailAddress {
  email_address: string;
  primary: boolean;
  verified: boolean;
}

interface UserCreatedEvent {
  type: 'user.created';
  data: {
    id: string;
    email_addresses?: EmailAddress[];
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
}

interface UserUpdatedEvent {
  type: 'user.updated';
  data: {
    id: string;
    email_addresses?: EmailAddress[];
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
}

interface UserDeletedEvent {
  type: 'user.deleted';
  data: {
    id: string;
  };
}

type WebhookEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | { type: string; data: unknown };

const http = httpRouter();

// Clerk webhook handler
http.route({
  path: '/clerk',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    // If webhook secret not configured, just sync based on auth
    if (!webhookSecret) {
      // This is a fallback for development without webhooks
      return new Response('Webhook secret not configured', { status: 200 });
    }

    // Get the headers
    const svix_id = request.headers.get('svix-id');
    const svix_timestamp = request.headers.get('svix-timestamp');
    const svix_signature = request.headers.get('svix-signature');

    // If there are no SVIX headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response('Error occurred -- no svix headers', {
        status: 400,
      });
    }

    // Get the body
    const payload = await request.text();

    // Create a new Svix instance with your webhook secret.
    const wh = new Webhook(webhookSecret);

    let evt: WebhookEvent;

    // Verify the webhook signature
    try {
      evt = wh.verify(payload, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as WebhookEvent;
    } catch (err: unknown) {
      console.error('Error verifying webhook:', err);
      return new Response('Error occurred', {
        status: 400,
      });
    }

    // Handle the webhook events
    const eventType = evt.type;

    switch (eventType) {
      case 'user.created':
      case 'user.updated': {
        const { id, email_addresses, first_name, last_name, image_url } =
          evt.data as UserCreatedEvent['data'];

        // Get primary email
        const primaryEmail = email_addresses?.find((email: EmailAddress) => email.primary);

        if (!primaryEmail) {
          return new Response('No primary email found', { status: 400 });
        }

        // Sync user to our database
        await ctx.runMutation(internal.clerk.syncUser, {
          clerkId: id,
          email: primaryEmail.email_address,
          name: [first_name, last_name].filter(Boolean).join(' ') || undefined,
          imageUrl: image_url,
          emailVerified: primaryEmail.verified,
        });

        return new Response('User synced', { status: 200 });
      }

      case 'user.deleted': {
        const { id } = evt.data as UserDeletedEvent['data'];
        await ctx.runMutation(internal.clerk.deleteUser, {
          clerkId: id,
        });
        return new Response('User deleted', { status: 200 });
      }

      default:
        // Ignore other events
        return new Response(`Unhandled event type: ${eventType}`, { status: 200 });
    }
  }),
});

export default http;
