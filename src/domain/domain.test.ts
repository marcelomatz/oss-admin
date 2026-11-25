import { describe, expect, it } from "vitest";
import {
  buildPermanentLatestAssetUrl,
  classifyAssetOS,
  classifyPackageKind,
  cleanSha256Digest,
  computeRealAnalytics,
  countCoveredPlatformSlots,
  formatBytesHuman,
  getOfficialSiteUrl,
  inspectLatestPlatformCoverage,
  normalizeUiLocale,
  ProjectTelemetry,
} from "./index";

describe("Layer 1 — Pure Deterministic Analytics Engine", () => {
  it("classifies real desktop release binaries by OS and package format", () => {
    expect(classifyAssetOS("writtt-windows-amd64-installer.exe")).toBe("Windows");
    expect(classifyPackageKind("writtt-windows-amd64-installer.exe")).toBe("installer");

    expect(classifyAssetOS("writtt-windows-amd64.exe")).toBe("Windows");
    expect(classifyPackageKind("writtt-windows-amd64.exe")).toBe("portable");

    expect(classifyAssetOS("writtt-macos-universal.dmg")).toBe("macOS");
    expect(classifyPackageKind("writtt-macos-universal.dmg")).toBe("installer");

    expect(classifyAssetOS("writtt-macos-universal.zip")).toBe("macOS");
    expect(classifyPackageKind("writtt-macos-universal.zip")).toBe("archive");

    expect(classifyAssetOS("writtt-linux-amd64.tar.gz")).toBe("Linux");
    expect(classifyPackageKind("writtt-linux-amd64.tar.gz")).toBe("archive");

    expect(classifyAssetOS("byCode-linux-amd64")).toBe("Linux");
    expect(classifyPackageKind("byCode-linux-amd64")).toBe("portable");
  });

  it("preserves zero-download newly published binaries in platform coverage and asset counts", () => {
    const sampleProject: ProjectTelemetry = {
      repo: "marcelomatz/writtt",
      info: {
        name: "writtt",
        fullName: "marcelomatz/writtt",
        description: "Estúdio editorial offline",
        homepage: "https://www.writtt.com",
        stars: 12,
        forks: 2,
        watchers: 4,
        openIssues: 1,
        sizeKb: 4200,
        language: "Go",
        license: "MIT",
        defaultBranch: "master",
        createdAt: "2026-01-01T00:00:00Z",
        pushedAt: "2026-11-25T12:00:00Z",
        url: "https://github.com/marcelomatz/writtt",
      },
      totalDownloads: 100,
      totalBytesTransferred: 100 * 10 * 1024 * 1024,
      releases: [
        {
          id: 2,
          tag: "v0.2.0",
          name: "Writtt v0.2.0",
          publishedAt: "2026-11-25T10:00:00Z",
          prerelease: false,
          author: "marcelomatz",
          url: "https://github.com/marcelomatz/writtt/releases/tag/v0.2.0",
          body: "## Novidades",
          totalDownloads: 0,
          totalBytesTransferred: 0,
          assets: [
            {
              id: 201,
              name: "writtt-windows-amd64-installer.exe",
              os: "Windows",
              kind: "installer",
              sizeBytes: 12 * 1024 * 1024,
              downloads: 0,
              contentType: "application/octet-stream",
              digest: "sha256:abcdef1234567890",
              downloadUrl: "https://github.com/marcelomatz/writtt/releases/download/v0.2.0/writtt-windows-amd64-installer.exe",
              updatedAt: "2026-11-25T10:00:00Z",
            },
            {
              id: 202,
              name: "writtt-windows-amd64.exe",
              os: "Windows",
              kind: "portable",
              sizeBytes: 11 * 1024 * 1024,
              downloads: 0,
              contentType: "application/octet-stream",
              digest: "sha256:123456abcdef",
              downloadUrl: "https://github.com/marcelomatz/writtt/releases/download/v0.2.0/writtt-windows-amd64.exe",
              updatedAt: "2026-11-25T10:00:00Z",
            },
            {
              id: 203,
              name: "writtt-macos-universal.dmg",
              os: "macOS",
              kind: "installer",
              sizeBytes: 18 * 1024 * 1024,
              downloads: 0,
              contentType: "application/octet-stream",
              digest: "sha256:99887766",
              downloadUrl: "https://github.com/marcelomatz/writtt/releases/download/v0.2.0/writtt-macos-universal.dmg",
              updatedAt: "2026-11-25T10:00:00Z",
            },
            {
              id: 204,
              name: "writtt-macos-universal.zip",
              os: "macOS",
              kind: "archive",
              sizeBytes: 17 * 1024 * 1024,
              downloads: 0,
              contentType: "application/zip",
              digest: "sha256:55443322",
              downloadUrl: "https://github.com/marcelomatz/writtt/releases/download/v0.2.0/writtt-macos-universal.zip",
              updatedAt: "2026-11-25T10:00:00Z",
            },
            {
              id: 205,
              name: "writtt-linux-amd64.tar.gz",
              os: "Linux",
              kind: "archive",
              sizeBytes: 10 * 1024 * 1024,
              downloads: 0,
              contentType: "application/gzip",
              digest: "sha256:11223344",
              downloadUrl: "https://github.com/marcelomatz/writtt/releases/download/v0.2.0/writtt-linux-amd64.tar.gz",
              updatedAt: "2026-11-25T10:00:00Z",
            },
          ],
        },
        {
          id: 1,
          tag: "v0.1.0",
          name: "Writtt v0.1.0",
          publishedAt: "2026-11-15T10:00:00Z",
          prerelease: false,
          author: "marcelomatz",
          url: "https://github.com/marcelomatz/writtt/releases/tag/v0.1.0",
          body: "## Primeira versão",
          totalDownloads: 100,
          totalBytesTransferred: 100 * 10 * 1024 * 1024,
          assets: [
            {
              id: 101,
              name: "writtt-windows-amd64.exe",
              os: "Windows",
              kind: "portable",
              sizeBytes: 10 * 1024 * 1024,
              downloads: 100,
              contentType: "application/octet-stream",
              digest: "",
              downloadUrl: "https://github.com/marcelomatz/writtt/releases/download/v0.1.0/writtt-windows-amd64.exe",
              updatedAt: "2026-11-15T10:00:00Z",
            },
          ],
        },
      ],
    };

    const cov = inspectLatestPlatformCoverage(sampleProject.releases[0]);
    expect(countCoveredPlatformSlots(cov)).toBe(5);

    const summary = computeRealAnalytics([sampleProject], null, "pt-BR");
    expect(summary.totalDownloads).toBe(100);
    expect(summary.totalReleases).toBe(2);
    expect(summary.totalAssetsPublished).toBe(6);
    expect(summary.verifiedDigestAssetsCount).toBe(5);
    expect(summary.averageDownloadsPerRelease).toBe(50);
    expect(summary.averageReleaseCadenceDays).toBe(10);
    expect(summary.latestRelease?.tag).toBe("v0.2.0");
    expect(summary.chronologicalSeries.labels).toEqual(["WT v0.1.0", "WT v0.2.0"]);
    expect(summary.chronologicalSeries.downloads).toEqual([100, 0]);
  });

  it("enforces official custom domains instead of stale vercel.app URLs", () => {
    const heapiProj: ProjectTelemetry = {
      repo: "marcelomatz/Heapi",
      info: {
        name: "Heapi",
        fullName: "marcelomatz/Heapi",
        description: "",
        homepage: "https://heapi-website.vercel.app/pt",
        stars: 2,
        forks: 0,
        watchers: 1,
        openIssues: 0,
        sizeKb: 1000,
        language: "Go",
        license: "MIT",
        defaultBranch: "main",
        createdAt: "",
        pushedAt: "",
        url: "https://github.com/marcelomatz/Heapi",
      },
      totalDownloads: 10,
      totalBytesTransferred: 0,
      releases: [],
    };
    expect(getOfficialSiteUrl(heapiProj)).toBe("https://heapi.marcelomatz.com.br/");
  });

  it("handles completely empty or zero-download snapshots without NaN or fake baselines", () => {
    const summary = computeRealAnalytics([], null, normalizeUiLocale("es"));
    expect(summary.totalDownloads).toBe(0);
    expect(summary.totalBytesTransferred).toBe(0);
    expect(summary.averageDownloadsPerRelease).toBe(0);
    expect(summary.averageReleaseCadenceDays).toBeNull();
    expect(summary.latestRelease).toBeNull();
    expect(summary.topAsset).toBeNull();
    expect(formatBytesHuman(0)).toBe("0 B");
    expect(cleanSha256Digest("sha256:deadbeef")).toBe("deadbeef");
    expect(buildPermanentLatestAssetUrl("marcelomatz/writtt", "writtt-windows-amd64-installer.exe")).toBe(
      "https://github.com/marcelomatz/writtt/releases/latest/download/writtt-windows-amd64-installer.exe"
    );
  });
});
