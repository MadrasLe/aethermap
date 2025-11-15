document.addEventListener('DOMContentLoaded', () => {
    const processButton = document.getElementById('processButton');
    const fileUpload = document.getElementById('fileUpload');
    const samplesSlider = document.getElementById('samplesSlider');
    const samplesValue = document.getElementById('samplesValue');
    const loadingSection = document.getElementById('loadingSection');
    const plotContainer = document.getElementById('plotContainer');
    const resultsPanel = document.getElementById('resultsPanel');

    const API_URL = "https://madras1-aethermap.hf.space/process/"; // <<< VERIFIQUE SE ESTA É A SUA URL CORRETA!

    samplesSlider.addEventListener('input', () => {
        samplesValue.textContent = samplesSlider.value;
    });

    processButton.addEventListener('click', async () => {
        const file = fileUpload.files[0];
        const nSamples = samplesSlider.value;

        if (!file) {
            alert("Por favor, selecione um arquivo primeiro.");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('n_samples', nSamples);

        loadingSection.classList.remove('d-none');
        plotContainer.innerHTML = '';
        resultsPanel.classList.add('d-none');
        processButton.disabled = true;
        processButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';

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
            loadingSection.classList.add('d-none');
            processButton.disabled = false;
            processButton.innerHTML = '✨ Gerar Universo ✨';
        }
    });

    function renderAllResults(data) {
        renderPlot(data);
        renderMetrics(data);
        renderDuplicates(data);
        resultsPanel.classList.remove('d-none');
    }

    function renderPlot(data) {
        const plotData = data.plot_data;
        const traces = [];
        const uniqueClusters = [...new Set(plotData.map(p => p.cluster))];

        uniqueClusters.forEach(clusterId => {
            const pointsInCluster = plotData.filter(p => p.cluster === clusterId);
            traces.push({
                x: pointsInCluster.map(p => p.x),
                y: pointsInCluster.map(p => p.y),
                z: pointsInCluster.map(p => p.z),
                mode: 'markers',
                type: 'scatter3d',
                name: `Cluster ${clusterId}`,
                text: pointsInCluster.map(p => p.full_text.substring(0, 200)),
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
            <div class="col-md-3"><strong>Documentos:</strong><br>${metrics.num_documents_processed}</div>
            <div class="col-md-3"><strong>Clusters:</strong><br>${metrics.num_clusters_found}</div>
            <div class="col-md-3"><strong>Pontos de Ruído:</strong><br>${metrics.num_noise_points}</div>
            <div class="col-md-3"><strong>Riqueza Lexical:</strong><br>${analysis.riqueza_lexical}</div>
        `;

        const keywordsHTML = analysis.palavras_relevantes.map(word => `<span class="keyword-tag">${word}</span>`).join('');
        keywordsContainer.innerHTML = `<hr><strong>Top Palavras-Chave:</strong><br>${keywordsHTML}`;
    }

    function renderDuplicates(data) {
        // Esta função pode ser implementada para mostrar os duplicados
        // Por enquanto, vamos deixar um placeholder
        const duplicatesContainer = document.getElementById('duplicates-container');
        duplicatesContainer.innerHTML = `<p class="text-muted">Análise de duplicidade será exibida aqui.</p>`;
    }
});
