import { describe, it, expect, beforeEach, vi } from "vitest";
import { isRateLimited } from "@/lib/rateLimiter";

function makeRequest(ip: string): Request {
  return new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("isRateLimited", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("permite primeira requisição", () => {
    const req = makeRequest("1.2.3.4");
    expect(isRateLimited(req, 10)).toBe(false);
  });

  it("permite até o limite sem bloquear", () => {
    const ip = "10.0.0.1";
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(makeRequest(ip), 5)).toBe(false);
    }
  });

  it("bloqueia ao exceder o limite", () => {
    const ip = "10.0.0.2";
    for (let i = 0; i < 5; i++) isRateLimited(makeRequest(ip), 5);
    expect(isRateLimited(makeRequest(ip), 5)).toBe(true);
  });

  it("IPs diferentes têm contadores independentes", () => {
    isRateLimited(makeRequest("192.168.0.1"), 1);
    expect(isRateLimited(makeRequest("192.168.0.2"), 1)).toBe(false);
  });

  it("libera requisições após janela de 1 minuto expirar", () => {
    const ip = "10.0.0.3";
    for (let i = 0; i < 3; i++) isRateLimited(makeRequest(ip), 3);
    expect(isRateLimited(makeRequest(ip), 3)).toBe(true);

    vi.advanceTimersByTime(61_000);

    expect(isRateLimited(makeRequest(ip), 3)).toBe(false);
  });

  it("usa x-real-ip quando x-forwarded-for ausente", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-real-ip": "5.5.5.5" },
    });
    expect(isRateLimited(req, 10)).toBe(false);
  });

  it("IP externo sem x-forwarded-for é agrupado e limitado", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "8.8.8.8" },
    });
    isRateLimited(req, 1);
    expect(isRateLimited(req, 1)).toBe(true);
  });

  it("requisição sem headers de IP não é limitada em não-produção (bypass localhost)", () => {
    const req = new Request("http://localhost/api/test");
    isRateLimited(req, 1);
    expect(isRateLimited(req, 1)).toBe(false);
  });
});
