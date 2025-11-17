document.addEventListener('DOMContentLoaded', () => {

    // --- Seletores de Elementos do DOM ---
    const processButton = document.getElementById('processButton');
    const fileUpload = document.getElementById('fileUpload');
    const samplesSlider = document.getElementById('samplesSlider');
    const samplesValue = document.getElementById('samplesValue');
    const loadingSection = document.getElementById('loadingSection');
    const plotContainer = document.getElementById('plotContainer');
    const emptyState = document.getElementById('emptyState');
    const resultsPanel = document.getElementById('resultsPanel');
    const searchCard = document.getElementById('search-card');
    const searchInput = document.getElementById('searchInput');
    const pointDetailModal = new bootstrap.Modal(document.getElementById('pointDetailModal'));

    // --- Configurações e Estado Global ---
    const API_URL = "https://madras1-aethermap.hf.space/process/";
    let fullPlotData = [];
    let activeCharts = [];
    let currentJobId = null; // <<< A CHAVE DO REINO >>>

    // --- Paleta de Cores do Reino ---
    const KINGDOM_COLORS = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];
    const SEMANTIC_SEARCH_COLORS = { high: '#ffde59', medium: '#f5b041', low: '#d68910' };

    // --- Ouvintes de Eventos ---
    samplesSlider.addEventListener('input', () => { samplesValue.textContent = samplesSlider.value; });
    processButton.addEventListener('click', handleProcessing);
    searchInput.addEventListener('input', debounce(handleSearch, 500)); // Adicionado debounce para não sobrecarregar a API

    // --- Módulo de Lógica Principal ---
    async function handleProcessing() {
        const file = fileUpload.files[0];
        const nSamples = samplesSlider.value;
        if (!file) { showToast("Por favor, selecione um arquivo primeiro.", "warning"); return; }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('n_samples', nSamples);

        setLoadingState(true);
        currentJobId = null; // Reseta a chave do reino ao iniciar

        try {
            const response = await fetch(API_URL, { method: 'POST', body: formData });
            if (!response.ok) { throw new Error(`Erro da API (${response.status}): ${await response.text()}`); }
            
            const data = await response.json();
            currentJobId = data.job_id; // <<< GUARDA A CHAVE DO REINO >>>
            
            renderAllResults(data);
            showToast("Universo gerado com sucesso!", "success");
        } catch (error) {
            console.error("Erro detalhado:", error);
            showToast(`Falha ao processar o universo: ${error.message}`, "error");
            emptyState.classList.remove('d-none');
        } finally {
            setLoadingState(false);
        }
    }
    
    // <<< O ARAUTO ILUMINADO >>> Função de busca reescrita para usar o Oráculo
    async function handleSearch(e) {
        const query = e.target.value.trim();
        
        if (!currentJobId) {
             showToast("Por favor, gere um universo primeiro para habilitar a busca semântica.", "warning");
             return;
        }

        if (!query) {
            renderPlot({ plot_data: fullPlotData });
            return;
        }

        const formData = new FormData();
        formData.append('query', query);
        formData.append('job_id', currentJobId);

        try {
            const response = await fetch(API_URL.replace('/process/', '/search/'), {
                method: 'POST',
                body: formData
            });
            if (!response.ok) { throw new Error('Falha na busca semântica'); }
            
            const searchData = await response.json();
            highlightPlotSemantico(searchData.results, query);

        } catch (error) {
            showToast(`Erro na busca: ${error.message}`, 'error');
        }
    }

    // --- Módulo de UI ---
    function setLoadingState(isLoading) { /* ... (Inalterado) ... */ }
    function showToast(message, type = "info") { /* ... (Inalterado) ... */ }
    function debounce(func, delay) { /* ... (Função auxiliar para debounce) ... */ }
    
    // --- Módulo de Renderização Mestre ---
    function renderAllResults(data) {
        fullPlotData = data.plot_data;
        activeCharts.forEach(chart => chart.destroy());
        activeCharts = [];

        emptyState.classList.add('d-none');
        plotContainer.innerHTML = '';
        
        renderPlot(data);
        renderOverviewCharts(data);
        renderClusterAnalysis(data);
        renderDuplicates(data);
        
        resultsPanel.classList.add('visible');
        searchCard.classList.add('visible');
    }

    // --- Funções de Renderização Específicas ---
    function renderPlot(data) { /* ... (Inalterado) ... */ }

    // <<< O FEITIÇO DO DESTAQUE SEMÂNTICO >>>
    function highlightPlotSemantico(results, query) {
        const highRelevance = [];
        const mediumRelevance = [];
        const lowRelevance = [];
        const normalData = [];

        const highlightedIndices = new Set(results.map(r => r.index));

        fullPlotData.forEach((point, index) => {
            if (highlightedIndices.has(index)) {
                const result = results.find(r => r.index === index);
                if (result.score > 0.6) {
                    highRelevance.push(point);
                } else if (result.score > 0.45) {
                    mediumRelevance.push(point);
                } else {
                    lowRelevance.push(point);
                }
            } else {
                normalData.push(point);
            }
        });

        const traces = [
            { name: 'Outros', x: normalData.map(p => p.x), y: normalData.map(p => p.y), z: normalData.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 3, color: 'grey', opacity: 0.2 } },
            { name: 'Relevância Baixa', x: lowRelevance.map(p => p.x), y: lowRelevance.map(p => p.y), z: lowRelevance.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 4, color: SEMANTIC_SEARCH_COLORS.low, opacity: 0.8 } },
            { name: 'Relevância Média', x: mediumRelevance.map(p => p.x), y: mediumRelevance.map(p => p.y), z: mediumRelevance.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 5, color: SEMANTIC_SEARCH_COLORS.medium, opacity: 0.9 } },
            { name: 'Relevância Alta', x: highRelevance.map(p => p.x), y: highRelevance.map(p => p.y), z: highRelevance.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 6, color: SEMANTIC_SEARCH_COLORS.high, opacity: 1.0 } }
        ];

        const layout = {
            title: `Destacando ${results.length} Documentos Semanticamente Relevantes para "${query}"`,
            margin: { l: 0, r: 0, b: 0, t: 40 },
            scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } },
            template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { y: 0.9, x: 0.95 }
        };

        Plotly.newPlot(plotContainer, traces, layout, {responsive: true});
    }

    function renderOverviewCharts(data) { /* ... (Inalterado) ... */ }
    function renderClusterAnalysis(data) { /* ... (Inalterado) ... */ }
    function renderDuplicates(data) { /* ... (Inalterado) ... */ }

    // Copiando as funções completas que não foram alteradas
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
    setLoadingState = (isLoading) => {
        if (isLoading) {
            emptyState.classList.add('d-none');
            plotContainer.innerHTML = '';
            resultsPanel.classList.remove('visible');
            searchCard.classList.remove('visible');
            loadingSection.classList.remove('d-none');
            processButton.disabled = true;
            processButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
        } else {
            loadingSection.classList.add('d-none');
            processButton.disabled = false;
            processButton.innerHTML = '<i class="bi bi-stars me-2"></i>Gerar Universo';
        }
    };
    showToast = (message, type = "info") => {
        const backgroundColors = { success: "linear-gradient(to right, #00b09b, #96c93d)", error: "linear-gradient(to right, #ff5f6d, #ffc371)", warning: "linear-gradient(to right, #f7b733, #fc4a1a)", info: "linear-gradient(to right, #0d6efd, #6f42c1)" };
        Toastify({ text: message, duration: 5000, close: true, gravity: "top", position: "right", stopOnFocus: true, style: { background: backgroundColors[type] } }).showToast();
    };
    renderPlot = (data) => {
        const plotData = data.plot_data;
        const traces = [];
        const uniqueClusters = [...new Set(plotData.map(p => p.cluster))].sort((a, b) => parseInt(a) - parseInt(b));
        uniqueClusters.forEach(clusterId => {
            const pointsInCluster = plotData.filter(p => p.cluster === clusterId);
            const traceColor = clusterId === '-1' ? 'grey' : KINGDOM_COLORS[parseInt(clusterId) % KINGDOM_COLORS.length];
            traces.push({ x: pointsInCluster.map(p => p.x), y: pointsInCluster.map(p => p.y), z: pointsInCluster.map(p => p.z), mode: 'markers', type: 'scatter3d', name: clusterId === '-1' ? 'Ruído' : `Cluster ${clusterId}`, text: pointsInCluster.map(p => p.full_text.substring(0, 200) + '...'), marker: { size: 4, opacity: 0.8, color: traceColor }, customdata: pointsInCluster });
        });
        const layout = { title: `Visualização de ${plotData.length} Documentos`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', legend: { y: 0.9, x: 0.95 } };
        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(graphDiv => {
            graphDiv.on('plotly_click', (eventData) => {
                if (eventData.points.length > 0) {
                    const point = eventData.points[0]; const clickedPointData = point.customdata;
                    if (clickedPointData) { const clusterId = clickedPointData.cluster; document.getElementById('modal-cluster-id').textContent = clusterId === '-1' ? 'Ruído' : `Cluster ${clusterId}`; document.getElementById('modal-full-text').textContent = clickedPointData.full_text; pointDetailModal.show(); }
                }
            });
        });
    };
    renderOverviewCharts = (data) => {
        const distCtx = document.getElementById('clusterDistributionChart').getContext('2d');
        const tfidfCtx = document.getElementById('tfidfChart').getContext('2d');
        const clusterCounts = {};
        data.plot_data.forEach(p => { const clusterName = p.cluster === '-1' ? 'Ruído' : `Cluster ${p.cluster}`; clusterCounts[clusterName] = (clusterCounts[clusterName] || 0) + 1; });
        const sortedClusters = Object.entries(clusterCounts).sort((a, b) => b[1] - a[1]);
        activeCharts.push(new Chart(distCtx, { type: 'doughnut', data: { labels: sortedClusters.map(entry => entry[0]), datasets: [{ data: sortedClusters.map(entry => entry[1]), backgroundColor: KINGDOM_COLORS, borderColor: '#0c0c0f', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#f0f1f2' } } } } }));
        const tfidfData = data.metrics.top_tfidf_palavras;
        activeCharts.push(new Chart(tfidfCtx, { type: 'bar', data: { labels: tfidfData.map(item => item.palavra).reverse(), datasets: [{ label: 'Score TF-IDF Global', data: tfidfData.map(item => item.score).reverse(), backgroundColor: KINGDOM_COLORS[1] }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: false } }, scales: { x: { ticks: { color: '#a0a0b0' } }, y: { ticks: { color: '#f0f1f2' } } } } }));
    };
    renderClusterAnalysis = (data) => {
        const container = document.getElementById('cluster-analysis-container');
        container.innerHTML = '';
        const analysis = data.cluster_analysis;
        const sortedAnalysis = Object.entries(analysis).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
        if (sortedAnalysis.length === 0) { container.innerHTML = '<div class="col-12"><p class="text-muted text-center">Nenhum cluster significativo foi encontrado.</p></div>'; return; }
        sortedAnalysis.forEach(([clusterId, clusterData]) => {
            const color = KINGDOM_COLORS[parseInt(clusterId) % KINGDOM_COLORS.length];
            container.innerHTML += `<div class="col-lg-4 col-md-6"><div class="cluster-card"><div class="cluster-card-header"><h6><span style="color: ${color};">■</span> Cluster ${clusterId}</h6><span class="badge text-bg-secondary">${clusterData.num_documentos} Documentos</span></div><div class="cluster-keywords-chart-container"><canvas id="clusterChart-${clusterId}"></canvas></div></div></div>`;
        });
        sortedAnalysis.forEach(([clusterId, clusterData]) => {
            if (clusterData.top_palavras.length > 0) {
                const ctx = document.getElementById(`clusterChart-${clusterId}`).getContext('2d');
                activeCharts.push(new Chart(ctx, { type: 'bar', data: { labels: clusterData.top_palavras.map(item => item.palavra).reverse(), datasets: [{ data: clusterData.top_palavras.map(item => item.score).reverse(), backgroundColor: KINGDOM_COLORS[parseInt(clusterId) % KINGDOM_COLORS.length] }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { ticks: { color: '#f0f1f2', font: { size: 10 } } } } } }));
            }
        });
    };
    renderDuplicates = (data) => {
        const container = document.getElementById('duplicates-container');
        const { grupos_exatos, pares_semanticos } = data.duplicates;
        const MAX_TO_SHOW = 5;
        let html = '<div class="row gy-4">';
        html += '<div class="col-lg-6">';
        const numGruposExatos = Object.keys(grupos_exatos).length;
        html += `<h6 class="mb-3">Duplicados Exatos (${numGruposExatos} grupos)</h6>`;
        if (numGruposExatos > 0) { Object.entries(grupos_exatos).slice(0, MAX_TO_SHOW).forEach(([text, indices]) => { html += `<p class="text-muted small lh-sm mb-2"><strong>(${indices.length}x):</strong> ${text.substring(0, 100)}...</p>`; }); } else { html += '<p class="text-success small">Nenhum duplicado exato encontrado.</p>'; }
        html += '</div>';
        html += '<div class="col-lg-6">';
        const numParesSemanticos = pares_semanticos.length;
        html += `<h6 class="mb-3">Pares Mais Similares (${numParesSemanticos} encontrados)</h6>`;
        if (numParesSemanticos > 0) { pares_semanticos.slice(0, MAX_TO_SHOW).forEach(pair => { html += `<div class="p-2 border-start border-primary small mb-2 lh-sm"><strong>Similaridade: ${pair.similaridade.toFixed(3)}</strong><br>1: ${pair.texto1.substring(0, 80)}...<br>2: ${pair.texto2.substring(0, 80)}...</div>`; }); } else { html += '<p class="text-success small">Nenhum par altamente similar encontrado.</p>'; }
        html += '</div></div>';
        container.innerHTML = html;
    };
});
