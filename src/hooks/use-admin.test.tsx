import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/use-admin";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));

const mockedAuth = vi.mocked(useAuth);

const setViewer = (role: string | null, loading = false) => {
  mockedAuth.mockReturnValue({
    user: role === null ? null : {
      id: "current-convex-user",
      email: "member@example.com",
      full_name: null,
      avatar_url: null,
      email_verified: true,
      role,
    },
    loading,
  } as ReturnType<typeof useAuth>);
};

describe("reactive admin role after email verification", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps an ID-linked admin signed in as admin", () => {
    setViewer("admin");
    expect(renderHook(() => useAdmin()).result.current).toEqual({
      isAdmin: true,
      loading: false,
    });
  });

  it("recognizes super_admin", () => {
    setViewer("super_admin");
    expect(renderHook(() => useAdmin()).result.current.isAdmin).toBe(true);
  });

  it("does not grant access to regular users or logged-out sessions", () => {
    setViewer("user");
    expect(renderHook(() => useAdmin()).result.current.isAdmin).toBe(false);
    setViewer(null);
    expect(renderHook(() => useAdmin()).result.current.isAdmin).toBe(false);
  });

  it("honors the authenticated viewer loading state", () => {
    setViewer("admin", true);
    expect(renderHook(() => useAdmin()).result.current.loading).toBe(true);
  });
});
