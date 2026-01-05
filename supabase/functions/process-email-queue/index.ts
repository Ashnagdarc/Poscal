import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Daily limit for Resend free tier
const DAILY_EMAIL_LIMIT = 95; // Keeping 5 as buffer
const BATCH_SIZE = 10; // Process in smaller batches to respect rate limits

interface QueuedEmail {
  id: string;
  user_id: string;
  email: string;
  name: string;
  email_type: string;
  attempts: number;
  max_attempts: number;
}

function generateWelcomeEmailHTML(name: string, websiteUrl: string): string {
  const displayName = name || 'Trader';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to PoscalFX</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); overflow: hidden; max-width: 600px;">
          
          <!-- Logo Section -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: left;">
              <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #0066FF 0%, #00A8FF 100%); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" opacity="0.9"/>
                  <path d="M2 17L12 22L22 17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
                  <path d="M2 12L12 17L22 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
                </svg>
              </div>
            </td>
          </tr>

          <!-- Main Heading -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <h1 style="margin: 0; font-size: 36px; font-weight: 700; color: #1a1f36; line-height: 1.2;">
                Welcome to<br/>PoscalFX! 
                <span style="font-size: 40px;">🤩</span>
              </h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <p style="margin: 0; font-size: 16px; color: #697386; line-height: 1.6;">
                Hey ${displayName},
              </p>
            </td>
          </tr>

          <!-- Body Text -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #697386; line-height: 1.6;">
                My name is Daniel, and I am the co-founder of Poscal.
              </p>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #697386; line-height: 1.6;">
                I couldn't be happier to welcome you to the PoscalFX community and to help you start building stronger trading relationships and experiences across all our digital channels.
              </p>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #697386; line-height: 1.6;">
                No matter your trading style or experience level, you can be sure that you'll find the tools you need on PoscalFX… and maybe a few you did not even know you needed yet!
              </p>
              <p style="margin: 0; font-size: 16px; color: #697386; line-height: 1.6;">
                If you have any questions, do not hesitate to reach out. Our team is ready to help you in any way we can. Happy trading!
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 30px 40px 40px 40px;">
              <a href="${websiteUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #0066FF 0%, #00A8FF 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(0, 102, 255, 0.3);">
                Get started now
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; color: #697386; text-align: center;">
                <a href="mailto:info@poscalfx.com" style="color: #0066FF; text-decoration: none;">info@poscalfx.com</a>
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
                © ${new Date().getFullYear()} PoscalFX. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

async function sendEmailViaResend(
  email: string,
  name: string,
  resendApiKey: string,
  websiteUrl: string
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  try {
    const htmlContent = generateWelcomeEmailHTML(name, websiteUrl);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'PoscalFX <onboarding@poscalfx.com>',
        to: email,
        subject: 'Welcome to PoscalFX! 🤩',
        html: htmlContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: JSON.stringify(data) };
    }

    return { success: true, emailId: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting email queue processing...');
    
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const WEBSITE_URL = Deno.env.get('WEBSITE_URL') || 'https://poscalfx.com';

    console.log('🔍 Environment check:');
    console.log(`  - RESEND_API_KEY: ${RESEND_API_KEY ? '✓ Set' : '✗ Missing'}`);
    console.log(`  - SUPABASE_URL: ${SUPABASE_URL ? '✓ Set' : '✗ Missing'}`);
    console.log(`  - SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'}`);
    console.log(`  - WEBSITE_URL: ${WEBSITE_URL}`);

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    
    if (!SUPABASE_URL) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }
    
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check how many emails were sent today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: sentToday } = await supabase
      .from('email_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', today.toISOString());

    const remainingToday = DAILY_EMAIL_LIMIT - (sentToday || 0);

    console.log(`📊 Emails sent today: ${sentToday}/${DAILY_EMAIL_LIMIT}`);
    console.log(`📧 Can send ${remainingToday} more emails today`);

    if (remainingToday <= 0) {
      console.log('⚠️ Daily email limit reached. Will process tomorrow.');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Daily limit reached',
          sentToday,
          limit: DAILY_EMAIL_LIMIT 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get pending emails from queue (oldest first)
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3) // Only get emails with less than 3 attempts
      .order('created_at', { ascending: true })
      .limit(Math.min(BATCH_SIZE, remainingToday));

    if (fetchError) {
      throw new Error(`Failed to fetch pending emails: ${fetchError.message}`);
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('✅ No pending emails to process');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending emails', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📬 Processing ${pendingEmails.length} emails...`);

    let successCount = 0;
    let failCount = 0;

    // Process each email with rate limiting (2 req/s = 500ms delay)
    for (const emailRecord of pendingEmails as QueuedEmail[]) {
      console.log(`📤 Sending to ${emailRecord.email} (${emailRecord.name})`);

      const result = await sendEmailViaResend(
        emailRecord.email,
        emailRecord.name,
        RESEND_API_KEY,
        WEBSITE_URL
      );

      if (result.success) {
        // Mark as sent
        await supabase
          .from('email_queue')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', emailRecord.id);
        
        successCount++;
        console.log(`✅ Sent to ${emailRecord.email}`);
      } else {
        // Increment attempts, mark as failed if max attempts reached
        const newAttempts = emailRecord.attempts + 1;
        const newStatus = newAttempts >= emailRecord.max_attempts ? 'failed' : 'pending';
        
        await supabase
          .from('email_queue')
          .update({ 
            attempts: newAttempts,
            status: newStatus,
            error_message: result.error 
          })
          .eq('id', emailRecord.id);
        
        failCount++;
        console.log(`❌ Failed to send to ${emailRecord.email}: ${result.error}`);
      }

      // Rate limiting: 2 requests per second (Resend free tier limit)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n📊 Summary: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: pendingEmails.length,
        sent: successCount,
        failed: failCount,
        sentToday: (sentToday || 0) + successCount,
        dailyLimit: DAILY_EMAIL_LIMIT
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error processing email queue:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
