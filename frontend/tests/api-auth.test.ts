import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("../src/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession } }),
}));
import { api } from "../src/lib/api/client";

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: "test-token" } }, error: null });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("authenticated API requests", () => {
  it("adds the current bearer token and preserves supplied Headers", async () => {
    await api.get("/projects", { headers: new Headers({ "X-Request-ID": "test" }) });
    const options = vi.mocked(fetch).mock.calls[0][1]!;
    const headers = new Headers(options.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(headers.get("X-Request-ID")).toBe("test");
  });
  it("sends falsy JSON bodies", async () => {
    await api.post("/example", false);
    expect(vi.mocked(fetch).mock.calls[0][1]?.body).toBe("false");
  });
  it("authenticates uploads without overwriting the multipart boundary", async () => {
    await api.upload("/feedback/parse-file", new File(["demo"], "demo.txt"));
    const options = vi.mocked(fetch).mock.calls[0][1]!;
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer test-token");
    expect(new Headers(options.headers).has("Content-Type")).toBe(false);
    expect(options.body).toBeInstanceOf(FormData);
  });
  it("refuses requests when signed out", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(api.get("/projects")).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not turn server validation errors into connection errors", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ detail: [{ msg: "invalid" }] }, { status: 422 }));
    await expect(api.post("/projects", {})).rejects.toMatchObject({ status: 422, message: '[{"msg":"invalid"}]' });
  });
  it("handles responses without content", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.delete("/projects/id")).resolves.toBeUndefined();
  });
});
