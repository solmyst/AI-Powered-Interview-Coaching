# InterviewAce - AI-Powered Interview Coaching Platform

InterviewAce is a comprehensive interview preparation platform that combines computer vision, speech analysis, and natural language processing to provide instant, actionable feedback on your interview performance.

## 🚀 Features

- **AI Interviewer**: Practice with intelligent AI that adapts questions based on your responses
- **Real-time Analysis**: Get instant feedback on speech patterns, body language, and facial expressions
- **Multi-modal Feedback**: Comprehensive analysis of eye contact, posture, speech clarity, and content quality
- **Industry-Specific Practice**: Tailored questions for different roles and industries
- **Progress Tracking**: Detailed analytics showing improvement over time
- **Google Authentication**: Secure sign-in with Google OAuth
- **Firebase Integration**: Real-time database for user data and session storage

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth with Google OAuth
- **Database**: Cloud Firestore
- **Charts**: Recharts
- **Icons**: Lucide React
- **Animations**: Framer Motion

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/interviewace.git
cd interviewace
```

2. Install dependencies:
```bash
npm install
```

3. Set up Firebase:
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication and Firestore Database
   - Enable Google Sign-in provider in Authentication
   - Copy your Firebase config

4. Create environment variables:
```bash
cp .env.example .env
```

5. Fill in your Firebase configuration in `.env`:
```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

6. Start the development server:
```bash
npm run dev
```

## 🏗️ Project Structure

```
src/
├── components/           # React components
│   ├── interview/       # Interview-specific components
│   ├── AuthModal.tsx    # Authentication modal
│   ├── Dashboard.tsx    # Main dashboard
│   ├── LandingPage.tsx  # Landing page
│   └── ...
├── config/              # Configuration files
│   └── firebase.ts      # Firebase configuration
├── services/            # Service layer
│   ├── authService.ts   # Authentication service
│   └── interviewService.ts # Interview data service
├── App.tsx              # Main app component
└── main.tsx            # App entry point
```

## 🔥 Firebase Setup

### Firestore Collections

The app uses the following Firestore collections:

1. **users**: User profiles and subscription data
2. **interviewSessions**: Interview session data and feedback

### Security Rules

Add these Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read and write their own interview sessions
    match /interviewSessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Deploy to Netlify

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist` folder to Netlify

## 📱 Features Overview

### Authentication
- Email/password sign-up and sign-in
- Google OAuth integration
- Secure user session management

### Interview Practice
- Multiple interview types (Quick, Full, Technical, Behavioral)
- Real-time feedback during practice
- AI-powered question generation
- Session recording and analysis

### Analytics Dashboard
- Performance metrics and trends
- Skill breakdown analysis
- Progress tracking over time
- Achievement system

### Subscription Management
- Free, Premium, and Professional tiers
- Usage limits and feature restrictions
- Upgrade/downgrade functionality

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you have any questions or need help, please:
- Open an issue on GitHub
- Contact us at support@interviewace.com

## 🎯 Roadmap

- [ ] Video recording and playback
- [ ] AI-powered resume analysis
- [ ] Mock panel interviews
- [ ] Integration with job boards
- [ ] Mobile app development
- [ ] Advanced analytics and insights