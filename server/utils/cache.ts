import NodeCache from 'node-cache';
import { connectDB } from './tools.ts';
import { membersCols } from '@/api/queryParams.ts';
import { HTTPException } from 'hono/http-exception';

const cache = new NodeCache();

function cacheResult(
  _target: unknown,
  propertyKey: string, 
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: unknown[]) {
    const isStale = args.some(arg => arg === true && typeof arg === 'boolean');
    const cacheKey = `${propertyKey}_${JSON.stringify(args)}`;

    if (!isStale) {
      const cachedResult = cache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
    }

    const result = await originalMethod.apply(this, args);
    cache.set(cacheKey, result, 60 * 30); // Cache for 30 minutes

    return result;
  };

  return descriptor;
}

class CacheFunc {
  @cacheResult
  async getTicketMembers(id: string) {
    const db = connectDB();
    const data = await db.query.tickets.findFirst({
      where: (tickets, { eq }) => eq(tickets.id, id),
      with: {
        ...membersCols,
      },
    });
    if (!data) {
      throw new HTTPException(404, {
        message: "Ticket not found",
      });
    }
    const result = data.technicians
      .map((t) => t.user)
      .concat(data.agent, data.customer);
    return result;
  }
}

export const MyCache = new CacheFunc();