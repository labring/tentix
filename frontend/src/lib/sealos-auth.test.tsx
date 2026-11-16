import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const fixture = vi.hoisted(() => ({ id: "sealos-user-a" }));
vi.mock("@zjy365/sealos-desktop-sdk", () => ({ EVENT_NAME: { CHANGE_I18N: "language" } }));
vi.mock("@zjy365/sealos-desktop-sdk/app", () => ({
  createSealosApp: () => () => {},
  sealosApp: {
    getSession: async () => ({ token: "sdk-token", kubeconfig: "", user: {
      id: fixture.id, name: "Test", avatar: "", k8sUsername: "test", nsid: "test",
    } }),
    getLanguage: async () => ({ lng: "en" }), addAppEventListen: () => () => {},
  },
}));
vi.mock("@lib/jwt", () => ({
  decodeJWT: () => ({ userId: fixture.id }), extractAreaFromSealosToken: () => "bja",
}));
vi.mock("i18n", () => ({
  default: { t: (key: string) => key, changeLanguage: vi.fn(async () => {}) },
  useTranslation: () => ({ i18n: { resolvedLanguage: "en" } }),
}));
vi.mock("../_provider/tanstack", () => ({ getQueryClient: () => ({ clear: () => {} }) }));
beforeEach(() => {
  vi.resetModules();
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
  fixture.id = "sealos-user-a";
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function start(info: () => Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === "/api/auth/platform") return Response.json({ targetPlatform: "sealos" });
    if (path === "/api/auth/sealos") return Response.json({ token: "v2.test.token", id: 1, role: "customer" });
    if (path === "/api/user/info") return info();
    throw new Error("Unexpected request " + path);
  });
  vi.stubGlobal("fetch", fetchMock);
  const api = await import("../_provider/sealos");
  let ready = false;
  function Probe() { ready = api.useSealos().isInitialized; return <div>draft remains mounted</div>; }
  render(<api.SealosProvider><Probe /></api.SealosProvider>);
  await waitFor(() => expect(ready).toBe(true));
  return { api, fetchMock };
}
test("bootstrap info bypasses gate, verifies identity, and shares one exchange", async () => {
  let finish!: (response: Response) => void;
  const { api, fetchMock } = await start(() => new Promise((resolve) => { finish = resolve; }));
  let protectedReady = false;
  void api.waitForSealosAuthReady("/api/ticket/create").then(() => { protectedReady = true; });
  const a = api.exchangeSealosSession(fixture.id, { name: "Test", avatar: "" });
  const b = api.exchangeSealosSession(fixture.id, { name: "Test", avatar: "" });
  expect(a).toBe(b);
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  expect(protectedReady).toBe(false);
  expect(window.localStorage.getItem("token")).toBeNull();
  finish(Response.json({ id: 1, role: "customer", sealosId: fixture.id }));
  await a;
  await waitFor(() => expect(protectedReady).toBe(true));
  expect(fetchMock.mock.calls.filter(([url]) => url === "/api/auth/sealos")).toHaveLength(1);
  expect(api.isSealosAuthenticated()).toBe(true);
});
test("failed server verification leaves old credentials unavailable", async () => {
  const { api } = await start(async () => new Response(null, { status: 503 }));
  await expect(api.exchangeSealosSession(fixture.id, { name: "Test", avatar: "" })).rejects.toThrow();
  expect(api.isSealosAuthenticated()).toBe(false);
  expect(window.localStorage.getItem("token")).toBeNull();
});
test("return target accepts only the current role and removes credentials", async () => {
  const { api } = await start(async () => Response.json({}));
  expect(api.safeSealosReturnTo("https://outside.example/user/newticket", "customer")).toBeNull();
  expect(api.safeSealosReturnTo("/staff/tickets/list", "customer")).toBeNull();
  expect(api.safeSealosReturnTo("/user/newticket?token=old&x=1", "customer")).toBe("/user/newticket?x=1");
});
