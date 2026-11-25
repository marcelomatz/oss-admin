package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

var trackedRepos = []string{
	"marcelomatz/writtt",
	"marcelomatz/myterm",
	"marcelomatz/bycode-releases",
	"marcelomatz/Heapi",
}

type RepoInfo struct {
	Name          string `json:"name"`
	FullName      string `json:"fullName"`
	Description   string `json:"description"`
	Homepage      string `json:"homepage"`
	Stars         int    `json:"stars"`
	Forks         int    `json:"forks"`
	Watchers      int    `json:"watchers"`
	OpenIssues    int    `json:"openIssues"`
	SizeKB        int    `json:"sizeKb"`
	Language      string `json:"language"`
	License       string `json:"license"`
	DefaultBranch string `json:"defaultBranch"`
	CreatedAt     string `json:"createdAt"`
	PushedAt      string `json:"pushedAt"`
	URL           string `json:"url"`
}

type ReleaseAssetDTO struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	OS          string `json:"os"`
	Kind        string `json:"kind"`
	SizeBytes   int64  `json:"sizeBytes"`
	Downloads   int    `json:"downloads"`
	ContentType string `json:"contentType"`
	Digest      string `json:"digest"`
	DownloadURL string `json:"downloadUrl"`
	UpdatedAt   string `json:"updatedAt"`
}

type ReleaseDTO struct {
	ID                    int64             `json:"id"`
	Tag                   string            `json:"tag"`
	Name                  string            `json:"name"`
	PublishedAt           string            `json:"publishedAt"`
	Prerelease            bool              `json:"prerelease"`
	Author                string            `json:"author"`
	URL                   string            `json:"url"`
	Body                  string            `json:"body"`
	TotalDownloads        int               `json:"totalDownloads"`
	TotalBytesTransferred int64             `json:"totalBytesTransferred"`
	Assets                []ReleaseAssetDTO `json:"assets"`
}

type ProjectTelemetryDTO struct {
	Repo                  string       `json:"repo"`
	Info                  RepoInfo     `json:"info"`
	TotalDownloads        int          `json:"totalDownloads"`
	TotalBytesTransferred int64        `json:"totalBytesTransferred"`
	Releases              []ReleaseDTO `json:"releases"`
}

type TelemetryPayload struct {
	FetchedAt          string                `json:"fetchedAt"`
	Source             string                `json:"source"`
	RateLimitRemaining *int                  `json:"rateLimitRemaining"`
	RateLimitLimit     *int                  `json:"rateLimitLimit"`
	Projects           []ProjectTelemetryDTO `json:"projects"`
}

var (
	cacheMu      sync.RWMutex
	cachedBundle *TelemetryPayload
	cacheTime    time.Time
)

func classifyAssetOS(assetName string) string {
	lower := strings.ToLower(assetName)
	if strings.HasSuffix(lower, ".exe") || strings.HasSuffix(lower, ".msi") || strings.Contains(lower, "windows") || strings.Contains(lower, "win64") || strings.Contains(lower, "win32") {
		return "Windows"
	}
	if strings.HasSuffix(lower, ".dmg") || strings.Contains(lower, "macos") || strings.Contains(lower, "darwin") || strings.Contains(lower, "osx") || strings.Contains(lower, "apple") {
		return "macOS"
	}
	if strings.HasSuffix(lower, ".appimage") || strings.HasSuffix(lower, ".deb") || strings.HasSuffix(lower, ".rpm") || strings.HasSuffix(lower, ".tar.gz") || strings.HasSuffix(lower, ".tar.xz") || strings.Contains(lower, "linux") {
		return "Linux"
	}
	return "Outros"
}

func classifyPackageKind(assetName string) string {
	lower := strings.ToLower(assetName)
	if strings.Contains(lower, "installer") || strings.Contains(lower, "setup") || strings.HasSuffix(lower, ".msi") || strings.HasSuffix(lower, ".dmg") || strings.HasSuffix(lower, ".deb") || strings.HasSuffix(lower, ".rpm") {
		return "installer"
	}
	if strings.HasSuffix(lower, ".zip") || strings.HasSuffix(lower, ".tar.gz") || strings.HasSuffix(lower, ".tar.xz") || strings.HasSuffix(lower, ".7z") {
		return "archive"
	}
	return "portable"
}

func fetchGitHubStats(force bool) TelemetryPayload {
	if !force {
		cacheMu.RLock()
		if cachedBundle != nil && time.Since(cacheTime) < 15*time.Minute {
			out := *cachedBundle
			cacheMu.RUnlock()
			return out
		}
		cacheMu.RUnlock()
	}

	client := &http.Client{Timeout: 15 * time.Second}
	token := os.Getenv("GITHUB_TOKEN")

	var rateRem *int
	var rateLim *int
	var rateMu sync.Mutex

	doReq := func(url string, target any) error {
		req, err := http.NewRequest(http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		req.Header.Set("User-Agent", "Matz-OSS-Release-Control/2.1")
		req.Header.Set("Accept", "application/vnd.github+json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if remStr := resp.Header.Get("X-RateLimit-Remaining"); remStr != "" {
			if v, err := strconv.Atoi(remStr); err == nil {
				rateMu.Lock()
				rateRem = &v
				rateMu.Unlock()
			}
		}
		if limStr := resp.Header.Get("X-RateLimit-Limit"); limStr != "" {
			if v, err := strconv.Atoi(limStr); err == nil {
				rateMu.Lock()
				rateLim = &v
				rateMu.Unlock()
			}
		}

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("status %d", resp.StatusCode)
		}
		return json.NewDecoder(resp.Body).Decode(target)
	}

	results := make([]ProjectTelemetryDTO, len(trackedRepos))
	var wg sync.WaitGroup

	for idx, repo := range trackedRepos {
		wg.Add(1)
		go func(i int, repoSlug string) {
			defer wg.Done()

			shortName := repoSlug
			if parts := strings.Split(repoSlug, "/"); len(parts) == 2 {
				shortName = parts[1]
			}

			info := RepoInfo{
				Name:          shortName,
				FullName:      repoSlug,
				DefaultBranch: "main",
				URL:           "https://github.com/" + repoSlug,
			}

			var rData struct {
				Name             string `json:"name"`
				FullName         string `json:"full_name"`
				Description      string `json:"description"`
				Homepage         string `json:"homepage"`
				StargazersCount  int    `json:"stargazers_count"`
				ForksCount       int    `json:"forks_count"`
				SubscribersCount int    `json:"subscribers_count"`
				OpenIssuesCount  int    `json:"open_issues_count"`
				Size             int    `json:"size"`
				Language         string `json:"language"`
				DefaultBranch    string `json:"default_branch"`
				CreatedAt        string `json:"created_at"`
				PushedAt         string `json:"pushed_at"`
				HTMLURL          string `json:"html_url"`
				License          *struct {
					SpdxID string `json:"spdx_id"`
				} `json:"license"`
			}

			if err := doReq("https://api.github.com/repos/"+repoSlug, &rData); err == nil {
				lic := ""
				if rData.License != nil && rData.License.SpdxID != "NOASSERTION" {
					lic = rData.License.SpdxID
				}
				info = RepoInfo{
					Name:          rData.Name,
					FullName:      rData.FullName,
					Description:   rData.Description,
					Homepage:      rData.Homepage,
					Stars:         rData.StargazersCount,
					Forks:         rData.ForksCount,
					Watchers:      rData.SubscribersCount,
					OpenIssues:    rData.OpenIssuesCount,
					SizeKB:        rData.Size,
					Language:      rData.Language,
					License:       lic,
					DefaultBranch: rData.DefaultBranch,
					CreatedAt:     rData.CreatedAt,
					PushedAt:      rData.PushedAt,
					URL:           rData.HTMLURL,
				}
			}

			var rawReleases []struct {
				ID          int64  `json:"id"`
				TagName     string `json:"tag_name"`
				Name        string `json:"name"`
				Draft       bool   `json:"draft"`
				Prerelease  bool   `json:"prerelease"`
				PublishedAt string `json:"published_at"`
				CreatedAt   string `json:"created_at"`
				HTMLURL     string `json:"html_url"`
				Body        string `json:"body"`
				Author      struct {
					Login string `json:"login"`
				} `json:"author"`
				Assets []struct {
					ID                 int64  `json:"id"`
					Name               string `json:"name"`
					Size               int64  `json:"size"`
					DownloadCount      int    `json:"download_count"`
					ContentType        string `json:"content_type"`
					Digest             string `json:"digest"`
					BrowserDownloadURL string `json:"browser_download_url"`
					UpdatedAt          string `json:"updated_at"`
				} `json:"assets"`
			}

			var releases []ReleaseDTO
			var projDownloads int
			var projBytes int64

			if err := doReq("https://api.github.com/repos/"+repoSlug+"/releases?per_page=100", &rawReleases); err == nil {
				for _, rel := range rawReleases {
					if rel.Draft {
						continue
					}
					pub := rel.PublishedAt
					if pub == "" {
						pub = rel.CreatedAt
					}
					author := rel.Author.Login
					if author == "" {
						author = "marcelomatz"
					}
					relName := rel.Name
					if relName == "" {
						relName = rel.TagName
					}

					assets := make([]ReleaseAssetDTO, 0, len(rel.Assets))
					var relDownloads int
					var relBytes int64

					for _, a := range rel.Assets {
						relDownloads += a.DownloadCount
						relBytes += int64(a.DownloadCount) * a.Size
						assets = append(assets, ReleaseAssetDTO{
							ID:          a.ID,
							Name:        a.Name,
							OS:          classifyAssetOS(a.Name),
							Kind:        classifyPackageKind(a.Name),
							SizeBytes:   a.Size,
							Downloads:   a.DownloadCount,
							ContentType: a.ContentType,
							Digest:      a.Digest,
							DownloadURL: a.BrowserDownloadURL,
							UpdatedAt:   a.UpdatedAt,
						})
					}

					projDownloads += relDownloads
					projBytes += relBytes
					releases = append(releases, ReleaseDTO{
						ID:                    rel.ID,
						Tag:                   rel.TagName,
						Name:                  relName,
						PublishedAt:           pub,
						Prerelease:            rel.Prerelease,
						Author:                author,
						URL:                   rel.HTMLURL,
						Body:                  rel.Body,
						TotalDownloads:        relDownloads,
						TotalBytesTransferred: relBytes,
						Assets:                assets,
					})
				}
			}

			results[i] = ProjectTelemetryDTO{
				Repo:                  repoSlug,
				Info:                  info,
				TotalDownloads:        projDownloads,
				TotalBytesTransferred: projBytes,
				Releases:              releases,
			}
		}(idx, repo)
	}

	wg.Wait()

	src := "go-server-public"
	if token != "" {
		src = "go-server-authenticated"
	}

	bundle := TelemetryPayload{
		FetchedAt:          time.Now().UTC().Format(time.RFC3339),
		Source:             src,
		RateLimitRemaining: rateRem,
		RateLimitLimit:     rateLim,
		Projects:           results,
	}

	cacheMu.Lock()
	cachedBundle = &bundle
	cacheTime = time.Now()
	cacheMu.Unlock()

	return bundle
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/oss/stats", func(w http.ResponseWriter, r *http.Request) {
		force := r.URL.Query().Get("refresh") == "1"
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		_ = json.NewEncoder(w).Encode(fetchGitHubStats(force))
	})

	mux.Handle("/", http.FileServer(http.Dir("./dist")))

	port := os.Getenv("PORT")
	if port == "" {
		port = "4173"
	}
	log.Printf("OSS Release & Download Control listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
