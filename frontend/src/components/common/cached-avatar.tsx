// ========== cached-avatar.tsx ==========
// 智能缓存的 Avatar 包装组件（工程优化版）：LRU + TTL + 退避重试 + SSR 保护

import {
  useState,
  useEffect,
  useRef,
  memo,
  forwardRef,
  type ReactNode,
  type CSSProperties,
} from "react";
import { cn } from "@lib/utils";

// ========== 类型定义 ==========
type ImageLoadStatus = "loading" | "success" | "error" | "unknown";

interface CacheEntry {
  status: ImageLoadStatus;
  timestamp: number;
  accessTime: number;
}

interface ImageCacheConfig {
  maxSize?: number; // LRU 容量，默认 150
  ttl?: number; // 过期时间 ms，默认 90 分钟
  maxRetries?: number; // 最大重试次数，默认 2
  timeout?: number; // 单次加载超时 ms，默认 8s
  backoffBaseMs?: number; // 退避基数 ms，默认 400
}

// ========== LRU 缓存实现 ==========
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  constructor(maxSize: number = 150) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    // 将访问的项移到最后（最新）
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的（第一个）
      const firstKey = this.cache.keys().next().value as K;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  entries(): Iterable<[K, V]> {
    return this.cache.entries();
  }
}

// ========== 图片缓存管理器 ==========
class ImageCacheManager {
  private static instance: ImageCacheManager | null = null;

  private statusCache: LRUCache<string, CacheEntry>;
  private loadingPromises: Map<string, Promise<void>>;
  private listeners: Map<string, Set<() => void>>;
  private cleanupTimerId: number | null = null;

  private config: Required<ImageCacheConfig>;

  private constructor(config?: ImageCacheConfig) {
    this.config = {
      maxSize: config?.maxSize ?? 150,
      ttl: config?.ttl ?? 90 * 60 * 1000, // 90 分钟
      maxRetries: config?.maxRetries ?? 2,
      timeout: config?.timeout ?? 8000,
      backoffBaseMs: config?.backoffBaseMs ?? 400,
    };

    this.statusCache = new LRUCache(this.config.maxSize);
    this.loadingPromises = new Map();
    this.listeners = new Map();

    // 仅在浏览器端启动清理定时器
    if (typeof window !== "undefined") {
      this.startCleanupTimer();
    }
  }

  // 单例获取
  static getInstance(config?: ImageCacheConfig): ImageCacheManager {
    if (!ImageCacheManager.instance) {
      ImageCacheManager.instance = new ImageCacheManager(config);
    }
    return ImageCacheManager.instance;
  }

  // 重置单例（用于配置更新或测试）
  static reset(config?: ImageCacheConfig): ImageCacheManager {
    if (ImageCacheManager.instance) {
      ImageCacheManager.instance.dispose();
      ImageCacheManager.instance = null;
    }
    return ImageCacheManager.getInstance(config);
  }

  // 释放资源
  private dispose(): void {
    this.stopCleanupTimer();
    this.statusCache.clear();
    this.loadingPromises.clear();
    this.listeners.clear();
  }

  // ========== 定时清理 ==========
  private startCleanupTimer(): void {
    this.cleanupTimerId = window.setInterval(
      () => this.cleanupExpiredEntries(),
      60_000, // 每分钟清理一次
    );
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimerId !== null) {
      clearInterval(this.cleanupTimerId);
      this.cleanupTimerId = null;
    }
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.statusCache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((k) => this.invalidate(k));
  }

  // ========== 状态获取 ==========
  getStatus(url: string): ImageLoadStatus {
    const entry = this.statusCache.get(url);
    if (!entry) return "unknown";

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.invalidate(url);
      return "unknown";
    }

    // 更新访问时间
    entry.accessTime = Date.now();
    this.statusCache.set(url, entry);
    return entry.status;
  }

  // ========== 加载图片（带指数退避重试） ==========
  async loadImage(url: string): Promise<void> {
    if (!url) return Promise.resolve();

    // 命中成功且未过期
    const entry = this.statusCache.get(url);
    if (entry && entry.status === "success") {
      if (Date.now() - entry.timestamp <= this.config.ttl) {
        return Promise.resolve();
      }
      // 过期，继续加载
      this.invalidate(url);
    }

    // 合并并发请求
    const existing = this.loadingPromises.get(url);
    if (existing) return existing;

    const promise = this.loadWithRetries(url);
    this.loadingPromises.set(url, promise);

    promise.finally(() => this.loadingPromises.delete(url));
    return promise;
  }

  private async loadWithRetries(url: string): Promise<void> {
    // SSR 保护
    if (typeof window === "undefined") {
      this.updateStatus(url, "unknown");
      return;
    }

    this.updateStatus(url, "loading");

    const maxRetries = this.config.maxRetries;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.tryLoadOnce(url);
        this.updateStatus(url, "success");
        return;
      } catch (e) {
        if (attempt >= maxRetries) {
          this.updateStatus(url, "error");
          throw e;
        }

        // 指数退避 + 随机抖动
        const baseDelay = this.config.backoffBaseMs * 2 ** (attempt - 1);
        const jitter = Math.random() * baseDelay * 0.3;
        await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
      }
    }
  }

  private tryLoadOnce(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      // 异步解码，减轻主线程阻塞
      if ("decoding" in img) {
        (img as HTMLImageElement & { decoding: string }).decoding = "async";
      }

      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Load timeout"));
      }, this.config.timeout);

      const cleanup = () => {
        clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
      };

      img.onload = () => {
        cleanup();
        resolve();
      };

      img.onerror = () => {
        cleanup();
        reject(new Error("Load error"));
      };

      img.src = url;
    });
  }

  private updateStatus(url: string, status: ImageLoadStatus): void {
    const now = Date.now();
    this.statusCache.set(url, {
      status,
      timestamp: now,
      accessTime: now,
    });
    this.notifyListeners(url);
  }

  // ========== 监听器管理 ==========
  addListener(url: string, cb: () => void): void {
    if (!this.listeners.has(url)) {
      this.listeners.set(url, new Set());
    }
    this.listeners.get(url)!.add(cb);
  }

  removeListener(url: string, cb: () => void): void {
    const set = this.listeners.get(url);
    if (!set) return;
    set.delete(cb);
    if (set.size === 0) {
      this.listeners.delete(url);
    }
  }

  private notifyListeners(url: string): void {
    const set = this.listeners.get(url);
    if (!set) return;
    set.forEach((cb) => cb());
  }

  // ========== 缓存维护 ==========
  invalidate(url: string): void {
    this.statusCache.delete(url);
    this.loadingPromises.delete(url);
    this.notifyListeners(url);
  }

  clear(): void {
    this.statusCache.clear();
    this.loadingPromises.clear();
    this.listeners.clear();
  }

  preload(urls: string[]): void {
    urls.forEach((url) => {
      if (url) {
        this.loadImage(url).catch(() => {
          // 预加载失败时静默处理
        });
      }
    });
  }

  getStats() {
    return {
      cacheSize: this.statusCache.size(),
      loadingCount: this.loadingPromises.size,
      listenerCount: this.listeners.size,
    };
  }
}

// ========== Hook：图片缓存状态 ==========
export function useImageCache(src?: string): ImageLoadStatus {
  const [status, setStatus] = useState<ImageLoadStatus>("unknown");
  const managerRef = useRef(ImageCacheManager.getInstance());
  const manager = managerRef.current;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!src) {
      setStatus("error");
      return;
    }

    // 获取初始状态
    setStatus(manager.getStatus(src));

    // 如果未知或加载中，开始加载
    const currentStatus = manager.getStatus(src);
    if (currentStatus === "unknown" || currentStatus === "loading") {
      manager
        .loadImage(src)
        .then(() => mountedRef.current && setStatus("success"))
        .catch(() => mountedRef.current && setStatus("error"));
    }

    // 监听状态变化
    const handleStatusChange = () => {
      if (!mountedRef.current) return;
      setStatus(manager.getStatus(src));
    };

    manager.addListener(src, handleStatusChange);

    return () => {
      manager.removeListener(src, handleStatusChange);
    };
  }, [src, manager]);

  return status;
}

// ========== CachedAvatarImage 组件 ==========
interface CachedAvatarImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  className?: string;
}

export const CachedAvatarImage = memo(
  forwardRef<HTMLImageElement, CachedAvatarImageProps>(
    ({ src, alt, className, ...props }, ref) => {
      const status = useImageCache(src);

      if (!src || status !== "success") {
        return null;
      }

      // 直接渲染 img 标签，避免 Radix Avatar 内部重新创建 Image 对象
      return (
        <img
          ref={ref}
          src={src}
          alt={alt}
          className={cn("aspect-square h-full w-full object-cover", className)}
          {...props}
        />
      );
    },
  ),
  (prev, next) =>
    prev.src === next.src &&
    prev.alt === next.alt &&
    prev.className === next.className,
);

CachedAvatarImage.displayName = "CachedAvatarImage";

// ========== CachedAvatar 组件 ==========
const SIZE_CLASSES = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
  "2xl": "h-20 w-20",
} as const;

type SizeKey = keyof typeof SIZE_CLASSES;

export interface CachedAvatarProps {
  src?: string;
  alt?: string;
  fallback?: ReactNode;
  size?: SizeKey | number;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
}

export const CachedAvatar = memo(
  forwardRef<HTMLSpanElement, CachedAvatarProps>(
    (
      { src, alt, fallback, size = "md", className, children, style, ...props },
      ref,
    ) => {
      const status = useImageCache(src);
      const showImage = status === "success" && src;

      let sizeClass = "";
      let sizeStyle: CSSProperties = {};

      if (typeof size === "number") {
        sizeStyle = { width: size, height: size };
      } else {
        sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;
      }

      return (
        <span
          ref={ref}
          className={cn(
            "relative flex shrink-0 overflow-hidden rounded-full",
            sizeClass,
            className,
          )}
          style={{ ...sizeStyle, ...style }}
          {...props}
        >
          {showImage ? (
            <img
              src={src}
              alt={alt}
              className="aspect-square h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center rounded-full bg-muted">
              {fallback ?? children}
            </span>
          )}
        </span>
      );
    },
  ),
);

CachedAvatar.displayName = "CachedAvatar";

// ========== Hook：批量预加载 ==========
export function usePreloadAvatars(urls: string[]): void {
  const managerRef = useRef(ImageCacheManager.getInstance());
  const manager = managerRef.current;

  useEffect(() => {
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
    if (uniqueUrls.length) {
      manager.preload(uniqueUrls);
    }
  }, [urls, manager]);
}

// ========== Hook：缓存管理 ==========
export interface AvatarCacheControls {
  invalidate: (url: string) => void;
  clear: () => void;
  preload: (urls: string[]) => void;
  getStatus: (url: string) => ImageLoadStatus;
  getStats: () => {
    cacheSize: number;
    loadingCount: number;
    listenerCount: number;
  };
}

export function useAvatarCacheManager(): AvatarCacheControls {
  const managerRef = useRef(ImageCacheManager.getInstance());
  const manager = managerRef.current;

  return {
    invalidate: (url) => manager.invalidate(url),
    clear: () => manager.clear(),
    preload: (urls) => manager.preload(urls),
    getStatus: (url) => manager.getStatus(url),
    getStats: () => manager.getStats(),
  };
}

// ========== 全局配置 ==========
export function configureImageCache(config: ImageCacheConfig): void {
  ImageCacheManager.reset(config);
}

// ========== 使用示例 ==========
/*

1. 应用启动时配置（可选）：
   在 main.tsx 或 App.tsx 中：

   import { configureImageCache } from "@/components/common/cached-avatar";

   configureImageCache({
     maxSize: 200,              // 最多缓存 200 个头像
     ttl: 2 * 60 * 60 * 1000,  // 2 小时过期
     maxRetries: 2,            // 最多重试 2 次
     timeout: 5000,            // 5 秒超时
     backoffBaseMs: 300        // 初始退避 300ms
   });

2. 最简单的替换方式：

   // 原代码
   <Avatar className="h-8 w-8 shrink-0">
     <AvatarImage src={messageSender?.avatar} alt={messageSender?.nickname} />
     <AvatarFallback>{messageSender?.nickname?.charAt(0)}</AvatarFallback>
   </Avatar>

   // 新代码（直接替换）
   <CachedAvatar
     size="sm"
     src={messageSender?.avatar}
     alt={messageSender?.nickname}
     fallback={messageSender?.nickname?.charAt(0)}
   />

3. 只替换 AvatarImage：

   <Avatar className="h-8 w-8 shrink-0">
     <CachedAvatarImage src={messageSender?.avatar} alt={messageSender?.nickname} />
     <AvatarFallback>{messageSender?.nickname?.charAt(0)}</AvatarFallback>
   </Avatar>

4. 预加载聊天列表头像：

   function ChatContainer() {
     const { sessionMembers } = useSessionMembersStore();

     const avatarUrls = useMemo(
       () => sessionMembers?.map(m => m.avatar).filter(Boolean) || [],
       [sessionMembers]
     );

     usePreloadAvatars(avatarUrls);

     return <MessageList />;
   }

5. 手动管理缓存：

   function ProfileSettings() {
     const { invalidate, clear, getStats } = useAvatarCacheManager();

     const handleAvatarUpdate = async (newAvatar: string) => {
       await updateUserAvatar(newAvatar);
       invalidate(oldAvatarUrl); // 清除旧头像缓存
     };

     const handleClearCache = () => {
       clear(); // 清除所有缓存
       console.log('Cache cleared:', getStats());
     };
   }

*/
