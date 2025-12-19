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

    // CSV Elements
    const csvColumnSection = document.getElementById('csvColumnSection');
    const csvColumnSelect = document.getElementById('csvColumnSelect');

    // Tavily Elements
    const tavilyQuery = document.getElementById('tavilyQuery');
    const tavilyMaxResults = document.getElementById('tavilyMaxResults');
    const tavilySearchButton = document.getElementById('tavilySearchButton');

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
    let threeViewer = null; // Three.js viewer instance

    // --- Theme Logic ---
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');

    function setTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('theme', theme);

        // Update Icon
        if (theme === 'dark') {
            themeIcon.classList.remove('bi-sun-fill');
            themeIcon.classList.add('bi-moon-stars-fill');
        } else {
            themeIcon.classList.remove('bi-moon-stars-fill');
            themeIcon.classList.add('bi-sun-fill');
        }

        // Update Charts if they exist
        updateChartsTheme(theme);
    }

    // Initialize Theme
    const currentTheme = localStorage.getItem('theme') || 'dark';
    setTheme(currentTheme);

    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });

    function updateChartsTheme(theme) {
        const isDark = theme === 'dark';
        const textColor = isDark ? '#ededed' : '#111827';
        const gridColor = isDark ? '#333' : '#e5e7eb';

        // Update Chart.js instances
        activeCharts.forEach(chart => {
            if (chart.options.scales) {
                ['x', 'y'].forEach(axis => {
                    if (chart.options.scales[axis]) {
                        chart.options.scales[axis].ticks.color = textColor;
                        chart.options.scales[axis].grid.color = gridColor;
                    }
                });
            }
            if (chart.options.plugins.legend) {
                chart.options.plugins.legend.labels.color = textColor;
            }
            chart.update();
        });

        // Update Plotly instance
        const plotEl = document.getElementById('plotContainer');
        if (plotEl && plotEl.data) {
            const update = {
                'template': isDark ? 'plotly_dark' : 'plotly_white',
                'paper_bgcolor': 'rgba(0,0,0,0)',
                'plot_bgcolor': 'rgba(0,0,0,0)',
                'scene.xaxis.title.font.color': textColor,
                'scene.yaxis.title.font.color': textColor,
                'scene.zaxis.title.font.color': textColor,
            };
            Plotly.relayout(plotEl, update);
        }
    }

    // --- Paleta de Cores NEON ---
    // Paleta vibrante futurista com tons neon
    const KINGDOM_COLORS = [
        '#818cf8', // Indigo Neon
        '#34d399', // Emerald Neon
        '#f472b6', // Pink Neon
        '#fbbf24', // Amber Neon
        '#60a5fa', // Blue Neon
        '#a78bfa', // Purple Neon
        '#22d3ee', // Cyan Neon
        '#fb7185', // Rose Neon
        '#4ade80', // Green Neon
        '#c084fc'  // Violet Neon
    ];
    const SEMANTIC_SEARCH_COLORS = { high: '#fef08a', medium: '#fde047', low: '#facc15' }; // Yellow/Gold variations

    // --- Ouvintes ---
    samplesSlider.addEventListener('input', () => { samplesValue.textContent = samplesSlider.value; });
    processButton.addEventListener('click', handleProcessing);
    searchInput.addEventListener('input', debounce(handleSearch, 500));

    // Custom File Input Listener
    fileUpload.addEventListener('change', (e) => {
        const fileName = e.target.files[0] ? e.target.files[0].name : "Escolher arquivo...";
        document.getElementById('fileNameDisplay').textContent = fileName;
        // Optional: Highlight border to show success
        if (e.target.files[0]) {
            const btn = document.querySelector('.file-upload-btn');
            // Use CSS var logic here or direct style? Direct style overrides classes.
            // Better to add a class.
            btn.style.borderColor = 'var(--success, #10b981)';
            btn.style.color = 'var(--text-primary)';
        }
    });

    // --- Lógica Principal ---
    async function handleProcessing() {
        const file = fileUpload.files[0];
        if (!file) { showToast("Por favor, selecione um arquivo.", "warning"); return; }

        // Check if CSV needs column selection
        if (file.name.toLowerCase().endsWith('.csv')) {
            const selectedColumn = csvColumnSelect ? csvColumnSelect.value : '';
            if (!selectedColumn) {
                showToast("Selecione a coluna de texto para o CSV", "warning");
                return;
            }
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('n_samples', samplesSlider.value);

        // Add text_column if CSV
        if (file.name.toLowerCase().endsWith('.csv') && csvColumnSelect) {
            formData.append('text_column', csvColumnSelect.value);
        }

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
            console.error("Erro detalhado:", error);
            showToast(`Falha ao processar: ${error.message}`, "error");
            setLoadingState(false, true);
        }
    }

    async function handleSearch(e) {
        const query = e.target.value.trim();
        if (!currentJobId) return;

        if (!query) {
            // Reset Three.js highlight instead of re-rendering
            if (threeViewer) {
                threeViewer.resetHighlight();
            } else {
                renderPlot(fullApiData);
            }
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
            renderSearchResultsList(searchData); // <<< APRIMORADO: Agora recebe o objeto inteiro
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
            if (!response.ok) throw new Error(`O Oráculo falhou: ${await response.text()}`);
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

    // --- Funções de UI e Renderização ---
    function setLoadingState(isLoading, hasFailed = false) {
        if (isLoading) {
            currentJobId = null;
            fullApiData = null;
            if (emptyState) emptyState.classList.add('d-none');
            if (plotContainer) plotContainer.innerHTML = '';

            [searchCard, overviewChartsRow, duplicatesRow].forEach(el => {
                if (el) el.style.display = 'none';
            });

            loadingSection.classList.remove('d-none');
            processButton.disabled = true;
            processButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
        } else {
            loadingSection.classList.add('d-none');
            processButton.disabled = false;
            processButton.innerHTML = '<i class="bi bi-stars me-2"></i>Gerar Universo';
            if (hasFailed && emptyState) {
                emptyState.classList.remove('d-none');
            }
        }
    }

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

        // Show sections with display block/flex
        if (searchCard) searchCard.style.display = 'block';
        if (overviewChartsRow) overviewChartsRow.style.display = 'block'; // Bootstrap row is flex by default but block is fine for div
        if (duplicatesRow) duplicatesRow.style.display = 'block';

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

        // Initialize Three.js viewer if not already done
        if (!threeViewer) {
            // Clear the container first
            plotContainer.innerHTML = '';

            threeViewer = new AetherMapViewer('plotContainer', {
                autoRotate: true,
                autoRotateSpeed: 0.5
            });

            // Set up click handler to open modal
            threeViewer.onPointClick = (pointData) => {
                showPointModal(pointData);
            };
        }

        // Load data into the viewer
        threeViewer.loadData(plotData);
    }

    // Show point details in modal (used by both Plotly and Three.js)
    function showPointModal(pointData) {
        const index = pointData.index !== undefined ? pointData.index :
            fullPlotData.findIndex(p => p.x === pointData.x && p.y === pointData.y);

        document.getElementById('modal-doc-index').textContent = index;
        document.getElementById('modal-cluster-id').textContent =
            pointData.cluster === '-1' ? 'Ruído' : `Cluster ${pointData.cluster}`;
        document.getElementById('modal-word-count').textContent =
            pointData.full_text ? pointData.full_text.split(/\s+/).length : 0;
        document.getElementById('modal-full-text').textContent =
            pointData.full_text || 'Sem texto disponível';
        pointDetailModal.show();
    }

    // Legacy function for Plotly compatibility
    function attachClickHandlerToPlot(plotDiv) {
        plotDiv.on('plotly_click', (eventData) => {
            if (eventData.points.length > 0) {
                const point = eventData.points[0];
                const clickedPointData = point.customdata;
                if (clickedPointData) {
                    showPointModal(clickedPointData);
                }
            }
        });
    }

    function renderOverviewCharts(data) {
        const distCanvas = document.getElementById('clusterDistributionChart');
        const tfidfCanvas = document.getElementById('tfidfChart');
        if (!distCanvas || !tfidfCanvas) return;

        const distCtx = distCanvas.getContext('2d');
        const clusterCounts = {};
        data.plot_data.forEach(p => {
            const clusterName = p.cluster === '-1' ? 'Ruído' : `Cluster ${p.cluster}`;
            clusterCounts[clusterName] = (clusterCounts[clusterName] || 0) + 1;
        });
        const sortedClusters = Object.entries(clusterCounts).sort((a, b) => b[1] - a[1]);

        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const textColor = isDark ? '#ededed' : '#111827';

        activeCharts.push(new Chart(distCtx, { type: 'doughnut', data: { labels: sortedClusters.map(entry => entry[0]), datasets: [{ data: sortedClusters.map(entry => entry[1]), backgroundColor: KINGDOM_COLORS, borderColor: 'transparent' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor } } } } }));

        if (data.metrics && data.metrics.top_tfidf_palavras) {
            const tfidfCtx = tfidfCanvas.getContext('2d');
            const tfidfData = data.metrics.top_tfidf_palavras;
            activeCharts.push(new Chart(tfidfCtx, { type: 'bar', data: { labels: tfidfData.map(item => item.palavra).reverse(), datasets: [{ label: 'Score TF-IDF', data: tfidfData.map(item => item.score).reverse(), backgroundColor: KINGDOM_COLORS[1] }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor } } } } }));
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

    // <<< FUNÇÃO DE BUSCA APRIMORADA PARA EXIBIR O RESUMO RAG >>>
    function renderSearchResultsList(searchData) {
        const container = scribeWingContent;
        container.innerHTML = '';
        const { summary, results } = searchData;

        if (results.length === 0) {
            container.innerHTML = '<div class="text-center p-5"><p class="text-muted">Nenhum resultado semanticamente relevante encontrado.</p></div>';
            return;
        }

        // Adiciona o card de Resumo do Sábio no topo
        let html = `
            <div class="sabio-card mb-3">
                <div class="card-body">
                    <h5 class="card-title mb-2"><i class="bi bi-lightbulb-fill me-2 text-warning"></i>Resposta Direta do Sábio</h5>
                    <p class="card-text">${summary}</p>
                </div>
            </div>
            <h6 class="text-muted text-center mb-2 small">FONTES CONSULTADAS</h6>
        `;

        // Adiciona a lista de resultados (fontes)
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

    function highlightPlotSemantico(results, query) {
        // Use Three.js viewer if available
        if (threeViewer) {
            const highlightedIndices = results.map(r => r.index);
            threeViewer.highlightPoints(highlightedIndices, 0xfef08a); // Yellow highlight
            return;
        }

        // Fallback to Plotly if Three.js not available
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
        const traces = [createTrace(normalData, 'Outros', 'grey', 3, 0.2), createTrace(lowRelevance, 'Relevância Baixa', SEMANTIC_SEARCH_COLORS.low, 4, 0.8), createTrace(mediumRelevance, 'Relevância Média', SEMANTIC_SEARCH_COLORS.medium, 5, 0.9), createTrace(highRelevance, 'Relevância Alta', SEMANTIC_SEARCH_COLORS.high, 8, 1.0)];
        const layout = { title: `Destacando ${results.length} Documentos para "${query}"`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', legend: { y: 0.9, x: 0.95 } };
        Plotly.newPlot(plotContainer, traces, layout, { responsive: true }).then(attachClickHandlerToPlot);
    }

    function highlightSinglePoint(selectedIndex) {
        // Use Three.js viewer if available
        if (threeViewer) {
            threeViewer.highlightPoints([selectedIndex], 0xff00ff); // Magenta highlight
            return;
        }

        // Fallback to Plotly
        const highlightedPoint = fullPlotData[selectedIndex];
        const normalData = fullPlotData.filter((_, index) => index !== selectedIndex);
        const traces = [
            { name: 'Outros', x: normalData.map(p => p.x), y: normalData.map(p => p.y), z: normalData.map(p => p.z), text: normalData.map(p => p.full_text.substring(0, 200)), mode: 'markers', type: 'scatter3d', marker: { size: 3, color: 'grey', opacity: 0.1 }, customdata: normalData },
            { name: 'Selecionado', x: [highlightedPoint.x], y: [highlightedPoint.y], z: [highlightedPoint.z], text: [highlightedPoint.full_text.substring(0, 200)], mode: 'markers', type: 'scatter3d', marker: { size: 10, color: '#ff00ff', opacity: 1.0 }, customdata: [highlightedPoint] }
        ];
        const layout = { title: `Focando no Documento #${selectedIndex}`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', showlegend: false };
        Plotly.newPlot(plotContainer, traces, layout, { responsive: true }).then(attachClickHandlerToPlot);
    }

    // --- Funções Utilitárias ---
    function showToast(message, type = "info") {
        const types = { info: { background: "linear-gradient(to right, #00b09b, #96c93d)" }, success: { background: "linear-gradient(to right, #4e79a7, #76b7b2)" }, warning: { background: "linear-gradient(to right, #f28e2c, #edc949)" }, error: { background: "linear-gradient(to right, #e15759, #ff9da7)" }, };
        Toastify({ text: message, duration: 4000, gravity: "bottom", position: "right", style: types[type] }).showToast();
    }

    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // --- CSV File Handling ---
    fileUpload.onchange = async function () {
        const file = this.files[0];
        if (!file) return;

        document.getElementById('fileNameDisplay').textContent = file.name;

        // Check if CSV
        if (file.name.toLowerCase().endsWith('.csv')) {
            csvColumnSection.style.display = 'flex';

            // Fetch columns from backend
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch(`${API_URL}/csv_columns/`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    csvColumnSelect.innerHTML = '<option value="">Selecione a coluna...</option>';
                    data.columns.forEach(col => {
                        const option = document.createElement('option');
                        option.value = col;
                        option.textContent = col;
                        csvColumnSelect.appendChild(option);
                    });
                    showToast(`CSV detectado: ${data.columns.length} colunas`, 'info');
                } else {
                    showToast('Erro ao ler colunas do CSV', 'error');
                }
            } catch (e) {
                showToast('Erro de conexão ao ler CSV', 'error');
            }
        } else {
            csvColumnSection.style.display = 'none';
        }
    };

    // Override process to include CSV column
    const originalHandleProcess = handleProcess;
    async function handleProcess() {
        const file = fileUpload.files[0];

        // Check if CSV needs column
        if (file && file.name.toLowerCase().endsWith('.csv')) {
            const selectedColumn = csvColumnSelect.value;
            if (!selectedColumn) {
                showToast('Selecione a coluna de texto para o CSV', 'warning');
                return;
            }
        }

        setLoadingState(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('n_samples', samplesSlider.value);

        // Add column if CSV
        if (file && file.name.toLowerCase().endsWith('.csv')) {
            formData.append('text_column', csvColumnSelect.value);
        }

        try {
            const response = await fetch(`${API_URL}/process/`, { method: 'POST', body: formData });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Erro no processamento');
            }
            const data = await response.json();
            handleProcessSuccess(data);
        } catch (error) {
            console.error("Erro detalhado:", error);
            showToast(`Falha ao processar: ${error.message}`, "error");
            setLoadingState(false, true);
        }
    }

    // --- Tavily Web Search ---
    if (tavilySearchButton) {
        tavilySearchButton.onclick = async function () {
            const query = tavilyQuery.value.trim();
            if (!query) {
                showToast('Digite um termo de busca', 'warning');
                return;
            }

            setLoadingState(true);
            const formData = new FormData();
            formData.append('query', query);
            formData.append('max_results', tavilyMaxResults.value);

            try {
                const response = await fetch(`${API_URL}/search_web/`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || 'Erro na busca web');
                }

                const data = await response.json();

                if (data.error) {
                    showToast(data.error, 'warning');
                    setLoadingState(false, true);
                    return;
                }

                // Process like normal file upload
                handleProcessSuccess(data);
                showToast(`Busca concluída: ${data.metadata.num_documents_processed} resultados`, 'success');

            } catch (error) {
                console.error("Erro Tavily:", error);
                showToast(`Falha na busca web: ${error.message}`, "error");
                setLoadingState(false, true);
            }
        };
    }

    // Common success handler
    function handleProcessSuccess(data) {
        fullApiData = data;
        currentJobId = data.job_id;
        fullPlotData = data.plot_data;

        renderPlot(data);
        renderGlobalMetrics(data);
        renderOverviewCharts(data);
        renderDuplicates(data.duplicates || {});
        renderClusterAnalysis(data);

        overviewChartsRow.style.display = 'block';
        duplicatesRow.style.display = 'block';
        scribeWing.style.display = 'block';
        searchCard.style.display = 'block';

        setLoadingState(false);
        showToast("Universo gerado com sucesso!", "success");
    }
});
