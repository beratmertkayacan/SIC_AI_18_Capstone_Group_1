import { describe, expect, it } from "vitest";
import { Session } from "./session";

describe("Session", () => {
  it("mesajları sayar", () => {
    const s = new Session(null);
    expect(s.recordSend()).toBe(1);
    expect(s.recordSend()).toBe(2);
  });

  it("aynı adreste oturumu korur", () => {
    const s = new Session("abc");
    s.recordSend();
    expect(s.onNavigate("abc")).toBe("keep");
    expect(s.turns).toBe(1);
  });

  it("yeni sohbette ilk mesajdan sonra gelen kimliği aynı oturum sayar (adopt)", () => {
    const s = new Session(null);
    s.recordSend();
    expect(s.onNavigate("abc12345")).toBe("adopt");
    expect(s.turns).toBe(1);
    expect(s.key).toBe("abc12345");
  });

  it("mesaj göndermeden eski bir sohbeti açınca sıfırlar", () => {
    const s = new Session(null);
    expect(s.onNavigate("abc12345")).toBe("reset");
    expect(s.turns).toBe(0);
  });

  it("bir sohbetten başka bir sohbete geçince sıfırlar", () => {
    const s = new Session("aaa11111");
    s.recordSend();
    expect(s.onNavigate("bbb22222")).toBe("reset");
    expect(s.turns).toBe(0);
  });

  it("bir sohbetten yeni sohbete geçince sıfırlar", () => {
    const s = new Session("aaa11111");
    s.recordSend();
    expect(s.onNavigate(null)).toBe("reset");
    expect(s.turns).toBe(0);
    expect(s.key).toBeNull();
  });

  it("var olan sohbetteki mesajları bir kez sayar (seedTurns)", () => {
    const s = new Session("aaa11111");
    expect(s.seedTurns(3)).toBe(true);
    expect(s.turns).toBe(3);
    expect(s.recordSend()).toBe(4);
  });

  it("kullanıcı zaten mesaj gönderdiyse seedTurns işe karışmaz", () => {
    const s = new Session("aaa11111");
    s.recordSend();
    expect(s.seedTurns(5)).toBe(false);
    expect(s.turns).toBe(1);
  });

  it("seedTurns(0) bir şey yapmaz", () => {
    const s = new Session("aaa11111");
    expect(s.seedTurns(0)).toBe(false);
    expect(s.turns).toBe(0);
  });
});

describe("Session.restart", () => {
  it("sayacı sıfırlar, sohbet anahtarını korur", () => {
    const s = new Session("abc");
    s.recordSend();
    s.recordSend();
    s.restart();
    expect(s.turns).toBe(0);
    expect(s.key).toBe("abc");
    expect(s.seedTurns(3)).toBe(true);
  });
});
