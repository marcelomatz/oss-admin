/**
 * Layer 1 — Pure Domain Models & Value Contracts (`oss-admin`)
 * Strictly represents real, verifiable GitHub Repository, Release, and Binary Asset data.
 * Zero fake metrics, zero synthetic random streams, zero DOM/HTTP dependencies.
 */

export type OsPlatform = "Windows" | "macOS" | "Linux" | "Outros";

export type PackageKind = "installer" | "portable" | "archive";

export type UiLocale = "pt-BR" | "en-US" | "es-ES";

export interface RepoMetadata {
  name: string;
  fullName: string;
  description: string;
  homepage: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  sizeKb: number;
  language: string;
  license: string;
  defaultBranch: string;
  createdAt: string;
  pushedAt: string;
  url: string;
}

export interface ReleaseAssetItem {
  id: number;
  name: string;
  os: OsPlatform;
  kind: PackageKind;
  sizeBytes: number;
  downloads: number;
  contentType: string;
  digest: string;
  downloadUrl: string;
  updatedAt: string;
}

export interface ReleaseRecord {
  id: number;
  tag: string;
  name: string;
  publishedAt: string;
  prerelease: boolean;
  author: string;
  url: string;
  body: string;
  totalDownloads: number;
  totalBytesTransferred: number;
  assets: ReleaseAssetItem[];
}

export interface ProjectTelemetry {
  repo: string;
  info: RepoMetadata;
  totalDownloads: number;
  totalBytesTransferred: number;
  releases: ReleaseRecord[];
}

export interface TelemetrySnapshot {
  fetchedAt: string;
  source: string;
  rateLimitRemaining: number | null;
  rateLimitLimit: number | null;
  projects: ProjectTelemetry[];
}

export interface ShareSlice {
  key: string;
  label: string;
  count: number;
  assetsCount: number;
  bytesTransferred: number;
  percentage: number;
  color: string;
}

export interface PlatformCoverageStatus {
  windowsInstaller: ReleaseAssetItem | null;
  windowsPortable: ReleaseAssetItem | null;
  macosDmg: ReleaseAssetItem | null;
  macosZip: ReleaseAssetItem | null;
  linuxBinary: ReleaseAssetItem | null;
}

export interface ComputedAnalyticsSummary {
  totalDownloads: number;
  totalBytesTransferred: number;
  totalReleases: number;
  stableReleaseCount: number;
  prereleaseCount: number;
  totalAssetsPublished: number;
  verifiedDigestAssetsCount: number;
  totalStars: number;
  totalForks: number;
  totalOpenIssues: number;
  totalWatchers: number;
  averageDownloadsPerRelease: number;
  averageReleaseCadenceDays: number | null;
  latestRelease: { project: string; repo: string; tag: string; publishedAt: string; downloads: number; url: string } | null;
  topAsset: { project: string; repo: string; tag: string; asset: ReleaseAssetItem } | null;
  osBreakdown: ShareSlice[];
  kindBreakdown: ShareSlice[];
  chronologicalSeries: {
    labels: string[];
    downloads: number[];
    megabytesDelivered: number[];
  };
  binarySizeSeries: {
    labels: string[];
    windowsInstallerMb: number[];
    macosMb: number[];
    linuxMb: number[];
  };
}
