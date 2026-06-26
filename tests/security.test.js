const { sanitizeKey, sanitizeMessage } = require("../src/utils/security");

describe("sanitizeKey()", () => {
  it("✅ harus return key apa adanya jika tidak ada karakter khusus", () => {
    expect(sanitizeKey("normalName")).toBe("normalName");
  });

  it("✅ harus replace . # $ / [ ] dengan underscore", () => {
    expect(sanitizeKey("user.name#123$")).toBe("user_name_123_");
  });

  it("✅ harus replace / [ ] dengan underscore pada path", () => {
    expect(sanitizeKey("path/to/file[0]")).toBe("path_to_file_0_");
  });

  it("✅ harus return 'unknown' jika null", () => {
    expect(sanitizeKey(null)).toBe("unknown");
  });

  it("✅ harus return 'unknown' jika undefined", () => {
    expect(sanitizeKey(undefined)).toBe("unknown");
  });

  it("✅ harus return 'unknown' jika string kosong", () => {
    expect(sanitizeKey("")).toBe("unknown");
  });
});

describe("sanitizeMessage()", () => {
  describe("XSS Protection", () => {
    it("✅ harus hapus <script> tags", () => {
      const result = sanitizeMessage("<script>alert('xss')</script>");
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("</script>");
    });

    it("✅ harus hapus event handler onerror dari tag img", () => {
      const result = sanitizeMessage("<img src=x onerror=alert(1)>");
      expect(result).not.toContain("onerror");
    });

    it("✅ harus html-escape tag <svg> (tidak whitelisted)", () => {
      const result = sanitizeMessage("<svg onload=alert(1)>");
      expect(result).toContain("&lt;svg");
      expect(result).not.toContain("<svg");
    });

    it("✅ harus hapus javascript: dari href anchor", () => {
      const result = sanitizeMessage("<a href='javascript:alert(1)'>klik</a>");
      expect(result).not.toContain("javascript:");
    });

    it("✅ harus html-escape tag <body> (tidak whitelisted)", () => {
      const result = sanitizeMessage("<body onload=alert(1)>");
      expect(result).toContain("&lt;body");
      expect(result).not.toContain("<body");
    });

    it("✅ harus html-escape tag <iframe> (tidak whitelisted)", () => {
      const result = sanitizeMessage("<iframe src='javascript:alert(1)'>");
      expect(result).toContain("&lt;iframe");
      expect(result).not.toContain("<iframe");
    });

    it("✅ harus html-escape tag <input> (tidak whitelisted)", () => {
      const result = sanitizeMessage("<input onfocus='alert(1)'>");
      expect(result).toContain("&lt;input");
      expect(result).not.toContain("<input");
    });
  });

  describe("Bad Words Filtering", () => {
    it("✅ harus sensor kata 'anjing'", () => {
      expect(sanitizeMessage("anjing")).toBe("***");
    });

    it("✅ harus sensor dengan case insensitive 'Anjing'", () => {
      expect(sanitizeMessage("Anjing")).toBe("***");
    });

    it("✅ harus sensor leet speak '4nj1ng' (a→4, i→1)", () => {
      expect(sanitizeMessage("4nj1ng")).toBe("***");
    });

    it("✅ harus sensor kata dengan pemisah titik 'a.n.j.i.n.g'", () => {
      expect(sanitizeMessage("a.n.j.i.n.g")).toBe("***");
    });

    it("✅ harus sensor kata dengan spasi 'b a b i'", () => {
      expect(sanitizeMessage("b a b i")).toBe("***");
    });

    it("✅ harus sensor leet combo 'k0nt0l' (o→0)", () => {
      expect(sanitizeMessage("k0nt0l")).toBe("***");
    });

    it("✅ harus sensor leet 's3tan' (e→3)", () => {
      expect(sanitizeMessage("s3tan")).toBe("***");
    });

    it("✅ harus sensor 'SETAN!!' dengan tanda baca di akhir", () => {
      expect(sanitizeMessage("SETAN!!")).toBe("***!!");
    });
  });

  describe("Edge Cases & Spam Protection", () => {
    it("✅ harus batasi karakter berulang (5+ → 3) contoh 'helloooooo!!'", () => {
      const result = sanitizeMessage("helloooooo!!");
      expect(result).toBe("hellooo!!");
    });

    it("✅ harus truncate pesan > 100 karakter", () => {
      const longMsg = "A".repeat(150);
      const result = sanitizeMessage(longMsg);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it("✅ harus return empty string untuk input kosong/null/undefined/whitespace", () => {
      expect(sanitizeMessage("")).toBe("");
      expect(sanitizeMessage(null)).toBe("");
      expect(sanitizeMessage(undefined)).toBe("");
      expect(sanitizeMessage("   ")).toBe("");
    });
  });
});
