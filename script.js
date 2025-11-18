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
    const searchCard = document.getElementById('search-card');
    const searchInput = document.getElementById('searchInput');
    
    // Seções de Resultados
    const overviewChartsRow = document.getElementById('overview-charts-row');
    const duplicatesRow = document.getElementById('duplicates-row');
    
    // Modal
    const pointDetailModal = new bootstrap.Modal(document.getElementById('pointDetailModal'));

    // --- Configurações e Estado Global ---
    const API_URL = "https://madras1-aethermap.hf.space";
    let fullPlotData = [];
    let currentJobId = null;
    let fullApiData = null;
    let activeCharts = [];

    // --- Paleta de Cores ---
    const KINGDOM_COLORS = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];
    const SEMANTIC_SEARCH_COLORS = { high: '#ffde59', medium: '#f5b041', low: '#d68910' };

    // --- Ouvintes ---
    samplesSlider.addEventListener('input', () => { samplesValue.textContent = samplesSlider.value; });
    processButton.addEventListener('click', handleProcessing);
    searchInput.addEventListener('input', debounce(handleSearch, 500));

    // --- Lógica Principal ---
    async function handleProcessing() {
        // ... (código igual ao da versão completa anterior)
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
            showToast("Universo gerado com sucesso!", "success");
        } catch (error) {
            showToast(`Falha ao processar: ${error.message}`, "error");
            setLoadingState(false, true);
        }
    }
    
    async function handleSearch(e) {
        const query = e.target.value.trim();
        if (!currentJobId) return;
        if (!query) {
            renderPlot(fullApiData);
            renderClusterAnalysis(fullApiData);
            return;
        }
        const formData = new FormData();
        formData.append('query', query);
        formData.append('job_id', currentJobId);
        try {
            const response = await fetch(`${API_URL}/search/`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Falha na busca semântica');
            const searchData = await response.json();
            highlightPlotSemantico(searchData.results, query);
            renderSearchResultsList(searchData.results);
        } catch (error) { showToast(`Erro na busca: ${error.message}`, 'error'); }
    }

    async function handleDescribeClusters() {
        // ... (código igual ao da versão completa anterior)
        if (!currentJobId) { showToast("Gere um universo primeiro.", "warning"); return; }
        const invokeButton = document.getElementById('invoke-sage-button');
        invokeButton.disabled = true;
        invokeButton.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Analisando...`;
        try {
            const formData = new FormData();
            formData.append('job_id', currentJobId);
            const response = await fetch(`${API_URL}/describe_clusters/`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`O Oráculo falhou: ${await response.text()}`);
            const data = await response.json();
            updateClusterCardsWithInsights(data.insights);
            showToast("O Sábio revelou os segredos!", "success");
            invokeButton.style.display = 'none';
        } catch (error) {
            showToast(`Erro ao consultar o Oráculo: ${error.message}`, "error");
            invokeButton.disabled = false;
            invokeButton.innerHTML = `<i class="bi bi-lightbulb-fill me-2"></i>Invocar Novamente`;
        }
    }

    // --- Renderização (Todas as funções) ---
    function setLoadingState(isLoading, hasFailed = false) {
        // ... (código igual ao da versão completa anterior)
        if (isLoading) {
            [searchCard, scribeWing, overviewChartsRow, duplicatesRow].forEach(el => {
                if(el) el.style.visibility = 'hidden';
            });
            loadingSection.classList.remove('d-none');
            processButton.disabled = true;
            processButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Forjando...';
        } else {
            loadingSection.classList.add('d-none');
            processButton.disabled = false;
            processButton.innerHTML = '<i class="bi bi-stars me-2"></i>Gerar Universo';
        }
    }
    
    function renderAllResults(data) {
        // ... (código igual ao da versão completa anterior)
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
            if(el) el.style.visibility = 'visible';
        });
        setLoadingState(false);
    }
    
    function renderGlobalMetrics(data) { /* ...código completo... */ }
    function renderPlot(data) { /* ...código completo... */ }
    function attachClickHandlerToPlot(plotDiv) { /* ...código completo... */ }
    function renderOverviewCharts(data) { /* ...código completo... */ }
    function renderClusterAnalysis(data) { /* ...código completo com o botão... */ }
    function updateClusterCardsWithInsights(insights) { /* ...código completo... */ }
    function renderDuplicates(data) { /* ...código completo... */ }

    function highlightPlotSemantico(results, query) {
        const highRelevance = [], mediumRelevance = [], lowRelevance = [], normalData = [];
        const highlightedIndices = new Set(results.map(r => r.index));
        fullPlotData.forEach((point, index) => {
            if (highlightedIndices.has(index)) {
                const result = results.find(r => r.index === index);
                point.score = result.score;
                if (result.score > 0.6) highRelevance.push(point);
                else if (result.score > 0.45) mediumRelevance.push(point);
                else lowRelevance.push(point);
            } else { normalData.push(point); }
        });
        const createTrace = (data, name, color, size, opacity) => ({ name, x: data.map(p => p.x), y: data.map(p => p.y), z: data.map(p => p.z), text: data.map(p => `[Score: ${(p.score || 0).toFixed(2)}] ${p.full_text.substring(0, 200)}...`), mode: 'markers', type: 'scatter3d', marker: { size, color, opacity }, customdata: data });
        const traces = [
            createTrace(normalData, 'Outros', 'grey', 3, 0.2),
            createTrace(lowRelevance, 'Relevância Baixa', SEMANTIC_SEARCH_COLORS.low, 4, 0.8),
            createTrace(mediumRelevance, 'Relevância Média', SEMANTIC_SEARCH_COLORS.medium, 5, 0.9),
            createTrace(highRelevance, 'Relevância Alta', SEMANTIC_SEARCH_COLORS.high, 8, 1.0)
        ];
        const layout = { title: `Destacando ${results.length} Documentos para "${query}"`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', legend: { y: 0.9, x: 0.95 } };
        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(attachClickHandlerToPlot);
    }

    function highlightSinglePoint(selectedIndex) {
        const highlightedPoint = fullPlotData[selectedIndex];
        const normalData = fullPlotData.filter((_, index) => index !== selectedIndex);
        const traces = [
            { name: 'Outros', x: normalData.map(p => p.x), y: normalData.map(p => p.y), z: normalData.map(p => p.z), text: normalData.map(p => p.full_text.substring(0,200)), mode: 'markers', type: 'scatter3d', marker: { size: 3, color: 'grey', opacity: 0.1 }, customdata: normalData },
            { name: 'Selecionado', x: [highlightedPoint.x], y: [highlightedPoint.y], z: [highlightedPoint.z], text: [highlightedPoint.full_text.substring(0,200)], mode: 'markers', type: 'scatter3d', marker: { size: 10, color: '#ff00ff', opacity: 1.0 }, customdata: [highlightedPoint] }
        ];
        const layout = { title: `Focando no Documento #${selectedIndex}`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', showlegend: false };
        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(attachClickHandlerToPlot);
    }
    
    function renderSearchResultsList(results) {
        const container = scribeWingContent;
        container.innerHTML = '';
        if (results.length === 0) {
            container.innerHTML = '<div class="text-center p-5"><p class="text-muted">Nenhum resultado semanticamente relevante encontrado.</p></div>';
            return;
        }
        let html = `<h5 class="mb-3 text-center sticky-top bg-dark py-2" style="background: rgba(12,12,15,0.9);">Top Resultados Semânticos</h5>`;
        results.forEach(result => {
            const doc = fullPlotData[result.index];
            html += `
                <div class="search-result-item" data-index="${result.index}">
                    <div class="d-flex justify-content-between">
                        <span class="search-result-score">Similaridade: ${result.score.toFixed(3)}</span>
                        <span class="badge bg-dark text-light border border-secondary" style="font-size: 0.6em;">#${result.index}</span>
                    </div>
                    <p class="search-result-text mt-1">${doc.full_text}</p>
                </div>`;
        });
        container.innerHTML = html;
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                highlightSinglePoint(index);
            });
        });
    }

    // --- Funções Utilitárias ---
    function showToast(message, type = "info") { /* ...código completo... */ }
    function debounce(func, delay) { /* ...código completo... */ }
});
