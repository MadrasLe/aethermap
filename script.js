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
    
    // Seções de Resultados
    const overviewChartsRow = document.getElementById('overview-charts-row');
    
    // Modal
    const pointDetailModal = new bootstrap.Modal(document.getElementById('pointDetailModal'));

    // --- Configurações e Estado Global ---
    const API_URL = "https://madras1-aethermap.hf.space"; // URL Base da sua API
    let fullPlotData = [];
    let currentJobId = null;
    let activeCharts = [];

    // --- Paleta de Cores ---
    const KINGDOM_COLORS = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];

    // --- Ouvintes ---
    samplesSlider.addEventListener('input', () => { samplesValue.textContent = samplesSlider.value; });
    processButton.addEventListener('click', handleProcessing);

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
            currentJobId = data.job_id;
            renderAllResults(data);
            showToast("Universo gerado com sucesso! Invoque o sábio para analisar os clusters.", "success");
        } catch (error) {
            console.error("Erro detalhado:", error);
            showToast(`Falha ao processar: ${error.message}`, "error");
            setLoadingState(false, true);
        }
    }
    
    async function handleDescribeClusters() {
        if (!currentJobId) {
            showToast("Gere um universo primeiro antes de invocar o sábio.", "warning");
            return;
        }

        const invokeButton = document.getElementById('invoke-sage-button');
        invokeButton.disabled = true;
        invokeButton.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Analisando...`;

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
            if (emptyState) emptyState.classList.remove('d-none');
            if (plotContainer) plotContainer.innerHTML = '';
            
            [scribeWing, overviewChartsRow].forEach(el => {
                if(el) el.classList.remove('visible');
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
        
        [scribeWing, overviewChartsRow].forEach(el => {
            if(el) el.classList.add('visible');
        });
        setLoadingState(false);
    }
    
    function renderGlobalMetrics(data) {
        const metricsContainer = document.getElementById('metrics-container');
        if (!metricsContainer) return;
        const { metadata } = data;
        metricsContainer.innerHTML = `
            <div class="col-md col-4"><h5>${metadata.num_documents_processed}</h5><small class="text-muted">Documentos</small></div>
            <div class="col-md col-4"><h5>${metadata.num_clusters_found}</h5><small class="text-muted">Clusters</small></div>
            <div class="col-md col-4"><h5>${metadata.num_noise_points}</h5><small class="text-muted">Pontos de Ruído</small></div>`;
    }

    function renderPlot(data) {
        const plotData = data.plot_data;
        const traces = [];
        const uniqueClusters = [...new Set(plotData.map(p => p.cluster))].sort((a, b) => parseInt(a) - parseInt(b));
        
        uniqueClusters.forEach(clusterId => {
            const pointsInCluster = plotData.filter(p => p.cluster === clusterId);
            const traceColor = clusterId === '-1' ? 'grey' : KINGDOM_COLORS[parseInt(clusterId) % KINGDOM_COLORS.length];
            traces.push({ 
                x: pointsInCluster.map(p => p.x), 
                y: pointsInCluster.map(p => p.y), 
                z: pointsInCluster.map(p => p.z), 
                mode: 'markers', 
                type: 'scatter3d', 
                name: clusterId === '-1' ? 'Ruído' : `Cluster ${clusterId}`, 
                text: pointsInCluster.map(p => p.full_text.substring(0, 200) + '...'), 
                marker: { size: 4, opacity: 0.8, color: traceColor }, 
                customdata: pointsInCluster 
            });
        });
        
        const layout = { 
            title: `Visualização de ${data.metadata.num_documents_processed} Documentos`, 
            margin: { l: 0, r: 0, b: 0, t: 40 }, 
            scene: { 
                xaxis: { title: 'UMAP 1' }, 
                yaxis: { title: 'UMAP 2' }, 
                zaxis: { title: 'UMAP 3' } 
            }, 
            template: 'plotly_dark', 
            paper_bgcolor: 'rgba(0,0,0,0)', 
            plot_bgcolor: 'rgba(0,0,0,0)', 
            legend: { y: 0.9, x: 0.95 } 
        };
        
        Plotly.newPlot(plotContainer, traces, layout, {responsive: true}).then(attachClickHandlerToPlot);
    }

    function attachClickHandlerToPlot(plotDiv) {
        plotDiv.on('plotly_click', (eventData) => {
            if (eventData.points.length > 0) {
                const point = eventData.points[0];
                const clickedPointData = point.customdata;
                const pointIndex = fullPlotData.findIndex(p => p.x === point.x && p.y === point.y && p.z === point.z);
                
                if (clickedPointData) {
                    document.getElementById('modal-doc-index').textContent = pointIndex;
                    document.getElementById('modal-cluster-id').textContent = clickedPointData.cluster === '-1' ? 'Ruído' : `Cluster ${clickedPointData.cluster}`;
                    document.getElementById('modal-word-count').textContent = clickedPointData.full_text.split(/\s+/).length;
                    document.getElementById('modal-full-text').textContent = clickedPointData.full_text;
                    pointDetailModal.show();
                }
            }
        });
    }

    function renderOverviewCharts(data) {
        const distCanvas = document.getElementById('clusterDistributionChart');
        if (!distCanvas) { console.error("Canvas de distribuição de clusters não encontrado!"); return; }
        const distCtx = distCanvas.getContext('2d');
        
        const clusterCounts = {};
        data.plot_data.forEach(p => {
            const clusterName = p.cluster === '-1' ? 'Ruído' : `Cluster ${p.cluster}`;
            clusterCounts[clusterName] = (clusterCounts[clusterName] || 0) + 1;
        });
        
        const sortedClusters = Object.entries(clusterCounts).sort((a, b) => b[1] - a[1]);
        const labels = sortedClusters.map(entry => entry[0]);
        const counts = sortedClusters.map(entry => entry[1]);
        const backgroundColors = labels.map(label => {
            if (label === 'Ruído') return 'grey';
            const clusterId = parseInt(label.replace('Cluster ', ''));
            return KINGDOM_COLORS[clusterId % KINGDOM_COLORS.length];
        });

        activeCharts.push(new Chart(distCtx, { 
            type: 'doughnut', 
            data: { 
                labels: labels, 
                datasets: [{ 
                    data: counts, 
                    backgroundColor: backgroundColors, 
                    borderColor: '#0c0c0f', 
                    borderWidth: 2 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { 
                    legend: { 
                        position: 'right', 
                        labels: { color: '#f0f1f2' } 
                    } 
                } 
            } 
        }));
    }

    function renderClusterAnalysis(data) {
        const container = scribeWingContent;
        container.innerHTML = '';
        const df = data.plot_data;

        const clusterIds = [...new Set(df.map(p => p.cluster))].filter(c => c !== "-1").sort((a, b) => parseInt(a) - parseInt(b));

        if (clusterIds.length === 0) {
            container.innerHTML = '<div class="text-center p-5"><p class="text-muted">Nenhum cluster significativo foi encontrado.</p></div>';
            return;
        }
        
        let html = `<div class="text-center mb-3">
                        <h5 class="mb-2">Análise por Cluster</h5>
                        <button id="invoke-sage-button" class="btn btn-outline-primary btn-sm">
                            <i class="bi bi-lightbulb-fill me-2"></i>Descrever Clusters com IA
                        </button>
                    </div>`;

        clusterIds.forEach(clusterId => {
            const num_documentos = df.filter(p => p.cluster === clusterId).length;
            const color = KINGDOM_COLORS[parseInt(clusterId) % KINGDOM_COLORS.length];
            html += `<div class="cluster-card mt-3" data-cluster-id="${clusterId}">
                        <div class="cluster-card-header">
                            <h6 class="cluster-title"><span style="color: ${color};">■</span> Cluster ${clusterId}</h6>
                            <span class="badge text-bg-secondary">${num_documentos} Documentos</span>
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

    // Funções utilitárias (Toastify)
    function showToast(message, type = "info") {
        const types = {
            info: { background: "linear-gradient(to right, #00b09b, #96c93d)" },
            success: { background: "linear-gradient(to right, #4e79a7, #76b7b2)" },
            warning: { background: "linear-gradient(to right, #f28e2c, #edc949)" },
            error: { background: "linear-gradient(to right, #e15759, #ff9da7)" },
        };
        Toastify({ text: message, duration: 4000, gravity: "bottom", position: "right", style: types[type] }).showToast();
    }
});
