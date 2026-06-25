import { describe, it, expect } from "vitest";
import { escapeValue, unescapeValue, splitEscaped, unfoldLines } from "./vcardEscape";

describe("vcardEscape", () => {
  it("escapes and unescapes round-trip", () => {
    const raw = "a,b; c\\d\nnext";
    const esc = escapeValue(raw);
    expect(esc).toBe("a\\,b\\; c\\\\d\\nnext");
    expect(unescapeValue(esc)).toBe(raw);
  });

  it("splitEscaped ignores escaped separators", () => {
    expect(splitEscaped("a\\;b;c", ";")).toEqual(["a\\;b", "c"]);
    expect(splitEscaped(";;", ";")).toEqual(["", "", ""]);
  });

  it("unfoldLines joins continuation lines", () => {
    const text = "FN:Ada\r\nNOTE:line one\r\n  line two\r\nEND:VCARD";
    expect(unfoldLines(text)).toEqual(["FN:Ada", "NOTE:line one line two", "END:VCARD"]);
  });
});
