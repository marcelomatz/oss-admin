/**
 * Layer 2 — Application State, Filtering, Sorting & Export Formatting
 * Pure business orchestration over Layer 1 domain entities. Zero DOM or network calls.
 */
import {
  cleanSha256Digest,
  getDisplayName,
  OsPlatform,
  PackageKind,
  ProjectTelemetry,
  ReleaseAssetItem,
  ReleaseRecord,
  TelemetrySnapshot,
  UiLocale,
} from "../domain";

export type ReleaseSortField = "date" | "downloads" | "bytes" | "size";

export interface DashboardViewState {
  selectedRepo: string | null;
  osFilter: "ALL" | OsPlatform;
  kindFilter: "ALL" | PackageKind;
  searchQuery: string;
  sortBy: ReleaseSortField;
  expandedReleaseIds: Set<number>;
  locale: UiLocale;
  theme: "dark" | "light";
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  toastMessage: string | null;
  snapshot: TelemetrySnapshot | null;
}

export interface FilteredReleaseEntry {
  repo: string;
  projectDisplayName: string;
  release: ReleaseRecord;
  matchingAssets: ReleaseAssetItem[];
  largestAssetBytes: number;
}

export function createInitialDashboardState(
  savedLocale: UiLocale,
  savedTheme: "dark" | "light"
): DashboardViewState {
  return {
    selectedRepo: null,
    osFilter: "ALL",
    kindFilter: "ALL",
    searchQuery: "",
    sortBy: "date",
    expandedReleaseIds: new Set<number>(),
    locale: savedLocale,
    theme: savedTheme,
    loading: true,
    refreshing: false,
    error: null,
    toastMessage: null,
    snapshot: null,
  };
}

export function selectFilteredReleases(state: DashboardViewState): FilteredReleaseEntry[] {
  if (!state.snapshot) return [];
  const query = state.searchQuery.trim().toLowerCase();
  const scopedProjects = state.selectedRepo
    ? state.snapshot.projects.filter((p) => p.repo === state.selectedRepo)
    : state.snapshot.projects;

  const entries: FilteredReleaseEntry[] = [];

  for (const proj of scopedProjects) {
    const projectDisplayName = getDisplayName(proj.repo);
    for (const rel of proj.releases) {
      const releaseMatchesText =
        !query ||
        rel.tag.toLowerCase().includes(query) ||
        rel.name.toLowerCase().includes(query) ||
        projectDisplayName.toLowerCase().includes(query) ||
        rel.author.toLowerCase().includes(query);

      const matchingAssets = rel.assets.filter((asset) => {
        if (state.osFilter !== "ALL" && asset.os !== state.osFilter) return false;
        if (state.kindFilter !== "ALL" && asset.kind !== state.kindFilter) return false;
        if (!query) return true;
        return (
          releaseMatchesText ||
          asset.name.toLowerCase().includes(query) ||
          cleanSha256Digest(asset.digest).toLowerCase().includes(query)
        );
      });

      // Keep empty-asset releases visible when no OS/kind filter is active and text matches
      const includeWithoutAssets =
        rel.assets.length === 0 &&
        state.osFilter === "ALL" &&
        state.kindFilter === "ALL" &&
        releaseMatchesText;

      if (matchingAssets.length > 0 || includeWithoutAssets) {
        const largestAssetBytes = matchingAssets.reduce(
          (max, a) => (a.sizeBytes > max ? a.sizeBytes : max),
          0
        );
        entries.push({
          repo: proj.repo,
          projectDisplayName,
          release: rel,
          matchingAssets,
          largestAssetBytes,
        });
      }
    }
  }

  entries.sort((a, b) => {
    if (state.sortBy === "downloads") {
      return b.release.totalDownloads - a.release.totalDownloads;
    }
    if (state.sortBy === "bytes") {
      return b.release.totalBytesTransferred - a.release.totalBytesTransferred;
    }
    if (state.sortBy === "size") {
      return b.largestAssetBytes - a.largestAssetBytes;
    }
    const tsA = Date.parse(a.release.publishedAt) || 0;
    const tsB = Date.parse(b.release.publishedAt) || 0;
    return tsB - tsA;
  });

  return entries;
}

export function buildTelemetryCsv(projects: ProjectTelemetry[]): string {
  const escCsv = (val: string | number | boolean): string => {
    const str = String(val ?? "");
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = [
    "software",
    "repository",
    "tag",
    "release_name",
    "published_at",
    "prerelease",
    "asset_name",
    "os",
    "package_kind",
    "size_bytes",
    "downloads",
    "bytes_transferred",
    "sha256",
    "download_url",
  ];

  const rows: string[] = [headers.join(",")];

  for (const proj of projects) {
    const software = getDisplayName(proj.repo);
    for (const rel of proj.releases) {
      if (rel.assets.length === 0) {
        rows.push(
          [
            software,
            proj.repo,
            rel.tag,
            rel.name,
            rel.publishedAt,
            rel.prerelease,
            "",
            "",
            "",
            0,
            0,
            0,
            "",
            rel.url,
          ]
            .map(escCsv)
            .join(",")
        );
        continue;
      }
      for (const asset of rel.assets) {
        rows.push(
          [
            software,
            proj.repo,
            rel.tag,
            rel.name,
            rel.publishedAt,
            rel.prerelease,
            asset.name,
            asset.os,
            asset.kind,
            asset.sizeBytes,
            asset.downloads,
            asset.downloads * asset.sizeBytes,
            cleanSha256Digest(asset.digest),
            asset.downloadUrl,
          ]
            .map(escCsv)
            .join(",")
        );
      }
    }
  }

  return rows.join("\n");
}

function escapeHtmlSafe(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatInlineReleaseCode(escapedLine: string): string {
  return escapedLine
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="oss-inline-code">$1</code>');
}

/**
 * Safe, deterministic Markdown-to-HTML renderer for GitHub Release Notes (`body`).
 * Escapes all HTML entities first to eliminate XSS while rendering headings and lists cleanly.
 */
export function renderSafeReleaseNotesHtml(markdown: string): string {
  const trimmed = (markdown || "").trim();
  if (!trimmed) return "";

  const lines = trimmed.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    const escaped = escapeHtmlSafe(line);

    if (escaped.startsWith("### ")) {
      closeList();
      out.push(`<h4>${formatInlineReleaseCode(escaped.slice(4))}</h4>`);
    } else if (escaped.startsWith("## ")) {
      closeList();
      out.push(`<h3>${formatInlineReleaseCode(escaped.slice(3))}</h3>`);
    } else if (escaped.startsWith("# ")) {
      closeList();
      out.push(`<h3>${formatInlineReleaseCode(escaped.slice(2))}</h3>`);
    } else if (escaped.startsWith("- ") || escaped.startsWith("* ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${formatInlineReleaseCode(escaped.slice(2))}</li>`);
    } else {
      closeList();
      out.push(`<p>${formatInlineReleaseCode(escaped)}</p>`);
    }
  }

  closeList();
  return out.join("");
}
