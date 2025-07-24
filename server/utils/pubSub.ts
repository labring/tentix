/* eslint-disable drizzle/enforce-delete-with-where */
import { EventEmitter, errorMonitor } from "node:events";
import { logError } from "./log.ts";
import type { userRoleType, JSONContentZod, wsMsgServerType } from "./types.ts";
import { type UUID } from "crypto";
import { sendUnreadSSE, type wsInstance } from "@/api/chat/tools.ts";
import { SSEStreamingApi } from "hono/streaming";
import NodeCache from "node-cache";
import { myNanoId } from "./runtime.ts";

type MyEventMap = {
  [errorMonitor]: Error;
  [key: symbol | string]: unknown;
};

class MyEventEmitter<T extends MyEventMap> extends EventEmitter {
  constructor() {
    super();
    this.on(errorMonitor, (err: Error) => {
      logError(err.message, err);
    });
  }
  on<K extends keyof T>(
    event: K,
    listener:
      | ((...event: [T[K]]) => void)
      | ((...event: [T[K]]) => Promise<void>),
  ): this {
    return super.on(event as string | symbol, listener);
  }
  emit<K extends keyof T>(event: K, ...args: [T[K]]): boolean {
    return super.emit(event as string | symbol, ...args);
  }
}

/**
 * MessageEmitter Implementation
 */
interface MsgEventMap extends MyEventMap {
  new_message: {
    ws: wsInstance;
    ctx: {
      clientId: UUID;
      roomId: string;
      userId: number;
      role: userRoleType;
    };
    message: {
      content: JSONContentZod;
      tempId: number;
      messageId: number;
      timestamp: number;
      isInternal: boolean;
    };
  };
}

export class MessageEmitter extends MyEventEmitter<MsgEventMap> {
  constructor() {
    super();
  }
}

/**
 * NewMessageEmitter Implementation
 */

interface roomObserveEventMap extends MyEventMap {
  new_message: {
    roomId: string;
    userId: number;
    content: JSONContentZod;
    tempId: number;
    messageId: number;
    timestamp: number;
    isInternal: boolean;
  };
  add_room_observer: {
    roomId: string;
    userId: number;
  };
  remove_room_observer: {
    roomId: string;
    userId: number;
  };
}

export class RoomObserveEmitter extends MyEventEmitter<roomObserveEventMap> {
  private userSSEInstanceMap: Map<number, SSEStreamingApi> = new Map(); // userId -> SSEClient
  /**
   * RoomId -> Set of userId, equals to `Map<string, Set<number>>`
   */
  private roomObserverMap = new NodeCache({
    stdTTL: 60 * 60 * 24 * 3, // 72 hours
    checkperiod: 60 * 60 * 12, // 24 hours
    useClones: false,
    maxKeys: 1000, // Max number of rooms, it just for memory limit
  });

  private static idGenerator = myNanoId(4);

  constructor() {
    super();
    this.on("add_room_observer", ({ roomId, userId }) => {
      this.observe(userId, roomId);
    });
    this.on("new_message", async (...[msg]) => {
      const roomObserverSet = this.roomObserverMap.get<Set<number>>(msg.roomId);
      if (!roomObserverSet) return;
      for (const userId of roomObserverSet) {
        const sse = this.userSSEInstanceMap.get(userId);
        if (!sse) continue;
        await sendUnreadSSE(sse, RoomObserveEmitter.idGenerator(), "newMsg", {
          messageId: msg.messageId,
          roomId: msg.roomId,
          userId: msg.userId,
          content: msg.content,
          timestamp: msg.timestamp,
          isInternal: msg.isInternal,
        });
      }
    });
  }

  public register(userId: number, sse: SSEStreamingApi) {
    this.userSSEInstanceMap.set(userId, sse);
  }

  public unregister(userId: number) {
    this.userSSEInstanceMap.delete(userId);
  }

  public isOnline(userId: number) {
    return this.userSSEInstanceMap.has(userId);
  }

  public observe(userId: number, roomIds: string | string[]) {
    if (Array.isArray(roomIds)) {
      for (const roomId of roomIds) {
        this.observe(userId, roomId);
      }
    } else {
      const roomObserverSet = this.roomObserverMap.get<Set<number>>(roomIds);
      if (!roomObserverSet) {
        this.roomObserverMap.set(roomIds, new Set([userId]));
      } else {
        roomObserverSet.add(userId);
      }
    }
  }
}

export const roomObserveEmitter = new RoomObserveEmitter();

/**
 * RoomEmitter Implementation
 */
type BasicRoomUserEvent = {
  clientId: UUID;
  roomId: string;
  userId: number;
  role: userRoleType;
  ws: wsInstance;
};

interface ConnectionState {
  lastHeartbeat: number;
  heartbeatTimeout?: NodeJS.Timeout;
  isAlive: boolean;
}

interface RoomEventMap extends MyEventMap {
  user_join: BasicRoomUserEvent;
  user_leave: BasicRoomUserEvent;
  user_typing: BasicRoomUserEvent;
  heartbeat_ack: {
    clientId: UUID;
  };
}

export class RoomEmitter extends MyEventEmitter<RoomEventMap> {
  // Connection management constants
  private static readonly HEARTBEAT_INTERVAL = 30000; // Send heartbeat every 30 seconds
  private static readonly HEARTBEAT_TIMEOUT = 10000; // Wait 10 seconds for heartbeat response
  private _roomsMap: Map<string, Map<string, wsInstance>> = new Map(); // roomId -> set of clientId   ticketId -> {clientId, ws}  一个房间会有多个 client ws
  private _connectionStates: Map<string, ConnectionState> = new Map();
  private _roomUserRoles: Map<
    string,
    Map<string, { userId: number; role: userRoleType }>
  > = new Map(); // roomId -> clientId -> user info

  get roomsMap() {
    return this._roomsMap;
  }

  get connectionStates() {
    return this._connectionStates;
  }

  get roomUserRoles() {
    return this._roomUserRoles;
  }

  // 检查房间中是否有特定角色的用户连接
  public hasRoleInRoom(roomId: string, role: userRoleType): boolean {
    const roomUsers = this._roomUserRoles.get(roomId);
    if (!roomUsers) return false;

    for (const userInfo of roomUsers.values()) {
      if (userInfo.role === role) {
        return true;
      }
    }
    return false;
  }

  // 获取房间中特定角色的用户列表
  public getUsersByRoleInRoom(roomId: string, role: userRoleType): number[] {
    const roomUsers = this._roomUserRoles.get(roomId);
    if (!roomUsers) return [];

    return Array.from(roomUsers.values())
      .filter((userInfo) => userInfo.role === role)
      .map((userInfo) => userInfo.userId);
  }

  constructor() {
    super();

    this.on("heartbeat_ack", ({ clientId }) => {
      this.handleHeartbeat(clientId);
    });

    this.on("user_join", ({ clientId, roomId, userId, role, ws }) => {
      if (!this.roomsMap.has(roomId)) {
        this.roomsMap.set(roomId, new Map());
      }
      const room = this.roomsMap.get(roomId)!;
      room.set(clientId, ws);

      // 维护用户角色信息
      if (!this._roomUserRoles.has(roomId)) {
        this._roomUserRoles.set(roomId, new Map());
      }
      const roomUsers = this._roomUserRoles.get(roomId)!;
      roomUsers.set(clientId, { userId, role });

      // Initialize connection state and start heartbeat
      this.initializeConnection(clientId, ws);
      this.broadcastToRoom(
        roomId,
        {
          type: "user_joined",
          userId,
          roomId,
          timestamp: Date.now(),
        },
        clientId,
      );
      roomObserveEmitter.emit("add_room_observer", {
        roomId,
        userId,
      });
    });

    this.on("user_leave", ({ clientId, roomId, userId }) => {
      const room = this.roomsMap.get(roomId)!;
      room.delete(clientId);

      // 清理用户角色信息
      const roomUsers = this._roomUserRoles.get(roomId);
      if (roomUsers) {
        roomUsers.delete(clientId);
        if (roomUsers.size === 0) {
          this._roomUserRoles.delete(roomId);
        }
      }

      const state = this.connectionStates.get(clientId);
      if (state?.heartbeatTimeout) {
        clearTimeout(state.heartbeatTimeout);
      }
      this.connectionStates.delete(clientId);
      if (room) {
        if (room.size === 0) {
          this.roomsMap.delete(roomId);
          return;
        }
        this.broadcastToRoom(
          roomId,
          {
            type: "user_left",
            userId,
            roomId,
            timestamp: Date.now(),
          },
          clientId,
        );
      }
    });
  }

  // Helper function to broadcast a message to all clients in a room
  public broadcastToRoom(
    roomId: string,
    message: wsMsgServerType,
    excludeClientId?: string | string[],
  ) {
    const room = this.roomsMap.get(roomId);
    if (!room) return;
    const set = new Set<string>(
      typeof excludeClientId === "string" ? [excludeClientId] : excludeClientId,
    );

    for (const [clientId, wsContext] of room) {
      if (set.has(clientId)) continue;
      wsContext.send(JSON.stringify(message));
    }
  }

  private initializeConnection(clientId: string, ws: wsInstance) {
    this.connectionStates.set(clientId, {
      lastHeartbeat: Date.now(),
      isAlive: true,
    });

    // Start heartbeat for this connection
    const heartbeatInterval = setInterval(() => {
      const state = this.connectionStates.get(clientId);
      if (!state || !state.isAlive) {
        clearInterval(heartbeatInterval);
        return;
      }

      // Send heartbeat
      ws.send(JSON.stringify({ type: "heartbeat", timestamp: Date.now() }));

      // Set timeout for response
      state.heartbeatTimeout = setTimeout(() => {
        const currentState = this.connectionStates.get(clientId);
        if (currentState) {
          currentState.isAlive = false;
          ws.close();
        }
      }, RoomEmitter.HEARTBEAT_TIMEOUT);
    }, RoomEmitter.HEARTBEAT_INTERVAL);
  }
  // HEARTBEAT_INTERVAL 时间必须大于 HEARTBEAT_TIMEOUT 时间，不然会出现问题
  // 如果 HEARTBEAT_INTERVAL 30s HEARTBEAT_TIMEOUT 40s，在 30s 上一个 heartbeatTimeout 被替换，但是实际还存在，没执行
  // 即使 32 秒时 server 收到 heartbeat_ack 执行了 handleHeartbeat 将 heartbeatTimeout 清除，但是 替换前的 heartbeatTimeout 还存在
  // 40s 到了后 heartbeatTimeout 执行，导致 ws 异常关闭，
  // 如果 HEARTBEAT_INTERVAL 时间不大于 HEARTBEAT_TIMEOUT 时间，那么该心跳设计就无意义了，
  // 该心跳设计是保证发送 heartbeat 在超时时间内要收到 heartbeat_ack，如果没收到 heartbeat_ack 就关闭 ws（超时关闭）

  private handleHeartbeat(clientId: string) {
    const state = this.connectionStates.get(clientId);
    if (state) {
      // Clear previous timeout if exists
      if (state.heartbeatTimeout) {
        clearTimeout(state.heartbeatTimeout);
      }
      state.lastHeartbeat = Date.now();
      state.isAlive = true;
      this.connectionStates.set(clientId, state);
    }
  }
}
