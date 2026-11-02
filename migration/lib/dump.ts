// Loads the INSERT statements of the phpMyAdmin MySQL dump into a local
// SQLite cache (every column as TEXT), so the import steps can query it.
// The cache is rebuilt only when the dump is newer than it.
import {
  createReadStream,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const INSERT_HEAD = /^INSERT INTO `([^`]+)` \(([^)]*)\) VALUES\s*/;
const ESCAPES: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  "0": "\0",
  Z: "\x1a",
};

type Value = string | null;

// Parses the "(...), (...);" part of an INSERT statement.
function parseRows(sql: string, start: number): Value[][] {
  const rows: Value[][] = [];
  let i = start;
  const n = sql.length;
  while (i < n) {
    while (i < n && " \n\r\t,".includes(sql[i])) i++;
    if (i >= n || sql[i] === ";") break;
    if (sql[i] !== "(") throw new Error(`Unexpected "${sql.slice(i, i + 40)}"`);
    i++;
    const row: Value[] = [];
    for (;;) {
      while (sql[i] === " " || sql[i] === "\n") i++;
      if (sql[i] === "'") {
        i++;
        let buf = "";
        for (;;) {
          const c = sql[i];
          if (c === "\\") {
            const next = sql[i + 1];
            buf += ESCAPES[next] ?? next;
            i += 2;
          } else if (c === "'") {
            if (sql[i + 1] === "'") {
              buf += "'";
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            let j = i;
            while (sql[j] !== "\\" && sql[j] !== "'") j++;
            buf += sql.slice(i, j);
            i = j;
          }
        }
        row.push(buf);
      } else {
        let j = i;
        while (sql[j] !== "," && sql[j] !== ")") j++;
        const token = sql.slice(i, j).trim();
        row.push(token === "NULL" ? null : token);
        i = j;
      }
      while (sql[i] === " ") i++;
      if (sql[i] === ",") {
        i++;
        continue;
      }
      if (sql[i] === ")") {
        i++;
        break;
      }
    }
    rows.push(row);
  }
  return rows;
}

// True when the line leaves us inside a quoted string.
function scanQuotes(line: string, inString: boolean): boolean {
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (!inString) {
      if (c === "'") inString = true;
    } else if (c === "\\") {
      i++;
    } else if (c === "'") {
      if (line[i + 1] === "'") i++;
      else inString = false;
    }
  }
  return inString;
}

export async function loadDump(
  dumpPath: string,
  cachePath: string,
): Promise<DatabaseSync> {
  if (
    existsSync(cachePath) &&
    statSync(cachePath).mtimeMs > statSync(dumpPath).mtimeMs
  ) {
    return new DatabaseSync(cachePath);
  }
  mkdirSync(path.dirname(cachePath), { recursive: true });
  rmSync(cachePath, { force: true });
  const db = new DatabaseSync(cachePath);
  db.exec("pragma journal_mode = off; pragma synchronous = off;");
  const created = new Set<string>();

  const stream = createReadStream(dumpPath);
  const input = dumpPath.endsWith(".gz") ? stream.pipe(createGunzip()) : stream;
  const lines = createInterface({ input, crlfDelay: Infinity });

  let statement: string[] | null = null;
  let inString = false;
  db.exec("begin");
  for await (const line of lines) {
    if (!statement) {
      if (!line.startsWith("INSERT INTO `")) continue;
      statement = [];
    }
    statement.push(line);
    inString = scanQuotes(line, inString);
    if (inString || !line.trimEnd().endsWith(";")) continue;

    const sql = statement.join("\n");
    statement = null;
    const head = INSERT_HEAD.exec(sql);
    if (!head) continue;
    const table = head[1];
    const cols = head[2].split(",").map((c) => c.trim().replace(/`/g, ""));
    if (!created.has(table)) {
      db.exec(
        `create table "${table}" (${cols.map((c) => `"${c}" text`).join(", ")})`,
      );
      created.add(table);
    }
    const insert = db.prepare(
      `insert into "${table}" values (${cols.map(() => "?").join(", ")})`,
    );
    for (const row of parseRows(sql, head[0].length)) insert.run(...row);
  }
  db.exec("commit");
  return db;
}
