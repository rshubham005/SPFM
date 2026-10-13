// Mock SPFM API for frontend development (no database, no auth checks).
// Implements docs/API-CONTRACT.md so the frontend can run in API mode
// before the ASP.NET Core endpoints exist.
//
//   npm run mock-api            -> http://localhost:5199
//   NEXT_PUBLIC_DATA_MODE=api NEXT_PUBLIC_API_BASE_URL=http://localhost:5199 npm run dev

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 5199);
const projects = new Map();
let counter = 0;

const send = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      try {
        resolve(d ? JSON.parse(d) : {});
      } catch (e) {
        reject(e);
      }
    });
  });

const userFrom = (req) => (req.headers.authorization ? "Signed-in user (token received)" : "Mock user (no token)");

function simpleDiff(before, after) {
  const changes = [];
  for (const k of ["name", "client", "siteAddress", "status"])
    if (before[k] !== after[k]) changes.push({ field: k, from: String(before[k]), to: String(after[k]) });
  for (const k of Object.keys(after.inputs))
    if (k !== "products" && before.inputs[k] !== after.inputs[k])
      changes.push({ field: k, from: String(before.inputs[k]), to: String(after.inputs[k]) });
  if (JSON.stringify(before.inputs.products) !== JSON.stringify(after.inputs.products))
    changes.push({ field: "products", from: `${before.inputs.products.length} lines`, to: `${after.inputs.products.length} lines` });
  return changes;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean); // ["api","projects",":id"]
  console.log(req.method, url.pathname, req.headers.authorization ? "(bearer token)" : "(no token)");
  if (req.method === "OPTIONS") return send(res, 204);

  try {
    if (req.method === "GET" && url.pathname === "/api/users/me") {
      return send(res, 200, { name: userFrom(req), email: "mock@example.com" });
    }
    if (parts[0] === "api" && parts[1] === "projects") {
      const id = parts[2];
      if (req.method === "GET" && !id) return send(res, 200, [...projects.values()]);
      if (req.method === "GET" && id) {
        const p = projects.get(id);
        return p ? send(res, 200, p) : send(res, 404, { title: "Project not found." });
      }
      if (req.method === "POST" && !id) {
        const draft = await readBody(req);
        if (!draft.name?.trim() || !draft.client?.trim())
          return send(res, 400, { title: "Project name and client are required." });
        const now = new Date().toISOString();
        const p = {
          ...draft,
          id: randomUUID(),
          number: `SSD-${new Date().getFullYear()}-${String(++counter).padStart(3, "0")}`,
          quickbooks: { customerId: null, projectId: null, lastSyncedAt: null },
          history: [{ id: randomUUID(), at: now, by: userFrom(req), action: "created", changes: [] }],
          createdAt: now,
          updatedAt: now,
        };
        projects.set(p.id, p);
        return send(res, 201, p);
      }
      if (req.method === "PUT" && id) {
        const old = projects.get(id);
        if (!old) return send(res, 404, { title: "Project not found." });
        const draft = await readBody(req);
        const changes = simpleDiff(old, draft);
        const now = new Date().toISOString();
        const p = {
          ...old,
          ...draft,
          history: changes.length
            ? [{ id: randomUUID(), at: now, by: userFrom(req), action: "updated", changes }, ...old.history]
            : old.history,
          updatedAt: now,
        };
        projects.set(id, p);
        return send(res, 200, p);
      }
    }
    send(res, 404, { title: "Not found." });
  } catch (e) {
    send(res, 400, { title: `Bad request: ${e.message}` });
  }
}).listen(PORT, () => console.log(`Mock SPFM API on http://localhost:${PORT}`));
