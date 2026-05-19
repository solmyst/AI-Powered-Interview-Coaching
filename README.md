# InterviewAce - AI-Powered Interview Coaching Platform

InterviewAce is a comprehensive interview preparation platform that combines computer vision simulation, speech analysis, and natural language processing to provide instant, actionable feedback on your interview performance.

It features a custom, premium design using the **Solmyst "Terroir"** design system for a sleek, editorial aesthetic.

---

## 🎨 Solmyst "Terroir" Design System

InterviewAce is built using a custom, high-contrast, editorial design language called **Terroir**:
- **Palette**:
  - **Void** (`#0D0B09`): Warm near-black background for dark pages.
  - **Carbon** (`#1E1C19`): Surface color for card elements.
  - **Ash** (`#4A4640`): Primary body text color.
  - **Mist** (`#9A9188`): Muted/secondary text and borders.
  - **Vellum** (`#EAE4D9`): Elegant, soft container/section backgrounds.
  - **Parchment** (`#F6F4F0`): Crisp off-white workspace canvas background.
  - **Clay** (`#BE5F3C`): Warm terracotta primary accent highlight.
  - **Clay-Pale** (`#E5A88A`): Soft terracotta accent for dark contrast.
- **Typography**: Editorial layout powered by **Outfit** (modern sans-serif for UI elements) and **Playfair Display** (expressive serif for headings) imported dynamically from Google Fonts.

---

## 🚀 Features & Current Status (Working)

### 1. Dual AI Provider Integration
- **OpenAI Service**: Seamlessly connects to GPT models to generate contextual follow-up questions and compile final feedback reports.
- **Ollama Integration**: Direct fallback to locally running LLMs (such as `llama3.2` via proxy) for a completely offline/local private setup.
- **Dynamic Follow-Ups**: Dynamically analyzes the user's spoken answers and creates context-aware follow-up questions on the fly.
- **Configurable Settings**: A clean Settings dashboard to switch providers, specify models, and securely manage local API keys.

### 2. Multi-Modal Speech & Video Analysis
- **Dual Transcription Engine**:
  - **Web Speech API**: Fast, client-side real-time transcript preview.
  - **OpenAI Whisper**: High-fidelity post-processing for precise conversational analysis.
- **Vocal Quality Metrics**: Track **Speaking Pace** (Words Per Minute), count **Filler Words** (such as *um*, *uh*, *like*, *so*), and identify **Silence/Pauses** with automated real-time warnings.
- **Video & Gesture Indicators**: Camera feed integration measuring simulated eye contact, body posture, facial detection warnings, and confidence scoring.

### 3. Interactive Analytics Dashboard
- **Performance Key Metrics**: Aggregated metrics including average score, completed sessions, and total hours practiced.
- **Terroir-Themed Recharts**:
  - **Performance Trends**: Line chart showing score improvement over time.
  - **Category Mastery**: Radar/bar chart showing strengths in categories (Technical, Behavioral, General).
  - **Sentiment Distribution**: Pie chart illustrating user sentiment analysis during mock sessions.
- **Historical Session Records**: Filter and view past interviews with complete transcripts, score breakdowns, lists of strengths, and areas for improvement.

### 4. Firebase Authentication & Resilient Backend
- **Secure Authentication**: Integrated Firebase Auth with support for Email/Password registration and Google OAuth sign-in.
- **Firestore Local Cache**: Enabled offline database persistency and query caching. When internet connection is lost, user sessions are cached locally and synced to Cloud Firestore immediately once reconnected.

---

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with Terroir CSS variables
- **State & Databases**: Firebase Auth + Cloud Firestore (with Offline Sync)
- **Visual Analytics**: Recharts
- **Icons**: Lucide React
- **Animations**: Framer Motion

---

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
   - Copy your Firebase config details

4. Create environment variables:
```bash
cp .env.example .env
```

5. Fill in your configuration in `.env`:
```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

6. Start the local development server:
```bash
npm run dev
```

---

## 🏗️ Project Structure

```
src/
├── components/           # React components
│   ├── interview/       # Interview-specific elements (RealTimeFeedback, VideoFeed, FeedbackReport)
│   ├── layout/          # Page layouts (Navigation)
│   └── pages/           # Page views (Dashboard, AnalyticsDashboard, Settings, LandingPage, InterviewPractice)
├── config/              # Configuration files
│   └── firebase.ts      # Firebase initialization & offline rules setup
├── services/            # Core business logic layer
│   ├── aiProviderService.ts      # OpenAI & Ollama coordinator
│   ├── faceAnalysisService.ts    # Camera feed & posture analyzer
│   ├── speechAnalysisService.ts  # Pace & filler word tracker
│   ├── sessionStorageService.ts  # Session storage & Firestore syncer
│   └── whisperService.ts         # Audio recording and Whisper transcription
├── App.tsx              # Main routing & app entry point
└── main.tsx            # App bundle mounting
```

---

## 🔥 Firebase Setup

### Firestore Security Rules
Add these rules inside the Firestore Console:
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

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/amazing-feature`.
3. Commit your changes: `git commit -m 'Add amazing feature'`.
4. Push to the branch: `git push origin feature/amazing-feature`.
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.