// Project repository.
//
// Two modes, chosen by NEXT_PUBLIC_DATA_MODE (see .env.example):
//  - "local" (default): projects are kept in this browser, with sample data,
//    so the full create → calculate → save → reopen loop works without a backend.
//  - "api": the ASP.NET Core Project API (docs/API-CONTRACT.md), called with
//    the signed-in user's Entra access token. The API records change history.

import { apiFetch } from "./api";
import { config } from "./config";
import { diffProjects } from "./history";
import { seedProjects } from "./seed";
import type { HistoryEntry, Project, ProjectInputs, ProjectStatus } from "./types";

export interface ProjectDraft {
  name: string;
  client: string;
  siteAddress: string;
  status: ProjectStatus;
  inputs: ProjectInputs;
  results: Project["results"];
  calculatedFor: string | null;
  calculatedAt: string | null;
}

const apiMode = () => config.dataMode === "api";

/* ---------- local (browser) storage ---------- */

const KEY = "spfm.projects.v1";

/** Fills fields added after a project was first stored. */
function normalize(p: Partial<Project> & Pick<Project, "id">): Project {
  return {
    ...(p as Project),
    quickbooks: p.quickbooks ?? { customerId: null, projectId: null, lastSyncedAt: null },
    history: p.history ?? [],
  };
}

function readAll(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return (JSON.parse(raw) as Project[]).map(normalize);
  } catch {
    /* storage unavailable or corrupt: fall back to sample data */
  }
  const seeded = seedProjects();
  writeAll(seeded);
  return seeded;
}

function writeAll(projects: Project[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(projects));
  } catch {
    /* ignore: preview only */
  }
}

function nextNumber(all: Project[]): string {
  const year = new Date().getFullYear();
  const prefix = `SSD-${year}-`;
  const max = all
    .filter((p) => p.number.startsWith(prefix))
    .reduce((m, p) => Math.max(m, Number(p.number.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

const entry = (by: string, action: HistoryEntry["action"], changes: HistoryEntry["changes"]): HistoryEntry => ({
  id: crypto.randomUUID(),
  at: new Date().toISOString(),
  by,
  action,
  changes,
});

/* ---------- public API (same signatures in both modes) ---------- */

export async function listProjects(): Promise<Project[]> {
  const all = apiMode() ? (await apiFetch<Project[]>("/api/projects")).map(normalize) : readAll();
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string): Promise<Project | null> {
  if (apiMode()) {
    try {
      return normalize(await apiFetch<Project>(`/api/projects/${encodeURIComponent(id)}`));
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  }
  return readAll().find((p) => p.id === id) ?? null;
}

export async function createProject(draft: ProjectDraft, by: string): Promise<Project> {
  if (apiMode()) {
    return normalize(await apiFetch<Project>("/api/projects", { method: "POST", body: JSON.stringify(draft) }));
  }
  const all = readAll();
  const now = new Date().toISOString();
  const project: Project = {
    ...draft,
    id: crypto.randomUUID(),
    number: nextNumber(all),
    quickbooks: { customerId: null, projectId: null, lastSyncedAt: null },
    history: [entry(by, "created", [])],
    createdAt: now,
    updatedAt: now,
  };
  writeAll([...all, project]);
  return project;
}

export async function updateProject(id: string, draft: ProjectDraft, by: string): Promise<Project> {
  if (apiMode()) {
    return normalize(
      await apiFetch<Project>(`/api/projects/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(draft) }),
    );
  }
  const all = readAll();
  const i = all.findIndex((p) => p.id === id);
  if (i < 0) throw new Error("This project no longer exists.");
  const changes = diffProjects(all[i], draft);
  const updated: Project = {
    ...all[i],
    ...draft,
    history: changes.length ? [entry(by, "updated", changes), ...all[i].history] : all[i].history,
    updatedAt: changes.length ? new Date().toISOString() : all[i].updatedAt,
  };
  all[i] = updated;
  writeAll(all);
  return updated;
}

export async function resetSampleData(): Promise<void> {
  writeAll(seedProjects());
}

export function emptyInputs(): ProjectInputs {
  return {
    products: [{ id: crypto.randomUUID(), description: "", qty: 1, unitCost: 0, unitPrice: 0, qbItemId: null }],
    variations: 0,
    labourHours: 0,
    labourRate: 0,
    subcontractorCost: 0,
    otherDirectCost: 0,
    overheadPct: 0,
  };
}
