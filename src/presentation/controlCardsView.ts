/**
 * Layer 4 — Download Control & Active Release Platform Audit Cards
 * Displays every software's active version, 5-slot platform availability,
 * exact binary sizes, download counts (including 0), SHA-256 hashes, and 1-click URL/Download actions.
 */
import { matzIcon } from "@matz/ui/icons";
import {
  buildPermanentLatestAssetUrl,
  cleanSha256Digest,
  countCoveredPlatformSlots,
  formatBytesHuman,
  formatShortDate,
  getDisplayName,
  getOfficialSiteUrl,
  getProductBadge,
  getProductColor,
  inspectLatestPlatformCoverage,
  PRODUCT_DISPLAY_META,
  ProjectTelemetry,
  ReleaseAssetItem,
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

interface CanonicalSlotSpec {
  id: string;
  label: string;
  icon: "window" | "laptop" | "terminal";
  asset: ReleaseAssetItem | null;
}

export function renderDownloadControlSection(
  projects: ProjectTelemetry[],
  selectedRepo: string | null,
  locale: UiLocale
): string {
  const scoped = selectedRepo ? projects.filter((p) => p.repo === selectedRepo) : projects;

  const cardsHtml = scoped
    .map((proj) => {
      const name = getDisplayName(proj.repo);
      const color = getProductColor(proj.repo);
      const meta = PRODUCT_DISPLAY_META[proj.repo];
      const iconName = (meta?.icon || "package") as "feather" | "terminal" | "code" | "api" | "package";
      const officialUrl = getOfficialSiteUrl(proj);
      const latest = proj.releases[0];
      const cov = inspectLatestPlatformCoverage(latest);
      const coveredSlots = countCoveredPlatformSlots(cov);

      const desc =
        proj.info.description ||
        getProductBadge(proj.repo, locale);

      if (!latest) {
        return `
          <article class="matz-card matz-beam-top oss-control-card">
            <div class="oss-control-header">
              <div class="oss-control-identity">
                <span class="oss-product-glyph" style="color:${color};border-color:${color}44;">
                  ${matzIcon(iconName, 18)}
                </span>
                <div>
                  <div class="oss-control-title-row">
                    <h3 class="oss-control-name">${escHtml(name)}</h3>
                    <span class="matz-badge matz-badge-amber">${trText(locale, "Sem versões públicas", "No public releases", "Sin versiones públicas")}</span>
                  </div>
                  <p class="oss-control-desc">${escHtml(desc)}</p>
                </div>
              </div>
              <a href="${escHtml(proj.info.url)}" target="_blank" rel="noopener noreferrer" class="oss-icon-action">
                ${matzIcon("external", 12)} GitHub
              </a>
            </div>
          </article>
        `;
      }

      const canonicalSlots: CanonicalSlotSpec[] = [
        {
          id: "win-inst",
          label: trText(locale, "Windows · Instalador (.exe)", "Windows · Installer (.exe)", "Windows · Instalador (.exe)"),
          icon: "window",
          asset: cov.windowsInstaller,
        },
        {
          id: "win-port",
          label: trText(locale, "Windows · Portátil (.exe)", "Windows · Portable (.exe)", "Windows · Portátil (.exe)"),
          icon: "window",
          asset: cov.windowsPortable,
        },
        {
          id: "mac-dmg",
          label: trText(locale, "macOS · Instalador (.dmg)", "macOS · Installer (.dmg)", "macOS · Instalador (.dmg)"),
          icon: "laptop",
          asset: cov.macosDmg,
        },
        {
          id: "mac-zip",
          label: trText(locale, "macOS · Pacote (.zip)", "macOS · Archive (.zip)", "macOS · Paquete (.zip)"),
          icon: "laptop",
          asset: cov.macosZip,
        },
        {
          id: "linux-bin",
          label: trText(locale, "Linux · Binário x64", "Linux · x64 Binary", "Linux · Binario x64"),
          icon: "terminal",
          asset: cov.linuxBinary,
        },
      ];

      const coveredAssetIds = new Set(
        canonicalSlots.map((s) => s.asset?.id).filter((id): id is number => Boolean(id))
      );
      const extraAssets = latest.assets.filter((a) => !coveredAssetIds.has(a.id));

      const slotRowsHtml = canonicalSlots
        .map((slot) => renderSlotRow(proj.repo, latest.tag, slot.label, slot.icon, slot.asset, locale))
        .join("");

      const extraRowsHtml = extraAssets
        .map((extra) =>
          renderSlotRow(
            proj.repo,
            latest.tag,
            `${extra.os} · ${trText(locale, "Extra", "Extra", "Extra")}`,
            "terminal",
            extra,
            locale
          )
        )
        .join("");

      const coverageBadgeClass =
        coveredSlots === 5
          ? "matz-badge-emerald"
          : coveredSlots >= 3
          ? "matz-badge-cyan"
          : "matz-badge-amber";

      return `
        <article class="matz-card matz-beam-top oss-control-card">
          <div class="oss-control-header">
            <div class="oss-control-identity">
              <span class="oss-product-glyph" style="color:${color};border-color:${color}55;">
                ${matzIcon(iconName, 18)}
              </span>
              <div>
                <div class="oss-control-title-row">
                  <h3 class="oss-control-name">${escHtml(name)}</h3>
                  <span class="oss-release-tag">${escHtml(latest.tag)}</span>
                  <span class="matz-badge ${coverageBadgeClass}">
                    ${coveredSlots}/5 ${trText(locale, "formatos ativos", "active formats", "formatos activos")}
                  </span>
                </div>
                <p class="oss-control-desc">${escHtml(desc)}</p>
              </div>
            </div>

            <div class="oss-control-links">
              ${
                !selectedRepo
                  ? `<button type="button" class="oss-icon-action" data-select-repo="${escHtml(proj.repo)}" title="${trText(locale, "Focar analytics neste software", "Focus analytics on this software", "Enfocar analítica en este software")}">
                      ${matzIcon("chart", 12)}
                      <span>${trText(locale, "Focar", "Focus", "Enfocar")}</span>
                    </button>`
                  : ""
              }
              <a href="${escHtml(officialUrl)}" target="_blank" rel="noopener noreferrer" class="oss-icon-action">
                ${matzIcon("globe", 12)}
                <span>${trText(locale, "Site", "Website", "Sitio")}</span>
              </a>
              <a href="${escHtml(latest.url)}" target="_blank" rel="noopener noreferrer" class="oss-icon-action">
                ${matzIcon("external", 12)}
                <span>Release</span>
              </a>
            </div>
          </div>

          <div class="oss-slot-list">
            ${slotRowsHtml}
            ${extraRowsHtml}
          </div>

          <div class="oss-control-footer">
            <span>
              ${matzIcon("calendar", 12)}
              ${trText(locale, "Publicada em", "Published on", "Publicada el")}
              <strong style="color:var(--text-secondary);">${escHtml(formatShortDate(latest.publishedAt, locale))}</strong>
              · ${trText(locale, "Versão atual:", "Active release:", "Versión actual:")}
              <strong class="matz-tabular" style="color:var(--text-primary);">${latest.totalDownloads.toLocaleString(locale)}</strong>
              ${trText(locale, "downloads", "downloads", "descargas")}
            </span>
            <span class="matz-tabular">
              ${trText(locale, "Acumulado histórico:", "All-time total:", "Acumulado histórico:")}
              <strong style="color:var(--text-primary);">${proj.totalDownloads.toLocaleString(locale)}</strong>
              (${escHtml(formatBytesHuman(proj.totalBytesTransferred))})
            </span>
          </div>
        </article>
      `;
    })
    .join("");

  return `
    <section class="oss-section" id="control">
      <div class="oss-section-head">
        <div>
          <div class="oss-section-eyebrow">${matzIcon("shield-check", 13)} ${trText(locale, "Controle de Distribuição & Binários", "Distribution & Binary Control", "Control de Distribución y Binarios")}</div>
          <h2 class="oss-section-title">${trText(locale, "Auditoria da Versão Atual e Links Oficiais de Download", "Active Release Audit & Official Download Links", "Auditoría de la Versión Actual y Enlaces Oficiales")}</h2>
          <p class="oss-section-desc">
            ${trText(
              locale,
              "Verifique instantaneamente quais instaladores e executáveis estão publicados na versão ativa de cada software, copie URLs permanentes (/latest/) para uso nos sites ou baixe qualquer binário auditado.",
              "Instantly verify which installers and executables are published in each software's active release, copy permanent (/latest/) URLs for websites, or download any audited binary.",
              "Verifique al instante qué instaladores y ejecutables están publicados en la versión activa de cada software, copie URLs permanentes (/latest/) o descargue cualquier binario auditado."
            )}
          </p>
        </div>
      </div>

      <div class="oss-control-grid ${scoped.length === 1 ? "is-single" : ""}">
        ${cardsHtml}
      </div>
    </section>
  `;
}

function renderSlotRow(
  repo: string,
  tag: string,
  slotLabel: string,
  iconName: "window" | "laptop" | "terminal",
  asset: ReleaseAssetItem | null,
  locale: UiLocale
): string {
  if (!asset) {
    return `
      <div class="oss-slot-row is-missing">
        <div class="oss-slot-platform">
          ${matzIcon(iconName, 13)}
          <span>${escHtml(slotLabel)}</span>
        </div>
        <div class="oss-slot-file">
          <span class="oss-slot-filename">${trText(locale, "Não incluído nesta versão", "Not included in this release", "No incluido en esta versión")}</span>
        </div>
        <div class="oss-slot-stats">
          <span>—</span>
        </div>
        <div class="oss-slot-actions">
          <span class="matz-badge" style="background:transparent;border-color:var(--border);color:var(--text-muted);font-size:10px;">
            ${trText(locale, "Ausente", "Missing", "Ausente")}
          </span>
        </div>
      </div>
    `;
  }

  const sha = cleanSha256Digest(asset.digest);
  const latestUrl = buildPermanentLatestAssetUrl(repo, asset.name);

  return `
    <div class="oss-slot-row">
      <div class="oss-slot-platform">
        ${matzIcon(iconName, 13)}
        <span>${escHtml(slotLabel)}</span>
      </div>

      <div class="oss-slot-file">
        <span class="oss-slot-filename" title="${escHtml(asset.name)}">${escHtml(asset.name)}</span>
        ${
          sha
            ? `<span class="oss-slot-sha" title="SHA-256: ${escHtml(sha)}">
                ${matzIcon("badge-check", 11)}
                <span>sha256:${escHtml(sha.slice(0, 10))}…${escHtml(sha.slice(-6))}</span>
              </span>`
            : `<span class="oss-slot-sha">${trText(locale, "Sem hash SHA-256 na API", "No SHA-256 digest in API", "Sin hash SHA-256 en API")}</span>`
        }
      </div>

      <div class="oss-slot-stats matz-tabular">
        <strong style="color:var(--text-primary);">${asset.downloads.toLocaleString(locale)} dl</strong>
        <span style="color:var(--text-muted);">${escHtml(formatBytesHuman(asset.sizeBytes))}</span>
      </div>

      <div class="oss-slot-actions">
        <button
          type="button"
          class="oss-icon-action"
          data-copy-text="${escHtml(latestUrl)}"
          data-copy-label="${escHtml(trText(locale, "Link permanente /latest/ copiado", "Permanent /latest/ link copied", "Enlace permanente /latest/ copiado"))}"
          title="${escHtml(trText(locale, "Copiar link permanente /releases/latest/download/...", "Copy permanent /releases/latest/download/... URL", "Copiar enlace permanente /releases/latest/download/..."))}"
        >
          ${matzIcon("link", 11)}
          <span>/latest</span>
        </button>

        <button
          type="button"
          class="oss-icon-action"
          data-copy-text="${escHtml(asset.downloadUrl)}"
          data-copy-label="${escHtml(trText(locale, `Link fixo (${tag}) copiado`, `Pinned (${tag}) link copied`, `Enlace fijo (${tag}) copiado`))}"
          title="${escHtml(trText(locale, `Copiar URL fixa da versão ${tag}`, `Copy pinned ${tag} URL`, `Copiar URL fija de la versión ${tag}`))}"
        >
          ${matzIcon("copy", 11)}
        </button>

        ${
          sha
            ? `<button
                type="button"
                class="oss-icon-action"
                data-copy-text="sha256:${escHtml(sha)}"
                data-copy-label="${escHtml(trText(locale, "Hash SHA-256 copiado", "SHA-256 hash copied", "Hash SHA-256 copiado"))}"
                title="Copiar SHA-256"
              >
                ${matzIcon("fingerprint", 11)}
              </button>`
            : ""
        }

        <a
          href="${escHtml(asset.downloadUrl)}"
          class="oss-icon-action is-primary"
          title="${escHtml(trText(locale, "Baixar binário oficial", "Download official binary", "Descargar binario oficial"))}"
        >
          ${matzIcon("download", 11)}
          <span>${trText(locale, "Baixar", "Download", "Descargar")}</span>
        </a>
      </div>
    </div>
  `;
}
