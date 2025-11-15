document.addEventListener('DOMContentLoaded', () => {

    // --- Seletores de Elementos do DOM ---
    const processButton = document.getElementById('processButton');
    const fileUpload = document.getElementById('fileUpload');
    const samplesSlider = document.getElementById('samplesSlider');
    const samplesValue = document.getElementById('samplesValue');
    const loadingSection = document.getElementById('loadingSection');
    const plotContainer = document.getElementById('plotContainer');
    const resultsPanel = document.getElementById('resultsPanel');
    const searchCard = document.getElementById('search-card');
    const searchInput = document.getElementById('searchInput');

    // --- URL da nossa API Backend ---
    const API_URL = "https://madras1-aethermap.hf.space/process/"; // VERIFIQUE SE ESTA É A SUA URL CORRETA!

    // --- Estado Global da Aplicação ---
    let fullPlotData = [];
    let fuse; // Nosso motor de busca rápido (Fuse.js)

    // --- Event Listeners (Ouvintes de Ações) ---

    // Atualiza o valor do slider na tela
    samplesSlider.addEventListener('input', () => {
        samplesValue.textContent = samplesSlider.value;
    });

    // Ação principal: Gerar o Universo
    processButton.addEventListener('click', async () => {
        const file = fileUpload.files[0];
        const nSamples = samplesSlider.value;

        if (!file) {
            alert("Por favor, selecione um arquivo primeiro.");
            return;
        }

        // Prepara os dados para enviar à API
        const formData = new FormData();
        formData.append('file', file);
        formData.append('n_samples', nSamples);

        // Atualiza a UI para o estado de carregamento
        setLoadingState(true);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro da API (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            renderAllResults(data);

        } catch (error) {
            alert(`Falha na comunicação com o oráculo: ${error.message}`);
        } finally {
            setLoadingState(false);
        }
    });

    // Ação da Busca Semântica (rápida, no frontend)
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Se a busca estiver vazia, restaura o gráfico original
        if (!query) {
            renderPlot({ plot_data: fullPlotData, metadata: { num_documents_processed: fullPlotData.length } });
            return;
        }
        
        // Usa o Fuse.js para encontrar os textos mais relevantes
        const results = fuse.search(query, { limit: 100 });
        const highlightedIndices = new Set(results.map(r => r.refIndex));
        
        highlightPlot(highlightedIndices);
    });

    // --- Funções Auxiliares de UI ---
    function setLoadingState(isLoading) {
        if (isLoading) {
            loadingSection.classList.remove('d-none');
            plotContainer.innerHTML = '';
            resultsPanel.classList.add('d-none');
            searchCard.classList.add('d-none');
            processButton.disabled = true;
            processButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
        } else {
            loadingSection.classList.add('d-none');
            processButton.disabled = false;
            processButton.innerHTML = '✨ Gerar Universo ✨';
        }
    }

    // --- Funções de Renderização ---

    function renderAllResults(data) {
        fullPlotData = data.plot_data; // Guarda os dados completos para buscas futuras
        
        // Inicializa o motor de busca Fuse.js com os textos recebidos
        fuse = new Fuse(fullPlotData, { keys: ['full_text'], threshold: 0.4 });
        
        renderPlot(data);
        renderMetrics(data);
        renderDuplicates(data);
        
        resultsPanel.classList.remove('d-none');
        searchCard.classList.remove('d-none'); // Mostra a barra de busca
    }

    function renderPlot(data) {
        const plotData = data.plot_data;
        const traces = [];
        const uniqueClusters = [...new Set(plotData.map(p => p.cluster))].sort();

        uniqueClusters.forEach(clusterId => {
            const pointsInCluster = plotData.filter(p => p.cluster === clusterId);
            traces.push({
                x: pointsInCluster.map(p => p.x),
                y: pointsInCluster.map(p => p.y),
                z: pointsInCluster.map(p => p.z),
                mode: 'markers',
                type: 'scatter3d',
                name: clusterId === '-1' ? 'Ruído' : `Cluster ${clusterId}`,
                text: pointsInCluster.map(p => p.full_text.substring(0, 200) + '...'),
                marker: { size: 4, opacity: 0.8 }
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

        Plotly.newPlot('plotContainer', traces, layout, {responsive: true});
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
            { name: 'Outros', x: normalData.map(p => p.x), y: normalData.map(p => p.y), z: normalData.map(p => p.z), text: normalData.map(p => p.full_text.substring(0, 200)), mode: 'markers', type: 'scatter3d', marker: { size: 3, color: 'grey', opacity: 0.3 } },
            { name: 'Busca', x: highlightedData.map(p => p.x), y: highlightedData.map(p => p.y), z: highlightedData.map(p => p.z), text: highlightedData.map(p => p.full_text.substring(0, 200)), mode: 'markers', type: 'scatter3d', marker: { size: 6, color: 'yellow', opacity: 1.0 } }
        ];
        
        const layout = {
            title: `Destacando ${highlightedIndices.size} Documentos Relevantes`,
            margin: { l: 0, r: 0, b: 0, t: 40 },
            scene: {
                xaxis: { title: 'UMAP 1' },
                yaxis: { title: 'UMAP 2' },
                zaxis: { title: 'UMAP 3' }
            },
            template: 'plotly_dark',
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        };

        Plotly.newPlot('plotContainer', traces, layout, {responsive: true});
    }

    function renderMetrics(data) {
        const metricsContainer = document.getElementById('metrics-container');
        const keywordsContainer = document.getElementById('keywords-container');

        const metrics = data.metadata;
        const analysis = data.metrics;

        metricsContainer.innerHTML = `
            <div class="col-md-3 col-6"><h5>${metrics.num_documents_processed}</h5><small class="text-muted">Documentos</small></div>
            <div class="col-md-3 col-6"><h5>${metrics.num_clusters_found}</h5><small class="text-muted">Clusters</small></div>
            <div class="col-md-3 col-6"><h5>${metrics.num_noise_points}</h5><small class="text-muted">Pontos de Ruído</small></div>
            <div class="col-md-3 col-6"><h5>${analysis.riqueza_lexical}</h5><small class="text-muted">Riqueza Lexical</small></div>
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
});
