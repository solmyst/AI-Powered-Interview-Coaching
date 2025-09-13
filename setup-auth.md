# Firebase Authentication Setup

You're getting the `auth/configuration-not-found` error because Firebase Authentication isn't enabled in your project. Here's how to fix it:

## Step 1: Enable Authentication in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/project/ai-interview-ed8ee)
2. Click on "Authentication" in the left sidebar
3. Click "Get started" to enable Authentication
4. Go to the "Sign-in method" tab

## Step 2: Enable Sign-in Providers

Enable the following sign-in methods:

### Email/Password
1. Click on "Email/Password"
2. Enable "Email/Password"
3. Optionally enable "Email link (passwordless sign-in)"
4. Click "Save"

### Google Sign-in
1. Click on "Google"
2. Enable "Google"
3. Set your project support email
4. Click "Save"

## Step 3: Configure Authorized Domains

1. Go to "Settings" tab in Authentication
2. Add your domains to "Authorized domains":
   - `localhost` (for development)
   - `ai-interview-ed8ee.web.app` (your Firebase hosting domain)
   - Any custom domains you plan to use

## Step 4: Test the Configuration

After completing the above steps, your authentication should work. The error should be resolved.

## Alternative: Use Firebase CLI (if available)

If you have the Firebase CLI with auth commands available, you can also run:

```bash
# This will open the Firebase Console Authentication page
firebase console:auth
```

## Verify Setup

Once you've enabled authentication in the console, try accessing your app again. The `auth/configuration-not-found` error should be resolved.