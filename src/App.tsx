import React, { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { InterviewPractice } from './components/InterviewPractice';
import { AuthModal } from './components/AuthModal';
import { Navigation } from './components/Navigation';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';

type User = {
  id: string;
  name: string;
  email: string;
  subscription: 'free' | 'premium' | 'professional';
  avatar?: string;
};

type Page = 'landing' | 'dashboard' | 'interview' | 'analytics' | 'pricing';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  const handleAuth = (userData: User) => {
    setUser(userData);
    setCurrentPage('dashboard');
    setShowAuth(false);
  };

  const handleSignUp = () => {
    setAuthMode('signup');
    setShowAuth(true);
  };

  const handleSignIn = () => {
    setAuthMode('signin');
    setShowAuth(true);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('landing');
  };

  const renderPage = () => {
    if (!user && currentPage !== 'landing') {
      return <LandingPage onSignUp={handleSignUp} onSignIn={handleSignIn} />;
    }

    switch (currentPage) {
      case 'landing':
        return <LandingPage onSignUp={handleSignUp} onSignIn={handleSignIn} />;
      case 'dashboard':
        return <Dashboard user={user!} onNavigate={setCurrentPage} />;
      case 'interview':
        return <InterviewPractice user={user!} onBack={() => setCurrentPage('dashboard')} />;
      case 'analytics':
        return <AnalyticsDashboard user={user!} onBack={() => setCurrentPage('dashboard')} />;
      default:
        return <Dashboard user={user!} onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {user && (
        <Navigation 
          user={user} 
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          onLogout={handleLogout}
        />
      )}
      
      <main className={user ? 'pt-16' : ''}>
        {renderPage()}
      </main>

      {showAuth && (
        <AuthModal 
          onClose={() => setShowAuth(false)}
          onAuth={handleAuth}
          initialMode={authMode}
        />
      )}
    </div>
  );
}

export default App;