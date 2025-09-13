# GitHub Pages Deployment Setup

Your InterviewAce app is now configured for GitHub Pages deployment at:
**https://solmyst.github.io/AI-Powered-Interview-Coaching/**

## 🚀 Deployment Options

### Option 1: Automatic Deployment (Recommended)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Setup GitHub Pages deployment"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your GitHub repository settings
   - Navigate to "Pages" section
   - Set source to "GitHub Actions"
   - The workflow will automatically deploy on every push to main

### Option 2: Manual Deployment

```bash
npm run deploy
```

## ⚙️ Configuration Changes Made

1. **Vite Config Updated:**
   - Added `base: '/AI-Powered-Interview-Coaching/'` for correct asset paths

2. **GitHub Actions Workflow:**
   - Created `.github/workflows/deploy.yml`
   - Automatically builds and deploys on push to main

3. **Package.json:**
   - Added `deploy` script for manual deployment
   - Added `gh-pages` dev dependency

## 🔧 Firebase Configuration

Your Firebase configuration will work on GitHub Pages, but you may need to:

1. **Add GitHub Pages domain to Firebase:**
   - Go to Firebase Console > Authentication > Settings
   - Add `solmyst.github.io` to authorized domains

2. **Update CORS settings** if needed for your Firebase project

## 📝 Next Steps

1. Commit and push your changes
2. Enable GitHub Pages in repository settings
3. Add the GitHub Pages domain to Firebase authorized domains
4. Your app will be live at the URL above!

## 🛠️ Local Development

For local development, use:
```bash
npm run dev
```

The base path is only applied in production builds.