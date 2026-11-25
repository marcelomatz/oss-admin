/**
 * Layer 3 — GitHub & Backend Telemetry Adapter
 * Queries `/api/oss/stats` (Vercel Serverless or Go standalone server) first,
 * and falls back seamlessly to direct GitHub REST API v3 calls with client-side caching.
 */
import {
  classifyAssetOS,
  classifyPackageKind,
  ProjectTelemetry,
  ReleaseAssetItem,
  ReleaseRecord,
  RepoMetadata,
  TelemetrySnapshot,
  TRACKED_OSS_REPOS,
} from "../domain";

const STORAGE_CACHE_KEY = "oss-admin:telemetry-snapshot:v2.1";
const CLIENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CachedEnvelope {
  savedAt: number;
  snapshot: TelemetrySnapshot;
}

function readCachedSnapshot(): TelemetrySnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEnvelope;
    if (!parsed?.snapshot?.projects || !Array.isArray(parsed.snapshot.projects)) {
      return null;
    }
    if (Date.now() - parsed.savedAt > CLIENT_CACHE_TTL_MS) {
      return null;
    }
    return parsed.snapshot;
  } catch {
    return null;
  }
}

function writeCachedSnapshot(snapshot: TelemetrySnapshot): void {
  try {
    const envelope: CachedEnvelope = {
      savedAt: Date.now(),
      snapshot,
    };
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // ignore storage quota errors
  }
}

async function fetchDirectFromGitHub(): Promise<TelemetrySnapshot> {
  let rateLimitRemaining: number | null = null;
  let rateLimitLimit: number | null = null;

  const ghGet = async (url: string): Promise<unknown> => {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(12000),
    });
    const rem = res.headers.get("x-ratelimit-remaining");
    const lim = res.headers.get("x-ratelimit-limit");
    if (rem !== null) rateLimitRemaining = Number(rem);
    if (lim !== null) rateLimitLimit = Number(lim);
    if (!res.ok) {
      throw new Error(`GitHub API HTTP ${res.status}`);
    }
    return res.json();
  };

  const projects: ProjectTelemetry[] = await Promise.all(
    TRACKED_OSS_REPOS.map(async (repo) => {
      const fallbackName = repo.split("/")[1] || repo;
      let info: RepoMetadata = {
        name: fallbackName,
        fullName: repo,
        description: "",
        homepage: "",
        stars: 0,
        forks: 0,
        watchers: 0,
        openIssues: 0,
        sizeKb: 0,
        language: "",
        license: "",
        defaultBranch: "main",
        createdAt: "",
        pushedAt: "",
        url: `https://github.com/${repo}`,
      };

      const rData = (await ghGet(`https://api.github.com/repos/${repo}`)) as Record<string, unknown>;
      const licenseObj = rData.license as { spdx_id?: string } | null;
      info = {
        name: String(rData.name || fallbackName),
        fullName: String(rData.full_name || repo),
        description: String(rData.description || ""),
        homepage: String(rData.homepage || ""),
        stars: Number(rData.stargazers_count || 0),
        forks: Number(rData.forks_count || 0),
        watchers: Number(rData.subscribers_count ?? rData.watchers_count ?? 0),
        openIssues: Number(rData.open_issues_count || 0),
        sizeKb: Number(rData.size || 0),
        language: String(rData.language || ""),
        license:
          licenseObj?.spdx_id && licenseObj.spdx_id !== "NOASSERTION"
            ? String(licenseObj.spdx_id)
            : "",
        defaultBranch: String(rData.default_branch || "main"),
        createdAt: String(rData.created_at || ""),
        pushedAt: String(rData.pushed_at || ""),
        url: String(rData.html_url || `https://github.com/${repo}`),
      };

      const rawReleases = (await ghGet(
        `https://api.github.com/repos/${repo}/releases?per_page=100`
      )) as Array<Record<string, unknown>>;

      const releases: ReleaseRecord[] = [];
      for (const rel of rawReleases) {
        if (rel.draft) continue;
        const rawAssets = Array.isArray(rel.assets)
          ? (rel.assets as Array<Record<string, unknown>>)
          : [];
        const assets: ReleaseAssetItem[] = rawAssets.map((a) => {
          const name = String(a.name || "");
          return {
            id: Number(a.id || 0),
            name,
            os: classifyAssetOS(name),
            kind: classifyPackageKind(name),
            sizeBytes: Number(a.size || 0),
            downloads: Number(a.download_count || 0),
            contentType: String(a.content_type || ""),
            digest: a.digest ? String(a.digest) : "",
            downloadUrl: String(a.browser_download_url || ""),
            updatedAt: String(a.updated_at || a.created_at || ""),
          };
        });

        const totalDownloads = assets.reduce((s, x) => s + x.downloads, 0);
        const totalBytesTransferred = assets.reduce(
          (s, x) => s + x.downloads * x.sizeBytes,
          0
        );
        const authorObj = rel.author as { login?: string } | null;

        releases.push({
          id: Number(rel.id || 0),
          tag: String(rel.tag_name || ""),
          name: String(rel.name || rel.tag_name || ""),
          publishedAt: String(rel.published_at || rel.created_at || ""),
          prerelease: Boolean(rel.prerelease),
          author: String(authorObj?.login || "marcelomatz"),
          url: String(rel.html_url || ""),
          body: String(rel.body || ""),
          totalDownloads,
          totalBytesTransferred,
          assets,
        });
      }

      return {
        repo,
        info,
        totalDownloads: releases.reduce((s, r) => s + r.totalDownloads, 0),
        totalBytesTransferred: releases.reduce((s, r) => s + r.totalBytesTransferred, 0),
        releases,
      };
    })
  );

  return {
    fetchedAt: new Date().toISOString(),
    source: "github-rest-direct",
    rateLimitRemaining,
    rateLimitLimit,
    projects,
  };
}

export async function loadTelemetrySnapshot(forceRefresh = false): Promise<TelemetrySnapshot> {
  if (!forceRefresh) {
    const cached = readCachedSnapshot();
    if (cached) return cached;
  }

  try {
    const endpoint = forceRefresh ? "/api/oss/stats?refresh=1" : "/api/oss/stats";
    const res = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(14000),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const payload = (await res.json()) as TelemetrySnapshot;
      if (Array.isArray(payload?.projects) && payload.projects.length > 0) {
        writeCachedSnapshot(payload);
        return payload;
      }
    }
  } catch {
    // Fall back cleanly to direct GitHub REST API calls (e.g. local Vite dev server)
  }

  const direct = await fetchDirectFromGitHub();
  writeCachedSnapshot(direct);
  return direct;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      return true;
    } catch {
      return false;
    }
  }
}

export function triggerTextFileDownload(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
