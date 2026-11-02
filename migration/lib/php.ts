// Minimal PHP unserialize() for WordPress meta values (arrays, strings,
// numbers, booleans, null). Arrays come back as plain objects keyed by the
// PHP keys; use `phpList()` for list-like arrays.
export type PhpValue =
  string | number | boolean | null | { [key: string]: PhpValue };

export function unserialize(input: string): PhpValue {
  // PHP string lengths are in bytes, so walk a UTF-8 buffer.
  const buf = Buffer.from(input, "utf8");
  let i = 0;

  const readUntil = (ch: string) => {
    const end = buf.indexOf(ch, i);
    const s = buf.toString("utf8", i, end);
    i = end + 1;
    return s;
  };

  const read = (): PhpValue => {
    const type = String.fromCharCode(buf[i]);
    i += 2; // type + ':' (or ';' for N)
    switch (type) {
      case "N":
        return null;
      case "b":
        return readUntil(";") === "1";
      case "i":
        return Number.parseInt(readUntil(";"), 10);
      case "d":
        return Number.parseFloat(readUntil(";"));
      case "s": {
        const len = Number.parseInt(readUntil(":"), 10);
        const s = buf.toString("utf8", i + 1, i + 1 + len);
        i += len + 3; // quotes and ';'
        return s;
      }
      case "a": {
        const count = Number.parseInt(readUntil(":"), 10);
        i += 1; // '{'
        const out: { [key: string]: PhpValue } = {};
        for (let k = 0; k < count; k++) {
          const key = read();
          out[String(key)] = read();
        }
        i += 1; // '}'
        return out;
      }
      default:
        throw new Error(`Unsupported PHP type "${type}"`);
    }
  };

  return read();
}

// Unserializes when the value looks serialized, otherwise returns it as-is.
export function maybeUnserialize(value: string | null): PhpValue {
  if (value == null) return null;
  return /^(a|s|i|b|d):|^N;/.test(value) ? unserialize(value) : value;
}

export function phpList(value: string | null): string[] {
  const parsed = maybeUnserialize(value);
  if (parsed == null || parsed === "") return [];
  if (typeof parsed === "object") return Object.values(parsed).map(String);
  return [String(parsed)];
}
