/**
 * Layer 4 — Real Visual Analytics Section
 * Mounts @matz/ui data-driven charts (`renderRingDonutChart`, `renderInteractiveAreaChart`)
 * strictly fed by verified GitHub metrics — zero random or synthetic generators.
 */
import { matzIcon } from "@matz/ui/icons";
import {
  renderInteractiveAreaChart,
  renderRingDonutChart,
} from "@matz/ui/analytics";
import {
  ComputedAnalyticsSummary,
  formatBytesHuman,
  getDisplayName,
  getProductColor,
  ProjectTelemetry,
  ReleaseAssetItem,
  ShareSlice,
  trText,
  UiLocale,
} from "../domain";

function escHtml(val: string | number): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMiniBreakdownStrip(slices: ShareSlice[], locale: UiLocale): string {
  if (slices.length === 0) return "";
  return `
    <div class="oss-mini-breakdown">
      ${slices
        .map(
          (s) => `
          <div class="oss-mini-stat-box">
            <div class="oss-mini-stat-head">
              <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="width:7px;height:7px;border-radius:50%;background:${s.color};"></span>
                <span>${escHtml(s.label)}</span>
              </span>
              <span class="matz-tabular">${s.percentage.toFixed(1)}%</span>
            </div>
            <div class="oss-mini-stat-val matz-tabular">
              ${s.count.toLocaleString(locale)} <span style="font-size:11px;font-weight:500;color:var(--text-muted);">dl</span>
            </div>
            <div class="oss-mini-stat-sub matz-tabular">
              ${escHtml(formatBytesHuman(s.bytesTransferred))} · ${s.assetsCount} ${trText(locale, "binários", "binaries", "binarios")}
            </div>
          </div>
        `
        )
        .join("")}
    </div>
  `;
}

export function renderAnalyticsSectionSkeleton(
  summary: ComputedAnalyticsSummary,
  projects: ProjectTelemetry[],
  selectedRepo: string | null,
  locale: UiLocale
): string {
  const compareOrTopAssetsCard = selectedRepo
    ? renderSingleSoftwareTopAssetsCard(projects, selectedRepo, locale)
    : renderEcosystemComparisonCard(projects, summary.totalDownloads, locale);

  return `
    <section class="oss-section" id="analytics">
      <div class="oss-section-head">
        <div>
          <div class="oss-section-eyebrow">${matzIcon("chart-line", 13)} ${trText(locale, "Inteligência de Distribuição Real", "Real Distribution Intelligence", "Inteligencia de Distribución Real")}</div>
          <h2 class="oss-section-title">${trText(locale, "Analytics Verificados por Plataforma, Formato e Versão", "Verified Analytics by Platform, Format & Release", "Analítica Verificada por Plataforma, Formato y Versión")}</h2>
          <p class="oss-section-desc">
            ${trText(
              locale,
              "Todos os gráficos abaixo refletem 100% os contadores reais de downloads e tamanhos em bytes retornados pela API pública do GitHub, sem estimativas sintéticas.",
              "Every chart below reflects 100% real download counters and byte sizes returned by the public GitHub API, with zero synthetic estimates.",
              "Todos los gráficos reflejan el 100% de los contadores reales de descargas y tamaños en bytes devueltos por la API pública de GitHub, sin estimaciones sintéticas."
            )}
          </p>
        </div>
      </div>

      <div class="oss-analytics-top">
        <div class="oss-analytics-stack">
          <div id="chart-os-donut"></div>
          ${renderMiniBreakdownStrip(summary.osBreakdown, locale)}
        </div>

        <div class="oss-analytics-stack">
          <div id="chart-kind-donut"></div>
          ${renderMiniBreakdownStrip(summary.kindBreakdown, locale)}
        </div>
      </div>

      <div class="oss-analytics-bottom">
        <div class="oss-analytics-stack" style="gap:16px;">
          <div id="chart-chrono-area"></div>
          ${selectedRepo ? '<div id="chart-binary-size-area"></div>' : ""}
        </div>

        <div>
          ${compareOrTopAssetsCard}
        </div>
      </div>
    </section>
  `;
}

function renderEcosystemComparisonCard(
  projects: ProjectTelemetry[],
  ecosystemTotalDownloads: number,
  locale: UiLocale
): string {
  const ranked = [...projects].sort((a, b) => b.totalDownloads - a.totalDownloads);

  return `
    <div class="matz-card matz-beam-top" style="display:flex;flex-direction:column;gap:14px;height:100%;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text-primary);">
            ${trText(locale, "Participação por Software no Ecossistema", "Ecosystem Share by Software", "Participación por Software en el Ecosistema")}
          </div>
          <div style="font-size:11.5px;color:var(--text-muted);">
            ${trText(locale, "Comparativo real de downloads, tráfego e versões publicadas", "Real comparison of downloads, bandwidth, and published releases", "Comparativa real de descargas, tráfico y versiones publicadas")}
          </div>
        </div>
        <span class="matz-badge">${ranked.length} softwares</span>
      </div>

      <div class="oss-compare-list">
        ${ranked
          .map((proj) => {
            const name = getDisplayName(proj.repo);
            const color = getProductColor(proj.repo);
            const pct =
              ecosystemTotalDownloads > 0
                ? (proj.totalDownloads / ecosystemTotalDownloads) * 100
                : 0;
            const latestTag = proj.releases[0]?.tag || "—";
            const avgPerRel =
              proj.releases.length > 0
                ? (proj.totalDownloads / proj.releases.length).toFixed(1)
                : "0";

            return `
              <div class="oss-compare-item">
                <div class="oss-compare-top">
                  <div style="display:inline-flex;align-items:center;gap:8px;">
                    <span style="width:9px;height:9px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};"></span>
                    <strong style="font-size:14px;color:var(--text-primary);">${escHtml(name)}</strong>
                    <span class="oss-scope-tag">${escHtml(latestTag)}</span>
                  </div>
                  <div class="matz-tabular" style="font-size:13px;font-weight:700;color:var(--text-primary);">
                    ${proj.totalDownloads.toLocaleString(locale)} dl
                    <span style="color:var(--text-muted);font-weight:500;">(${pct.toFixed(1)}%)</span>
                  </div>
                </div>

                <div class="matz-progress-track" style="height:7px;">
                  <div class="matz-progress-fill" style="width:${Math.max(pct, proj.totalDownloads > 0 ? 2 : 0).toFixed(1)}%;background:${color};"></div>
                </div>

                <div class="oss-compare-meta">
                  <span class="matz-tabular">
                    ${escHtml(formatBytesHuman(proj.totalBytesTransferred))} · ${proj.releases.length} ${trText(locale, "versões", "releases", "versiones")} · ${avgPerRel}/rel
                  </span>
                  <button type="button" class="oss-icon-action" data-select-repo="${escHtml(proj.repo)}">
                    ${matzIcon("arrow-right", 11)}
                    <span>${trText(locale, "Detalhar", "Inspect", "Detallar")}</span>
                  </button>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderSingleSoftwareTopAssetsCard(
  projects: ProjectTelemetry[],
  selectedRepo: string,
  locale: UiLocale
): string {
  const proj = projects.find((p) => p.repo === selectedRepo);
  if (!proj) return "";

  const allAssets: Array<{ tag: string; asset: ReleaseAssetItem }> = [];
  for (const rel of proj.releases) {
    for (const asset of rel.assets) {
      allAssets.push({ tag: rel.tag, asset });
    }
  }
  allAssets.sort((a, b) => b.asset.downloads - a.asset.downloads || b.asset.sizeBytes - a.asset.sizeBytes);
  const topSix = allAssets.slice(0, 6);
  const maxDl = Math.max(...topSix.map((x) => x.asset.downloads), 1);
  const color = getProductColor(proj.repo);

  return `
    <div class="matz-card matz-beam-top" style="display:flex;flex-direction:column;gap:14px;height:100%;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text-primary);">
            ${trText(locale, "Binários Mais Baixados do Software", "Most Downloaded Software Binaries", "Binarios Más Descargados del Software")}
          </div>
          <div style="font-size:11.5px;color:var(--text-muted);">
            ${trText(locale, "Ranking histórico real por executável e versão", "All-time real ranking by executable and release", "Ranking histórico real por ejecutable y versión")}
          </div>
        </div>
        <span class="matz-badge">${allAssets.length} ${trText(locale, "arquivos", "files", "archivos")}</span>
      </div>

      <div class="oss-compare-list">
        ${
          topSix.length === 0
            ? `<div style="color:var(--text-muted);font-size:12.5px;">${trText(locale, "Nenhum binário publicado ainda.", "No binaries published yet.", "Ningún binario publicado aún.")}</div>`
            : topSix
                .map(({ tag, asset }) => {
                  const pct = (asset.downloads / maxDl) * 100;
                  return `
                    <div class="oss-compare-item">
                      <div class="oss-compare-top">
                        <div style="min-width:0;display:flex;align-items:center;gap:6px;">
                          <span class="oss-scope-tag">${escHtml(tag)}</span>
                          <code class="oss-slot-filename" style="max-width:210px;" title="${escHtml(asset.name)}">${escHtml(asset.name)}</code>
                        </div>
                        <strong class="matz-tabular" style="font-size:12.5px;color:var(--text-primary);">
                          ${asset.downloads.toLocaleString(locale)} dl
                        </strong>
                      </div>
                      <div class="matz-progress-track" style="height:6px;">
                        <div class="matz-progress-fill" style="width:${pct.toFixed(1)}%;background:${color};"></div>
                      </div>
                      <div class="oss-compare-meta matz-tabular">
                        <span>${escHtml(asset.os)} · ${escHtml(formatBytesHuman(asset.sizeBytes))}</span>
                        <span>${trText(locale, "Tráfego:", "Traffic:", "Tráfico:")} ${escHtml(formatBytesHuman(asset.downloads * asset.sizeBytes))}</span>
                      </div>
                    </div>
                  `;
                })
                .join("")
        }
      </div>
    </div>
  `;
}

export function mountRealAnalyticsCharts(
  root: ParentNode,
  summary: ComputedAnalyticsSummary,
  selectedRepo: string | null,
  locale: UiLocale
): void {
  const osMount = root.querySelector<HTMLElement>("#chart-os-donut");
  if (osMount) {
    const osSegments = summary.osBreakdown
      .filter((s) => s.count > 0)
      .map((s) => ({
        label: s.label,
        value: s.count,
        color: s.color,
      }));

    if (osSegments.length > 0) {
      renderRingDonutChart(
        osMount,
        trText(locale, "Downloads por Sistema Operacional", "Downloads by Operating System", "Descargas por Sistema Operativo"),
        osSegments,
        trText(locale, "Downloads", "Downloads", "Descargas")
      );
    } else {
      osMount.innerHTML = renderZeroDownloadsChartCard(
        trText(locale, "Downloads por Sistema Operacional", "Downloads by Operating System", "Descargas por Sistema Operativo"),
        locale
      );
    }
  }

  const kindMount = root.querySelector<HTMLElement>("#chart-kind-donut");
  if (kindMount) {
    const kindSegments = summary.kindBreakdown
      .filter((s) => s.count > 0)
      .map((s) => ({
        label: s.label,
        value: s.count,
        color: s.color,
      }));

    if (kindSegments.length > 0) {
      renderRingDonutChart(
        kindMount,
        trText(locale, "Preferência por Formato de Instalação", "Installation Format Preference", "Preferencia por Formato de Instalación"),
        kindSegments,
        trText(locale, "Downloads", "Downloads", "Descargas")
      );
    } else {
      kindMount.innerHTML = renderZeroDownloadsChartCard(
        trText(locale, "Preferência por Formato de Instalação", "Installation Format Preference", "Preferencia por Formato de Instalación"),
        locale
      );
    }
  }

  const chronoMount = root.querySelector<HTMLElement>("#chart-chrono-area");
  if (chronoMount) {
    const labels =
      summary.chronologicalSeries.labels.length >= 2
        ? summary.chronologicalSeries.labels
        : summary.chronologicalSeries.labels.length === 1
        ? [summary.chronologicalSeries.labels[0], summary.chronologicalSeries.labels[0]]
        : ["—", "—"];

    const dlData =
      summary.chronologicalSeries.downloads.length >= 2
        ? summary.chronologicalSeries.downloads
        : summary.chronologicalSeries.downloads.length === 1
        ? [summary.chronologicalSeries.downloads[0], summary.chronologicalSeries.downloads[0]]
        : [0, 0];

    const mbData =
      summary.chronologicalSeries.megabytesDelivered.length >= 2
        ? summary.chronologicalSeries.megabytesDelivered
        : summary.chronologicalSeries.megabytesDelivered.length === 1
        ? [summary.chronologicalSeries.megabytesDelivered[0], summary.chronologicalSeries.megabytesDelivered[0]]
        : [0, 0];

    renderInteractiveAreaChart(chronoMount, {
      title: trText(
        locale,
        "Trajetória Real de Downloads e Tráfego (MB) por Lançamento",
        "Real Downloads & Delivered Traffic (MB) Trajectory per Release",
        "Trayectoria Real de Descargas y Tráfico (MB) por Lanzamiento"
      ),
      subtitle: trText(
        locale,
        "Ordem cronológica exata de publicação no GitHub Releases (passe o cursor para inspecionar)",
        "Exact chronological publication order on GitHub Releases (hover to inspect)",
        "Orden cronológico exacto de publicación en GitHub Releases (pase el cursor para inspeccionar)"
      ),
      labels,
      series: [
        {
          name: trText(locale, "Downloads", "Downloads", "Descargas"),
          color: selectedRepo ? getProductColor(selectedRepo) : "#8b5cf6",
          data: dlData,
        },
        {
          name: trText(locale, "Volume Entregue (MB)", "Volume Delivered (MB)", "Volumen Entregado (MB)"),
          color: "#06b6d4",
          data: mbData,
        },
      ],
    });
  }

  const sizeMount = root.querySelector<HTMLElement>("#chart-binary-size-area");
  if (sizeMount && selectedRepo) {
    const rawLabels = summary.binarySizeSeries.labels;
    const labels =
      rawLabels.length >= 2
        ? rawLabels
        : rawLabels.length === 1
        ? [rawLabels[0], rawLabels[0]]
        : ["—", "—"];

    const padTwo = (arr: number[]) =>
      arr.length >= 2 ? arr : arr.length === 1 ? [arr[0], arr[0]] : [0, 0];

    renderInteractiveAreaChart(sizeMount, {
      title: trText(
        locale,
        "Evolução Real do Tamanho dos Binários (MB) entre Versões",
        "Real Binary Footprint Evolution (MB) Across Releases",
        "Evolución Real del Tamaño de Binarios (MB) entre Versiones"
      ),
      subtitle: trText(
        locale,
        "Acompanhamento de peso dos pacotes compilados em Windows, macOS e Linux",
        "Compiled package footprint tracking across Windows, macOS, and Linux",
        "Seguimiento del peso de paquetes compilados en Windows, macOS y Linux"
      ),
      labels,
      unit: " MB",
      series: [
        {
          name: "Windows",
          color: "#3b82f6",
          data: padTwo(summary.binarySizeSeries.windowsInstallerMb),
        },
        {
          name: "macOS",
          color: "#f59e0b",
          data: padTwo(summary.binarySizeSeries.macosMb),
        },
        {
          name: "Linux",
          color: "#10b981",
          data: padTwo(summary.binarySizeSeries.linuxMb),
        },
      ],
    });
  }
}

function renderZeroDownloadsChartCard(title: string, locale: UiLocale): string {
  return `
    <div class="matz-card matz-beam-top oss-empty-state">
      <div style="font-size:14px;font-weight:700;color:var(--text-primary);">${escHtml(title)}</div>
      <p style="font-size:12.5px;color:var(--text-muted);max-width:340px;">
        ${trText(
          locale,
          "Os binários publicados ainda registram 0 downloads acumulados na API do GitHub.",
          "Published binaries currently record 0 cumulative downloads in the GitHub API.",
          "Los binarios publicados registran actualmente 0 descargas acumuladas en la API de GitHub."
        )}
      </p>
    </div>
  `;
}
