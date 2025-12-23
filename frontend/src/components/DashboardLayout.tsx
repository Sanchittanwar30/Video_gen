import React, { useState, useEffect } from 'react';
import { 
  Video, 
  Image, 
  Sparkles, 
  Home, 
  Menu, 
  X,
  Settings,
  LogOut,
  Network,
  Moon,
  Sun
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navigation = [
  { name: 'Home', icon: Home, id: 'home' },
  { name: 'Generate Video', icon: Sparkles, id: 'generate' },
  { name: 'Diagrams', icon: Network, id: 'diagrams' },
  { name: 'Video Library', icon: Video, id: 'videos' },
  { name: 'Photo Library', icon: Image, id: 'photos' },
];

export default function DashboardLayout({ children, currentPage, onNavigate }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage first, then system preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Apply dark mode to document
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Video className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">VideoGen Studio</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.name}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-3 py-4 border-t border-border space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
              <Settings className="w-5 h-5 shrink-0" />
              Settings
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
              <LogOut className="w-5 h-5 shrink-0" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background border-b border-border">
          <div className="flex items-center justify-between px-4 py-3 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            
            <h1 className="text-lg font-semibold capitalize lg:text-xl">
              {navigation.find(item => item.id === currentPage)?.name || 'Home'}
            </h1>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Sparkles className="w-4 h-4 mr-2" />
                New Video
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

