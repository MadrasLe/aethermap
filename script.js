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
    
    // Seções de Resultados (para controle de visibilidade)
    const overviewChartsRow = document.getElementById('overview-charts-row');
    const duplicatesRow = document.getElementById('duplicates-row');
    
    // Modal
    const pointDetailModal = new bootstrap.Modal(document.getElementById('pointDetailModal'));

    // --- Configurações e Estado Global ---
    const API_URL = "https://madras1-aethermap.hf.space/process/";
    let fullPlotData = [];
    let currentJobId = null;
    let fullApiData = null; // Guarda todos os dados para restaurar o estado original
    let activeCharts = []; // Para gerenciar a destruição de gráficos antigos

    // --- Paleta de Cores do Reino ---
    const KINGDOM_COLORS = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];
    const SEMANTIC_SEARCH_COLORS = { high: '#ffde59', medium: '#f5b041', low: '#d68910' };

    // --- Ouvintes de Eventos ---
    samplesSlider.addEventListener('input', () => { samplesValue.textContent = samplesSlider.value; });
    processButton.addEventListener('click', handleProcessing);
    searchInput.addEventListener('input', debounce(handleSearch, 500));

    // --- Módulo de Lógica Principal ---
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
        currentJobId = null;

        try {
            const response = await fetch(API_URL, { method: 'POST', body: formData });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro da API (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            fullApiData = data; // Guarda o tesouro completo
            currentJobId = data.job_id; // Guarda a chave do reino
            
            renderAllResults(data);
            showToast("Universo gerado com sucesso!", "success");
        } catch (error) {
            console.error("Erro detalhado:", error);
            showToast(`Falha ao processar o universo: ${error.message}`, "error");
            setLoadingState(false, true); // Indica falha
        } finally {
            // O loading é removido dentro do renderAllResults se der sucesso, 
            // ou acima se der erro, mas por segurança:
            if (loadingSection.classList.contains('d-none') === false && fullApiData) {
                 setLoadingState(false);
            }
        }
    }
    
    async function handleSearch(e) {
        const query = e.target.value.trim();
        
        if (!currentJobId) { return; } // Sem universo, sem busca

        // Se a busca for limpa, restaura o estado original
        if (!query) {
            renderPlot(fullApiData);
            renderClusterAnalysis(fullApiData); // Restaura a Ala do Escriba para Clusters
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
            
            // 1. Atualiza o Observatório (3D)
            highlightPlotSemantico(searchData.results, query);
            
            // 2. Atualiza a Ala do Escriba (Lista Lateral)
            renderSearchResultsList(searchData.results);

        } catch (error) {
            showToast(`Erro na busca: ${error.message}`, 'error');
        }
    }

    // --- Módulo de UI ---
    function setLoadingState(isLoading, hasFailed = false) {
        if (isLoading) {
            emptyState.classList.add('d-none');
            plotContainer.innerHTML = ''; // Limpa o gráfico 3D apenas
            
            // Esconde as seções, mas NÃO as destrói (preserva os canvas)
            [searchCard, scribeWing, overviewChartsRow, duplicatesRow].forEach(el => {
                if(el) el.classList.remove('visible');
            });
            
            loadingSection.classList.remove('d-none');
            processButton.disabled = true;
            processButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
        } else {
            loadingSection.classList.add('d-none');
            processButton.disabled = false;
            processButton.innerHTML = '<i class="bi bi-stars me-2"></i>Gerar Universo';
            
            if (hasFailed) {
                emptyState.classList.remove('d-none');
            }
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
    
    // --- Módulo de Renderização Mestre ---
    function renderAllResults(data) {
        fullPlotData = data.plot_data;
        
        // Limpa gráficos antigos do Chart.js para não sobrepor
        activeCharts.forEach(chart => chart.destroy());
        activeCharts = [];

        emptyState.classList.add('d-none');
        plotContainer.innerHTML = '';
        
        // Invoca os artistas
        renderPlot(data);
        renderOverviewCharts(data);
        renderClusterAnalysis(data);
        renderDuplicates(data);
        
        // Revela o palácio
        [searchCard, scribeWing, overviewChartsRow, duplicatesRow].forEach(el => {
            if(el) el.classList.add('visible');
        });
        
        setLoadingState(false);
    }

    // --- Funções de Renderização Específicas ---

    // Helper para anexar o evento de clique (Restaura a Voz do Oráculo)
    function attachClickHandlerToPlot(plotDiv) {
        plotDiv.on('plotly_click', (eventData) => {
            if (eventData.points.length > 0) {
                const point = eventData.points[0];
                // Tenta pegar customdata (onde guardamos o objeto completo)
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
            traces.push({
                x: pointsInCluster.map(p => p.x), y: pointsInCluster.map(p => p.y), z: pointsInCluster.map(p => p.z),
                mode: 'markers', type: 'scatter3d', name: clusterId === '-1' ? 'Ruído' : `Cluster ${clusterId}`,
                text: pointsInCluster.map(p => p.full_text.substring(0, 200) + '...'), // Restaurado o texto no hover
                marker: { size: 4, opacity: 0.8, color: traceColor }, 
                customdata: pointsInCluster // Dados essenciais para o clique
            });
        });

        const layout = {
            title: `Visualização de ${data.metadata.num_documents_processed} Documentos`, margin: { l: 0, r: 0, b: 0, t: 40 },
            scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } },
            template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { y: 0.9, x: 0.95 }
        };

        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(attachClickHandlerToPlot);
    }

    function highlightPlotSemantico(results, query) {
        const highRelevance = [], mediumRelevance = [], lowRelevance = [], normalData = [];
        const highlightedIndices = new Set(results.map(r => r.index));

        fullPlotData.forEach((point, index) => {
            if (highlightedIndices.has(index)) {
                const result = results.find(r => r.index === index);
                // Adiciona o score ao objeto do ponto para uso no hover se quiser
                point.score = result.score; 
                
                if (result.score > 0.6) highRelevance.push(point);
                else if (result.score > 0.45) mediumRelevance.push(point);
                else lowRelevance.push(point);
            } else {
                normalData.push(point);
            }
        });

        const createTrace = (data, name, color, size, opacity) => ({
            name: name,
            x: data.map(p => p.x), y: data.map(p => p.y), z: data.map(p => p.z),
            text: data.map(p => `[Score: ${(p.score || 0).toFixed(2)}] ${p.full_text.substring(0, 200)}...`), // Hover rico
            mode: 'markers', type: 'scatter3d',
            marker: { size: size, color: color, opacity: opacity },
            customdata: data
        });

        const traces = [
            createTrace(normalData, 'Outros', 'grey', 3, 0.2),
            createTrace(lowRelevance, 'Relevância Baixa', SEMANTIC_SEARCH_COLORS.low, 4, 0.8),
            createTrace(mediumRelevance, 'Relevância Média', SEMANTIC_SEARCH_COLORS.medium, 5, 0.9),
            createTrace(highRelevance, 'Relevância Alta', SEMANTIC_SEARCH_COLORS.high, 8, 1.0)
        ];

        const layout = {
            title: `Destacando ${results.length} Documentos para "${query}"`, margin: { l: 0, r: 0, b: 0, t: 40 },
            scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } },
            template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { y: 0.9, x: 0.95 }
        };

        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(attachClickHandlerToPlot);
    }

    function highlightSinglePoint(selectedIndex) {
        const highlightedPoint = fullPlotData[selectedIndex];
        const normalData = fullPlotData.filter((_, index) => index !== selectedIndex);

        const traces = [
            { name: 'Outros', x: normalData.map(p => p.x), y: normalData.map(p => p.y), z: normalData.map(p => p.z), text: normalData.map(p => p.full_text.substring(0,200)), mode: 'markers', type: 'scatter3d', marker: { size: 3, color: 'grey', opacity: 0.1 }, customdata: normalData },
            { name: 'Selecionado', x: [highlightedPoint.x], y: [highlightedPoint.y], z: [highlightedPoint.z], text: [highlightedPoint.full_text.substring(0,200)], mode: 'markers', type: 'scatter3d', marker: { size: 10, color: '#ff00ff', opacity: 1.0 }, customdata: [highlightedPoint] }
        ];
        
        const layout = { title: `Focando no Documento`, margin: { l: 0, r: 0, b: 0, t: 40 }, scene: { xaxis: { title: 'UMAP 1' }, yaxis: { title: 'UMAP 2' }, zaxis: { title: 'UMAP 3' } }, template: 'plotly_dark', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', showlegend: false };
        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(attachClickHandlerToPlot);
    }

    function renderOverviewCharts(data) {
        // Garante que os elementos existem antes de tentar desenhar
        const distCanvas = document.getElementById('clusterDistributionChart');
        const tfidfCanvas = document.getElementById('tfidfChart');

        if (!distCanvas || !tfidfCanvas) {
            console.error("Canvas de gráficos não encontrados!");
            return;
        }

        const distCtx = distCanvas.getContext('2d');
        const tfidfCtx = tfidfCanvas.getContext('2d');
        
        // Rosca
        const clusterCounts = {};
        data.plot_data.forEach(p => {
            const clusterName = p.cluster === '-1' ? 'Ruído' : `Cluster ${p.cluster}`;
            clusterCounts[clusterName] = (clusterCounts[clusterName] || 0) + 1;
        });
        const sortedClusters = Object.entries(clusterCounts).sort((a, b) => b[1] - a[1]);
        
        activeCharts.push(new Chart(distCtx, {
            type: 'doughnut',
            data: {
                labels: sortedClusters.map(entry => entry[0]),
                datasets: [{
                    data: sortedClusters.map(entry => entry[1]),
                    backgroundColor: KINGDOM_COLORS,
                    borderColor: '#0c0c0f',
                    borderWidth: 2
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#f0f1f2' } } } }
        }));

        // Barras
        const tfidfData = data.metrics.top_tfidf_palavras;
        activeCharts.push(new Chart(tfidfCtx, {
            type: 'bar',
            data: {
                labels: tfidfData.map(item => item.palavra).reverse(),
                datasets: [{
                    label: 'Score TF-IDF',
                    data: tfidfData.map(item => item.score).reverse(),
                    backgroundColor: KINGDOM_COLORS[1]
                }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#a0a0b0' } }, y: { ticks: { color: '#f0f1f2' } } } }
        }));
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
        
        let html = `<h5 class="mb-3 text-center sticky-top bg-dark py-2" style="background: rgba(12,12,15,0.9);">Análise por Cluster</h5>`;
        sortedAnalysis.forEach(([clusterId, clusterData]) => {
            const color = KINGDOM_COLORS[parseInt(clusterId) % KINGDOM_COLORS.length];
            // Adicionei as top palavras diretamente no card para simplicidade e leitura rápida
            html += `<div class="cluster-card mt-3">
                        <div class="cluster-card-header">
                            <h6><span style="color: ${color};">■</span> Cluster ${clusterId}</h6>
                            <span class="badge text-bg-secondary">${clusterData.num_documentos} Documentos</span>
                            <div class="mt-2 small text-muted" style="font-style: italic;">
                                "${clusterData.top_palavras.map(p => p.palavra).join(', ')}"
                            </div>
                        </div>
                    </div>`;
        });
        container.innerHTML = html;
    }

    function renderSearchResultsList(results) {
        scribeWingContent.innerHTML = '';
        if (results.length === 0) {
            scribeWingContent.innerHTML = '<div class="text-center p-5"><p class="text-muted">Nenhum resultado semanticamente relevante encontrado.</p></div>';
            return;
        }

        let html = `<h5 class="mb-3 text-center sticky-top bg-dark py-2" style="background: rgba(12,12,15,0.9);">Top Resultados Semânticos</h5>`;
        results.forEach(result => {
            const doc = fullPlotData[result.index];
            html += `
                <div class="search-result-item" data-index="${result.index}">
                    <div class="d-flex justify-content-between">
                        <span class="search-result-score">Sim: ${result.score.toFixed(3)}</span>
                        <span class="badge bg-dark text-light border border-secondary" style="font-size: 0.6em;">#${result.index}</span>
                    </div>
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

    function renderDuplicates(data) {
        const container = document.getElementById('duplicates-container');
        const { grupos_exatos, pares_semanticos } = data.duplicates;
        const MAX_TO_SHOW = 5;
        let html = '<div class="row gy-4">';

        // Exatos
        html += '<div class="col-lg-6">';
        const numGruposExatos = Object.keys(grupos_exatos).length;
        html += `<h6 class="mb-3">Duplicados Exatos (${numGruposExatos} grupos)</h6>`;
        if (numGruposExatos > 0) {
            Object.entries(grupos_exatos).slice(0, MAX_TO_SHOW).forEach(([text, indices]) => {
                html += `<p class="text-muted small lh-sm mb-2"><strong>(${indices.length}x):</strong> ${text.substring(0, 100)}...</p>`;
            });
        } else { html += '<p class="text-success small">Nenhum duplicado exato encontrado.</p>'; }
        html += '</div>';

        // Semânticos
        html += '<div class="col-lg-6">';
        const numParesSemanticos = pares_semanticos.length;
        html += `<h6 class="mb-3">Pares Mais Similares (${numParesSemanticos} encontrados)</h6>`;
        if (numParesSemanticos > 0) {
            pares_semanticos.slice(0, MAX_TO_SHOW).forEach(pair => {
                html += `<div class="p-2 border-start border-primary small mb-2 lh-sm"><strong>Similaridade: ${pair.similaridade.toFixed(3)}</strong><br>1: ${pair.texto1.substring(0, 80)}...<br>2: ${pair.texto2.substring(0, 80)}...</div>`;
            });
        } else { html += '<p class="text-success small">Nenhum par altamente similar encontrado.</p>'; }
        html += '</div></div>';
        container.innerHTML = html;
    }

    // Utilitários
    function debounce(func, delay) { let timeout; return function(...args) { const context = this; clearTimeout(timeout); timeout = setTimeout(() => func.apply(context, args), delay); }; }
});
