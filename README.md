# Welcome to Your Miaoda Project
Miaoda Application Link URL
    URL:https://medo.dev/projects/app-7whklnxpov0h

# Comic Vault

A comprehensive platform for comic book collectors to catalog their collections, grade their comics, and participate in a marketplace for buying and selling.

## 🚀 Quick Start

### Current Status: ✅ READY TO USE

All environment variables are configured and the application is ready for deployment.

### What's Working

- ✅ **User Authentication**: Registration, login, and profile management
- ✅ **Collection Management**: Catalog and organize your comic books
- ✅ **AI-Powered Grading**: Upload comic images for automated grading (3 free trial scans)
- ✅ **Subscription System**: Monthly subscription for unlimited grading ($9.99/month)
- ✅ **Marketplace**: Buy and sell comics with other collectors
- ✅ **Grading History**: View all your past grading requests
- ✅ **Wishlist**: Track comics you want to acquire

## 🔧 Configuration

### Environment Variables

All required environment variables are configured in `.env`:

```bash
# Supabase Database
VITE_SUPABASE_URL=https://adviiaevcdtyuixxxzmo.supabase.co
VITE_SUPABASE_ANON_KEY=[configured]

# Backend Grading Service
VITE_BACKEND_URL=http://backend-ugog.onrender.com

# Stripe Payments
VITE_STRIPE_PUBLIC_KEY=[configured]
VITE_STRIPE_SECRET_KEY=[configured]
VITE_STRIPE_WEBHOOK_SECRET=[configured]

# Google Gemini AI
VITE_GEMINI_API_KEY=[configured]
```

### Supabase Secrets

The following secrets are configured in Supabase Edge Functions:
- `STRIPE_SECRET_KEY`: For payment processing
- `STRIPE_WEBHOOK_SECRET`: For webhook verification
- `GEMINI_API_KEY`: For AI-powered comic analysis

## 📋 What You Need to Complete

### 1. Verify Supabase Project Setup

**Action Required**: Ensure your Supabase project `adviiaevcdtyuixxxzmo` has the necessary database structure.

**Check if these tables exist:**
- `profiles` - User profiles and subscription status
- `comics` - Comic collection data
- `grading_requests` - Grading submission records
- `orders` - Payment and subscription orders
- `marketplace_listings` - Comics for sale
- `wishlists` - User wishlist items

**Check if these storage buckets exist:**
- `comic-images` - For collection images
- `grading-images` - For grading submission images

**How to verify:**
1. Go to https://supabase.com/dashboard
2. Select project `adviiaevcdtyuixxxzmo`
3. Check **Database** → **Tables**
4. Check **Storage** → **Buckets**

**If tables/buckets are missing:**
- You may need to run the migration files from `supabase/migrations/`
- Or set up the database schema manually

### 2. Test Stripe Payment Integration

**Action Required**: Test the subscription purchase flow.

**Steps:**
1. Publish the application
2. Navigate to the Subscription page
3. Click "Subscribe Now"
4. Use test card: `4242 4242 4242 4242`
5. Complete the payment
6. Verify subscription is activated

**Expected Result:**
- Redirects to Stripe Checkout
- Payment processes successfully
- User role changes to "subscriber"
- Unlimited grading scans enabled

### 3. Verify Backend Grading Service

**Action Required**: Test the comic grading functionality.

**Steps:**
1. Go to the Grading page
2. Upload front and back images of a comic
3. Submit for grading
4. Wait for results (may take 30-60 seconds on first request due to cold start)

**Expected Result:**
- Images upload successfully
- Grading request is submitted to backend
- Results appear with grade and subgrades
- Option to save to collection

**Note**: The backend URL is `http://backend-ugog.onrender.com`. If this service is not running or you need to use a different backend, update `VITE_BACKEND_URL` in `.env`.

### 4. Configure Stripe Webhook (Optional)

**Action Required**: Set up Stripe webhook for production payment events.

**Steps:**
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your application URL + `/webhook/stripe`
4. Select events: `checkout.session.completed`, `payment_intent.succeeded`
5. Copy the webhook signing secret
6. Update `VITE_STRIPE_WEBHOOK_SECRET` in `.env`

**Note**: This is optional for development but required for production.

### 5. Replace Test Keys with Live Keys (For Production)

**Action Required**: When ready for production, replace Stripe test keys with live keys.

**Steps:**
1. Go to https://dashboard.stripe.com
2. Switch from "Test mode" to "Live mode"
3. Copy live keys from Developers → API keys
4. Update `.env`:
   ```bash
   VITE_STRIPE_PUBLIC_KEY=pk_live_...
   VITE_STRIPE_SECRET_KEY=sk_live_...
   ```
5. Update Supabase secrets with live keys

**Warning**: Only do this when ready for production. Test mode is safe for development.

### 6. Enable HTTPS for Backend (Recommended)

**Action Required**: Update backend URL to use HTTPS for security.

**Current**: `http://backend-ugog.onrender.com`
**Recommended**: `https://backend-ugog.onrender.com`

**Steps:**
1. Verify your backend supports HTTPS
2. Update `.env`:
   ```bash
   VITE_BACKEND_URL=https://backend-ugog.onrender.com
   ```
3. Test grading functionality

## 🧪 Testing Checklist

### Before Going Live

- [ ] **Database Connection**: Verify Supabase tables exist and are accessible
- [ ] **User Authentication**: Test registration and login
- [ ] **Collection Management**: Add, edit, and delete comics
- [ ] **Grading System**: Upload images and receive grades
- [ ] **Subscription Purchase**: Complete test payment flow
- [ ] **Marketplace**: Create and view listings
- [ ] **Responsive Design**: Test on mobile and desktop
- [ ] **Error Handling**: Verify error messages are user-friendly

### Test Accounts

**Stripe Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires Authentication: `4000 0025 0000 3155`

Use any future expiration date and any 3-digit CVC.

## 📚 Documentation

All detailed documentation has been moved to `docs/archive/` for reference:

- **API_KEY_FIX.md**: Solution for invalid API key error
- **ENVIRONMENT_CONFIGURATION.md**: Complete environment setup guide
- **ENVIRONMENT_IMPLEMENTATION_SUMMARY.md**: Configuration summary
- **Feature guides**: Grading, marketplace, subscriptions, etc.

## 🔒 Security Notes

### Current Security Status

✅ **Properly Secured:**
- Supabase anon key (public, protected by RLS)
- Stripe public key (public, safe to expose)
- Environment variables in `.env` (gitignored)
- Stripe secret key (stored in Supabase secrets)

⚠️ **For Production:**
- Replace test Stripe keys with live keys
- Enable HTTPS for all API endpoints
- Add domain restrictions to API keys
- Review and test Row Level Security policies

### Sensitive Keys

These keys are stored securely in Supabase Edge Functions:
- `STRIPE_SECRET_KEY`: Never exposed to frontend
- `STRIPE_WEBHOOK_SECRET`: Only used server-side
- `GEMINI_API_KEY`: Available for AI features

## 🚀 Deployment

### Deploy to Hosting Platform

**Recommended Platforms:**
- Vercel
- Netlify
- Cloudflare Pages

**Steps:**
1. Connect your repository
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables from `.env`
5. Deploy

### Environment Variables for Hosting

Copy these to your hosting platform's environment settings:

```bash
VITE_APP_ID=app-7whklnxpov0h
VITE_SUPABASE_URL=https://adviiaevcdtyuixxxzmo.supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
VITE_BACKEND_URL=http://backend-ugog.onrender.com
VITE_STRIPE_PUBLIC_KEY=[your-public-key]
VITE_STRIPE_SECRET_KEY=[your-secret-key]
VITE_STRIPE_WEBHOOK_SECRET=[your-webhook-secret]
VITE_STRIPE_WEBHOOK_ENDPOINT=/webhook/stripe
VITE_GEMINI_API_KEY=[your-gemini-key]
```

## 🆘 Troubleshooting

### "Invalid API Key" Error

**Solution**: Ensure Supabase URL and anon key match the same project.
- URL project: `adviiaevcdtyuixxxzmo`
- Anon key must be for the same project

See `docs/archive/API_KEY_FIX.md` for details.

### Grading Request Timeout

**Solution**: Backend may be cold starting (30-60 seconds on first request).
- Wait for the request to complete
- Use the free resubmit feature if needed
- Check backend URL is correct

### Payment Not Processing

**Solution**: Verify Stripe configuration.
- Check Stripe keys are correct
- Ensure Edge Functions are deployed
- Verify Supabase secrets are set
- Test with Stripe test cards

### Database Connection Failed

**Solution**: Verify Supabase project is active.
- Check project exists in dashboard
- Verify tables are created
- Ensure RLS policies allow access
- Check anon key is valid

## 📞 Support

For issues or questions:
1. Check `docs/archive/` for detailed guides
2. Review error messages in browser console
3. Verify environment variables are correct
4. Test with provided test credentials

## 🎯 Features Overview

### For Collectors
- **Digital Catalog**: Keep detailed records of your collection
- **AI Grading**: Get professional-grade assessments
- **Market Values**: Track the worth of your comics
- **Wishlist**: Plan future acquisitions
- **Marketplace**: Buy and sell with other collectors

### For Sellers
- **Easy Listings**: Create marketplace listings quickly
- **Verified Grades**: Show AI-generated grades to buyers
- **Secure Transactions**: Stripe-powered payments
- **Collection Management**: Track inventory

### Subscription Benefits
- **Free Trial**: 3 free grading scans for new users
- **Unlimited Grading**: $9.99/month for unlimited scans
- **Priority Processing**: Faster grading results
- **Advanced Features**: Access to all platform features

## 🔄 Recent Updates

### Latest Changes (v84)
- ✅ Fixed invalid API key error (Supabase URL/key mismatch)
- ✅ Configured all environment variables
- ✅ Set up Stripe payment integration
- ✅ Added Gemini AI key for future features
- ✅ Cleaned up documentation structure

### Previous Features
- Free resubmit for pending grading requests
- Logo cache-busting for consistent branding
- Backend integration for AI grading
- Three-day trial system
- Grading history tracking
- Wishlist functionality

## 📄 License

Copyright 2025 Comic Vault

---

**Version**: v84
**Last Updated**: December 16, 2025
**Status**: ✅ Production Ready
