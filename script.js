document.addEventListener('DOMContentLoaded', () => {

    // --- Seletores de Elementos do DOM (O Arsenal do Mago) ---
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

    // --- Configurações e Estado Global (A Torre de Controle) ---
    const API_URL = "https://madras1-aethermap.hf.space/process/";
    let fullPlotData = [];
    let fuse;

    // --- Ouvintes de Eventos (Os Vigilantes do Reino) ---
    samplesSlider.addEventListener('input', () => {
        samplesValue.textContent = samplesSlider.value;
    });

    processButton.addEventListener('click', handleProcessing);
    searchInput.addEventListener('input', handleSearch);

    // --- Módulo de Lógica Principal (O Estrategista) ---
    async function handleProcessing() {
        const file = fileUpload.files[0];
        const nSamples = samplesSlider.value;

        if (!file) {
            showToast("Por favor, selecione um arquivo primeiro.", "warning");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('n_samples', nSamples);

        setLoadingState(true);

        try {
            const response = await fetch(API_URL, { method: 'POST', body: formData });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro da API (${response.status}): ${errorText}`);
            }
            const data = await response.json();
            renderAllResults(data);
            showToast("Universo gerado com sucesso!", "success");
        } catch (error) {
            showToast(`Falha na comunicação com o oráculo: ${error.message}`, "error");
            emptyState.classList.remove('d-none'); // Mostra o estado vazio em caso de erro
        } finally {
            setLoadingState(false);
        }
    }

    function handleSearch(e) {
        const query = e.target.value.trim();
        if (!fuse) return; // Proteção para evitar busca antes dos dados carregarem

        if (!query) {
            renderPlot({ plot_data: fullPlotData, metadata: { num_documents_processed: fullPlotData.length } });
            return;
        }
        const results = fuse.search(query, { limit: 100 });
        const highlightedIndices = new Set(results.map(r => r.refIndex));
        highlightPlot(highlightedIndices);
    }

    // --- Módulo de UI (O Arquiteto da Experiência) ---
    function setLoadingState(isLoading) {
        if (isLoading) {
            emptyState.classList.add('d-none');
            plotContainer.innerHTML = '';
            resultsPanel.innerHTML = '';
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
    }

    function showToast(message, type = "info") {
        const backgroundColors = {
            success: "linear-gradient(to right, #00b09b, #96c93d)",
            error: "linear-gradient(to right, #ff5f6d, #ffc371)",
            warning: "linear-gradient(to right, #f7b733, #fc4a1a)",
            info: "linear-gradient(to right, #0d6efd, #6f42c1)"
        };
        Toastify({ text: message, duration: 5000, close: true, gravity: "top", position: "right", stopOnFocus: true, style: { background: backgroundColors[type] } }).showToast();
    }
    
    // --- Módulo de Renderização (O Artista do Palácio) ---
    function renderAllResults(data) {
        fullPlotData = data.plot_data;
        // Inicializa o Fuse.js aqui, com os dados completos
        fuse = new Fuse(data.plot_data, { 
            keys: ['full_text'], 
            threshold: 0.4,
            includeScore: true,
            useExtendedSearch: true
        });
        
        emptyState.classList.add('d-none');
        plotContainer.innerHTML = '';
        
        renderPlot(data);
        // Gera o HTML para o painel de resultados de uma vez
        resultsPanel.innerHTML = `
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Análise Quantitativa</h5>
                            <div id="metrics-container" class="row text-center gy-3"></div>
                            <hr class="my-4">
                            <div id="keywords-container"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Análise de Duplicidade</h5>
                            <div id="duplicates-container"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        renderMetrics(data); // Agora preenche o HTML que acabamos de criar
        renderDuplicates(data);
        
        resultsPanel.classList.add('visible');
        searchCard.classList.add('visible');
    }

    function renderPlot(data) {
        const plotData = data.plot_data;
        const traces = [];
        const uniqueClusters = [...new Set(plotData.map(p => p.cluster))].sort((a, b) => a - b);

        uniqueClusters.forEach(clusterId => {
            const pointsInCluster = plotData.filter(p => p.cluster === clusterId);
            traces.push({
                x: pointsInCluster.map(p => p.x),
                y: pointsInCluster.map(p => p.y),
                z: pointsInCluster.map(p => p.z),
                mode: 'markers', type: 'scatter3d',
                name: clusterId === -1 ? 'Ruído' : `Cluster ${clusterId}`,
                text: pointsInCluster.map(p => p.full_text.substring(0, 200) + '...'),
                marker: { size: 4, opacity: 0.8 },
                customdata: pointsInCluster
            });
        });

        const layout = {
            title: `Visualização de ${data.metadata.num_documents_processed} Documentos`,
            margin: { l: 0, r: 0, b: 0, t: 40 },
            scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } },
            template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { y: 0.9, x: 0.95 }
        };

        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(setupPlotInteractions);
    }

    function highlightPlot(highlightedIndices) {
        const highlightedData = [];
        const normalData = [];
        fullPlotData.forEach((point, index) => {
            if (highlightedIndices.has(index)) {
                highlightedData.push(point);
            } else {
                normalData.push(point);
            }
        });

        const traces = [
            { name: 'Outros', x: normalData.map(p => p.x), y: normalData.map(p => p.y), z: normalData.map(p => p.z), text: normalData.map(p => p.full_text.substring(0, 200)), mode: 'markers', type: 'scatter3d', marker: { size: 3, color: 'grey', opacity: 0.3 }, customdata: normalData },
            { name: 'Busca', x: highlightedData.map(p => p.x), y: highlightedData.map(p => p.y), z: highlightedData.map(p => p.z), text: highlightedData.map(p => p.full_text.substring(0, 200)), mode: 'markers', type: 'scatter3d', marker: { size: 6, color: 'yellow', opacity: 1.0 }, customdata: highlightedData }
        ];
        
        const layout = {
            title: `Destacando ${highlightedIndices.size} Documentos Relevantes`,
            margin: { l: 0, r: 0, b: 0, t: 40 },
            scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } },
            template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)'
        };

        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(setupPlotInteractions);
    }

    function renderMetrics(data) {
        const metricsContainer = document.getElementById('metrics-container');
        const keywordsContainer = document.getElementById('keywords-container');
        const metrics = data.metadata;
        const analysis = data.metrics;

        metricsContainer.innerHTML = `
            <div class="col-md col-6"><h5>${metrics.num_documents_processed}</h5><small class="text-muted">Documentos</small></div>
            <div class="col-md col-6"><h5>${metrics.num_clusters_found}</h5><small class="text-muted">Clusters</small></div>
            <div class="col-md col-6"><h5>${metrics.num_noise_points}</h5><small class="text-muted">Pontos de Ruído</small></div>
            <div class="col-md col-6"><h5>${analysis.riqueza_lexical}</h5><small class="text-muted">Riqueza Lexical</small></div>
            <div class="col-md col-12 mt-3 mt-md-0"><h5>${analysis.entropia.toFixed(2)}</h5><small class="text-muted">Entropia (Bits)</small></div>
        `;

        const keywordsHTML = analysis.palavras_relevantes.map(word => `<span class="keyword-tag">${word}</span>`).join('');
        keywordsContainer.innerHTML = `<strong>Top Palavras-Chave (TF-IDF):</strong><div class="mt-2">${keywordsHTML}</div>`;
    }

    function renderDuplicates(data) {
        const duplicatesContainer = document.getElementById('duplicates-container');
        const { grupos_exatos, pares_semanticos } = data.duplicates;
        const MAX_TO_SHOW = 10;
        let html = '';

        const numGruposExatos = Object.keys(grupos_exatos).length;
        html += `<h6 class="mb-3">Duplicados Exatos (${numGruposExatos} grupos)</h6>`;
        if (numGruposExatos > 0) {
            Object.entries(grupos_exatos).slice(0, MAX_TO_SHOW).forEach(([text, indices]) => {
                html += `<p class="text-muted small lh-sm"><strong>(${indices.length}x):</strong> ${text.substring(0, 150)}...</p>`;
            });
        } else {
            html += '<p class="text-success small">Nenhum duplicado exato encontrado.</p>';
        }

        html += `<hr class="my-4">`;
        const numParesSemanticos = pares_semanticos.length;
        html += `<h6 class="mb-3">Duplicados Semânticos (${numParesSemanticos} pares)</h6>`;
        if (numParesSemanticos > 0) {
            pares_semanticos.slice(0, MAX_TO_SHOW).forEach(pair => {
                html += `<div class="p-2 border-start border-primary small mb-2 lh-sm"><strong>Similaridade: ${pair.similaridade.toFixed(3)}</strong><br>1: ${pair.texto1.substring(0, 100)}...<br>2: ${pair.texto2.substring(0, 100)}...</div>`;
            });
        } else {
            html += '<p class="text-success small">Nenhum duplicado semântico encontrado.</p>';
        }

        duplicatesContainer.innerHTML = html;
    }

    function setupPlotInteractions() {
        plotContainer.on('plotly_click', (data) => {
            if (data.points.length > 0) {
                const point = data.points[0];
                const clickedPointData = point.customdata;

                if (clickedPointData) {
                    const clusterId = clickedPointData.cluster;
                    document.getElementById('modal-cluster-id').textContent = clusterId === -1 ? 'Ruído' : `Cluster ${clusterId}`;
                    document.getElementById('modal-full-text').textContent = clickedPointData.full_text;
                    pointDetailModal.show();
                }
            }
        });
    }
});
