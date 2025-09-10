import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CachedUser {
  id: number;
  name: string;
  nickname: string;
  avatar: string;
  role?: string;
  updatedAt: number;
}

interface UserCacheStore {
  users: Map<number, CachedUser>;
  setUser: (user: Omit<CachedUser, 'updatedAt'>) => void;
  setUsers: (users: Omit<CachedUser, 'updatedAt'>[]) => void;
  getUser: (id: number) => CachedUser | undefined;
  clearCache: () => void;
  
  debugInfo: {
    cacheHits: number;
    cacheMisses: number;
  };
  getCacheStats: () => {
    cacheHits: number;
    cacheMisses: number;
    hitRate: string;
    totalUsers: number;
  };
}


export const useUserCacheStore = create<UserCacheStore>()(
  persist(
    (set, get) => ({
      users: new Map(),
      debugInfo: {
        cacheHits: 0,
        cacheMisses: 0,
      },
      
      setUser: (user) => set((state) => {
        const userWithTimestamp: CachedUser = {
          ...user,
          updatedAt: Date.now(),
        };
        const newUsers = new Map(state.users);

        newUsers.set(user.id, userWithTimestamp);
        
        
        return { users: newUsers };
      }),
      
      setUsers: (users) => set((state) => {
        const timestamp = Date.now();
        const newUsers = new Map(state.users);
        
        users.forEach(user => {
          newUsers.set(user.id, {
            ...user,
            updatedAt: timestamp,
          });
        });
        
        if (import.meta.env.DEV) {
          console.log(`🔄 [UserCache] 批量缓存 ${users.length} 个用户`);
        }
        
        return { users: newUsers };
      }),
      

      getUser: (id) => {
        const state = get();
        const user = state.users.get(id);
        
        if (!user) {
     
          set((state) => ({
            debugInfo: {
              ...state.debugInfo,
              cacheMisses: state.debugInfo.cacheMisses + 1,
            }
          }));
          
          if (import.meta.env.DEV) {
            console.log(`❌ [UserCache] 缓存未命中: 用户 ${id} 不存在`);
          }
          return undefined;
        }
   
        set((state) => ({
          debugInfo: {
            ...state.debugInfo,
            cacheHits: state.debugInfo.cacheHits + 1,
          }
        }));
        
     
        if (import.meta.env.DEV) {
          console.log(`✅ [UserCache] 缓存命中: 用户 ${user.name} (ID: ${id})`);
        }
        
        return user;
      },
      
      clearCache: () => set({
        users: new Map(),
        debugInfo: {
          cacheHits: 0,
          cacheMisses: 0,
        }
      }),
      
      getCacheStats: () => {
        const state = get();
        const { cacheHits, cacheMisses } = state.debugInfo;
        const totalQueries = cacheHits + cacheMisses;
        const hitRate = totalQueries > 0 
          ? ((cacheHits / totalQueries) * 100).toFixed(2) + '%'
          : '0%';
        
        return {
          cacheHits,
          cacheMisses,
          hitRate,
          totalUsers: state.users.size,
        };
      },
    }),
    {
      name: 'user-cache-storage',
  
      storage: {
        getItem: (name) => {
          try {
            const str = localStorage.getItem(name);
            if (!str) return null;
            
            const { state } = JSON.parse(str);
            return {
              state: {
                ...state,
    
                users: new Map(Array.isArray(state.users) ? state.users : []),
              }
            };
          } catch (error) {
            console.error('[UserCache] 解析缓存数据失败:', error);
            return {
              state: {
                users: new Map(),
                debugInfo: { cacheHits: 0, cacheMisses: 0 }
              }
            };
          }
        },
        setItem: (name, value) => {
          try {
            const { users, ...rest } = value.state;
            const serialized = JSON.stringify({
              state: {
                ...rest,
     
                users: Array.from(users.entries()),
              }
            });
            localStorage.setItem(name, serialized);
          } catch (error) {
            console.error('[UserCache] 保存缓存数据失败:', error);
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);


export const logCacheStats = () => {
  const stats = useUserCacheStore.getState().getCacheStats();
  console.table({
    '缓存统计': {
      '缓存命中': stats.cacheHits,
      '缓存未命中': stats.cacheMisses,
      '命中率': stats.hitRate,
      '缓存用户数': stats.totalUsers,
    }
  });
};


if (import.meta.env.DEV) {
  (window as any).userCacheStats = logCacheStats;
  (window as any).clearUserCache = () => useUserCacheStore.getState().clearCache();
}
