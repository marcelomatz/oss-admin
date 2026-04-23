<script lang="ts">
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    let activeTabIndex = $state(0);
    
    function getProjectName(repo: string) {
        return repo.split('/')[1] || repo;
    }

    function formatDate(dateStr: string) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    }

    let activeProject = $derived(activeTabIndex > 0 && data.projects ? data.projects[activeTabIndex - 1] : null);
    let totalGlobalDownloads = $derived(data.projects ? data.projects.reduce((acc, p) => acc + p.totalDownloads, 0) : 0);
    let totalGlobalStars = $derived(data.projects ? data.projects.reduce((acc, p) => acc + (p.info?.stars || 0), 0) : 0);
    let totalGlobalIssues = $derived(data.projects ? data.projects.reduce((acc, p) => acc + (p.info?.issues || 0), 0) : 0);
    let totalGlobalForks = $derived(data.projects ? data.projects.reduce((acc, p) => acc + (p.info?.forks || 0), 0) : 0);

    let marketshare = $derived.by(() => {
        if (!activeProject || activeProject.totalDownloads === 0) return [];
        
        const osMap = new Map<string, number>();
        for (const detail of activeProject.details) {
            osMap.set(detail.os, (osMap.get(detail.os) || 0) + detail.downloads);
        }
        
        return Array.from(osMap.entries()).map(([os, count]) => ({
            os,
            count,
            percentage: ((count / activeProject.totalDownloads) * 100).toFixed(1)
        })).sort((a, b) => b.count - a.count);
    });

    let globalMarketshare = $derived.by(() => {
        if (!data.projects || totalGlobalDownloads === 0) return [];
        
        const osMap = new Map<string, number>();
        for (const project of data.projects) {
            for (const detail of project.details) {
                osMap.set(detail.os, (osMap.get(detail.os) || 0) + detail.downloads);
            }
        }
        
        return Array.from(osMap.entries()).map(([os, count]) => ({
            os,
            count,
            percentage: ((count / totalGlobalDownloads) * 100).toFixed(1)
        })).sort((a, b) => b.count - a.count);
    });

    let groupedReleases = $derived.by(() => {
        if (!activeProject) return [];
        
        const versionMap = new Map<string, { date: string, total: number, osDetails: Record<string, number>, url: string, author: string }>();
        
        for (const detail of activeProject.details) {
            if (!versionMap.has(detail.version)) {
                versionMap.set(detail.version, {
                    date: detail.date,
                    total: 0,
                    osDetails: {},
                    url: detail.releaseUrl,
                    author: detail.author
                });
            }
            
            const vData = versionMap.get(detail.version)!;
            vData.total += detail.downloads;
            vData.osDetails[detail.os] = (vData.osDetails[detail.os] || 0) + detail.downloads;
        }
        
        return Array.from(versionMap.entries())
            .map(([version, data]) => ({ version, ...data }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    let showAllReleases = $state(false);
    
    $effect(() => {
        activeTabIndex;
        showAllReleases = false;
    });
</script>

<svelte:head>
    <title>OSS Admin Dashboard</title>
</svelte:head>

<main class="dashboard-container">
    <header class="dashboard-header animate-fade-in">
        <h1>OSS Admin</h1>
        <p>Monitoramento e Marketshare Open Source</p>
    </header>

    {#if !data.projects || data.projects.length === 0}
        <div class="no-data animate-fade-in">
            <p>Nenhum dado encontrado. Verifique a configuração da API do GitHub.</p>
        </div>
    {:else}
        <!-- Tabs -->
        <div class="tabs-container animate-fade-in">
            <button 
                class="tab-btn {activeTabIndex === 0 ? 'active' : ''}" 
                onclick={() => activeTabIndex = 0}>
                Visão Geral
            </button>
            {#each data.projects as project, i}
                <button 
                    class="tab-btn {activeTabIndex === i + 1 ? 'active' : ''}" 
                    onclick={() => activeTabIndex = i + 1}>
                    {getProjectName(project.repo)}
                </button>
            {/each}
        </div>

        <!-- Visão Geral -->
        {#if activeTabIndex === 0}
            <div class="project-view animate-fade-in">
                <div class="project-overview">
                    <div class="card total-card">
                        <div class="total-number">{totalGlobalDownloads}</div>
                        <div class="total-label">Downloads Globais</div>
                    </div>

                    <div class="card marketshare-card">
                        <h3>Marketshare Geral</h3>
                        {#if totalGlobalDownloads === 0}
                            <div class="no-data" style="padding: 1rem;">Sem dados para gerar gráficos</div>
                        {:else}
                            <div class="os-bars">
                                {#each globalMarketshare as stat}
                                    <div class="os-bar-item">
                                        <div class="os-bar-header">
                                            <div class="os-label os-{stat.os}">
                                                <span class="os-dot"></span>
                                                {stat.os}
                                            </div>
                                            <div>
                                                <span class="os-percent">{stat.percentage}%</span>
                                                <span class="os-count">({stat.count})</span>
                                            </div>
                                        </div>
                                        <div class="bar-track">
                                            <div class="bar-fill os-{stat.os}" style="width: {stat.percentage}%;"></div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <div class="card repo-info-card">
                        <h3>Estatísticas Globais do OSS</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">A soma das métricas de todos os seus repositórios indexados no GitHub.</p>
                        <div class="repo-stats" style="display:flex; flex-wrap:wrap; gap: 1rem;">
                            <div class="repo-stat-item">
                                <span class="stat-icon">⭐</span>
                                <strong>{totalGlobalStars}</strong>
                                <span>Stars</span>
                            </div>
                            <div class="repo-stat-item">
                                <span class="stat-icon">🐛</span>
                                <strong>{totalGlobalIssues}</strong>
                                <span>Issues Abertas</span>
                            </div>
                            <div class="repo-stat-item">
                                <span class="stat-icon">🍴</span>
                                <strong>{totalGlobalForks}</strong>
                                <span>Forks</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card releases-card">
                    <h3>Visão dos Softwares</h3>
                    <div class="projects-summary-grid">
                        {#each [...data.projects].sort((a,b) => b.totalDownloads - a.totalDownloads) as project}
                            <div class="release-item" style="display:flex; flex-direction:column; justify-content:space-between; align-items:center; text-align:center; min-height: 220px;">
                                <div>
                                    <span class="release-version" style="font-size: 1.5rem; margin-bottom:0.5rem; display:block;">{getProjectName(project.repo)}</span>
                                    <strong style="font-size: 2rem; color: var(--accent-color); line-height: 1;">{project.totalDownloads}</strong>
                                    <span class="release-date" style="display:block; margin-top: 0.2rem;">Downloads Totais</span>
                                </div>
                                {#if project.info}
                                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 1rem; display: flex; gap: 0.75rem; justify-content: center; background: rgba(0,0,0,0.2); padding: 0.4rem 0.8rem; border-radius: 99px;">
                                        <span title="Stars">⭐ {project.info.stars}</span>
                                        <span title="Issues">🐛 {project.info.issues}</span>
                                        <span title="Forks">🍴 {project.info.forks}</span>
                                    </div>
                                    <a href="{project.info.url}" target="_blank" rel="noopener noreferrer" class="release-link" style="margin-top: 1rem; font-size: 0.95rem;">Acessar Repositório ↗</a>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        {/if}

        <!-- Projeto Ativo -->
        {#if activeProject}
            {#key activeProject.repo}
                <div class="project-view animate-fade-in">
                    
                    <div class="project-overview">
                        <div class="card total-card">
                            <div class="total-number">{activeProject.totalDownloads}</div>
                            <div class="total-label">Downloads Totais</div>
                        </div>

                        <div class="card marketshare-card">
                            <h3>Marketshare por Sistema Operacional</h3>
                            {#if activeProject.totalDownloads === 0}
                                <div class="no-data" style="padding: 1rem;">Sem dados para gerar gráficos</div>
                            {:else}
                                <div class="os-bars">
                                    {#each marketshare as stat}
                                        <div class="os-bar-item">
                                            <div class="os-bar-header">
                                                <div class="os-label os-{stat.os}">
                                                    <span class="os-dot"></span>
                                                    {stat.os}
                                                </div>
                                                <div>
                                                    <span class="os-percent">{stat.percentage}%</span>
                                                    <span class="os-count">({stat.count})</span>
                                                </div>
                                            </div>
                                            <div class="bar-track">
                                                <div class="bar-fill os-{stat.os}" style="width: {stat.percentage}%;"></div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>

                        <!-- Novo Card de Metadados do Repositório (se existir) -->
                        {#if activeProject.info}
                            <div class="card repo-info-card">
                                <h3>Sobre o Projeto</h3>
                                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">{activeProject.info.description || 'Sem descrição.'}</p>
                                
                                <div class="repo-stats" style="display:flex; flex-wrap:wrap; gap: 1rem; margin-bottom: 1.5rem;">
                                    <div class="repo-stat-item">
                                        <span class="stat-icon">⭐</span>
                                        <strong>{activeProject.info.stars}</strong>
                                        <span>Stars</span>
                                    </div>
                                    <div class="repo-stat-item">
                                        <span class="stat-icon">🐛</span>
                                        <strong>{activeProject.info.issues}</strong>
                                        <span>Issues Abertas</span>
                                    </div>
                                    <div class="repo-stat-item">
                                        <span class="stat-icon">🍴</span>
                                        <strong>{activeProject.info.forks}</strong>
                                        <span>Forks</span>
                                    </div>
                                </div>
                                
                                <a href="{activeProject.info.url}" target="_blank" rel="noopener noreferrer" class="cta-button">Ver Repositório no GitHub</a>
                            </div>
                        {/if}
                    </div>

                    {#if groupedReleases.length > 0}
                        <div class="card releases-card">
                            <h3>Histórico de Lançamentos</h3>
                            
                            <div class="release-grid">
                                {#each showAllReleases ? groupedReleases : groupedReleases.slice(0, 6) as release}
                                    <div class="release-item">
                                        <div class="release-header" style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem;">
                                            <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
                                                <a href="{release.url}" target="_blank" rel="noopener noreferrer" class="release-version release-link">
                                                    {release.version} ↗
                                                </a>
                                                <span class="release-date">{formatDate(release.date)}</span>
                                            </div>
                                            <span style="font-size: 0.8rem; color: var(--text-secondary);">Lançado por @{release.author}</span>
                                        </div>
                                        <div class="release-os-list">
                                            <div class="release-os-row" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.25rem;">
                                                <span>Total desta versão:</span>
                                                <strong>{release.total}</strong>
                                            </div>
                                            
                                            {#each Object.entries(release.osDetails).sort((a, b) => b[1] - a[1]) as [os, count]}
                                                <div class="release-os-row">
                                                    <span style="display:flex; align-items:center; gap:0.4rem;">
                                                        <span class="os-dot os-{os}" style="width:6px; height:6px;"></span>
                                                        {os}
                                                    </span>
                                                    <strong>{count}</strong>
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                {/each}
                            </div>

                            {#if groupedReleases.length > 6}
                                <button class="expand-button" onclick={() => showAllReleases = !showAllReleases}>
                                    {showAllReleases ? 'Mostrar Menos' : `Ver todo o histórico (${groupedReleases.length} lançamentos)`}
                                </button>
                            {/if}
                        </div>
                    {/if}
                    
                </div>
            {/key}
        {/if}
    {/if}
</main>
