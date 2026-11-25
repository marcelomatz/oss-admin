/**
 * Layer 1 — Pure Deterministic Analytics & Classification Engine
 * Every metric is computed strictly from real GitHub API release & repository records.
 * Zero random numbers, zero fabricated baselines, zero placeholders.
 */
import {
  ComputedAnalyticsSummary,
  OsPlatform,
  PackageKind,
  PlatformCoverageStatus,
  ProjectTelemetry,
  ReleaseAssetItem,
  ReleaseRecord,
  ShareSlice,
  UiLocale,
} from "./models";
import { trText } from "./i18n";

export const TRACKED_OSS_REPOS = [
  "marcelomatz/writtt",
  "marcelomatz/myterm",
  "marcelomatz/bycode-releases",
  "marcelomatz/Heapi",
] as const;

export const PRODUCT_DISPLAY_META: Record<
  string,
  {
    displayName: string;
    shortCode: string;
    productId: "writtt" | "myterm" | "bycode" | "heapi";
    icon: string;
    accent: string;
    badgePt: string;
    badgeEn: string;
    badgeEs: string;
    descPt: string;
    descEn: string;
    descEs: string;
    officialUrl: string;
  }
> = {
  "marcelomatz/writtt": {
    displayName: "Writtt",
    shortCode: "WT",
    productId: "writtt",
    icon: "feather",
    accent: "#3b82f6",
    badgePt: "Estúdio Editorial & Cofre Local",
    badgeEn: "Editorial Studio & Local Vault",
    badgeEs: "Estudio Editorial y Bóveda Local",
    descPt:
      "Estúdio de escrita focado em privacidade total, cofre criptografado offline no computador e assistente de IA local sem servidores externos.",
    descEn:
      "Privacy-first desktop writing studio with an offline encrypted local vault and optional local AI assistant with zero external servers.",
    descEs:
      "Estudio de escritura enfocado en privacidad total, bóveda cifrada offline en su equipo y asistente de IA local sin servidores externos.",
    officialUrl: "https://www.writtt.com/",
  },
  "marcelomatz/myterm": {
    displayName: "MyTerm",
    shortCode: "MT",
    productId: "myterm",
    icon: "terminal",
    accent: "#10b981",
    badgePt: "Terminal GPU & SSH Manager",
    badgeEn: "GPU Terminal & SSH Manager",
    badgeEs: "Terminal GPU y Gestor SSH",
    descPt:
      "Emulador de terminal acelerado por GPU, multiplexador de abas/painéis e gerenciador nativo de conexões SSH e túneis seguros.",
    descEn:
      "GPU-accelerated terminal emulator, split-pane workspace multiplexer, and native SSH session & tunnel manager.",
    descEs:
      "Emulador de terminal acelerado por GPU, multiplexador de pestañas/paneles y gestor nativo de sesiones y túneles SSH.",
    officialUrl: "https://myterm.marcelomatz.com.br/",
  },
  "marcelomatz/bycode-releases": {
    displayName: "ByCode",
    shortCode: "BC",
    productId: "bycode",
    icon: "code",
    accent: "#8b5cf6",
    badgePt: "Ambiente MDE / IDE Nativo",
    badgeEn: "Native MDE / IDE Workspace",
    badgeEs: "Entorno MDE / IDE Nativo",
    descPt:
      "Ambiente de desenvolvimento modular nativo de alta performance em Go e Wails, com edição de código ágil, Git integrado e baixo consumo de RAM.",
    descEn:
      "High-performance native modular development environment built with Go and Wails, featuring fast code editing, Git integration, and low memory usage.",
    descEs:
      "Entorno de desarrollo modular nativo de alto rendimiento en Go y Wails, con edición ágil, Git integrado y bajo consumo de memoria.",
    officialUrl: "https://bycode.marcelomatz.com.br/",
  },
  "marcelomatz/Heapi": {
    displayName: "Heapi",
    shortCode: "HP",
    productId: "heapi",
    icon: "api",
    accent: "#d946ef",
    badgePt: "Cliente REST, GraphQL & API Studio",
    badgeEn: "REST, GraphQL & API Studio",
    badgeEs: "Cliente REST, GraphQL y API Studio",
    descPt:
      "Cliente nativo de alta performance para inspeção e testes de APIs REST, GraphQL e WebSockets, amigável ao Git e com terminal integrado.",
    descEn:
      "High-performance native client for testing and inspecting REST, GraphQL, and WebSocket APIs, Git-friendly with an integrated terminal.",
    descEs:
      "Cliente nativo de alto rendimiento para pruebas e inspección de APIs REST, GraphQL y WebSockets, amigable con Git y con terminal integrado.",
    officialUrl: "https://heapi.marcelomatz.com.br/",
  },
};

export function classifyAssetOS(assetName: string): OsPlatform {
  const lower = (assetName || "").toLowerCase();
  if (
    lower.endsWith(".exe") ||
    lower.endsWith(".msi") ||
    lower.includes("windows") ||
    lower.includes("win64") ||
    lower.includes("win32")
  ) {
    return "Windows";
  }
  if (
    lower.endsWith(".dmg") ||
    lower.includes("macos") ||
    lower.includes("darwin") ||
    lower.includes("osx") ||
    lower.includes("apple")
  ) {
    return "macOS";
  }
  if (
    lower.endsWith(".appimage") ||
    lower.endsWith(".deb") ||
    lower.endsWith(".rpm") ||
    lower.endsWith(".tar.gz") ||
    lower.endsWith(".tar.xz") ||
    lower.includes("linux")
  ) {
    return "Linux";
  }
  return "Outros";
}

export function classifyPackageKind(assetName: string): PackageKind {
  const lower = (assetName || "").toLowerCase();
  if (
    lower.includes("installer") ||
    lower.includes("setup") ||
    lower.endsWith(".msi") ||
    lower.endsWith(".dmg") ||
    lower.endsWith(".deb") ||
    lower.endsWith(".rpm")
  ) {
    return "installer";
  }
  if (
    lower.endsWith(".zip") ||
    lower.endsWith(".tar.gz") ||
    lower.endsWith(".tar.xz") ||
    lower.endsWith(".7z")
  ) {
    return "archive";
  }
  return "portable";
}

export function getDisplayName(repo: string): string {
  return PRODUCT_DISPLAY_META[repo]?.displayName || repo.split("/")[1] || repo;
}

export function getProductColor(repo: string): string {
  return PRODUCT_DISPLAY_META[repo]?.accent || "#8b5cf6";
}

export function getProductBadge(repo: string, locale: UiLocale): string {
  const meta = PRODUCT_DISPLAY_META[repo];
  if (!meta) return "Open Source";
  return trText(locale, meta.badgePt, meta.badgeEn, meta.badgeEs);
}

export function stripUnicodeEmojis(input: string): string {
  return String(input || "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function getLocalizedProductDescription(
  project: ProjectTelemetry,
  locale: UiLocale
): string {
  const meta = PRODUCT_DISPLAY_META[project.repo];
  if (meta) {
    return trText(locale, meta.descPt, meta.descEn, meta.descEs);
  }
  const cleanRepoDesc = stripUnicodeEmojis(project.info.description);
  return cleanRepoDesc || getProductBadge(project.repo, locale);
}

export function getOfficialSiteUrl(project: ProjectTelemetry): string {
  const meta = PRODUCT_DISPLAY_META[project.repo];
  if (meta?.officialUrl) {
    return meta.officialUrl;
  }
  const raw = (project.info.homepage || "").trim();
  if (raw && /^https?:\/\//i.test(raw) && !/\.vercel\.app/i.test(raw)) {
    return raw;
  }
  return project.info.url;
}

export function cleanSha256Digest(digest: string): string {
  const trimmed = (digest || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/^sha256:/i, "");
}

export function formatBytesHuman(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val >= 100 || idx === 0 ? val.toFixed(0) : val.toFixed(2)} ${units[idx]}`;
}

export function formatShortDate(iso: string, locale: UiLocale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string, locale: UiLocale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildPermanentLatestAssetUrl(repo: string, assetName: string): string {
  return `https://github.com/${repo}/releases/latest/download/${encodeURIComponent(assetName)}`;
}

export function inspectLatestPlatformCoverage(release: ReleaseRecord | undefined): PlatformCoverageStatus {
  const empty: PlatformCoverageStatus = {
    windowsInstaller: null,
    windowsPortable: null,
    macosDmg: null,
    macosZip: null,
    linuxBinary: null,
  };
  if (!release) return empty;

  for (const asset of release.assets) {
    const lower = asset.name.toLowerCase();
    if (asset.os === "Windows") {
      if (asset.kind === "installer" && !empty.windowsInstaller) empty.windowsInstaller = asset;
      else if (asset.kind !== "installer" && !empty.windowsPortable) empty.windowsPortable = asset;
    } else if (asset.os === "macOS") {
      if (lower.endsWith(".dmg") && !empty.macosDmg) empty.macosDmg = asset;
      else if (!empty.macosZip) empty.macosZip = asset;
    } else if (asset.os === "Linux" && !empty.linuxBinary) {
      empty.linuxBinary = asset;
    }
  }
  return empty;
}

export function countCoveredPlatformSlots(cov: PlatformCoverageStatus): number {
  let count = 0;
  if (cov.windowsInstaller) count++;
  if (cov.windowsPortable) count++;
  if (cov.macosDmg) count++;
  if (cov.macosZip) count++;
  if (cov.linuxBinary) count++;
  return count;
}

const OS_COLORS: Record<OsPlatform, string> = {
  Windows: "#3b82f6",
  macOS: "#f59e0b",
  Linux: "#10b981",
  Outros: "#94a3b8",
};

const KIND_COLORS: Record<PackageKind, string> = {
  installer: "#8b5cf6",
  portable: "#06b6d4",
  archive: "#ec4899",
};

export function computeRealAnalytics(
  projects: ProjectTelemetry[],
  selectedRepo: string | null,
  locale: UiLocale
): ComputedAnalyticsSummary {
  const scoped = selectedRepo ? projects.filter((p) => p.repo === selectedRepo) : projects;

  let totalDownloads = 0;
  let totalBytesTransferred = 0;
  let totalReleases = 0;
  let stableReleaseCount = 0;
  let prereleaseCount = 0;
  let totalAssetsPublished = 0;
  let verifiedDigestAssetsCount = 0;
  let totalStars = 0;
  let totalForks = 0;
  let totalOpenIssues = 0;
  let totalWatchers = 0;

  let latestRelease: ComputedAnalyticsSummary["latestRelease"] = null;
  let topAsset: ComputedAnalyticsSummary["topAsset"] = null;

  const osTotals = new Map<OsPlatform, { count: number; assetsCount: number; bytes: number }>();
  const kindTotals = new Map<PackageKind, { count: number; assetsCount: number; bytes: number }>();

  const flatReleasesChrono: Array<{
    project: string;
    shortCode: string;
    repo: string;
    release: ReleaseRecord;
    ts: number;
  }> = [];

  const cadenceDeltasDays: number[] = [];

  for (const proj of scoped) {
    totalDownloads += proj.totalDownloads;
    totalBytesTransferred += proj.totalBytesTransferred;
    totalReleases += proj.releases.length;
    totalStars += proj.info.stars;
    totalForks += proj.info.forks;
    totalOpenIssues += proj.info.openIssues;
    totalWatchers += proj.info.watchers;

    const repoTimestamps: number[] = [];
    const shortCode = PRODUCT_DISPLAY_META[proj.repo]?.shortCode || getDisplayName(proj.repo).slice(0, 2).toUpperCase();

    for (const rel of proj.releases) {
      if (rel.prerelease) prereleaseCount++;
      else stableReleaseCount++;

      totalAssetsPublished += rel.assets.length;
      const ts = Date.parse(rel.publishedAt) || 0;
      if (ts > 0) repoTimestamps.push(ts);

      flatReleasesChrono.push({
        project: getDisplayName(proj.repo),
        shortCode,
        repo: proj.repo,
        release: rel,
        ts,
      });

      if (!latestRelease || ts > (Date.parse(latestRelease.publishedAt) || 0)) {
        latestRelease = {
          project: getDisplayName(proj.repo),
          repo: proj.repo,
          tag: rel.tag,
          publishedAt: rel.publishedAt,
          downloads: rel.totalDownloads,
          url: rel.url,
        };
      }

      for (const asset of rel.assets) {
        if (cleanSha256Digest(asset.digest)) {
          verifiedDigestAssetsCount++;
        }

        const prevOs = osTotals.get(asset.os) || { count: 0, assetsCount: 0, bytes: 0 };
        prevOs.count += asset.downloads;
        prevOs.assetsCount += 1;
        prevOs.bytes += asset.downloads * asset.sizeBytes;
        osTotals.set(asset.os, prevOs);

        const prevKind = kindTotals.get(asset.kind) || { count: 0, assetsCount: 0, bytes: 0 };
        prevKind.count += asset.downloads;
        prevKind.assetsCount += 1;
        prevKind.bytes += asset.downloads * asset.sizeBytes;
        kindTotals.set(asset.kind, prevKind);

        if (!topAsset || asset.downloads > topAsset.asset.downloads) {
          topAsset = {
            project: getDisplayName(proj.repo),
            repo: proj.repo,
            tag: rel.tag,
            asset,
          };
        }
      }
    }

    if (repoTimestamps.length >= 2) {
      repoTimestamps.sort((a, b) => a - b);
      for (let i = 1; i < repoTimestamps.length; i++) {
        const days = (repoTimestamps[i] - repoTimestamps[i - 1]) / (1000 * 60 * 60 * 24);
        if (days >= 0) cadenceDeltasDays.push(days);
      }
    }
  }

  flatReleasesChrono.sort((a, b) => a.ts - b.ts);

  const averageReleaseCadenceDays =
    cadenceDeltasDays.length > 0
      ? Number((cadenceDeltasDays.reduce((s, d) => s + d, 0) / cadenceDeltasDays.length).toFixed(1))
      : null;

  const osSublabels: Record<OsPlatform, string> = {
    Windows: "x64 (.exe)",
    macOS: "Universal (.dmg / .zip)",
    Linux: "x64 (.tar.gz / bin)",
    Outros: "Extra",
  };

  const osOrder: OsPlatform[] = ["Windows", "macOS", "Linux", "Outros"];
  const osBreakdown: ShareSlice[] = osOrder
    .map((os) => {
      const entry = osTotals.get(os) || { count: 0, assetsCount: 0, bytes: 0 };
      return {
        key: os,
        label: os === "Outros" ? trText(locale, "Outros", "Other", "Otros") : os,
        sublabel: osSublabels[os],
        count: entry.count,
        assetsCount: entry.assetsCount,
        bytesTransferred: entry.bytes,
        percentage: totalDownloads > 0 ? (entry.count / totalDownloads) * 100 : 0,
        color: OS_COLORS[os],
      };
    })
    .filter((s) => s.count > 0 || s.assetsCount > 0);

  // Concise labels prevent wrapping in Donut legends and stat cards
  const kindLabels: Record<PackageKind, string> = {
    installer: trText(locale, "Instaladores", "Installers", "Instaladores"),
    portable: trText(locale, "Portáteis", "Portable", "Portátiles"),
    archive: trText(locale, "Compactados", "Archives", "Comprimidos"),
  };

  const kindSublabels: Record<PackageKind, string> = {
    installer: ".exe · .dmg",
    portable: trText(locale, "Executável direto", "Direct binary", "Ejecutable directo"),
    archive: ".zip · .tar.gz",
  };

  const kindOrder: PackageKind[] = ["installer", "portable", "archive"];
  const kindBreakdown: ShareSlice[] = kindOrder
    .map((kind) => {
      const entry = kindTotals.get(kind) || { count: 0, assetsCount: 0, bytes: 0 };
      return {
        key: kind,
        label: kindLabels[kind],
        sublabel: kindSublabels[kind],
        count: entry.count,
        assetsCount: entry.assetsCount,
        bytesTransferred: entry.bytes,
        percentage: totalDownloads > 0 ? (entry.count / totalDownloads) * 100 : 0,
        color: KIND_COLORS[kind],
      };
    })
    .filter((s) => s.count > 0 || s.assetsCount > 0);

  // Odd slice count (11) ensures X-axis even-index ticks (0,2,4,6,8,10) never overlap at the tail
  const recentChrono = flatReleasesChrono.slice(-11);
  const chronologicalSeries = {
    labels: recentChrono.map((r) =>
      selectedRepo ? r.release.tag : `${r.shortCode} ${r.release.tag}`
    ),
    downloads: recentChrono.map((r) => r.release.totalDownloads),
    megabytesDelivered: recentChrono.map((r) =>
      Number((r.release.totalBytesTransferred / (1024 * 1024)).toFixed(1))
    ),
  };

  const binarySizeSeries = {
    labels: recentChrono.map((r) =>
      selectedRepo ? r.release.tag : `${r.shortCode} ${r.release.tag}`
    ),
    windowsInstallerMb: recentChrono.map((r) => {
      const cov = inspectLatestPlatformCoverage(r.release);
      const target = cov.windowsInstaller || cov.windowsPortable;
      return target ? Number((target.sizeBytes / (1024 * 1024)).toFixed(2)) : 0;
    }),
    macosMb: recentChrono.map((r) => {
      const cov = inspectLatestPlatformCoverage(r.release);
      const target = cov.macosDmg || cov.macosZip;
      return target ? Number((target.sizeBytes / (1024 * 1024)).toFixed(2)) : 0;
    }),
    linuxMb: recentChrono.map((r) => {
      const cov = inspectLatestPlatformCoverage(r.release);
      return cov.linuxBinary ? Number((cov.linuxBinary.sizeBytes / (1024 * 1024)).toFixed(2)) : 0;
    }),
  };

  return {
    totalDownloads,
    totalBytesTransferred,
    totalReleases,
    stableReleaseCount,
    prereleaseCount,
    totalAssetsPublished,
    verifiedDigestAssetsCount,
    totalStars,
    totalForks,
    totalOpenIssues,
    totalWatchers,
    averageDownloadsPerRelease:
      totalReleases > 0 ? Number((totalDownloads / totalReleases).toFixed(1)) : 0,
    averageReleaseCadenceDays,
    latestRelease,
    topAsset,
    osBreakdown,
    kindBreakdown,
    chronologicalSeries,
    binarySizeSeries,
  };
}
