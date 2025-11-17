document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores do DOM ---
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
    const overviewChartsRow = document.getElementById('overview-charts-row');
    const duplicatesRow = document.getElementById('duplicates-row');
    
    // --- Estado Global ---
    const API_URL = "https://madras1-aethermap.hf.space/process/";
    let fullPlotData = [];
    let currentJobId = null;
    let fullApiData = null;
    let activeCharts = [];

    // --- Paletas de Cores ---
    const KINGDOM_COLORS = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];
    const SEMANTIC_SEARCH_COLORS = { high: '#ffde59', medium: '#f5b041', low: '#d68910' };

    // --- Ouvintes ---
    samplesSlider.addEventListener('input', () => { samplesValue.textContent = samplesSlider.value; });
    processButton.addEventListener('click', handleProcessing);
    searchInput.addEventListener('input', debounce(handleSearch, 500));

    // --- Lógica Principal ---
    async function handleProcessing() {
        const file = fileUpload.files[0];
        if (!file) { showToast("Selecione um arquivo.", "warning"); return; }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('n_samples', samplesSlider.value);

        setLoadingState(true);
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
            setLoadingState(false, true); // Passa 'true' para indicar falha
        }
    }
    
    async function handleSearch(e) {
        const query = e.target.value.trim();
        if (!currentJobId) { return; }
        if (!query) {
            renderPlot(fullApiData);
            renderClusterAnalysis(fullApiData);
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
        } catch (error) { showToast(`Erro na busca: ${error.message}`, 'error'); }
    }

    // --- Módulo de UI ---
    function setLoadingState(isLoading, hasFailed = false) {
        if (isLoading) {
            currentJobId = null;
            emptyState.classList.add('d-none');
            plotContainer.innerHTML = '';
            [searchCard, scribeWing, overviewChartsRow, duplicatesRow].forEach(el => el.classList.remove('visible'));
            loadingSection.classList.remove('d-none');
            processButton.disabled = true;
            processButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
        } else {
            loadingSection.classList.add('d-none');
            processButton.disabled = false;
            processButton.innerHTML = '<i class="bi bi-stars me-2"></i>Gerar Universo';
            if (hasFailed) emptyState.classList.remove('d-none');
        }
    }
    
    function renderAllResults(data) {
        fullPlotData = data.plot_data;
        activeCharts.forEach(chart => chart.destroy());
        activeCharts = [];

        renderPlot(data);
        renderOverviewCharts(data);
        renderClusterAnalysis(data);
        renderDuplicates(data);
        
        [searchCard, scribeWing, overviewChartsRow, duplicatesRow].forEach(el => el.classList.add('visible'));
        setLoadingState(false);
    }
    
    // --- Funções de Renderização Detalhadas ---
    
    function attachClickHandlerToPlot(plotDiv) {
        plotDiv.on('plotly_click', (eventData) => {
            if (eventData.points.length > 0) {
                const point = eventData.points[0];
                const clickedPointData = point.customdata;
                if (clickedPointData) {
                    const clusterId = clickedPointData.cluster;
                    document.getElementById('modal-cluster-id').textContent = clusterId === '-1' ? 'Ruído' : `Cluster ${clusterId}`;
                    document.getElementById('modal-full-text').textContent = clickedPointData.full_text;
                    pointDetailModal.show();
                }
            }
        });
    }

    function renderPlot(data) {
        const plotData = data.plot_data;
        const traces = [];
        const uniqueClusters = [...new Set(plotData.map(p => p.cluster))].sort((a, b) => parseInt(a) - parseInt(b));
        uniqueClusters.forEach(clusterId => {
            const pointsInCluster = plotData.filter(p => p.cluster === clusterId);
            const traceColor = clusterId === '-1' ? 'grey' : KINGDOM_COLORS[parseInt(clusterId) % KINGDOM_COLORS.length];
            traces.push({ x: pointsInCluster.map(p => p.x), y: pointsInCluster.map(p => p.y), z: pointsInCluster.map(p => p.z), mode: 'markers', type: 'scatter3d', name: clusterId === '-1' ? 'Ruído' : `Cluster ${clusterId}`, text: pointsInCluster.map(p => p.full_text.substring(0, 200)), marker: { size: 4, opacity: 0.8, color: traceColor }, customdata: pointsInCluster });
        });
        const layout = { title: `Visualização de ${plotData.length} Documentos`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', legend: { y: 0.9, x: 0.95 } };
        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(attachClickHandlerToPlot);
    }

    function highlightPlotSemantico(results, query) {
        const highRelevance = [], mediumRelevance = [], lowRelevance = [], normalData = [];
        const highlightedIndices = new Set(results.map(r => r.index));
        fullPlotData.forEach((point, index) => {
            if (highlightedIndices.has(index)) {
                const result = results.find(r => r.index === index);
                if (result.score > 0.6) highRelevance.push(point);
                else if (result.score > 0.45) mediumRelevance.push(point);
                else lowRelevance.push(point);
            } else { normalData.push(point); }
        });
        const traces = [
            { name: 'Outros', text: normalData.map(p=>p.full_text.substring(0,200)), x: normalData.map(p => p.x), y: normalData.map(p => p.y), z: normalData.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 3, color: 'grey', opacity: 0.2 }, customdata: normalData },
            { name: 'Relevância Baixa', text: lowRelevance.map(p=>p.full_text.substring(0,200)), x: lowRelevance.map(p => p.x), y: lowRelevance.map(p => p.y), z: lowRelevance.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 4, color: SEMANTIC_SEARCH_COLORS.low }, customdata: lowRelevance },
            { name: 'Relevância Média', text: mediumRelevance.map(p=>p.full_text.substring(0,200)), x: mediumRelevance.map(p => p.x), y: mediumRelevance.map(p => p.y), z: mediumRelevance.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 5, color: SEMANTIC_SEARCH_COLORS.medium }, customdata: mediumRelevance },
            { name: 'Relevância Alta', text: highRelevance.map(p=>p.full_text.substring(0,200)), x: highRelevance.map(p => p.x), y: highRelevance.map(p => p.y), z: highRelevance.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 6, color: SEMANTIC_SEARCH_COLORS.high }, customdata: highRelevance }
        ];
        const layout = { title: `Destacando ${results.length} Documentos para "${query}"`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', legend: { y: 0.9, x: 0.95 } };
        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(attachClickHandlerToPlot);
    }
    
    function highlightSinglePoint(selectedIndex) {
        const highlightedPoint = fullPlotData[selectedIndex];
        const normalData = fullPlotData.filter((_, index) => index !== selectedIndex);
        const traces = [
            { name: 'Outros', text: normalData.map(p=>p.full_text.substring(0,200)), x: normalData.map(p => p.x), y: normalData.map(p => p.y), z: normalData.map(p => p.z), mode: 'markers', type: 'scatter3d', marker: { size: 3, color: 'grey', opacity: 0.2 }, customdata: normalData },
            { name: 'Selecionado', text: [highlightedPoint.full_text.substring(0,200)], x: [highlightedPoint.x], y: [highlightedPoint.y], z: [highlightedPoint.z], mode: 'markers', type: 'scatter3d', marker: { size: 8, color: '#ff00ff', opacity: 1.0 }, customdata: [highlightedPoint] }
        ];
        const layout = { title: `Focando no Documento #${selectedIndex}`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', showlegend: false };
        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(attachClickHandlerToPlot);
    }

    function renderOverviewCharts(data) { /* ... Inalterado da versão anterior ... */ }
    function renderClusterAnalysis(data) { /* ... Inalterado da versão anterior ... */ }
    function renderSearchResultsList(results) { /* ... Inalterado da versão anterior ... */ }
    function renderDuplicates(data) { /* ... Inalterado da versão anterior ... */ }
    function debounce(func, delay) { /* ... Inalterado da versão anterior ... */ }
    function showToast(message, type = "info") { /* ... Inalterado da versão anterior ... */ }
});
