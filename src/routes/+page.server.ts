import { env } from '$env/dynamic/private';

const REPOS = [
    'marcelomatz/Heapi',
    'marcelomatz/myterm',
    'marcelomatz/writtt',
    'marcelomatz/bycode-releases'
];

type OsType = 'Windows' | 'macOS' | 'Linux' | 'Outros';

export interface RepoInfo {
    description: string;
    stars: number;
    issues: number;
    forks: number;
    url: string;
}

export interface DownloadStats {
    os: OsType;
    version: string;
    date: string;
    downloads: number;
    releaseUrl: string;
    author: string;
}

export interface ProjectStats {
    repo: string;
    totalDownloads: number;
    details: DownloadStats[];
    info: RepoInfo | null;
}

// Simple in-memory cache to avoid hitting GitHub API limits
let cache: { data: ProjectStats[], timestamp: number } | null = null;
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

function detectOS(assetName: string): OsType {
    const lowerName = assetName.toLowerCase();
    if (lowerName.endsWith('.exe') || lowerName.endsWith('.msi')) return 'Windows';
    if (lowerName.endsWith('.dmg') || lowerName.includes('darwin') || lowerName.includes('mac')) return 'macOS';
    if (lowerName.endsWith('.appimage') || lowerName.endsWith('.deb') || lowerName.endsWith('.rpm') || lowerName.endsWith('.tar.gz') || lowerName.includes('linux')) return 'Linux';
    return 'Outros';
}

export async function load() {
    // Return cached data if valid
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION_MS) {
        return { projects: cache.data };
    }

    const headers: Record<string, string> = {
        'User-Agent': 'OSS-Admin-Dashboard',
        'Accept': 'application/vnd.github.v3+json'
    };

    if (env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${env.GITHUB_TOKEN}`;
    }

    const projects: ProjectStats[] = [];

    for (const repo of REPOS) {
        try {
            // Informações do Repositório
            let info: RepoInfo | null = null;
            const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
            if (repoRes.ok) {
                const rData = await repoRes.json();
                info = {
                    description: rData.description || '',
                    stars: rData.stargazers_count || 0,
                    issues: rData.open_issues_count || 0,
                    forks: rData.forks_count || 0,
                    url: rData.html_url || ''
                };
            }

            let page = 1;
            let hasMore = true;
            let totalDownloads = 0;
            const details: DownloadStats[] = [];

            while (hasMore) {
                const response = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`, { headers });
                
                if (!response.ok) {
                    console.error(`Failed to fetch ${repo}: ${response.statusText}`);
                    break;
                }
                
                const releases: any[] = await response.json();
                
                if (releases.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const release of releases) {
                    const version = release.tag_name;
                    const date = release.published_at || release.created_at;
                    const releaseUrl = release.html_url;
                    const author = release.author?.login || 'Automated';

                    for (const asset of release.assets || []) {
                        if (asset.download_count > 0) {
                            const os = detectOS(asset.name);
                            totalDownloads += asset.download_count;
                            details.push({
                                os,
                                version,
                                date,
                                downloads: asset.download_count,
                                releaseUrl,
                                author
                            });
                        }
                    }
                }
                
                if (releases.length < 100) {
                    hasMore = false;
                } else {
                    page++;
                }
            }

            projects.push({ repo, totalDownloads, details, info });
        } catch (error) {
            console.error(`Error fetching ${repo}:`, error);
        }
    }

    // Update cache
    cache = { data: projects, timestamp: Date.now() };

    return { projects };
}
