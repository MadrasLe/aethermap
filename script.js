document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos do DOM ---
    const processButton = document.getElementById('processButton');
    const fileUpload = document.getElementById('fileUpload');
    const samplesSlider = document.getElementById('samplesSlider');
    const samplesValue = document.getElementById('samplesValue');
    const loadingSection = document.getElementById('loadingSection');
    const plotContainer = document.getElementById('plotContainer');
    const emptyState = document.getElementById('emptyState');
    const scribeWing = document.getElementById('scribe-wing');
    const scribeWingContent = document.getElementById('scribe-wing-content');
    const searchCard = document.getElementById('search-card');
    const searchInput = document.getElementById('searchInput');
    const pointDetailModal = new bootstrap.Modal(document.getElementById('pointDetailModal'));

    // --- Configurações e Estado Global ---
    const API_URL = "https://madras1-aethermap.hf.space/process/";
    let fullPlotData = [];
    let currentJobId = null;
    let fullApiData = null;

    // --- Paleta de Cores ---
    const KINGDOM_COLORS = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];
    const SEMANTIC_SEARCH_COLORS = { high: '#ffde59', medium: '#f5b041', low: '#d68910' };

    // --- Ouvintes de Eventos ---
    samplesSlider.addEventListener('input', () => { samplesValue.textContent = samplesSlider.value; });
    processButton.addEventListener('click', handleProcessing);
    searchInput.addEventListener('input', debounce(handleSearch, 500));

    // --- Módulo de Lógica Principal ---
    async function handleProcessing() {
        const file = fileUpload.files[0];
        if (!file) { showToast("Selecione um arquivo.", "warning"); return; }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('n_samples', samplesSlider.value);

        setLoadingState(true);
        currentJobId = null;

        try {
            const response = await fetch(API_URL, { method: 'POST', body: formData });
            if (!response.ok) { throw new Error(`Erro da API: ${await response.text()}`); }
            
            const data = await response.json();
            fullApiData = data;
            currentJobId = data.job_id;
            
            renderAllResults(data);
            showToast("Universo gerado com sucesso!", "success");
        } catch (error) {
            console.error("Erro detalhado:", error);
            showToast(`Falha ao processar: ${error.message}`, "error");
            emptyState.classList.remove('d-none');
        } finally {
            setLoadingState(false);
        }
    }
    
    async function handleSearch(e) {
        const query = e.target.value.trim();
        
        if (!currentJobId) { return; }

        if (!query) {
            renderPlot(fullApiData);
            renderClusterAnalysis(fullApiData); // Restaura a Ala do Escriba
            return;
        }

        const formData = new FormData();
        formData.append('query', query);
        formData.append('job_id', currentJobId);

        try {
            const response = await fetch(API_URL.replace('/process/', '/search/'), { method: 'POST', body: formData });
            if (!response.ok) { throw new Error('Falha na busca semântica'); }
            
            const searchData = await response.json();
            highlightPlotSemantico(searchData.results, query);
            renderSearchResultsList(searchData.results);

        } catch (error) {
            showToast(`Erro na busca: ${error.message}`, 'error');
        }
    }

    // --- Módulo de UI e Renderização ---
    function setLoadingState(isLoading) {
        if (isLoading) {
            emptyState.classList.add('d-none');
            plotContainer.innerHTML = '';
            searchCard.classList.remove('visible');
            scribeWing.classList.remove('visible');
            loadingSection.classList.remove('d-none');
            processButton.disabled = true;
            processButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
        } else {
            loadingSection.classList.add('d-none');
            processButton.disabled = false;
            processButton.innerHTML = '<i class="bi bi-stars me-2"></i>Gerar Universo';
        }
    }

    function renderAllResults(data) {
        fullPlotData = data.plot_data;
        renderPlot(data);
        renderClusterAnalysis(data);
        
        searchCard.classList.add('visible');
        scribeWing.classList.add('visible');
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
        const layout = { title: `Visualização de ${plotData.length} Documentos`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', legend: { y: 0.9, x: 0.95 } };
        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(graphDiv => {
            graphDiv.on('plotly_click', (eventData) => {
                if (eventData.points.length > 0) {
                    const point = eventData.points[0]; const clickedPointData = point.customdata;
                    if (clickedPointData) { const clusterId = clickedPointData.cluster; document.getElementById('modal-cluster-id').textContent = clusterId === '-1' ? 'Ruído' : `Cluster ${clusterId}`; document.getElementById('modal-full-text').textContent = clickedPointData.full_text; pointDetailModal.show(); }
                }
            });
        });
    }

    function highlightPlotSemantico(results, query) {
        const highRelevance = [], mediumRelevance = [], lowRelevance = [], normalData = []; const highlightedIndices = new Set(results.map(r => r.index));
        fullPlotData.forEach((point, index) => {
            if (highlightedIndices.has(index)) { const result = results.find(r => r.index === index); if (result.score > 0.6) highRelevance.push(point); else if (result.score > 0.45) mediumRelevance.push(point); else lowRelevance.push(point); } 
            else { normalData.push(point); }
        });
        const traces = [
            { name: 'Outros', x: normalData.map(p => p.x), y: normalData.map(p => p.y), z: normalData.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 3, color: 'grey', opacity: 0.2 } },
            { name: 'Relevância Baixa', x: lowRelevance.map(p => p.x), y: lowRelevance.map(p => p.y), z: lowRelevance.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 4, color: SEMANTIC_SEARCH_COLORS.low, opacity: 0.8 } },
            { name: 'Relevância Média', x: mediumRelevance.map(p => p.x), y: mediumRelevance.map(p => p.y), z: mediumRelevance.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 5, color: SEMANTIC_SEARCH_COLORS.medium, opacity: 0.9 } },
            { name: 'Relevância Alta', x: highRelevance.map(p => p.x), y: highRelevance.map(p => p.y), z: highRelevance.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 6, color: SEMANTIC_SEARCH_COLORS.high, opacity: 1.0 } }
        ];
        const layout = { title: `Destacando ${results.length} Documentos para "${query}"`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', legend: { y: 0.9, x: 0.95 } };
        Plotly.newPlot(plotContainer, traces, layout, {responsive: true});
    }

    function renderSearchResultsList(results) {
        scribeWingContent.innerHTML = '';
        if (results.length === 0) {
            scribeWingContent.innerHTML = '<div class="text-center p-5"><p class="text-muted">Nenhum resultado semanticamente relevante encontrado.</p></div>';
            return;
        }

        let html = `<h5 class="mb-3">Top Resultados Semânticos</h5>`;
        results.forEach(result => {
            const doc = fullPlotData[result.index];
            html += `
                <div class="search-result-item" data-index="${result.index}">
                    <span class="search-result-score">Similaridade: ${result.score.toFixed(3)}</span>
                    <p class="search-result-text mt-1">${doc.full_text}</p>
                </div>
            `;
        });
        scribeWingContent.innerHTML = html;

        document.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                highlightSinglePoint(index);
            });
        });
    }

    function renderClusterAnalysis(data) {
        const container = scribeWingContent;
        container.innerHTML = '';
        const analysis = data.cluster_analysis;
        const sortedAnalysis = Object.entries(analysis).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
        
        if (sortedAnalysis.length === 0) {
            container.innerHTML = '<div class="text-center p-5"><p class="text-muted">Nenhum cluster significativo foi encontrado.</p></div>';
            return;
        }
        
        let html = `<h5 class="mb-3">Análise por Cluster</h5>`;
        sortedAnalysis.forEach(([clusterId, clusterData]) => {
            const color = KINGDOM_COLORS[parseInt(clusterId) % KINGDOM_COLORS.length];
            html += `<div class="cluster-card mt-3">
                        <div class="cluster-card-header">
                            <h6><span style="color: ${color};">■</span> Cluster ${clusterId}</h6>
                            <span class="badge text-bg-secondary">${clusterData.num_documentos} Documentos</span>
                            <div class="mt-2 small text-muted"><strong>Top Palavras:</strong> ${clusterData.top_palavras.map(p => p.palavra).join(', ')}</div>
                        </div>
                    </div>`;
        });
        container.innerHTML = html;
    }
    
    function highlightSinglePoint(selectedIndex) {
        const highlightedPoint = fullPlotData[selectedIndex];
        const normalData = fullPlotData.filter((_, index) => index !== selectedIndex);

        const traces = [
            { name: 'Outros', x: normalData.map(p => p.x), y: normalData.map(p => p.y), z: normalData.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 3, color: 'grey', opacity: 0.2 } },
            { name: 'Selecionado', x: [highlightedPoint.x], y: [highlightedPoint.y], z: [highlightedPoint.z], mode: 'markers', type: 'scatter3d', marker: { size: 8, color: '#ff00ff', opacity: 1.0 } }
        ];
        
        const layout = { title: `Focando no Documento #${selectedIndex}`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', showlegend: false };
        Plotly.newPlot(plotContainer, traces, layout, {responsive: true});
    }

    // Funções auxiliares
    function debounce(func, delay) { let timeout; return function(...args) { const context = this; clearTimeout(timeout); timeout = setTimeout(() => func.apply(context, args), delay); }; }
    function showToast(message, type = "info") { const backgroundColors = { success: "linear-gradient(to right, #00b09b, #96c93d)", error: "linear-gradient(to right, #ff5f6d, #ffc371)", warning: "linear-gradient(to right, #f7b733, #fc4a1a)", info: "linear-gradient(to right, #0d6efd, #6f42c1)" }; Toastify({ text: message, duration: 5000, close: true, gravity: "top", position: "right", stopOnFocus: true, style: { background: backgroundColors[type] } }).showToast(); }
});
