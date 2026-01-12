# Welcome Email Setup Guide

## ✅ What Has Been Set Up

1. **Resend API Integration** - Edge Function to send emails via Resend
2. **Database Trigger** - Automatically sends welcome email when users sign up
3. **Beautiful Email Template** - Matching the PoscalFX branding

## 🔧 Setup Steps

### 1. Get Your Resend API Key

1. Go to [Resend Dashboard](https://resend.com/api-keys)
2. Create a new API key
3. Copy the API key (starts with `re_`)

### 2. Update Environment Variables

**In `.env` file (local):**
```bash
RESEND_API_KEY=re_your_actual_api_key_here
```

**In Supabase Dashboard (production):**
1. Go to [Edge Functions Secrets](https://supabase.com/dashboard/project/ywnmxrpasfikvwdgexdo/settings/functions)
2. Add secret: `RESEND_API_KEY` = your Resend API key
3. Add secret: `WEBSITE_URL` = `https://poscalfx.com` (or your domain)

### 3. Verify Your Domain in Resend

1. Go to [Resend Domains](https://resend.com/domains)
2. Add your domain: `poscalfx.com`
3. Follow DNS verification steps
4. Update the `from` address in the Edge Function:
   - Change `onboarding@poscalfx.com` to your verified domain email

### 4. Deploy the Edge Function

```bash
# Deploy the welcome email function
npx supabase functions deploy send-welcome-email --no-verify-jwt

# Verify it's deployed
npx supabase functions list
```

### 5. Run the Database Migration

```bash
# Apply the trigger migration
npx supabase db push

# Or if using migration files
npx supabase migration up
```

### 6. Configure Supabase Settings (if using pg_net)

If you want the database trigger to directly call the Edge Function, you need to set up `pg_net`:

1. Go to [Database Settings](https://supabase.com/dashboard/project/ywnmxrpasfikvwdgexdo/settings/database)
2. Enable `pg_net` extension
3. Set custom config variables:
   ```sql
   ALTER DATABASE postgres SET "app.settings.supabase_url" TO 'https://ywnmxrpasfikvwdgexdo.supabase.co';
   ALTER DATABASE postgres SET "app.settings.service_role_key" TO 'your_service_role_key';
   ```

### Alternative: Call from Frontend (Simpler)

If the database trigger approach is too complex, you can call the Edge Function directly from your signup flow:

```typescript
// In your signup component (e.g., SignUp.tsx)
async function handleSignup(email: string, password: string, name: string) {
  // Create user account
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name
      }
    }
  });

  if (data.user && !error) {
    // Send welcome email
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          email: data.user.email,
          name: name,
          userId: data.user.id
        })
      });
    } catch (emailError) {
      // Don't block signup if email fails
      console.error('Failed to send welcome email:', emailError);
    }
  }
}
```

## 📧 Email Features

- **Beautiful Design**: Matches the Sendinblue style with PoscalFX branding
- **Responsive**: Works on all devices
- **Personalized**: Uses user's name (or email username as fallback)
- **Professional**: Clean layout with gradient button
- **Contact Info**: Includes info@poscalfx.com

## 🎨 Customization

To customize the email:

1. Edit `supabase/functions/send-welcome-email/index.ts`
2. Modify the `generateWelcomeEmailHTML()` function
3. Change colors, text, or layout as needed
4. Redeploy: `npx supabase functions deploy send-welcome-email --no-verify-jwt`

## 🧪 Testing

Test the welcome email:

```bash
# Local testing
npx supabase functions serve send-welcome-email --env-file .env

# Test it
curl -X POST http://localhost:54321/functions/v1/send-welcome-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "name": "Test User",
    "userId": "test-123"
  }'
```

## 📊 Monitoring

Check if emails are being sent:

1. [Resend Dashboard](https://resend.com/emails) - View sent emails
2. Supabase Functions Logs - Check for errors
3. Test signup flow in your app

## 🚀 What Happens Now

1. ✅ User signs up (no email confirmation needed)
2. ✅ User can log in immediately
3. ✅ Welcome email is sent automatically via Resend
4. ✅ User receives beautiful branded welcome email

## 📝 Resend Free Tier Limits

- **100 emails/day**
- **3,000 emails/month**
- **2 requests/second**

Perfect for your use case! 🎉

## ❓ Troubleshooting

**Email not sending?**
- Check Resend API key is set correctly
- Verify domain in Resend dashboard
- Check Edge Function logs
- Test the function directly

**Trigger not firing?**
- Verify migration was applied: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
- Check function exists: `SELECT proname FROM pg_proc WHERE proname = 'send_welcome_email';`
- Check Supabase logs for errors

**Domain not verified?**
- Use Resend's default domain for testing: `onboarding@resend.dev`
- Follow DNS verification in Resend dashboard for production

## 📞 Support

If you have questions:
- Check [Resend Documentation](https://resend.com/docs)
- Check [Supabase Functions Docs](https://supabase.com/docs/guides/functions)
- Email: info@poscalfx.com
