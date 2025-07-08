import { Resend } from 'resend';

export async function GET() {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    
    // First, let's try to verify the API key works by listing domains
    try {
      const domains = await resend.domains.list();
      console.log('Domains response:', domains);
    } catch (domainError) {
      const error = domainError as Error & { code?: string; statusCode?: number };
      return Response.json({ 
        stage: 'domain_list_failed',
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
        raw: error
      }, { status: 500 });
    }
    
    // If that works, try sending a test email
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM!.trim(), // Trim any whitespace/newlines
      to: 'delivered@resend.dev', // Resend's test address that always succeeds
      subject: 'Test from Scry',
      text: 'Testing Resend connection'
    });
    
    return Response.json({ 
      success: true, 
      id: result.data?.id,
      from: process.env.EMAIL_FROM,
      fromTrimmed: process.env.EMAIL_FROM?.trim()
    });
  } catch (e) {
    const error = e as Error & { code?: string; statusCode?: number; response?: unknown };
    return Response.json({ 
      stage: 'email_send_failed',
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      response: error.response,
      raw: JSON.stringify(error, null, 2)
    }, { status: 500 });
  }
}