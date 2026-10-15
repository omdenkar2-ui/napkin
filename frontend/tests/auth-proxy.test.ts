import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { getClaims, setCookies } = vi.hoisted(() => ({ getClaims: vi.fn(), setCookies: { current: undefined as undefined | ((cookies: { name: string; value: string }[]) => void) } }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: typeof setCookies.current } }) => {
    setCookies.current = options.cookies.setAll;
    return { auth: { getClaims } };
  },
}));
import { updateSession } from "../src/lib/supabase/middleware";

beforeEach(() => {
  getClaims.mockReset();
  getClaims.mockResolvedValue({ data: null, error: null });
});
describe("frontend route protection", () => {
  it("redirects a signed-out visitor to login", async () => {
    const response = await updateSession(new NextRequest("https://example.test/sessions?x=1"));
    expect(response.headers.get("location")).toBe("https://example.test/login");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it.each(["/login", "/signup", "/callback?code=demo"])("allows the public auth route %s", async (path) => {
    const response = await updateSession(new NextRequest(`https://example.test${path}`));
    expect(response.headers.has("location")).toBe(false);
  });
  it("allows verified claims and forwards refreshed cookies", async () => {
    getClaims.mockImplementation(async () => {
      setCookies.current?.([{ name: "refreshed", value: "new-cookie" }]);
      return { data: { claims: { sub: "user" } }, error: null };
    });
    const response = await updateSession(new NextRequest("https://example.test/sessions"));
    expect(response.headers.has("location")).toBe(false);
    expect(response.cookies.get("refreshed")?.value).toBe("new-cookie");
  });
  it("retains cookie clearing on an invalid-session redirect", async () => {
    getClaims.mockImplementation(async () => {
      setCookies.current?.([{ name: "expired", value: "" }]);
      return { data: null, error: new Error("expired") };
    });
    const response = await updateSession(new NextRequest("https://example.test/team"));
    expect(response.cookies.get("expired")?.value).toBe("");
    expect(response.status).toBe(307);
  });
});
