import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WelcomeEmailRequest {
  email: string;
  name?: string;
  userId: string;
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    // Parse request body
    const { email, name, userId }: WelcomeEmailRequest = await req.json();

    if (!email) {
      throw new Error('Email is required');
    }

    console.log(`📧 Sending welcome email to: ${email} (User ID: ${userId})`);

    // Get website URL from environment or use default
    const websiteUrl = Deno.env.get('WEBSITE_URL') || 'https://poscalfx.com';

    // Generate HTML email
    const htmlContent = generateWelcomeEmailHTML(name || 'Trader', websiteUrl);

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'PoscalFX <onboarding@poscalfx.com>', // Change to your verified domain
        to: email,
        subject: 'Welcome to PoscalFX! 🤩',
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('❌ Resend API error:', resendData);
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`);
    }

    console.log('✅ Welcome email sent successfully:', resendData);

    // Optionally log the email to database
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        // You can create a table to track sent emails
        // await supabase.from('email_logs').insert({
        //   user_id: userId,
        //   email_type: 'welcome',
        //   recipient: email,
        //   status: 'sent',
        //   resend_id: resendData.id,
        // });
      } catch (logError) {
        console.error('Failed to log email:', logError);
        // Don't throw - email was sent successfully
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Welcome email sent successfully',
        emailId: resendData.id 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error sending welcome email:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
