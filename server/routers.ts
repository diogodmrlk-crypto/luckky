import { router, publicProcedure, rbxisProcedure, rbxisAdminProcedure } from "./trpc";
import { z } from "zod";
import { createHash } from "crypto";
import { createMockKey, deleteMockKey, findMockKey, getMockKey, listMockKeys, mockKeyId, mockKeyToLicense, updateMockKey } from "../mockapi";
import { setSessionCookie, getAdminAccessKey, readSessionFromRequest } from "../rbxis-auth";

const SensitivityValues = z.object({
  general: z.number(),
  redDot: z.number(),
  scope2x: z.number(),
  scope4x: z.number(),
  awm: z.number(),
});

function buildSensitivity(seed: string, device = "") {
  const digest = createHash("sha256").update(seed).digest();
  const n = (index: number) => digest[index] ?? 0;
  const normalized = device.toLowerCase();
  const isOther = normalized.includes("outros");
  const isIos = normalized.includes("iphone") || normalized.includes("iph");
  const isHighEnd = /s24|rog|poco x6|iphone 15|iphone 14|edge 40/.test(normalized);
  const base = isOther ? (isIos ? 134 : 126) : isHighEnd ? 142 : isIos ? 132 : 118;
  const spread = isOther ? 45 : 34;
  const value = (index: number, offset: number) => Math.min(200, Math.max(1, base - offset + (n(index) % spread)));
  return { general: value(0, 0), redDot: value(1, 7), scope2x: value(2, 15), scope4x: value(3, 25), awm: value(4, 37) };
}

export const appRouter = router({
  auth: router({
    adminLogin: publicProcedure.input(z.object({ adminKey: z.string() })).mutation(async ({ ctx, input }) => {
      if (input.adminKey.trim() !== getAdminAccessKey()) throw new Error("Chave administrativa inválida");
      setSessionCookie(ctx.req, ctx.res, { role: "admin", username: getAdminAccessKey() });
      return { success: true, username: getAdminAccessKey() };
    }),
    login: publicProcedure.input(z.object({ accessKey: z.string(), deviceId: z.string() })).mutation(async ({ ctx, input }) => {
      const key = await findMockKey("", input.accessKey);
      if (!key) throw new Error("Key inválida");
      if (key.status === "blocked") throw new Error("Esta key foi bloqueada pelo administrador");
      if (key.status === "revoked") throw new Error("Esta key foi revogada");
      if (key.expiresAt && key.expiresAt <= Math.floor(Date.now() / 1000)) throw new Error("Esta key expirou");
      if (key.device && key.device !== input.deviceId) throw new Error("Esta key já está vinculada a outro dispositivo");
      const now = Math.floor(Date.now() / 1000);
      const activationExpiresAt = key.type === "perm" ? 0 : now + Math.max(1, Number(key.expire || 1)) * 86400;
      const updated = await updateMockKey(key.id ?? key.key, { device: input.deviceId, used: true, activatedAt: key.activatedAt || now, expiresAt: key.expiresAt || activationExpiresAt });
      setSessionCookie(ctx.req, ctx.res, { role: "user", userId: mockKeyId(updated), licenseId: mockKeyId(updated), username: updated.key });
      return { success: true, username: updated.key, expiresAt: updated.expiresAt ? new Date(updated.expiresAt * 1000) : null };
    }),
    me: publicProcedure.query(async ({ ctx }) => {
      const session = readSessionFromRequest(ctx.req);
      if (!session) return null;
      if (session.role === "admin") return { role: "admin", username: getAdminAccessKey(), name: getAdminAccessKey(), email: null };
      const key = (await listMockKeys()).find(item => item.key === session.username);
      if (!key || key.status === "revoked" || key.status === "blocked" || (key.expiresAt && key.expiresAt <= Math.floor(Date.now() / 1000))) return null;
      return { role: "user", username: key.key, name: key.key, email: null, planId: key.type ?? "daily", expiresAt: key.expiresAt ? new Date(key.expiresAt * 1000) : new Date("2099-12-31T23:59:59Z") };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie("rbxis_session_v3", { httpOnly: true, sameSite: "lax", path: "/" });
      return { success: true };
    }),
  }),
  generator: router({
    generate: rbxisProcedure.input(z.object({ operatingSystem: z.string(), device: z.string(), performance: z.string() })).mutation(async ({ input, ctx }) => {
      const key = (await listMockKeys()).find(k => k.key === ctx.rbxisSession?.username);
      if (!key) throw new Error("Licença não encontrada");
      const values = buildSensitivity(`${key.key}:${input.operatingSystem}:${input.device}:${input.performance}`, input.device);
      return { values, historyId: Date.now() };
    }),
    history: rbxisProcedure.query(async ({ ctx }) => {
      const key = (await listMockKeys()).find(k => k.key === ctx.rbxisSession?.username);
      return (key?.history ?? []).filter(item => !item.favorite).sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
    }),
    favorites: rbxisProcedure.query(async ({ ctx }) => {
      const key = (await listMockKeys()).find(k => k.key === ctx.rbxisSession?.username);
      return (key?.history ?? []).filter(item => item.favorite).sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
    }),
    toggleFavorite: rbxisProcedure.input(z.object({ historyId: z.number() })).mutation(async ({ ctx, input }) => {
      const key = (await listMockKeys()).find(k => k.key === ctx.rbxisSession?.username);
      if (!key?.id) return undefined;
      const history = (key.history ?? []) as any[];
      const updated = history.map(item => item.id === input.historyId ? { ...item, favorite: !item.favorite } : item);
      await updateMockKey(key.id, { history: updated });
      return { success: true };
    }),
  }),
  admin: router({
    licenses: rbxisAdminProcedure.query(async () => {
      const keys = await listMockKeys();
      return keys.map(mockKeyToLicense);
    }),
    stats: rbxisAdminProcedure.query(async () => {
      const licenses = (await listMockKeys()).map(mockKeyToLicense);
      const active = licenses.filter(x => x.status === "active");
      return { totalLicenses: licenses.length, activeLicenses: active.length, revokedLicenses: licenses.filter(x => x.status === "revoked").length, blockedLicenses: licenses.filter(x => x.status === "blocked").length };
    }),
    createLicense: rbxisAdminProcedure.input(z.object({ planId: z.string(), durationValue: z.number(), durationUnit: z.string() })).mutation(async ({ input }) => {
      return mockKeyToLicense(await createMockKey({ username: "", planId: input.planId, durationValue: input.durationValue, durationUnit: input.durationUnit as any }));
    }),
    updateLicense: rbxisAdminProcedure.input(z.object({ id: z.number(), status: z.string().optional(), planId: z.string().optional(), durationValue: z.number().optional(), durationUnit: z.string().optional() })).mutation(async ({ input }) => {
      const keys = await listMockKeys();
      const key = keys.find(k => mockKeyId(k) === input.id);
      if (!key?.id) throw new Error("Licença não encontrada");
      const patch: any = {};
      if (input.status) patch.status = input.status;
      if (input.planId) patch.type = input.planId;
      if (input.durationValue) patch.expire = input.durationValue;
      return mockKeyToLicense(await updateMockKey(key.id, patch));
    }),
    revokeLicense: rbxisAdminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const keys = await listMockKeys();
      const key = keys.find(k => mockKeyId(k) === input.id);
      if (!key?.id) throw new Error("Licença não encontrada");
      return mockKeyToLicense(await updateMockKey(key.id, { status: "revoked" }));
    }),
    blockLicense: rbxisAdminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const keys = await listMockKeys();
      const key = keys.find(k => mockKeyId(k) === input.id);
      if (!key?.id) throw new Error("Licença não encontrada");
      return mockKeyToLicense(await updateMockKey(key.id, { status: "blocked" }));
    }),
    deleteLicense: rbxisAdminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const keys = await listMockKeys();
      const key = keys.find(k => mockKeyId(k) === input.id);
      if (!key?.id) throw new Error("Licença não encontrada");
      await deleteMockKey(key.id);
      return { success: true };
    }),
    resetDevice: rbxisAdminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const keys = await listMockKeys();
      const key = keys.find(k => mockKeyId(k) === input.id);
      if (!key?.id) throw new Error("Licença não encontrada");
      return mockKeyToLicense(await updateMockKey(key.id, { device: "", activatedAt: 0 }));
    }),
  }),
});

export type AppRouter = typeof appRouter;
