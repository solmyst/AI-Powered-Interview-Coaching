import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './config/firebase';
import { AuthService, User as AppUser } from './services/authService';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { InterviewPractice } from './components/InterviewPractice';
import { AuthModal } from './components/AuthModal';
import { Navigation } from './components/Navigation';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { PricingPage } from './components/PricingPage';



type Page = 'landing' | 'dashboard' | 'interview' | 'analytics' | 'pricing';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [user, setUser] = useState<AppUser | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [firebaseUser, loading, error] = useAuthState(auth);
  const [initializing, setInitializing] = useState(true);

  // Handle Firebase auth state changes
  useEffect(() => {
    const initializeUser = async () => {
      if (firebaseUser) {
        try {
          const userData = await AuthService.getUserData(firebaseUser);
          setUser(userData);
          setCurrentPage('dashboard');
        } catch (error) {
          console.error('Error fetching user data:', error);
          await AuthService.signOut();
        }
      } else {
        setUser(null);
        setCurrentPage('landing');
      }
      setInitializing(false);
    };

    if (!loading) {
      initializeUser();
    }
  }, [firebaseUser, loading]);

  const handleAuth = (userData: AppUser) => {
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

  const handleLogout = async () => {
    try {
      await AuthService.signOut();
      setUser(null);
      setCurrentPage('landing');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };



  // Show loading spinner while initializing
  if (initializing || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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
      case 'pricing':
        return <PricingPage user={user!} onBack={() => setCurrentPage('dashboard')} />;
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