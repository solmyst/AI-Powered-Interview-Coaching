import { useState } from 'react';
import { 
  Brain, 
  Home, 
  Video, 
  TrendingUp, 
  LogOut,
  ChevronDown,
  Settings as SettingsIcon,
  User as UserIcon
} from 'lucide-react';
import { Page, User } from '../../types';

interface NavigationProps {
  user: User;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export function Navigation({ user, currentPage, onNavigate, onLogout }: NavigationProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems: { id: Page; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'interview', label: 'Practice', icon: Video },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];

  return (
    <nav className="fixed top-0 w-full bg-parchment/90 backdrop-blur-md border-b border-mist/20 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div 
            className="flex items-center space-x-2 cursor-pointer group"
            onClick={() => onNavigate('dashboard')}
          >
            <div className="w-10 h-10 bg-clay/10 rounded-xl flex items-center justify-center group-hover:bg-clay/20 transition-colors">
              <Brain className="h-6 w-6 text-clay" />
            </div>
            <span className="text-2xl font-bold font-serif text-void tracking-tight">InterviewAce</span>
          </div>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  currentPage === item.id
                    ? 'bg-clay/10 text-clay font-semibold shadow-sm'
                    : 'text-ash hover:text-void hover:bg-vellum/50 font-medium'
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-vellum/50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-clay/10 rounded-full flex items-center justify-center border border-clay/25">
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <UserIcon className="h-4 w-4 text-clay" />
                  )}
                </div>
                <div className="hidden sm:block">
                  <span className="text-sm font-semibold text-ash">{user.name}</span>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-mist" />
            </button>

            {showUserMenu && (
              <>
                {/* Backdrop to close menu */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowUserMenu(false)} 
                />
                <div className="absolute right-0 mt-2 w-56 bg-vellum rounded-xl shadow-xl border border-mist/25 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-mist/10">
                    <p className="text-sm font-bold text-void">{user.name}</p>
                    <p className="text-xs text-ash">{user.email}</p>
                  </div>

                  <button 
                    onClick={() => {
                      onNavigate('settings');
                      setShowUserMenu(false);
                    }}
                    className={`w-full flex items-center space-x-2 px-4 py-2.5 text-sm transition-colors ${
                      currentPage === 'settings' 
                        ? 'bg-clay/10 text-clay font-semibold' 
                        : 'text-ash hover:text-void hover:bg-parchment/50'
                    }`}
                  >
                    <SettingsIcon className="h-4 w-4" />
                    <span>Settings</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      onLogout();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-clay hover:bg-clay/5 transition-colors font-medium"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-mist/20 bg-parchment">
        <div className="grid grid-cols-3 gap-1 p-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors ${
                currentPage === item.id
                  ? 'bg-clay/10 text-clay font-semibold shadow-sm'
                  : 'text-ash hover:text-void hover:bg-vellum/50 font-medium'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px]">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}