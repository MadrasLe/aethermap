// Aguarda o documento carregar completamente
document.addEventListener('DOMContentLoaded', () => {

    // --- Seletores dos elementos da página ---
    const processButton = document.getElementById('processButton');
    const fileUpload = document.getElementById('fileUpload');
    const samplesSlider = document.getElementById('samplesSlider');
    const samplesValue = document.getElementById('samplesValue');
    const loadingSection = document.getElementById('loadingSection');
    const plotContainer = document.getElementById('plotContainer');
    const resultsPanel = document.getElementById('resultsPanel');

    // URL da nossa API poderosa no Hugging Face
    const API_URL = "https://madras1-aethermap.hf.space/process/"; // <<< COLOQUE A SUA URL AQUI!

    // Atualiza o valor do slider na tela
    samplesSlider.addEventListener('input', () => {
        samplesValue.textContent = samplesSlider.value;
    });

    // --- A MÁGICA ACONTECE AQUI ---
    processButton.addEventListener('click', async () => {
        const file = fileUpload.files[0];
        const nSamples = samplesSlider.value;

        if (!file) {
            alert("Por favor, selecione um arquivo primeiro.");
            return;
        }

        // 1. Prepara a requisição para a API
        const formData = new FormData();
        formData.append('file', file);
        formData.append('n_samples', nSamples);

        // 2. Mostra o "carregando" e limpa resultados antigos
        loadingSection.classList.remove('d-none');
        plotContainer.innerHTML = '';
        resultsPanel.innerHTML = '';
        resultsPanel.classList.add('d-none');
        processButton.disabled = true;
        processButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';

        try {
            // 3. Chama a API!
            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Erro da API: ${errorData.detail || response.statusText}`);
            }

            const data = await response.json();

            // 4. Recebe os dados e desenha o universo
            renderResults(data);

        } catch (error) {
            alert(`Falha na comunicação com o oráculo: ${error.message}`);
        } finally {
            // 5. Esconde o "carregando" e reativa o botão
            loadingSection.classList.add('d-none');
            processButton.disabled = false;
            processButton.innerHTML = '✨ Gerar Universo ✨';
        }
    });

    function renderResults(data) {
        // --- Renderiza o Gráfico 3D com Plotly.js ---
        const plotData = data.plot_data;
        const traces = [];
        const clusters = [...new Set(plotData.map(p => p.cluster))];

        clusters.forEach(clusterId => {
            const pointsInCluster = plotData.filter(p => p.cluster === clusterId);
            traces.push({
                x: pointsInCluster.map(p => p.x),
                y: pointsInCluster.map(p => p.y),
                z: pointsInCluster.map(p => p.z),
                mode: 'markers',
                type: 'scatter3d',
                name: `Cluster ${clusterId}`,
                text: pointsInCluster.map(p => p.full_text.substring(0, 200)),
                marker: {
                    size: 3,
                    opacity: 0.8
                }
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
            template: 'plotly_dark'
        };

        Plotly.newPlot('plotContainer', traces, layout);

        // --- Renderiza o Painel de Métricas (exemplo) ---
        resultsPanel.innerHTML = `
            <div class="card bg-dark-subtle text-light border-secondary">
                <div class="card-body">
                    <h5 class="card-title">Análise Quantitativa</h5>
                    <p>Documentos Processados: ${data.metadata.num_documents_processed}</p>
                    <p>Clusters Encontrados: ${data.metadata.num_clusters_found}</p>
                    <p>Riqueza Lexical: ${data.metrics.riqueza_lexical}</p>
                </div>
            </div>
        `;
        resultsPanel.classList.remove('d-none');
    }
});