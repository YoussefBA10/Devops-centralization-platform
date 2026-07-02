import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Search, 
  ChevronRight,
  Save,
  Trash2,
  Lock,
  Globe,
  Activity,
  Server,
  AlertTriangle,
  Loader2,
  MessageSquare,
  Edit2,
  X,
  UserPlus,
  Key,
  Terminal,
  Share2,
  Layers,
  Settings,
  Network,
  BarChart2,
  FileText,
  Book
} from 'lucide-react';
import api from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Input';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast } from '../components/ui/Toast';

interface User {
  id: number;
  username: string;
  role: string;
}

interface Cluster {
  id: number;
  name: string;
}

interface PermissionState {
  userId: string;
  clusterAccess: boolean;
  allowedClusterIds: string[];
  monitoring: {
    observability: boolean;
    logs: boolean;
    infraGraph: boolean;
  };
  envDeployment: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
  appDeployment: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
  incidents: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
  chatbotAccess: boolean;
  networkMonitorView: boolean;
  securityDashboardView: boolean;
  analyseView: boolean;
  auditLogView: boolean;
  documentationView: boolean;
  operationalIntelligenceView: boolean;
}

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<PermissionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const { showToast } = useToast();

  // User CRUD states
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({ username: '', password: '', role: 'USER' });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [usersRes, clustersRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/clusters')
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      console.log("Fetched clusters:", clustersRes.data);
      setClusters(Array.isArray(clustersRes.data) ? clustersRes.data : []);
    } catch (err) {
      console.error("Failed to fetch initial data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (user: User) => {
    setLoading(true);
    setSelectedUser(user);
    try {
      const res = await api.get(`/admin/permissions/${user.username}`);
      setPermissions(res.data);
    } catch (err) {
      console.error("Failed to fetch permissions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser || !permissions) return;
    setSaving(true);
    try {
      await api.put(`/admin/permissions/${selectedUser.username}`, permissions);
      showToast('Permissions saved successfully!', 'success');
    } catch (err) {
      console.error("Failed to save permissions", err);
      showToast('Failed to save permissions', 'error');
    } finally {
      setSaving(false);
    }
  };

  // User CRUD handlers
  const handleOpenUserModal = (user: User | null = null) => {
    if (user) {
      setEditingUser(user);
      setUserFormData({ username: user.username, password: '', role: user.role });
    } else {
      setEditingUser(null);
      setUserFormData({ username: '', password: '', role: 'USER' });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    setSaving(true);
    try {
      if (editingUser) {
        await api.put(`/admin/users/${editingUser.id}`, userFormData);
      } else {
        await api.post('/admin/users', userFormData);
      }
      setIsUserModalOpen(false);
      fetchInitialData();
    } catch (err) {
      console.error("Failed to save user", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/admin/users/${userToDelete.id}`);
      setIsDeleteModalOpen(false);
      if (selectedUser?.id === userToDelete.id) {
        setSelectedUser(null);
        setPermissions(null);
      }
      fetchInitialData();
    } catch (err) {
      console.error("Failed to delete user", err);
    }
  };

  const togglePermission = (category: keyof PermissionState | string, subKey?: string) => {
    if (!permissions) return;

    setPermissions(prev => {
      if (!prev) return null;
      
      if (subKey) {
        return {
          ...prev,
          [category]: {
            ...(prev as any)[category],
            [subKey]: !(prev as any)[category][subKey]
          }
        };
      }

      return {
        ...prev,
        [category]: !(prev as any)[category]
      };
    });
  };

  const toggleCluster = (clusterId: string) => {
    if (!permissions) return;
    setPermissions(prev => {
      if (!prev) return null;
      const allowed = [...prev.allowedClusterIds];
      const index = allowed.indexOf(clusterId);
      if (index > -1) allowed.splice(index, 1);
      else allowed.push(clusterId);
      return { ...prev, allowedClusterIds: allowed };
    });
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  if (loading && users.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Access Control</h1>
          </div>
          <Button 
            onClick={() => handleOpenUserModal()}
            className="bg-primary text-primary-foreground"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add New User
          </Button>
        </div>
        <p className="text-muted-foreground">Manage user accounts and platform privileges.</p>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* User List Sidebar */}
        <div className="col-span-4 space-y-4">
          <Card className="p-4 bg-card/50 backdrop-blur-xl border-white/5">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-secondary/50 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredUsers.map(user => (
                <div key={user.id} className="group relative">
                  <button
                    onClick={() => handleSelectUser(user)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      selectedUser?.id === user.id 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-white/5 text-muted-foreground hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${selectedUser?.id === user.id ? 'bg-white/20' : 'bg-secondary'}`}>
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{user.username}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                          selectedUser?.id === user.id 
                            ? 'bg-white/20 border-white/30 text-white' 
                            : user.role === 'ADMIN' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${selectedUser?.id === user.id ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                  </button>
                  
                  {/* Quick actions on hover */}
                  <div className={`absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-all opacity-0 group-hover:opacity-100 ${selectedUser?.id === user.id ? 'text-white' : ''}`}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenUserModal(user); }}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setUserToDelete(user); setIsDeleteModalOpen(true); }}
                      className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Permission Editor */}
        <div className="col-span-8">
          {selectedUser && permissions ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center text-xl font-bold border border-white/5">
                      {selectedUser.username.charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <h2 className="text-xl font-bold">{selectedUser.username}</h2>
                     <p className="text-sm text-muted-foreground">Modify permissions for this user</p>
                   </div>
                </div>
                <Button 
                  onClick={handleSavePermissions} 
                  loading={saving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Permissions
                </Button>
              </div>

              {selectedUser.role === 'ADMIN' ? (
                <div className="p-8 border-2 border-dashed border-primary/20 rounded-3xl bg-primary/5 flex flex-col items-center text-center">
                  <Shield className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-lg font-bold">Administrator Bypass</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-2">
                    This user has the ADMIN role and automatically possesses all platform privileges. 
                    Fine-grained permissions are not applicable.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {/* 1. Cluster Access */}
                  <Card className="p-6 space-y-6 border-white/5 bg-card/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-emerald-500" />
                        <div>
                          <h3 className="font-bold">Cluster Access</h3>
                          <p className="text-xs text-muted-foreground">Select which clusters the user can see</p>
                        </div>
                      </div>
                      <div 
                        onClick={() => togglePermission('clusterAccess')}
                        className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${permissions.clusterAccess ? 'bg-primary' : 'bg-secondary'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${permissions.clusterAccess ? 'translate-x-6' : ''}`} />
                      </div>
                    </div>
 
                    {permissions.clusterAccess && (
                      <div className="pt-4 border-t border-white/5">
                        {(clusters || []).length > 0 ? (
                          <div className="grid grid-cols-3 gap-3">
                            {(clusters || []).map(cluster => (
                              <button
                                key={cluster.id}
                                onClick={() => toggleCluster(cluster.id.toString())}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                  permissions.allowedClusterIds.includes(cluster.id.toString())
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                    : 'bg-secondary/30 border-white/5 text-muted-foreground hover:border-white/10'
                                }`}
                              >
                                <span className="text-sm font-medium">{cluster.name}</span>
                                {permissions.allowedClusterIds.includes(cluster.id.toString()) ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border border-current opacity-20" />
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center bg-secondary/20 rounded-2xl border border-dashed border-white/10">
                            <Server className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                            <p className="text-sm text-muted-foreground">No clusters found in the system.</p>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="mt-2 text-primary"
                              onClick={() => window.location.href = '/environments'}
                            >
                              Create a Cluster in Environments
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>

                  {/* 2. Monitoring */}
                  <Card className="p-6 border-white/5 bg-card/30">
                    <div className="flex items-center gap-3 mb-6">
                      <Activity className="w-5 h-5 text-blue-500" />
                      <div>
                        <h3 className="font-bold">Monitoring & Observability</h3>
                        <p className="text-xs text-muted-foreground">Insight into environment health and logs</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { key: 'observability', label: 'Observability', icon: Shield },
                        { key: 'logs', label: 'Log Explorer', icon: Terminal },
                        { key: 'infraGraph', label: 'Infra Graph', icon: Share2 }
                      ].map(item => (
                        <button
                          key={item.key}
                          onClick={() => togglePermission('monitoring', item.key)}
                          className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all text-left ${
                            (permissions.monitoring as any)[item.key]
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
                              : 'bg-secondary/30 border-white/5 text-muted-foreground hover:border-white/10'
                          }`}
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="font-bold text-sm">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </Card>

                  {/* 3. Deployments (Env & App) */}
                  <div className="grid grid-cols-2 gap-6">
                    <Card className="p-6 border-white/5 bg-card/30">
                      <div className="flex items-center gap-3 mb-6">
                        <Server className="w-5 h-5 text-purple-500" />
                        <h3 className="font-bold">Env Deployment</h3>
                      </div>
                      <div className="space-y-3">
                        {['view', 'create', 'edit', 'delete'].map(action => (
                          <button
                            key={action}
                            onClick={() => togglePermission('envDeployment', action)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                              (permissions.envDeployment as any)[action]
                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                                : 'bg-secondary/30 border-white/5 text-muted-foreground'
                            }`}
                          >
                            <span className="text-sm font-medium capitalize">{action}</span>
                            <div className={`w-4 h-4 rounded-full border border-current flex items-center justify-center`}>
                               {(permissions.envDeployment as any)[action] && <div className="w-2 h-2 bg-current rounded-full" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </Card>

                    <Card className="p-6 border-white/5 bg-card/30">
                      <div className="flex items-center gap-3 mb-6">
                        <Layers className="w-5 h-5 text-orange-500" />
                        <h3 className="font-bold">App Deployment</h3>
                      </div>
                      <div className="space-y-3">
                        {['view', 'create', 'edit', 'delete'].map(action => (
                          <button
                            key={action}
                            onClick={() => togglePermission('appDeployment', action)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                              (permissions.appDeployment as any)[action]
                                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                                : 'bg-secondary/30 border-white/5 text-muted-foreground'
                            }`}
                          >
                            <span className="text-sm font-medium capitalize">{action}</span>
                            <div className={`w-4 h-4 rounded-full border border-current flex items-center justify-center`}>
                               {(permissions.appDeployment as any)[action] && <div className="w-2 h-2 bg-current rounded-full" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {/* 4. Incidents & AI */}
                  <div className="grid grid-cols-2 gap-6">
                     <Card className="p-6 border-white/5 bg-card/30">
                      <div className="flex items-center gap-3 mb-6">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <h3 className="font-bold">Incidents</h3>
                      </div>
                      <div className="space-y-3">
                        {['view', 'create', 'edit', 'delete'].map(action => (
                          <button
                            key={action}
                            onClick={() => togglePermission('incidents', action)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                              (permissions.incidents as any)[action]
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-secondary/30 border-white/5 text-muted-foreground'
                            }`}
                          >
                            <span className="text-sm font-medium capitalize">{action}</span>
                            <div className={`w-4 h-4 rounded-full border border-current flex items-center justify-center`}>
                               {(permissions.incidents as any)[action] && <div className="w-2 h-2 bg-current rounded-full" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </Card>

                    <Card className="p-6 border-white/5 bg-card/30 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-6">
                          <MessageSquare className="w-5 h-5 text-primary" />
                          <h3 className="font-bold">AI Assistant</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">
                          Grant access to the Monetique Eye AI for infrastructure intelligence and query assistance.
                        </p>
                      </div>
                      
                      <button
                        onClick={() => togglePermission('chatbotAccess')}
                        className={`w-full flex items-center justify-center gap-3 p-6 rounded-2xl border transition-all font-bold ${
                          permissions.chatbotAccess
                            ? 'bg-primary text-primary-foreground border-primary/20 shadow-lg shadow-primary/20'
                            : 'bg-secondary/30 border-white/5 text-muted-foreground'
                        }`}
                      >
                        {permissions.chatbotAccess ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                        {permissions.chatbotAccess ? 'AI Access Enabled' : 'AI Access Disabled'}
                      </button>
                    </Card>
                  </div>

                  {/* 5. Additional Features */}
                  <Card className="p-6 border-white/5 bg-card/30">
                    <div className="flex items-center gap-3 mb-6">
                      <Settings className="w-5 h-5 text-indigo-500" />
                      <div>
                        <h3 className="font-bold">Additional Features</h3>
                        <p className="text-xs text-muted-foreground">Access to supplementary platform tools</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { key: 'networkMonitorView', label: 'Network Monitor', icon: Network },
                        { key: 'securityDashboardView', label: 'Security Dashboard', icon: Shield },
                        { key: 'analyseView', label: 'Analyse', icon: BarChart2 },
                        { key: 'operationalIntelligenceView', label: 'Operational Intelligence', icon: Activity },
                        { key: 'auditLogView', label: 'Audit Log', icon: FileText },
                        { key: 'documentationView', label: 'Documentation', icon: Book }
                      ].map(item => (
                        <button
                          key={item.key}
                          onClick={() => togglePermission(item.key)}
                          className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all text-left ${
                            (permissions as any)[item.key]
                              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500'
                              : 'bg-secondary/30 border-white/5 text-muted-foreground hover:border-white/10'
                          }`}
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="font-bold text-sm">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-50 border-2 border-dashed border-white/5 rounded-3xl">
              <Shield className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-bold">No User Selected</h3>
              <p className="text-sm max-w-xs mt-2">
                Select a user from the left to manage their account or granular privileges.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* User Create/Edit Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-8 space-y-6 border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">{editingUser ? 'Edit User' : 'Add New User'}</h2>
              </div>
              <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Username</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={userFormData.username}
                    onChange={e => setUserFormData({ ...userFormData, username: e.target.value })}
                    className="w-full bg-secondary/50 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Enter username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {editingUser ? 'New Password (Optional)' : 'Password'}
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={userFormData.password}
                    onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
                    className="w-full bg-secondary/50 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder={editingUser ? "Leave blank to keep current" : "Enter password"}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {['USER', 'ADMIN'].map(r => (
                    <button
                      key={r}
                      onClick={() => setUserFormData({ ...userFormData, role: r })}
                      className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                        userFormData.role === r 
                          ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20' 
                          : 'bg-secondary/50 border-white/5 text-muted-foreground hover:border-white/10'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={() => setIsUserModalOpen(false)} 
                className="flex-1 bg-secondary hover:bg-secondary/80 text-foreground"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveUser} 
                loading={saving}
                className="flex-1 bg-primary text-primary-foreground"
              >
                {editingUser ? 'Update User' : 'Create User'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete "${userToDelete?.username}"? This will also remove all their associated permissions and cluster access. This action cannot be undone.`}
        confirmText="Delete User"
        type="danger"
      />
    </div>
  );
};

export default UserManagementPage;
