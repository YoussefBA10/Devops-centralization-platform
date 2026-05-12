import React from 'react';
import { useCluster } from '../../context/ClusterContext';
import { ChevronDown, Server } from 'lucide-react';

const ClusterSelector: React.FC = () => {
  const { clusters, selectedCluster, setSelectedCluster } = useCluster();

  return (
    <div className="relative group">
      <button className="flex items-center gap-3 px-4 py-2 bg-secondary/50 backdrop-blur-sm rounded-lg border border-border hover:border-primary/50 transition-all text-sm font-medium">
        <Server className="w-4 h-4 text-primary" />
        <span className="max-w-[120px] truncate">{selectedCluster?.name || 'All Clusters'}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>

      <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top scale-95 group-hover:scale-100 z-50">
        <div className="p-2 space-y-1">
          <button
            onClick={() => setSelectedCluster(null)}
            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
              selectedCluster === null 
                ? 'bg-primary/10 text-primary' 
                : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            All Clusters
          </button>
          
          <div className="h-px bg-border my-1 mx-2"></div>
          
          {(clusters || []).map((cluster) => (
            <button
              key={cluster.id}
              onClick={() => setSelectedCluster(cluster)}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                selectedCluster?.id === cluster.id 
                  ? 'bg-primary/10 text-primary' 
                  : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-semibold">{cluster.name}</span>
                {cluster.description && (
                  <span className="text-[10px] text-muted-foreground truncate">{cluster.description}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClusterSelector;
