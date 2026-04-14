import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Layers, 
  Terminal, 
  Activity, 
  Share2, 
  FileText, 
  MessageSquare,
  LayoutDashboard,
  Settings
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png';

const Sidebar: React.FC = () => {
  const { isAdmin } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Observability', path: '/operational', icon: Activity },
    { name: 'Infrastructure', path: '/infrastructure', icon: Share2 },
    { name: 'Logs', path: '/logs', icon: Terminal },
    { name: 'Incidents', path: '/tickets', icon: FileText },
    { name: 'AI Assistant', path: '/chat', icon: MessageSquare },
  ];

  if (isAdmin) {
    navItems.splice(1, 0, { name: 'Environments', path: '/environments', icon: Layers });
  }

  return (
    <div className="w-64 h-full bg-card border-r border-border flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center">
          <img src={logo} alt="Monetique Eye" className="w-full h-full object-contain" />
        </div>
        <span className="text-xl font-bold gradient-text">Monetique Eye</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive 
                  ? 'bg-primary/10 text-primary border border-primary/20' 
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground cursor-pointer group transition-colors">
          <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-500" />
          <span className="font-medium">Settings</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
