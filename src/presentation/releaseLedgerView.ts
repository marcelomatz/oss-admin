/**
 * Layer 4 — Complete Filterable & Auditable Release Ledger (`#releases`)
 * Displays every GitHub release, release notes (`body`), and binary asset metrics
 * with live search, OS filter, format filter, and multi-criteria sorting.
 */
import { matzIcon } from "@matz/ui/icons";
import {
  buildPermanentLatestAssetUrl,
  cleanSha256Digest,
  formatBytesHuman,
  formatShortDate,
  getProductColor,
  OsPlatform,
  PackageKind,
  trText,
  UiLocale,
} from "../domain";
import {
  DashboardViewState,
  FilteredReleaseEntry,
  ReleaseSortField,
  renderSafeReleaseNotesHtml,
  selectFilteredReleases,
} from "../application/dashboardState";

function escHtml(val: string | number): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function kindBadgeLabel(kind: PackageKind, locale: UiLocale): string {
  if (kind === "installer") return trText(locale, "Instalador", "Installer", "Instalador");
  if (kind === "archive") return trText(locale, "Compactado", "Archive", "Comprimido");
  return trText(locale, "Portátil", "Portable", "Portátil");
}

function osBadgeClass(os: OsPlatform): string {
  if (os === "Windows") return "matz-badge-cyan";
  if (os === "macOS") return "matz-badge-amber";
  if (os === "Linux") return "matz-badge-emerald";
  return "";
}

export function renderReleaseLedgerSection(state: DashboardViewState): string {
  const { locale } = state;
  const entries = selectFilteredReleases(state);

  return `
    <section class="oss-section" id="releases">
      <div class="oss-section-head">
        <div>
          <div class="oss-section-eyebrow">${matzIcon("archive", 13)} ${trText(locale, "Livro-Razão de Releases & Artefatos", "Release & Artifact Ledger", "Registro de Versiones y Artefactos")}</div>
          <h2 class="oss-section-title">${trText(locale, "Histórico Completo de Versões, Binários e Notas de Lançamento", "Complete History of Releases, Binaries & Changelogs", "Historial Completo de Versiones, Binarios y Notas de Lanzamiento")}</h2>
          <p class="oss-section-desc">
            ${trText(
              locale,
              "Filtre por sistema operacional, formato de pacote ou pesquise por versão, nome de arquivo ou hash SHA-256.",
              "Filter by operating system, package format, or search by tag, filename, or SHA-256 digest.",
              "Filtre por sistema operativo, formato de paquete o busque por versión, archivo o hash SHA-256."
            )}
          </p>
        </div>
        <span class="matz-badge" id="ledger-count-badge">
          ${entries.length} ${trText(locale, "versões exibidas", "releases shown", "versiones mostradas")}
        </span>
      </div>

      <div class="oss-filter-bar">
        <div class="oss-search-wrap">
          <span class="oss-search-icon">${matzIcon("search", 14)}</span>
          <input
            type="search"
            id="oss-ledger-search"
            class="matz-input oss-search-input"
            value="${escHtml(state.searchQuery)}"
            placeholder="${escHtml(trText(locale, "Buscar versão, binário (.exe, .dmg, .tar.gz) ou SHA-256...", "Search tag, binary (.exe, .dmg, .tar.gz) or SHA-256...", "Buscar versión, binario (.exe, .dmg, .tar.gz) o SHA-256..."))}"
          />
        </div>

        <select id="oss-filter-os" class="matz-select" aria-label="Sistema Operacional">
          <option value="ALL" ${state.osFilter === "ALL" ? "selected" : ""}>${trText(locale, "Todos os Sistemas", "All Platforms", "Todos los Sistemas")}</option>
          <option value="Windows" ${state.osFilter === "Windows" ? "selected" : ""}>Windows</option>
          <option value="macOS" ${state.osFilter === "macOS" ? "selected" : ""}>macOS</option>
          <option value="Linux" ${state.osFilter === "Linux" ? "selected" : ""}>Linux</option>
        </select>

        <select id="oss-filter-kind" class="matz-select" aria-label="Formato do Pacote">
          <option value="ALL" ${state.kindFilter === "ALL" ? "selected" : ""}>${trText(locale, "Todos os Formatos", "All Package Formats", "Todos los Formatos")}</option>
          <option value="installer" ${state.kindFilter === "installer" ? "selected" : ""}>${trText(locale, "Instaladores (.exe / .dmg)", "Installers (.exe / .dmg)", "Instaladores (.exe / .dmg)")}</option>
          <option value="portable" ${state.kindFilter === "portable" ? "selected" : ""}>${trText(locale, "Executáveis Portáteis", "Portable Executables", "Ejecutables Portátiles")}</option>
          <option value="archive" ${state.kindFilter === "archive" ? "selected" : ""}>${trText(locale, "Compactados (.zip / .tar.gz)", "Archives (.zip / .tar.gz)", "Comprimidos (.zip / .tar.gz)")}</option>
        </select>

        <select id="oss-sort-by" class="matz-select" aria-label="Ordenar por">
          ${renderSortOptions(state.sortBy, locale)}
        </select>
      </div>

      <div id="oss-ledger-results" class="oss-ledger-list">
        ${renderLedgerEntriesHtml(entries, state)}
      </div>
    </section>
  `;
}

function renderSortOptions(active: ReleaseSortField, locale: UiLocale): string {
  const opts: Array<{ val: ReleaseSortField; label: string }> = [
    { val: "date", label: trText(locale, "Ordenar: Mais Recentes", "Sort: Newest First", "Ordenar: Más Recientes") },
    { val: "downloads", label: trText(locale, "Ordenar: Mais Downloads", "Sort: Most Downloads", "Ordenar: Más Descargas") },
    { val: "bytes", label: trText(locale, "Ordenar: Maior Tráfego", "Sort: Highest Traffic", "Ordenar: Mayor Tráfico") },
    { val: "size", label: trText(locale, "Ordenar: Maior Binário", "Sort: Largest Binary", "Ordenar: Mayor Binario") },
  ];
  return opts
    .map(
      (o) =>
        `<option value="${o.val}" ${active === o.val ? "selected" : ""}>${escHtml(o.label)}</option>`
    )
    .join("");
}

export function renderLedgerEntriesHtml(
  entries: FilteredReleaseEntry[],
  state: DashboardViewState
): string {
  const { locale } = state;

  if (entries.length === 0) {
    return `
      <div class="matz-card oss-empty-state">
        <span style="color:var(--text-muted);">${matzIcon("filter", 22)}</span>
        <strong style="font-size:14.5px;color:var(--text-primary);">
          ${trText(locale, "Nenhuma versão encontrada para os filtros selecionados", "No releases match the active filters", "Ninguna versión coincide con los filtros seleccionados")}
        </strong>
        <p style="font-size:12.5px;color:var(--text-muted);">
          ${trText(locale, "Ajuste os filtros de sistema operacional, formato ou termo pesquisado.", "Adjust the operating system, format, or search term filters.", "Ajuste los filtros de sistema operativo, formato o búsqueda.")}
        </p>
      </div>
    `;
  }

  return entries
    .map((entry) => {
      const { repo, projectDisplayName, release, matchingAssets } = entry;
      const color = getProductColor(repo);
      const proj = state.snapshot?.projects.find((p) => p.repo === repo);
      const isLatestOfRepo = proj?.releases[0]?.id === release.id;
      const isExpanded = state.expandedReleaseIds.has(release.id);
      const hasNotes = Boolean(release.body && release.body.trim().length > 0);

      return `
        <article class="matz-card oss-release-card">
          <div class="oss-release-header">
            <div class="oss-release-title-group">
              <div class="oss-release-badges">
                <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--text-primary);">
                  <span style="width:8px;height:8px;border-radius:50%;background:${color};"></span>
                  ${escHtml(projectDisplayName)}
                </span>
                <span class="oss-release-tag">${escHtml(release.tag)}</span>
                ${
                  isLatestOfRepo
                    ? `<span class="matz-badge matz-badge-emerald">${trText(locale, "Versão Atual", "Latest", "Versión Actual")}</span>`
                    : ""
                }
                ${
                  release.prerelease
                    ? `<span class="matz-badge matz-badge-amber">${trText(locale, "Pré-lançamento", "Pre-release", "Prelanzamiento")}</span>`
                    : ""
                }
                <span class="oss-release-name">${escHtml(release.name)}</span>
              </div>

              <div class="oss-release-sub">
                <span>${matzIcon("calendar", 12)} ${escHtml(formatShortDate(release.publishedAt, locale))}</span>
                <span>·</span>
                <span>${matzIcon("user", 12)} ${escHtml(release.author)}</span>
                <span>·</span>
                <span>${matchingAssets.length} ${trText(locale, "arquivos exibidos", "files shown", "archivos mostrados")}</span>
              </div>
            </div>

            <div class="oss-release-kpis">
              <span class="matz-badge matz-tabular" style="font-size:11.5px;">
                ${matzIcon("download", 11)}
                ${release.totalDownloads.toLocaleString(locale)} dl
              </span>
              <span class="matz-badge matz-badge-cyan matz-tabular" style="font-size:11.5px;">
                ${escHtml(formatBytesHuman(release.totalBytesTransferred))}
              </span>
              ${
                hasNotes
                  ? `<button type="button" class="oss-icon-action" data-toggle-notes="${release.id}">
                      ${matzIcon("file-text", 12)}
                      <span>${isExpanded ? trText(locale, "Ocultar Notas", "Hide Notes", "Ocultar Notas") : trText(locale, "Notas da Versão", "Release Notes", "Notas de Versión")}</span>
                    </button>`
                  : ""
              }
              <a href="${escHtml(release.url)}" target="_blank" rel="noopener noreferrer" class="oss-icon-action">
                ${matzIcon("external", 12)}
                <span>GitHub</span>
              </a>
            </div>
          </div>

          ${
            isExpanded && hasNotes
              ? `<div class="oss-changelog-panel">
                  ${renderSafeReleaseNotesHtml(release.body)}
                </div>`
              : ""
          }

          ${
            matchingAssets.length > 0
              ? `<div class="oss-table-wrap">
                  <table class="oss-asset-table">
                    <thead>
                      <tr>
                        <th>${trText(locale, "Arquivo Binário", "Binary File", "Archivo Binario")}</th>
                        <th>${trText(locale, "Sistema", "Platform", "Sistema")}</th>
                        <th>${trText(locale, "Formato", "Format", "Formato")}</th>
                        <th>${trText(locale, "Tamanho", "Size", "Tamaño")}</th>
                        <th>${trText(locale, "Downloads", "Downloads", "Descargas")}</th>
                        <th>${trText(locale, "% da Versão", "% of Release", "% de Versión")}</th>
                        <th>${trText(locale, "Tráfego", "Traffic", "Tráfico")}</th>
                        <th>SHA-256</th>
                        <th style="text-align:right;">${trText(locale, "Ações", "Actions", "Acciones")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${matchingAssets
                        .map((asset) => {
                          const sha = cleanSha256Digest(asset.digest);
                          const pctRel =
                            release.totalDownloads > 0
                              ? ((asset.downloads / release.totalDownloads) * 100).toFixed(1)
                              : "0.0";
                          const latestUrl = buildPermanentLatestAssetUrl(repo, asset.name);

                          return `
                            <tr>
                              <td>
                                <code class="oss-slot-filename" style="color:var(--text-primary);font-weight:600;">${escHtml(asset.name)}</code>
                              </td>
                              <td>
                                <span class="matz-badge ${osBadgeClass(asset.os)}" style="font-size:10.5px;">${escHtml(asset.os)}</span>
                              </td>
                              <td>${escHtml(kindBadgeLabel(asset.kind, locale))}</td>
                              <td class="matz-tabular" style="font-family:var(--font-mono);">${escHtml(formatBytesHuman(asset.sizeBytes))}</td>
                              <td class="matz-tabular" style="font-weight:700;color:var(--text-primary);">${asset.downloads.toLocaleString(locale)}</td>
                              <td class="matz-tabular">${pctRel}%</td>
                              <td class="matz-tabular" style="font-family:var(--font-mono);">${escHtml(formatBytesHuman(asset.downloads * asset.sizeBytes))}</td>
                              <td style="font-family:var(--font-mono);font-size:10.5px;">
                                ${
                                  sha
                                    ? `<button type="button" class="oss-icon-action" data-copy-text="sha256:${escHtml(sha)}" data-copy-label="${escHtml(trText(locale, "SHA-256 copiado", "SHA-256 copied", "SHA-256 copiado"))}" title="sha256:${escHtml(sha)}">
                                        ${matzIcon("fingerprint", 11)}
                                        <span>${escHtml(sha.slice(0, 8))}…</span>
                                      </button>`
                                    : `<span style="color:var(--text-muted);">—</span>`
                                }
                              </td>
                              <td style="text-align:right;">
                                <div style="display:inline-flex;align-items:center;gap:5px;">
                                  ${
                                    isLatestOfRepo
                                      ? `<button type="button" class="oss-icon-action" data-copy-text="${escHtml(latestUrl)}" data-copy-label="${escHtml(trText(locale, "Link /latest/ copiado", "/latest/ link copied", "Enlace /latest/ copiado"))}" title="${escHtml(latestUrl)}">
                                          ${matzIcon("link", 11)}
                                          <span>/latest</span>
                                        </button>`
                                      : ""
                                  }
                                  <button type="button" class="oss-icon-action" data-copy-text="${escHtml(asset.downloadUrl)}" data-copy-label="${escHtml(trText(locale, "URL copiada", "URL copied", "URL copiada"))}" title="${escHtml(asset.downloadUrl)}">
                                    ${matzIcon("copy", 11)}
                                  </button>
                                  <a href="${escHtml(asset.downloadUrl)}" class="oss-icon-action is-primary">
                                    ${matzIcon("download", 11)}
                                    <span>${trText(locale, "Baixar", "Download", "Descargar")}</span>
                                  </a>
                                </div>
                              </td>
                            </tr>
                          `;
                        })
                        .join("")}
                    </tbody>
                  </table>
                </div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}
