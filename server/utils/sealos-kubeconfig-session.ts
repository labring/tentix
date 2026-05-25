import { WS_TOKEN_EXPIRY_TIME } from "@/utils/const.ts";

type UserSealosKubeconfigBinding = {
  kubeconfig: string;
  updatedAt: number;
};

type TicketSealosKubeconfigBinding = {
  clientId: string;
  userId: number;
  kubeconfig: string;
  updatedAt: number;
};

const userSealosKubeconfigMap = new Map<number, UserSealosKubeconfigBinding>();
const ticketSealosKubeconfigMap = new Map<
  string,
  TicketSealosKubeconfigBinding
>();

function isExpired(updatedAt: number) {
  return Date.now() - updatedAt > WS_TOKEN_EXPIRY_TIME;
}

export function setUserSealosKubeconfig(userId: number, kubeconfig: string) {
  userSealosKubeconfigMap.set(userId, {
    kubeconfig,
    updatedAt: Date.now(),
  });
}

export function getUserSealosKubeconfig(userId: number): string | null {
  const current = userSealosKubeconfigMap.get(userId);
  if (!current) return null;

  if (isExpired(current.updatedAt)) {
    userSealosKubeconfigMap.delete(userId);
    return null;
  }

  return current.kubeconfig;
}

export function bindTicketSealosKubeconfig(
  ticketId: string,
  clientId: string,
  userId: number,
  kubeconfig: string,
) {
  ticketSealosKubeconfigMap.set(ticketId, {
    clientId,
    userId,
    kubeconfig,
    updatedAt: Date.now(),
  });
}

export function getTicketSealosKubeconfig(ticketId: string): string | null {
  const current = ticketSealosKubeconfigMap.get(ticketId);
  if (!current) return null;

  if (isExpired(current.updatedAt)) {
    ticketSealosKubeconfigMap.delete(ticketId);
    return null;
  }

  return current.kubeconfig;
}

export function unbindTicketSealosKubeconfig(
  ticketId: string,
  clientId?: string,
) {
  const current = ticketSealosKubeconfigMap.get(ticketId);
  if (!current) return;

  if (clientId && current.clientId !== clientId) {
    return;
  }

  ticketSealosKubeconfigMap.delete(ticketId);
}
