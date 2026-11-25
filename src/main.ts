/**
 * Layer 4 — Main Portal Entrypoint (`oss-admin`)
 * Standardized on `@matz/ui` (`renderMatzPortalHeader`, `renderMatzPortalFooter`, `renderSparklineCard`,
 * `renderRingDonutChart`, `renderInteractiveAreaChart`, Specular Obsidian & Satin Alabaster themes).
 * Zero fake data, zero placeholders, zero emojis.
 */
import "@matz/ui/styles.css";
import "./styles/oss-admin.css";

import { matzIcon } from "@matz/ui/icons";
import { renderSparklineCard } from "@matz/ui/analytics";
import {
  bindMatzPortalHeaderEvents,
  renderMatzPortalFooter,
  renderMatzPortalHeader,
} from "@matz/ui/web";
import {
  computeRealAnalytics,
  formatBytesHuman,
  formatDateTime,
  getDisplayName,
  getLocalizedProductDescription,
  getProductBadge,
  getProductColor,
  normalizeUiLocale,
  PRODUCT_DISPLAY_META,
  trText,
  UiLocale,
} from "./domain";
import {
  buildTelemetryCsv,
  createInitialDashboardState,
  DashboardViewState,
  ReleaseSortField,
  selectFilteredReleases,
} from "./application/dashboardState";
import {
  copyTextToClipboard,
  loadTelemetrySnapshot,
  triggerTextFileDownload,
} from "./adapters/githubTelemetryAdapter";
import { renderDownloadControlSection } from "./presentation/controlCardsView";
import {
  mountRealAnalyticsCharts,
  renderAnalyticsSectionSkeleton,
} from "./presentation/analyticsSectionView";
import {
  renderLedgerEntriesHtml,
  renderReleaseLedgerSection,
} from "./presentation/releaseLedgerView";

// Re-export ReleaseSortField type check cleanly
type SortKey = ReleaseSortField;

const LOCALE_STORAGE_KEY = "oss-admin:locale";
const THEME_STORAGE_KEY = "oss-admin:theme";

const initialLocale: UiLocale = normalizeUiLocale(
  localStorage.getItem(LOCALE_STORAGE_KEY) || navigator.language
);
const initialTheme: "dark" | "light" =
  localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";

const state: DashboardViewState = createInitialDashboardState(initialLocale, initialTheme);
let toastTimer: number | undefined;

function applyDocumentThemeAndProduct(): void {
  document.documentElement.setAttribute("data-theme", state.theme);
  document.documentElement.lang = state.locale;
  const productAttr = state.selectedRepo
    ? PRODUCT_DISPLAY_META[state.selectedRepo]?.productId || "matz"
    : "matz";
  document.documentElement.setAttribute("data-product", productAttr);
}

function showToast(msg: string): void {
  state.toastMessage = msg;
  const existing = document.getElementById("oss-toast-el");
  if (existing) {
    existing.innerHTML = `${matzIcon("check-circle", 14)} <span>${escHtml(msg)}</span>`;
  } else {
    const div = document.createElement("div");
    div.id = "oss-toast-el";
    div.className = "oss-toast";
    div.innerHTML = `${matzIcon("check-circle", 14)} <span>${escHtml(msg)}</span>`;
    document.body.appendChild(div);
  }
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    state.toastMessage = null;
    document.getElementById("oss-toast-el")?.remove();
  }, 2600);
}

function escHtml(val: string | number): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortLocaleCode(locale: UiLocale): "pt" | "en" | "es" {
  if (locale === "en-US") return "en";
  if (locale === "es-ES") return "es";
  return "pt";
}

function sourceBadgeText(source: string, locale: UiLocale): string {
  if (source === "server-authenticated" || source === "go-server-authenticated") {
    return trText(locale, "API Autenticada", "Authenticated API", "API Autenticada");
  }
  if (source === "server-public" || source === "go-server-public") {
    return trText(locale, "Servidor Edge Público", "Public Edge Server", "Servidor Edge Público");
  }
  return trText(locale, "GitHub REST Direto", "Direct GitHub REST", "GitHub REST Directo");
}

function ensureSparklinePoints(series: number[]): number[] {
  if (series.length >= 2) return series;
  if (series.length === 1) return [series[0], series[0]];
  return [0, 0];
}

function renderPortal(): void {
  applyDocumentThemeAndProduct();
  const root = document.getElementById("app");
  if (!root) return;

  const { locale, snapshot, selectedRepo } = state;
  const activeProductId = selectedRepo
    ? PRODUCT_DISPLAY_META[selectedRepo]?.productId || "matz"
    : "matz";

  const headerHtml = renderMatzPortalHeader({
    product: activeProductId,
    brandName: "OSS Release Control",
    brandHref: "#overview",
    brandIcon: "radar",
    version: "2.1",
    locale: shortLocaleCode(locale),
    theme: state.theme,
    showSuiteBar: false,
    navItems: [
      {
        id: "overview",
        label: trText(locale, "Visão Geral", "Overview", "Resumen"),
        href: "#overview",
        icon: "gauge",
      },
      {
        id: "control",
        label: trText(locale, "Controle de Downloads", "Download Control", "Control de Descargas"),
        href: "#control",
        icon: "download",
      },
      {
        id: "analytics",
        label: "Analytics",
        href: "#analytics",
        icon: "chart-line",
      },
      {
        id: "releases",
        label: trText(locale, "Histórico & Binários", "Releases & Binaries", "Versiones y Binarios"),
        href: "#releases",
        icon: "archive",
      },
    ],
    secondaryLink: {
      label: "GitHub",
      href: "https://github.com/marcelomatz",
      icon: "external",
      external: true,
    },
    cta: {
      label: trText(locale, "Auditar Versões", "Audit Releases", "Auditar Versiones"),
      href: "#control",
      icon: "shield-check",
    },
  });

  const footerHtml = renderMatzPortalFooter({
    product: activeProductId,
    brandName: "OSS Release & Download Control",
    brandIcon: "radar",
    version: "2.1",
    tagline: trText(
      locale,
      "Telemetria 100% determinística e controle de distribuição binária em tempo real via GitHub REST API — zero métricas sintéticas.",
      "100% deterministic telemetry and real-time binary distribution control powered by GitHub REST API — zero synthetic metrics.",
      "Telemetría 100% determinista y control de distribución binaria en tiempo real mediante GitHub REST API — cero métricas sintéticas."
    ),
    links: [
      { label: "Writtt", href: "https://www.writtt.com/", external: true },
      { label: "MyTerm", href: "https://myterm.marcelomatz.com.br/", external: true },
      { label: "ByCode", href: "https://bycode.marcelomatz.com.br/", external: true },
      { label: "Heapi", href: "https://heapi.marcelomatz.com.br/", external: true },
      { label: "GitHub @marcelomatz", href: "https://github.com/marcelomatz", external: true },
    ],
  });

  if (state.loading && !snapshot) {
    root.innerHTML = `
      <div class="oss-shell">
        ${headerHtml}
        <main class="oss-container">
          <div class="matz-card matz-beam-top oss-empty-state" style="min-height:320px;justify-content:center;">
            <span class="oss-spin" style="color:var(--accent);">${matzIcon("refresh", 28)}</span>
            <h1 style="font-size:18px;font-weight:800;color:var(--text-primary);">
              ${trText(locale, "Consultando lançamentos e binários reais no GitHub...", "Fetching real releases and binaries from GitHub...", "Consultando versiones y binarios reales en GitHub...")}
            </h1>
            <p style="font-size:13px;color:var(--text-secondary);max-width:460px;">
              ${trText(locale, "Sincronizando contadores verificados de downloads, tamanhos exatos em bytes e hashes SHA-256 dos 4 softwares.", "Synchronizing verified download counters, exact byte sizes, and SHA-256 hashes across all 4 softwares.", "Sincronizando contadores verificados de descargas, tamaños exactos en bytes y hashes SHA-256 de los 4 softwares.")}
            </p>
          </div>
        </main>
        ${footerHtml}
      </div>
    `;
    bindHeaderAndGlobalControls(root);
    return;
  }

  if (state.error && !snapshot) {
    root.innerHTML = `
      <div class="oss-shell">
        ${headerHtml}
        <main class="oss-container">
          <div class="matz-card oss-empty-state" style="border-color:var(--status-err);">
            <span style="color:var(--status-err);">${matzIcon("alert-triangle", 28)}</span>
            <h1 style="font-size:18px;font-weight:800;color:var(--text-primary);">
              ${trText(locale, "Não foi possível carregar os dados da API do GitHub", "Unable to load GitHub API telemetry", "No fue posible cargar los datos de la API de GitHub")}
            </h1>
            <p style="font-size:13px;color:var(--text-secondary);">${escHtml(state.error)}</p>
            <button type="button" class="matz-btn matz-btn-primary" id="oss-retry-btn">
              ${matzIcon("refresh", 14)}
              <span>${trText(locale, "Tentar Novamente", "Retry Now", "Reintentar Ahora")}</span>
            </button>
          </div>
        </main>
        ${footerHtml}
      </div>
    `;
    bindHeaderAndGlobalControls(root);
    root.querySelector("#oss-retry-btn")?.addEventListener("click", () => void refreshData(true));
    return;
  }

  if (!snapshot) return;

  const projects = snapshot.projects;
  const summary = computeRealAnalytics(projects, selectedRepo, locale);
  const ecosystemTotalDownloads = projects.reduce((s, p) => s + p.totalDownloads, 0);
  const ecosystemTotalReleases = projects.reduce((s, p) => s + p.releases.length, 0);

  const selectedProjectObj = selectedRepo
    ? projects.find((p) => p.repo === selectedRepo) || null
    : null;

  const opsBarHtml = `
    <div class="oss-ops-bar">
      <div class="oss-ops-meta">
        <span style="display:inline-flex;align-items:center;gap:7px;font-weight:600;color:var(--text-primary);">
          <span class="oss-live-dot"></span>
          <span>${trText(locale, "Dados Reais Auditados", "Verified Real Telemetry", "Datos Reales Auditados")}</span>
        </span>
        <span class="oss-ops-sep">·</span>
        <span>
          ${matzIcon("clock", 12)}
          ${trText(locale, "Sincronizado em", "Synced at", "Sincronizado el")}
          <strong class="matz-tabular" style="color:var(--text-primary);">${escHtml(formatDateTime(snapshot.fetchedAt, locale))}</strong>
        </span>
        <span class="oss-ops-sep">·</span>
        <span class="matz-badge" style="font-size:10.5px;">${escHtml(sourceBadgeText(snapshot.source, locale))}</span>
        ${
          snapshot.rateLimitRemaining !== null && snapshot.rateLimitLimit !== null
            ? `<span class="oss-ops-sep">·</span>
               <span class="matz-tabular" style="font-family:var(--font-mono);font-size:11px;">
                 GitHub Quota: <strong style="color:var(--text-primary);">${snapshot.rateLimitRemaining}/${snapshot.rateLimitLimit}</strong>
               </span>`
            : ""
        }
      </div>

      <div class="oss-ops-actions">
        <button type="button" class="matz-btn matz-btn-sm ${state.refreshing ? "oss-spin" : ""}" id="oss-refresh-btn" ${state.refreshing ? "disabled" : ""}>
          ${matzIcon("refresh", 13)}
          <span>${state.refreshing ? trText(locale, "Atualizando...", "Refreshing...", "Actualizando...") : trText(locale, "Atualizar Agora", "Refresh Live", "Actualizar Ahora")}</span>
        </button>
        <button type="button" class="matz-btn matz-btn-sm" id="oss-export-csv-btn">
          ${matzIcon("table", 13)}
          <span>CSV</span>
        </button>
        <button type="button" class="matz-btn matz-btn-sm" id="oss-export-json-btn">
          ${matzIcon("braces", 13)}
          <span>JSON</span>
        </button>
      </div>
    </div>
  `;

  const scopeTabsHtml = `
    <div class="oss-scope-grid" role="tablist" aria-label="Escopo de Software">
      <button
        type="button"
        class="oss-scope-tab ${selectedRepo === null ? "is-active" : ""}"
        data-select-repo=""
      >
        <div class="oss-scope-top">
          <span class="oss-scope-brand">
            <span class="oss-scope-dot" style="background:#8b5cf6;box-shadow:0 0 8px #8b5cf6;"></span>
            <span>${trText(locale, "Ecossistema Geral", "Full Ecosystem", "Ecosistema General")}</span>
          </span>
          <span class="oss-scope-tag">${projects.length} apps</span>
        </div>
        <div class="oss-scope-bottom">
          <span class="oss-scope-metric matz-tabular">${ecosystemTotalDownloads.toLocaleString(locale)} <small style="font-size:11px;font-weight:500;color:var(--text-muted);">dl</small></span>
          <span class="oss-scope-caption">${ecosystemTotalReleases} ${trText(locale, "versões", "releases", "versiones")}</span>
        </div>
      </button>

      ${projects
        .map((proj) => {
          const active = selectedRepo === proj.repo;
          const color = getProductColor(proj.repo);
          const latestTag = proj.releases[0]?.tag || "—";
          return `
            <button
              type="button"
              class="oss-scope-tab ${active ? "is-active" : ""}"
              data-select-repo="${escHtml(proj.repo)}"
            >
              <div class="oss-scope-top">
                <span class="oss-scope-brand">
                  <span class="oss-scope-dot" style="background:${color};box-shadow:0 0 8px ${color};"></span>
                  <span>${escHtml(getDisplayName(proj.repo))}</span>
                </span>
                <span class="oss-scope-tag">${escHtml(latestTag)}</span>
              </div>
              <div class="oss-scope-bottom">
                <span class="oss-scope-metric matz-tabular">${proj.totalDownloads.toLocaleString(locale)} <small style="font-size:11px;font-weight:500;color:var(--text-muted);">dl</small></span>
                <span class="oss-scope-caption">${escHtml(getProductBadge(proj.repo, locale))}</span>
              </div>
            </button>
          `;
        })
        .join("")}
    </div>
  `;

  const kpiDownloadsHtml = renderSparklineCard({
    title: trText(locale, "Downloads Verificados", "Verified Downloads", "Descargas Verificadas"),
    value: summary.totalDownloads.toLocaleString(locale),
    delta: summary.latestRelease
      ? `${summary.latestRelease.project} ${summary.latestRelease.tag}`
      : trText(locale, "Sem versões", "No releases", "Sin versiones"),
    positive: true,
    data: ensureSparklinePoints(summary.chronologicalSeries.downloads),
    color: selectedRepo ? getProductColor(selectedRepo) : "#8b5cf6",
  });

  const kpiBandwidthHtml = renderSparklineCard({
    title: trText(locale, "Volume Binário Entregue", "Binary Volume Delivered", "Volumen Binario Entregado"),
    value: formatBytesHuman(summary.totalBytesTransferred),
    delta: `${summary.averageDownloadsPerRelease} dl/${trText(locale, "versão", "release", "versión")}`,
    positive: true,
    data: ensureSparklinePoints(summary.chronologicalSeries.megabytesDelivered),
    color: "#06b6d4",
  });

  const cadenceText =
    summary.averageReleaseCadenceDays !== null
      ? `${summary.averageReleaseCadenceDays} ${trText(locale, "dias", "days", "días")}`
      : trText(locale, "Versão única", "Single release", "Versión única");

  const kpiCadenceHtml = `
    <div class="matz-card matz-beam-top oss-kpi-custom">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="font-size:12px;font-weight:600;color:var(--text-secondary);">
          ${trText(locale, "Versões & Artefatos Auditados", "Audited Releases & Artifacts", "Versiones y Artefactos Auditados")}
        </span>
        <span class="matz-badge matz-badge-cyan" style="font-size:10.5px;">
          ${summary.totalAssetsPublished} ${trText(locale, "binários", "binaries", "binarios")}
        </span>
      </div>

      <div class="matz-tabular" style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:var(--text-primary);line-height:1;">
        ${summary.totalReleases}
        <span style="font-size:13px;font-weight:600;color:var(--text-secondary);">${trText(locale, "lançamentos", "releases", "lanzamientos")}</span>
      </div>

      <div class="oss-kpi-subgrid matz-tabular">
        <div class="oss-kpi-mini">
          <span>${trText(locale, "Cadência média", "Avg cadence", "Cadencia media")}</span>
          <strong>${escHtml(cadenceText)}</strong>
        </div>
        <div class="oss-kpi-mini">
          <span>SHA-256</span>
          <strong>${summary.verifiedDigestAssetsCount}/${summary.totalAssetsPublished}</strong>
        </div>
      </div>
    </div>
  `;

  const kpiCommunityHtml = `
    <div class="matz-card matz-beam-top oss-kpi-custom">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="font-size:12px;font-weight:600;color:var(--text-secondary);">
          ${trText(locale, "Comunidade & Repositórios", "Community & Repositories", "Comunidad y Repositorios")}
        </span>
        <span class="matz-badge" style="font-size:10.5px;">
          ${selectedProjectObj ? escHtml(selectedProjectObj.info.language || "Go / TS") : "Open Source"}
        </span>
      </div>

      <div class="matz-tabular" style="display:flex;align-items:baseline;gap:14px;">
        <span style="font-size:28px;font-weight:800;letter-spacing:-0.03em;color:var(--text-primary);line-height:1;">
          ${summary.totalStars.toLocaleString(locale)}
        </span>
        <span style="font-size:12.5px;font-weight:600;color:var(--text-secondary);display:inline-flex;align-items:center;gap:4px;">
          ${matzIcon("star", 13)} Stars
        </span>
      </div>

      <div class="oss-kpi-subgrid matz-tabular">
        <div class="oss-kpi-mini">
          <span>${matzIcon("fork", 11)} Forks</span>
          <strong>${summary.totalForks.toLocaleString(locale)}</strong>
        </div>
        <div class="oss-kpi-mini">
          <span>${matzIcon("bug", 11)} Issues</span>
          <strong>${summary.totalOpenIssues.toLocaleString(locale)}</strong>
        </div>
      </div>
    </div>
  `;

  const heroTitle = selectedProjectObj
    ? `${getDisplayName(selectedProjectObj.repo)} — ${trText(locale, "Controle de Downloads & Telemetria", "Download Control & Telemetry", "Control de Descargas y Telemetría")}`
    : trText(
        locale,
        "Controle de Downloads e Telemetria Open-Source",
        "Open-Source Download Control & Release Telemetry",
        "Control de Descargas y Telemetría Open-Source"
      );

  const heroSubtitle = selectedProjectObj
    ? getLocalizedProductDescription(selectedProjectObj, locale)
    : trText(
        locale,
        "Central unificada de auditoria de releases, links oficiais de distribuição multiplataforma e métricas reais verificadas diretamente na API do GitHub para Writtt, MyTerm, ByCode e Heapi.",
        "Unified release audit center, multi-platform official distribution links, and real verified GitHub API metrics across Writtt, MyTerm, ByCode, and Heapi.",
        "Central unificada de auditoría de versiones, enlaces oficiales de distribución multiplataforma y métricas reales verificadas directamente en la API de GitHub para Writtt, MyTerm, ByCode y Heapi."
      );

  root.innerHTML = `
    <div class="oss-shell">
      ${headerHtml}

      <main class="oss-container">
        ${opsBarHtml}

        <section class="oss-hero" id="overview">
          <div class="oss-hero-header">
            <div>
              <h1 class="oss-hero-title matz-heading-grad">${escHtml(heroTitle)}</h1>
              <p class="oss-hero-subtitle">${escHtml(heroSubtitle)}</p>
            </div>
            ${
              selectedProjectObj
                ? `<button type="button" class="matz-btn" data-select-repo="">
                    ${matzIcon("arrow-left", 13)}
                    <span>${trText(locale, "Ver Todos os Softwares", "View All Softwares", "Ver Todos los Softwares")}</span>
                  </button>`
                : ""
            }
          </div>

          ${scopeTabsHtml}

          <div class="oss-kpi-grid">
            ${kpiDownloadsHtml}
            ${kpiBandwidthHtml}
            ${kpiCadenceHtml}
            ${kpiCommunityHtml}
          </div>
        </section>

        ${renderDownloadControlSection(projects, selectedRepo, locale)}
        ${renderAnalyticsSectionSkeleton(summary, projects, selectedRepo, locale)}
        ${renderReleaseLedgerSection(state)}
      </main>

      ${footerHtml}
    </div>
  `;

  mountRealAnalyticsCharts(root, summary, selectedRepo, locale);
  bindHeaderAndGlobalControls(root);
  bindInteractiveDashboardEvents(root);
}

function bindHeaderAndGlobalControls(root: ParentNode): void {
  bindMatzPortalHeaderEvents(root);

  root.querySelector("#matz-portal-theme-toggle")?.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, state.theme);
    renderPortal();
  });

  root.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = normalizeUiLocale(btn.dataset.locale);
      if (next !== state.locale) {
        state.locale = next;
        localStorage.setItem(LOCALE_STORAGE_KEY, next);
        renderPortal();
      }
    });
  });
}

function updateLedgerResultsOnly(): void {
  const resultsEl = document.getElementById("oss-ledger-results");
  const badgeEl = document.getElementById("ledger-count-badge");
  if (!resultsEl) return;
  const entries = selectFilteredReleases(state);
  resultsEl.innerHTML = renderLedgerEntriesHtml(entries, state);
  if (badgeEl) {
    badgeEl.textContent = `${entries.length} ${trText(state.locale, "versões exibidas", "releases shown", "versiones mostradas")}`;
  }
}

function bindInteractiveDashboardEvents(root: ParentNode): void {
  // Refresh button
  root.querySelector("#oss-refresh-btn")?.addEventListener("click", () => {
    void refreshData(true);
  });

  // CSV Export
  root.querySelector("#oss-export-csv-btn")?.addEventListener("click", () => {
    if (!state.snapshot) return;
    const scoped = state.selectedRepo
      ? state.snapshot.projects.filter((p) => p.repo === state.selectedRepo)
      : state.snapshot.projects;
    const csv = buildTelemetryCsv(scoped);
    const stamp = new Date().toISOString().slice(0, 10);
    triggerTextFileDownload(`oss-telemetry-${stamp}.csv`, csv, "text/csv;charset=utf-8");
    showToast(trText(state.locale, "Relatório CSV exportado", "CSV report exported", "Informe CSV exportado"));
  });

  // JSON Export
  root.querySelector("#oss-export-json-btn")?.addEventListener("click", () => {
    if (!state.snapshot) return;
    const stamp = new Date().toISOString().slice(0, 10);
    triggerTextFileDownload(
      `oss-telemetry-${stamp}.json`,
      JSON.stringify(state.snapshot, null, 2),
      "application/json;charset=utf-8"
    );
    showToast(trText(state.locale, "Snapshot JSON exportado", "JSON snapshot exported", "Snapshot JSON exportado"));
  });

  // Scope selection buttons
  root.querySelectorAll<HTMLElement>("[data-select-repo]").forEach((el) => {
    el.addEventListener("click", () => {
      const repoVal = el.getAttribute("data-select-repo") || "";
      state.selectedRepo = repoVal ? repoVal : null;
      renderPortal();
    });
  });

  // Filter controls in Release Ledger (preserving input focus on search!)
  const searchInput = root.querySelector<HTMLInputElement>("#oss-ledger-search");
  searchInput?.addEventListener("input", () => {
    state.searchQuery = searchInput.value;
    updateLedgerResultsOnly();
  });

  const osSelect = root.querySelector<HTMLSelectElement>("#oss-filter-os");
  osSelect?.addEventListener("change", () => {
    state.osFilter = osSelect.value as DashboardViewState["osFilter"];
    updateLedgerResultsOnly();
  });

  const kindSelect = root.querySelector<HTMLSelectElement>("#oss-filter-kind");
  kindSelect?.addEventListener("change", () => {
    state.kindFilter = kindSelect.value as DashboardViewState["kindFilter"];
    updateLedgerResultsOnly();
  });

  const sortSelect = root.querySelector<HTMLSelectElement>("#oss-sort-by");
  sortSelect?.addEventListener("change", () => {
    state.sortBy = sortSelect.value as SortKey;
    updateLedgerResultsOnly();
  });

  // Delegated click handler for copy buttons & release notes toggles (works inside dynamically updated ledger too!)
  const mainEl = root.querySelector("main");
  mainEl?.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;

    const copyBtn = target.closest<HTMLElement>("[data-copy-text]");
    if (copyBtn) {
      const text = copyBtn.getAttribute("data-copy-text") || "";
      const label =
        copyBtn.getAttribute("data-copy-label") ||
        trText(state.locale, "Copiado para a área de transferência", "Copied to clipboard", "Copiado al portapapeles");
      if (text) {
        void copyTextToClipboard(text).then((ok) => {
          if (ok) showToast(label);
        });
      }
      return;
    }

    const notesBtn = target.closest<HTMLElement>("[data-toggle-notes]");
    if (notesBtn) {
      const relId = Number(notesBtn.getAttribute("data-toggle-notes") || 0);
      if (relId > 0) {
        if (state.expandedReleaseIds.has(relId)) {
          state.expandedReleaseIds.delete(relId);
        } else {
          state.expandedReleaseIds.add(relId);
        }
        updateLedgerResultsOnly();
      }
    }
  });
}

async function refreshData(forceRefresh: boolean): Promise<void> {
  if (forceRefresh) {
    state.refreshing = true;
    renderPortal();
  } else {
    state.loading = true;
    renderPortal();
  }

  try {
    const snap = await loadTelemetrySnapshot(forceRefresh);
    state.snapshot = snap;
    state.error = null;
    if (forceRefresh) {
      showToast(
        trText(
          state.locale,
          "Telemetria sincronizada diretamente com o GitHub",
          "Telemetry synced live from GitHub",
          "Telemetría sincronizada en vivo con GitHub"
        )
      );
    }
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err);
  } finally {
    state.loading = false;
    state.refreshing = false;
    renderPortal();
  }
}

void refreshData(false);
