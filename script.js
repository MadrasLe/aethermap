document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos do DOM ---
    const processButton = document.getElementById('processButton');
    const fileUpload = document.getElementById('fileUpload');
    const samplesSlider = document.getElementById('samplesSlider');
    const samplesValue = document.getElementById('samplesValue');
    const loadingSection = document.getElementById('loadingSection');
    
    // Áreas principais
    const plotContainer = document.getElementById('plotContainer');
    const emptyState = document.getElementById('emptyState');
    const scribeWing = document.getElementById('scribe-wing');
    const scribeWingContent = document.getElementById('scribe-wing-content');
    const searchCard = document.getElementById('search-card'); // Restaurado
    const searchInput = document.getElementById('searchInput');   // Restaurado
    
    // Seções de Resultados
    const overviewChartsRow = document.getElementById('overview-charts-row');
    const duplicatesRow = document.getElementById('duplicates-row'); // Restaurado
    
    // Modal
    const pointDetailModal = new bootstrap.Modal(document.getElementById('pointDetailModal'));

    // --- Configurações e Estado Global ---
    const API_URL = "https://madras1-aethermap.hf.space"; // URL Base da sua API
    let fullPlotData = [];
    let currentJobId = null;
    let fullApiData = null; // Guardamos todos os dados da API
    let activeCharts = [];

    // --- Paleta de Cores ---
    const KINGDOM_COLORS = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];
    const SEMANTIC_SEARCH_COLORS = { high: '#ffde59', medium: '#f5b041', low: '#d68910' };

    // --- Ouvintes ---
    samplesSlider.addEventListener('input', () => { samplesValue.textContent = samplesSlider.value; });
    processButton.addEventListener('click', handleProcessing);
    searchInput.addEventListener('input', debounce(handleSearch, 500)); // Busca reativada

    // --- Módulo de Lógica Principal ---
    async function handleProcessing() {
        const file = fileUpload.files[0];
        if (!file) { showToast("Por favor, selecione um arquivo.", "warning"); return; }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('n_samples', samplesSlider.value);

        setLoadingState(true);
        try {
            const response = await fetch(`${API_URL}/process/`, { method: 'POST', body: formData });
            if (!response.ok) { throw new Error(`Erro da API: ${await response.text()}`); }
            
            const data = await response.json();
            fullApiData = data;
            currentJobId = data.job_id;
            renderAllResults(data);
            showToast("Universo gerado com sucesso! Explore os dados ou invoque o sábio.", "success");
        } catch (error) {
            console.error("Erro detalhado:", error);
            showToast(`Falha ao processar: ${error.message}`, "error");
            setLoadingState(false, true);
        }
    }
    
    async function handleSearch(e) {
        const query = e.target.value.trim();
        if (!currentJobId) return;
        if (!query) {
            renderPlot(fullApiData);
            renderClusterAnalysis(fullApiData); // Volta para a visão de clusters
            return;
        }
        const formData = new FormData();
        formData.append('query', query);
        formData.append('job_id', currentJobId);
        try {
            const response = await fetch(`${API_URL}/search/`, { method: 'POST', body: formData });
            if (!response.ok) { throw new Error('Falha na busca semântica'); }
            const searchData = await response.json();
            highlightPlotSemantico(searchData.results, query);
            renderSearchResultsList(searchData.results);
        } catch (error) { showToast(`Erro na busca: ${error.message}`, 'error'); }
    }

    async function handleDescribeClusters() {
        if (!currentJobId) { showToast("Gere um universo primeiro.", "warning"); return; }
        const invokeButton = document.getElementById('invoke-sage-button');
        invokeButton.disabled = true;
        invokeButton.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Analisando...`;
        try {
            const formData = new FormData();
            formData.append('job_id', currentJobId);
            const response = await fetch(`${API_URL}/describe_clusters/`, { method: 'POST', body: formData });
            if (!response.ok) { throw new Error(`O Oráculo falhou: ${await response.text()}`); }
            const data = await response.json();
            updateClusterCardsWithInsights(data.insights);
            showToast("O Sábio revelou os segredos dos clusters!", "success");
            invokeButton.style.display = 'none';
        } catch (error) {
            console.error("Erro ao descrever clusters:", error);
            showToast(`Erro ao consultar o Oráculo: ${error.message}`, "error");
            invokeButton.disabled = false;
            invokeButton.innerHTML = `<i class="bi bi-lightbulb-fill me-2"></i>Invocar Sábio Novamente`;
        }
    }

    // --- Módulo de UI ---
    function setLoadingState(isLoading, hasFailed = false) {
        if (isLoading) {
            currentJobId = null;
            fullApiData = null;
            if (emptyState) emptyState.classList.add('d-none');
            if (plotContainer) plotContainer.innerHTML = '';
            
            [searchCard, scribeWing, overviewChartsRow, duplicatesRow].forEach(el => {
                if(el) el.classList.remove('visible', 'fade-in-section');
            });
            
            loadingSection.classList.remove('d-none');
            processButton.disabled = true;
            processButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Forjando o universo...';
        } else {
            loadingSection.classList.add('d-none');
            processButton.disabled = false;
            processButton.innerHTML = '<i class="bi bi-stars me-2"></i>Gerar Universo';
            if (hasFailed && emptyState) {
                emptyState.classList.remove('d-none');
            }
        }
    }
    
    // --- Renderização ---
    function renderAllResults(data) {
        fullPlotData = data.plot_data;
        activeCharts.forEach(chart => chart.destroy());
        activeCharts = [];

        emptyState.classList.add('d-none');
        
        renderGlobalMetrics(data);
        renderPlot(data);
        renderOverviewCharts(data);
        renderClusterAnalysis(data);
        renderDuplicates(data);
        
        [searchCard, scribeWing, overviewChartsRow, duplicatesRow].forEach(el => {
            if(el) {
                el.style.visibility = 'visible'; // Torna visível para a animação
                el.classList.add('visible', 'fade-in-section');
            }
        });
        setLoadingState(false);
    }
    
    function renderGlobalMetrics(data) {
        const metricsContainer = document.getElementById('metrics-container');
        if (!metricsContainer) return;
        const { metadata, metrics } = data;
        metricsContainer.innerHTML = `
            <div class="col-md col-6"><h5>${metadata.num_documents_processed}</h5><small class="text-muted">Documentos</small></div>
            <div class="col-md col-6"><h5>${metadata.num_clusters_found}</h5><small class="text-muted">Clusters</small></div>
            <div class="col-md col-6"><h5>${metadata.num_noise_points}</h5><small class="text-muted">Pontos de Ruído</small></div>
            <div class="col-md col-6"><h5>${metrics.riqueza_lexical}</h5><small class="text-muted">Riqueza Lexical</small></div>
            <div class="col-md col-12 mt-3 mt-md-0"><h5>${metrics.entropia.toFixed(2)}</h5><small class="text-muted">Entropia (Bits)</small></div>`;
    }

    function renderPlot(data) {
        const plotData = data.plot_data;
        const traces = [];
        const uniqueClusters = [...new Set(plotData.map(p => p.cluster))].sort((a, b) => parseInt(a) - parseInt(b));
        uniqueClusters.forEach(clusterId => {
            const pointsInCluster = plotData.filter(p => p.cluster === clusterId);
            const traceColor = clusterId === '-1' ? 'grey' : KINGDOM_COLORS[parseInt(clusterId) % KINGDOM_COLORS.length];
            traces.push({ x: pointsInCluster.map(p => p.x), y: pointsInCluster.map(p => p.y), z: pointsInCluster.map(p => p.z), mode: 'markers', type: 'scatter3d', name: clusterId === '-1' ? 'Ruído' : `Cluster ${clusterId}`, text: pointsInCluster.map(p => p.full_text.substring(0, 200) + '...'), marker: { size: 4, opacity: 0.8, color: traceColor }, customdata: pointsInCluster });
        });
        const layout = { title: `Visualização de ${data.metadata.num_documents_processed} Documentos`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', legend: { y: 0.9, x: 0.95 } };
        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(attachClickHandlerToPlot);
    }

    function highlightPlotSemantico(results, query) {
        // ... (código para highlight semântico, igual ao que você já tinha)
    }

    function renderOverviewCharts(data) {
        const distCanvas = document.getElementById('clusterDistributionChart');
        const tfidfCanvas = document.getElementById('tfidfChart');
        if (!distCanvas || !tfidfCanvas) return;
        
        // Gráfico de Pizza (Distribuição)
        const distCtx = distCanvas.getContext('2d');
        const clusterCounts = {};
        data.plot_data.forEach(p => {
            const clusterName = p.cluster === '-1' ? 'Ruído' : `Cluster ${p.cluster}`;
            clusterCounts[clusterName] = (clusterCounts[clusterName] || 0) + 1;
        });
        const sortedClusters = Object.entries(clusterCounts).sort((a, b) => b[1] - a[1]);
        activeCharts.push(new Chart(distCtx, { type: 'doughnut', data: { labels: sortedClusters.map(entry => entry[0]), datasets: [{ data: sortedClusters.map(entry => entry[1]), backgroundColor: KINGDOM_COLORS, borderColor: '#0c0c0f' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#f0f1f2' } } } } }));
        
        // Gráfico de Barras (Palavras-Chave)
        if (data.metrics && data.metrics.top_tfidf_palavras) {
            const tfidfCtx = tfidfCanvas.getContext('2d');
            const tfidfData = data.metrics.top_tfidf_palavras;
            activeCharts.push(new Chart(tfidfCtx, { type: 'bar', data: { labels: tfidfData.map(item => item.palavra).reverse(), datasets: [{ label: 'Score TF-IDF', data: tfidfData.map(item => item.score).reverse(), backgroundColor: KINGDOM_COLORS[1] }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#a0a0b0' } }, y: { ticks: { color: '#f0f1f2' } } } } }));
        }
    }

    function renderClusterAnalysis(data) {
        const container = scribeWingContent;
        container.innerHTML = '';
        const analysis = data.cluster_analysis;
        const sortedAnalysis = Object.entries(analysis).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
        
        if (sortedAnalysis.length === 0) {
            container.innerHTML = '<div class="text-center p-5"><p class="text-muted">Nenhum cluster significativo foi encontrado para analisar.</p></div>';
            return;
        }

        let html = `<div class="text-center mb-3">
                        <h5 class="mb-2">Análise por Cluster</h5>
                        <button id="invoke-sage-button" class="btn btn-outline-primary btn-sm">
                            <i class="bi bi-lightbulb-fill me-2"></i>Descrever Clusters com IA
                        </button>
                    </div>`;

        sortedAnalysis.forEach(([clusterId, clusterData]) => {
            const color = KINGDOM_COLORS[parseInt(clusterId) % KINGDOM_COLORS.length];
            html += `<div class="cluster-card mt-3" data-cluster-id="${clusterId}">
                        <div class="cluster-card-header">
                            <h6 class="cluster-title"><span style="color: ${color};">■</span> Cluster ${clusterId}</h6>
                            <span class="badge text-bg-secondary">${clusterData.num_documentos} Documentos</span>
                            <div class="mt-2 small text-muted"><strong>Top Palavras (TF-IDF):</strong> "${clusterData.top_palavras.map(p => p.palavra).join(', ')}"</div>
                            <div class="insight-container mt-2" style="display: none;">
                                <p class="mb-1"><strong><i class="bi bi-chat-quote-fill me-1"></i> Tópico:</strong> <span class="topic-name"></span></p>
                                <p class="text-muted small mb-0"><strong><i class="bi bi-search me-1"></i> Insight:</strong> <span class="core-insight"></span></p>
                            </div>
                        </div>
                    </div>`;
        });
        container.innerHTML = html;
        document.getElementById('invoke-sage-button').addEventListener('click', handleDescribeClusters);
    }

    function updateClusterCardsWithInsights(insights) {
        for (const clusterId in insights) {
            const clusterCard = document.querySelector(`.cluster-card[data-cluster-id="${clusterId}"]`);
            if (clusterCard) {
                const insightData = insights[clusterId];
                const topicNameEl = clusterCard.querySelector('.topic-name');
                const coreInsightEl = clusterCard.querySelector('.core-insight');
                const insightContainerEl = clusterCard.querySelector('.insight-container');
                
                topicNameEl.textContent = insightData.topic_name;
                coreInsightEl.textContent = insightData.core_insight;

                const titleEl = clusterCard.querySelector('.cluster-title');
                const colorSpan = titleEl.querySelector('span').outerHTML;
                titleEl.innerHTML = `${colorSpan} ${insightData.topic_name}`;

                insightContainerEl.style.display = 'block';
                insightContainerEl.classList.add('fade-in-section', 'visible');
            }
        }
    }
    
    function renderDuplicates(data) {
        const container = document.getElementById('duplicates-container');
        if (!container || !data.duplicates) return;
        const { grupos_exatos, pares_semanticos } = data.duplicates;
        const MAX_TO_SHOW = 3;
        let html = '<div class="row gy-4">';
        html += '<div class="col-lg-6">';
        const numGruposExatos = Object.keys(grupos_exatos).length;
        html += `<h6 class="mb-3">Duplicados Exatos (${numGruposExatos} grupos)</h6>`;
        if (numGruposExatos > 0) { Object.entries(grupos_exatos).slice(0, MAX_TO_SHOW).forEach(([text, indices]) => { html += `<p class="text-muted small lh-sm mb-2"><strong>(${indices.length}x):</strong> ${text.substring(0, 100)}...</p>`; }); } 
        else { html += '<p class="text-success small">Nenhum duplicado exato encontrado.</p>'; }
        html += '</div>';
        html += '<div class="col-lg-6">';
        const numParesSemanticos = pares_semanticos.length;
        html += `<h6 class="mb-3">Pares Mais Similares (${numParesSemanticos} encontrados)</h6>`;
        if (numParesSemanticos > 0) { pares_semanticos.slice(0, MAX_TO_SHOW).forEach(pair => { html += `<div class="p-2 border-start border-primary small mb-2 lh-sm"><strong>Similaridade: ${pair.similaridade.toFixed(3)}</strong><br>1: ${pair.texto1.substring(0, 80)}...<br>2: ${pair.texto2.substring(0, 80)}...</div>`; }); } 
        else { html += '<p class="text-success small">Nenhum par altamente similar encontrado.</p>'; }
        html += '</div></div>';
        container.innerHTML = html;
    }

    function renderSearchResultsList(results) {
        // ... (código para renderizar a lista de busca, igual ao que você já tinha)
    }

    function attachClickHandlerToPlot(plotDiv) {
        // ... (código do click handler, igual ao que você já tinha)
    }

    function showToast(message, type = "info") {
        // ... (código do toastify, igual ao que você já tinha)
    }
    
    function debounce(func, delay) { let timeout; return function(...args) { const context = this; clearTimeout(timeout); timeout = setTimeout(() => func.apply(context, args), delay); }; }
});
