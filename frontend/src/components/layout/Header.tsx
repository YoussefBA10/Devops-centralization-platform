import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEnvironment } from '../../context/EnvironmentContext';
import { 
  Bell, 
  Search, 
  LogOut, 
  User as UserIcon,
  ChevronDown,
  Globe
} from 'lucide-react';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { environments, selectedEnvironment, setSelectedEnvironment } = useEnvironment();

  return (
    <header className="h-16 bg-card/50 backdrop-blur-md border-b border-border px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-8 flex-1">
        {/* Environment Selector */}
        <div className="relative group">
          <button className="flex items-center gap-3 px-4 py-2 bg-secondary rounded-lg border border-border hover:border-primary/50 transition-all text-sm font-medium">
            <Globe className="w-4 h-4 text-primary" />
            <span>{selectedEnvironment?.name || 'Select Environment'}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          <div className="absolute top-full left-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top scale-95 group-hover:scale-100">
            <div className="p-2 space-y-1">
              {environments.map((env) => (
                <button
                  key={env.id}
                  onClick={() => setSelectedEnvironment(env)}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                    selectedEnvironment?.id === env.id 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {env.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-md w-full relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search resources, logs, tickets..." 
            className="w-full bg-secondary border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-secondary rounded-lg relative text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-card"></span>
        </button>

        <div className="h-8 w-px bg-border mx-2"></div>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2 group cursor-pointer relative">
          <div className="text-right">
            <p className="text-sm font-semibold">{user?.username}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role.toLowerCase()}</p>
          </div>
          <div className="w-10 h-10 bg-secondary border border-border rounded-full flex items-center justify-center group-hover:border-primary/50 transition-all overflow-hidden">
            <UserIcon className="w-5 h-5 text-muted-foreground" />
          </div>

          <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top right scale-95 group-hover:scale-100 p-2">
            <button 
              onClick={logout}
              className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
