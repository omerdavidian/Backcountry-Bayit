# Vercel + Resend Setup Guide

This project uses **Vercel Serverless Functions** with **Resend** to send RSVP
confirmation emails for FREE!

## Setup Instructions

### 1. Add Environment Variable to Vercel

1. Go to your Vercel project dashboard: https://vercel.com/dashboard
2. Select your project (Backcountry-Bayit)
3. Go to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Name:** `RESEND_API_KEY`
   - **Value:** `re_j4DpCM8w_44YsB5PFFWRyLMGSnnXjfQKb` (your existing key)
   - **Environment:** Select all (Production, Preview, Development)
5. Click **Save**

### 2. Verify Domain in Resend

To send emails from `noreply@bcbayit.org`, you need to verify your domain:

1. Go to https://resend.com/domains
2. Click **Add Domain**
3. Enter: `bcbayit.org`
4. Follow the instructions to add DNS records to your domain
5. Wait for verification (usually a few minutes)

**Alternative:** If you don't have access to DNS settings, Resend provides a
test domain like `onboarding@resend.dev` that you can use temporarily. Update
the API function to use that domain.

### 3. Deploy to Vercel

```bash
git add -A
git commit -m "Add Resend email confirmation via Vercel serverless functions"
git push
```

Vercel will automatically deploy your changes!

### 4. Test the Email System

After deployment:

1. Go to your Events page
2. Submit an RSVP
3. Check the email inbox for confirmation

### How It Works

- **Client-side** (React): Calls `/api/send-rsvp-confirmation`
- **Server-side** (Vercel): `api/send-rsvp-confirmation.js` runs securely with
  your Resend API key
- **Resend**: Sends beautiful HTML emails to users

### Benefits

✅ **100% Free** - Vercel Serverless Functions are free (up to 100GB-Hrs/month)
✅ **Secure** - API key stays on the server, never exposed to users ✅
**Reliable** - Resend has great deliverability ✅ **No Firebase Functions** - No
need to upgrade Firebase plan ✅ **Easy to maintain** - All in one codebase

### Resend Free Tier

- 100 emails/day
- 3,000 emails/month
- Perfect for a community website!

## Troubleshooting

**Issue:** Emails not sending

- Check Vercel logs: Project → Deployments → Functions
- Verify `RESEND_API_KEY` is set in Vercel environment variables
- Check Resend dashboard for error logs

**Issue:** "Domain not verified" error

- Use Resend's test domain temporarily: Change `from:` in the API function to
  `noreply@resend.dev`
- Or complete domain verification steps above

## Local Development

To test locally:

1. Add `RESEND_API_KEY` to your local `.env` file
2. Install Vercel CLI: `npm i -g vercel`
3. Run: `vercel dev`
4. Test at: http://localhost:3000
