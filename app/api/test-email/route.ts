export async function GET() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  
  return Response.json({
    hasKey: !!key,
    keyLength: key?.length || 0,
    from: from || 'NOT_SET',
    fromLength: from?.length || 0,
    fromIncludesNewline: from?.includes('\n') || false,
    // Check for common issues
    fromTrimmed: from?.trim() || 'NOT_SET',
  });
}