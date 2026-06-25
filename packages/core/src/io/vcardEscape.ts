export function escapeValue(v: string): string {
  let out = "";
  for (const ch of v) {
    if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === ",") out += "\\,";
    else if (ch === ";") out += "\\;";
    else out += ch;
  }
  return out;
}

export function unescapeValue(v: string): string {
  let out = "";
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "\\" && i + 1 < v.length) {
      const n = v[i + 1];
      if (n === "n" || n === "N") out += "\n";
      else out += n; // \\ \, \; -> \ , ;
      i++;
    } else {
      out += v[i];
    }
  }
  return out;
}

export function splitEscaped(v: string, sep: string): string[] {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "\\" && i + 1 < v.length) {
      cur += v[i] + v[i + 1]!;
      i++;
    } else if (v[i] === sep) {
      parts.push(cur);
      cur = "";
    } else {
      cur += v[i];
    }
  }
  parts.push(cur);
  return parts;
}

export function unfoldLines(text: string): string[] {
  const physical = text.replace(/\r\n/g, "\n").split("\n");
  const logical: string[] = [];
  for (const line of physical) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && logical.length > 0) {
      logical[logical.length - 1] += line.slice(1);
    } else {
      logical.push(line);
    }
  }
  return logical;
}
