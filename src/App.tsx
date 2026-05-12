import { useState, useEffect } from 'react';
import { User as AppUser, Page } from './types';
import { LandingPage } from './components/pages/LandingPage';
import { Dashboard } from './components/pages/Dashboard';
import { InterviewPractice } from './components/pages/InterviewPractice';
import { Navigation } from './components/layout/Navigation';
import { AnalyticsDashboard } from './components/pages/AnalyticsDashboard';
import { Settings } from './components/pages/Settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [user, setUser] = useState<AppUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [interviewType, setInterviewType] = useState<string | undefined>(undefined);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentPage === 'interview' && document.fullscreenElement) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentPage]);

  useEffect(() => {
    // Check if there's a guest user in localStorage
    const guestData = localStorage.getItem('interviewace-guest');
    if (guestData) {
      try {
        const guest = JSON.parse(guestData);
        setUser(guest);
        setCurrentPage('dashboard');
      } catch {
        // Invalid guest data
      }
    }
    setInitializing(false);
  }, []);

  const handleStart = () => {
    const guestUser: AppUser = {
      id: 'guest_' + Date.now(),
      name: 'Guest User',
      email: 'guest@interviewace.local',
      subscription: 'free'
    };
    localStorage.setItem('interviewace-guest', JSON.stringify(guestUser));
    setUser(guestUser);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('interviewace-guest');
    setUser(null);
    setCurrentPage('landing');
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading InterviewAce...</p>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    if (!user && currentPage !== 'landing') {
      return <LandingPage onStart={handleStart} />;
    }

    switch (currentPage) {
      case 'landing':
        return <LandingPage onStart={handleStart} />;
      case 'dashboard':
        return <Dashboard user={user!} onNavigate={(page: Page) => setCurrentPage(page)} onStartInterview={(type) => { setInterviewType(type); setCurrentPage('interview'); }} />;
      case 'interview':
        return <InterviewPractice user={user!} onBack={() => { setInterviewType(undefined); setCurrentPage('dashboard'); }} autoStartType={interviewType} />;
      case 'analytics':
        return <AnalyticsDashboard user={user!} onBack={() => setCurrentPage('dashboard')} />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard user={user!} onNavigate={(page: Page) => setCurrentPage(page)} onStartInterview={(type) => { setInterviewType(type); setCurrentPage('interview'); }} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {user && !isFullscreen && (
        <Navigation 
          user={user} 
          currentPage={currentPage}
          onNavigate={(page: Page) => setCurrentPage(page)}
          onLogout={handleLogout}
        />
      )}
      
      <main className={user && !isFullscreen ? 'pt-16' : ''}>
        {renderPage()}
      </main>
    </div>
  );
}

export default App;