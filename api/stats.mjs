// Vercel Serverless Endpoint (`/api/stats` -> rewritten from `/api/oss/stats`)
// Fetches 100% genuine GitHub repository + full release asset telemetry with edge caching.

const TRACKED_REPOS = [
  "marcelomatz/writtt",
  "marcelomatz/myterm",
  "marcelomatz/bycode-releases",
  "marcelomatz/Heapi",
];

function classifyAssetOS(assetName) {
  const lower = String(assetName || "").toLowerCase();
  if (lower.endsWith(".exe") || lower.endsWith(".msi") || lower.includes("windows") || lower.includes("win64") || lower.includes("win32")) {
    return "Windows";
  }
  if (lower.endsWith(".dmg") || lower.includes("macos") || lower.includes("darwin") || lower.includes("osx") || lower.includes("apple")) {
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

function classifyPackageKind(assetName) {
  const lower = String(assetName || "").toLowerCase();
  if (lower.includes("installer") || lower.includes("setup") || lower.endsWith(".msi") || lower.endsWith(".dmg") || lower.endsWith(".deb") || lower.endsWith(".rpm")) {
    return "installer";
  }
  if (lower.endsWith(".zip") || lower.endsWith(".tar.gz") || lower.endsWith(".tar.xz") || lower.endsWith(".7z")) {
    return "archive";
  }
  return "portable";
}

export default async function handler(req, res) {
  const forceRefresh = req.query?.refresh === "1";
  const headers = {
    "User-Agent": "Matz-OSS-Release-Control/2.1",
    Accept: "application/vnd.github+json",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let rateLimitRemaining = null;
  let rateLimitLimit = null;

  const ghFetch = async (url) => {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    const rem = r.headers.get("x-ratelimit-remaining");
    const lim = r.headers.get("x-ratelimit-limit");
    if (rem !== null) rateLimitRemaining = Number(rem);
    if (lim !== null) rateLimitLimit = Number(lim);
    if (!r.ok) throw new Error(`GitHub HTTP ${r.status}`);
    return r.json();
  };

  const projects = await Promise.all(
    TRACKED_REPOS.map(async (repo) => {
      let info = {
        name: repo.split("/")[1] || repo,
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

      try {
        const rData = await ghFetch(`https://api.github.com/repos/${repo}`);
        info = {
          name: rData.name || info.name,
          fullName: rData.full_name || repo,
          description: rData.description || "",
          homepage: rData.homepage || "",
          stars: Number(rData.stargazers_count || 0),
          forks: Number(rData.forks_count || 0),
          watchers: Number(rData.subscribers_count ?? rData.watchers_count ?? 0),
          openIssues: Number(rData.open_issues_count || 0),
          sizeKb: Number(rData.size || 0),
          language: rData.language || "",
          license: rData.license?.spdx_id && rData.license.spdx_id !== "NOASSERTION" ? rData.license.spdx_id : "",
          defaultBranch: rData.default_branch || "main",
          createdAt: rData.created_at || "",
          pushedAt: rData.pushed_at || "",
          url: rData.html_url || `https://github.com/${repo}`,
        };
      } catch {
        // preserve minimal repo fallback
      }

      const releases = [];
      try {
        let page = 1;
        while (page <= 5) {
          const relPage = await ghFetch(`https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`);
          if (!Array.isArray(relPage) || relPage.length === 0) break;

          for (const rel of relPage) {
            if (rel.draft) continue;
            const assets = (rel.assets || []).map((a) => ({
              id: Number(a.id || 0),
              name: String(a.name || ""),
              os: classifyAssetOS(a.name),
              kind: classifyPackageKind(a.name),
              sizeBytes: Number(a.size || 0),
              downloads: Number(a.download_count || 0),
              contentType: String(a.content_type || ""),
              digest: a.digest ? String(a.digest) : "",
              downloadUrl: String(a.browser_download_url || ""),
              updatedAt: String(a.updated_at || a.created_at || ""),
            }));

            const totalDownloads = assets.reduce((s, x) => s + x.downloads, 0);
            const totalBytesTransferred = assets.reduce((s, x) => s + x.downloads * x.sizeBytes, 0);

            releases.push({
              id: Number(rel.id || 0),
              tag: String(rel.tag_name || ""),
              name: String(rel.name || rel.tag_name || ""),
              publishedAt: String(rel.published_at || rel.created_at || ""),
              prerelease: Boolean(rel.prerelease),
              author: String(rel.author?.login || "marcelomatz"),
              url: String(rel.html_url || ""),
              body: String(rel.body || ""),
              totalDownloads,
              totalBytesTransferred,
              assets,
            });
          }

          if (relPage.length < 100) break;
          page++;
        }
      } catch {
        // preserve empty releases if API errored
      }

      const totalDownloads = releases.reduce((s, r) => s + r.totalDownloads, 0);
      const totalBytesTransferred = releases.reduce((s, r) => s + r.totalBytesTransferred, 0);

      return {
        repo,
        info,
        totalDownloads,
        totalBytesTransferred,
        releases,
      };
    })
  );

  if (!forceRefresh) {
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
  } else {
    res.setHeader("Cache-Control", "no-store");
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json({
    fetchedAt: new Date().toISOString(),
    source: process.env.GITHUB_TOKEN ? "server-authenticated" : "server-public",
    rateLimitRemaining,
    rateLimitLimit,
    projects,
  });
}
