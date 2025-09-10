import { useState, useEffect } from "react";
import { useUserCacheStore } from "../../store/user-cache";
import { Button } from "tentix-ui";
import { cn } from "@lib/utils";

interface CacheDebugPanelProps {
  className?: string;
}

export function CacheDebugPanel({ className }: CacheDebugPanelProps) {
  const getCacheStats = useUserCacheStore((state: any) => state.getCacheStats);
  const clearCache = useUserCacheStore((state: any) => state.clearCache);
  const users = useUserCacheStore((state: any) => state.users);
  
  const [stats, setStats] = useState(() => getCacheStats());
  const [isExpanded, setIsExpanded] = useState(false);


  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getCacheStats());
    }, 3000); 
    return () => clearInterval(interval);
  }, [getCacheStats]);

  const handleClearCache = () => {
    clearCache();
    setStats(getCacheStats());
    console.log("🗑️ [CacheDebugPanel] 缓存已清空");
  };

  const handleLogStats = () => {
    const currentStats = getCacheStats();
    console.table({
      '缓存统计': {
        '缓存命中': currentStats.cacheHits,
        '缓存未命中': currentStats.cacheMisses,
        '命中率': currentStats.hitRate,
        '缓存用户数': currentStats.totalUsers,
      }
    });
  };


  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className={cn(
      "fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-w-sm",
      className
    )}>
    
      <div 
        className="p-3 border-b border-gray-200 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">用户缓存状态</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">
              {isExpanded ? "▼" : "▶"}
            </span>
          </div>
        </div>
      </div>


      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* 统计信息 */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-purple-50 p-2 rounded">
              <div className="text-purple-800 font-medium">缓存用户</div>
              <div className="text-purple-600">{stats.totalUsers}</div>
            </div>
          </div>

    
          <div className="max-h-32 overflow-y-auto">
            <div className="text-xs font-medium text-gray-700 mb-1">缓存用户列表:</div>
            <div className="space-y-1">
              {Array.from(users.entries() as IterableIterator<[number, any]>).slice(0, 5).map(([id, user]) => (
                <div key={id} className="flex items-center gap-2 text-xs p-1 bg-gray-50 rounded">
                  <img 
                    src={user.avatar} 
                    alt={user.name}
                    className="w-4 h-4 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="truncate flex-1">{user.name}</span>
                  <span className="text-gray-500">{user.role}</span>
                </div>
              ))}
              {users.size > 5 && (
                <div className="text-xs text-gray-400 text-center">
                  还有 {users.size - 5} 个用户...
                </div>
              )}
            </div>
          </div>


          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleLogStats}
              className="flex-1 text-xs"
            >
              打印统计
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleClearCache}
              className="flex-1 text-xs"
            >
              清空缓存
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


export function useCacheDebugToggle() {
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
 
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setShowDebugPanel(prev => !prev);
      }
    };

    if (import.meta.env.DEV) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, []);

  return { showDebugPanel, setShowDebugPanel };
}
