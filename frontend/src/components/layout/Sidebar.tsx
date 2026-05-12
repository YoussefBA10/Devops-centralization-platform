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
  Settings,
  Box,
  Book,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png';

const Sidebar: React.FC = () => {
  const { isAdmin, permissions, loading } = useAuth();

  // Debugging: Log permissions to see if they are arriving
  React.useEffect(() => {
    if (permissions) {
      console.log("Sidebar Permissions Received:", permissions);
    }
  }, [permissions]);

  const navItems = [
    { 
        name: 'Dashboard', 
        path: '/', 
        icon: LayoutDashboard,
        show: true 
    },
    { 
      name: 'Environments', 
      path: '/environments', 
      icon: Layers,
      show: isAdmin || permissions?.environmentAccess
    },
    { 
      name: 'Applications', 
      path: '/applications', 
      icon: Box,
      show: isAdmin || permissions?.appDeployment?.view
    },
    { 
      name: 'Observability', 
      path: '/operational', 
      icon: Activity,
      show: isAdmin || permissions?.monitoring?.observability
    },
    { 
      name: 'Infrastructure', 
      path: '/infrastructure', 
      icon: Share2,
      show: isAdmin || permissions?.monitoring?.infraGraph
    },
    { 
      name: 'Logs', 
      path: '/logs', 
      icon: Terminal,
      show: isAdmin || permissions?.monitoring?.logs
    },
    { 
      name: 'Tickets', 
      path: '/tickets', 
      icon: FileText,
      show: isAdmin || permissions?.incidents?.view
    },
    { 
      name: 'AI Assistant', 
      path: '/chat', 
      icon: MessageSquare,
      show: isAdmin || permissions?.chatbotAccess
    },
    { 
      name: 'Documentation', 
      path: '/documentation', 
      icon: Book,
      show: true 
    },
  ];

  const visibleItems = navItems.filter(item => item.show);

  if (loading && !permissions && !isAdmin) {
      return (
          <div className="w-64 h-full bg-card border-r border-border flex flex-col p-8 items-center justify-center">
              <Activity className="w-8 h-8 text-primary animate-spin" />
          </div>
      );
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
        {visibleItems.map((item) => (
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

      {isAdmin && (
        <div className="p-4 border-t border-border">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive 
                  ? 'bg-primary/10 text-primary border border-primary/20' 
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`
            }
          >
            <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-500" />
            <span className="font-medium">Settings</span>
          </NavLink>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
