import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { useWallet } from "@/hooks/useWallet";

vi.mock("@/components/providers/WalletProvider", async () => {
  const { createContext } = await import("react");
  return { WalletContext: createContext<unknown>(null) };
});

import { WalletContext } from "@/components/providers/WalletProvider";

const mockContext = {
  address: "0xdeadbeef" as string | null,
  provider: null,
  signer: null,
  role: "doador" as const,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

describe("useWallet", () => {
  it("lança erro quando usado fora do WalletProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useWallet())).toThrow();
    spy.mockRestore();
  });

  it("retorna address do contexto", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(
        WalletContext.Provider as React.Provider<unknown>,
        { value: mockContext },
        children,
      );

    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current.address).toBe("0xdeadbeef");
  });

  it("retorna role do contexto", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(
        WalletContext.Provider as React.Provider<unknown>,
        { value: mockContext },
        children,
      );

    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current.role).toBe("doador");
  });

  it("retorna a função connect do contexto", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(
        WalletContext.Provider as React.Provider<unknown>,
        { value: mockContext },
        children,
      );

    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current.connect).toBe(mockContext.connect);
  });
});
