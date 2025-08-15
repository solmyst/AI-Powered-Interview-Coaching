# InterviewAce Deployment Guide

## 🚀 Quick Start

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project called "InterviewAce"
3. Enable the following services:
   - **Authentication**: Enable Google sign-in provider
   - **Firestore Database**: Create in production mode
   - **Storage**: For future file uploads

### 2. Environment Variables

Create a `.env` file in the root directory with your Firebase config:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Firestore Security Rules

Add these rules in Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /interviewSessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

### 4. Local Development

```bash
npm install
npm run dev
```

### 5. Production Deployment

#### Option A: Vercel (Recommended)
1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

#### Option B: Netlify
1. Build: `npm run build`
2. Deploy `dist` folder to Netlify
3. Add environment variables in Netlify dashboard

#### Option C: GitHub Pages
1. Add Firebase config to GitHub Secrets
2. Push to main branch
3. GitHub Actions will deploy automatically

## 🔧 Configuration Checklist

- [ ] Firebase project created
- [ ] Authentication enabled with Google provider
- [ ] Firestore database created
- [ ] Security rules configured
- [ ] Environment variables set
- [ ] Domain configured (for production)
- [ ] CORS settings updated in Firebase

## 🎯 Features Included

✅ **Authentication System**
- Email/password registration and login
- Google OAuth integration
- Secure session management
- User profile management

✅ **Interview Practice**
- Multiple interview types (Quick, Full, Technical, Behavioral)
- Real-time feedback system
- AI interviewer simulation
- Session recording and analysis

✅ **Analytics Dashboard**
- Performance metrics and trends
- Skill breakdown analysis
- Progress tracking over time
- Achievement system

✅ **Subscription Management**
- Free, Premium, and Professional tiers
- Usage limits and restrictions
- Upgrade/downgrade functionality

✅ **Responsive Design**
- Mobile-first approach
- Tailwind CSS styling
- Modern UI components
- Accessibility features

## 🛠️ Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Headless UI
- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore
- **Charts**: Recharts
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Deployment**: GitHub Actions + Vercel/Netlify

## 📊 Database Schema

### Users Collection
```typescript
{
  id: string;
  name: string;
  email: string;
  subscription: 'free' | 'premium' | 'professional';
  avatar?: string;
  createdAt: Date;
  lastLoginAt: Date;
  sessionsCount: number;
  totalPracticeTime: number;
}
```

### Interview Sessions Collection
```typescript
{
  id: string;
  userId: string;
  type: 'quick' | 'full' | 'technical' | 'behavioral';
  duration: number;
  questions: string[];
  feedback: {
    speech: { speakingPace: number; fillerWords: number; clarity: number; };
    visual: { eyeContact: number; posture: number; gestures: number; };
    content: { relevance: number; structure: number; depth: number; };
  };
  overallScore: number;
  improvements: string[];
  strengths: string[];
  startTime: Date;
  endTime?: Date;
}
```

## 🚨 Important Notes

1. **Firebase Quotas**: Monitor usage to avoid hitting free tier limits
2. **Security**: Never commit `.env` files to version control
3. **Performance**: Consider code splitting for large bundles
4. **SEO**: Add meta tags and structured data for better search visibility
5. **Analytics**: Integrate Google Analytics for user tracking

## 🆘 Troubleshooting

### Common Issues

1. **Firebase Connection Error**
   - Check environment variables
   - Verify Firebase project settings
   - Ensure correct domain in Firebase console

2. **Authentication Issues**
   - Verify Google OAuth configuration
   - Check authorized domains in Firebase
   - Ensure proper redirect URLs

3. **Build Errors**
   - Clear node_modules and reinstall
   - Check TypeScript errors
   - Verify all imports are correct

4. **Deployment Issues**
   - Check environment variables in deployment platform
   - Verify build command and output directory
   - Check for any missing dependencies

## 📞 Support

For technical support or questions:
- Create an issue on GitHub
- Check the documentation
- Review Firebase console logs