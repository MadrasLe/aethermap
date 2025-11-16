document.addEventListener('DOMContentLoaded', () => {

    // --- Seletores de Elementos do DOM (O Arsenal do Mago) ---
    const processButton = document.getElementById('processButton');
    const fileUpload = document.getElementById('fileUpload');
    const samplesSlider = document.getElementById('samplesSlider');
    const samplesValue = document.getElementById('samplesValue');
    const loadingSection = document.getElementById('loadingSection');
    const loadingMessage = document.getElementById('loadingMessage');
    const plotContainer = document.getElementById('plotContainer');
    const emptyState = document.getElementById('emptyState');
    const exampleButton = document.getElementById('exampleButton');
    const resultsPanel = document.getElementById('resultsPanel');
    const searchCard = document.getElementById('search-card');
    const searchInput = document.getElementById('searchInput');
    const pointDetailModal = new bootstrap.Modal(document.getElementById('pointDetailModal'));

    // --- Configurações e Estado Global (A Torre de Controle) ---
    const API_URL = "https://madras1-aethermap.hf.space/process/"; // Nota: Em produção, o ideal é usar variáveis de ambiente.
    let fullPlotData = [];
    let fuse;

    // --- Ouvintes de Eventos (Os Vigilantes do Reino) ---

    samplesSlider.addEventListener('input', () => {
        samplesValue.textContent = samplesSlider.value;
    });

    processButton.addEventListener('click', handleProcessing);
    exampleButton.addEventListener('click', processExampleData);
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
        } finally {
            setLoadingState(false);
        }
    }

    function processExampleData() {
        showToast("Carregando um universo de exemplo...", "info");
        // Simular um payload de API para demonstração
        const exampleData = generateMockData(); 
        renderAllResults(exampleData);
    }
    
    function handleSearch(e) {
        const query = e.target.value.trim();
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
            loadingSection.classList.remove('d-none');
            emptyState.classList.add('d-none');
            plotContainer.innerHTML = ''; // Limpa o gráfico anterior
            resultsPanel.classList.remove('visible');
            searchCard.classList.remove('visible');
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
        Toastify({
            text: message,
            duration: 5000,
            close: true,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: { background: backgroundColors[type] }
        }).showToast();
    }
    
    // --- Módulo de Renderização (O Artista do Palácio) ---

    function renderAllResults(data) {
        fullPlotData = data.plot_data;
        fuse = new Fuse(fullPlotData, { keys: ['full_text'], threshold: 0.4 });
        
        emptyState.classList.add('d-none');
        renderPlot(data);
        renderMetrics(data);
        renderDuplicates(data);
        
        // Ativa a animação suave
        resultsPanel.classList.add('visible');
        searchCard.classList.add('visible');
    }

    function renderPlot(data) {
        // (A lógica de renderPlot permanece a mesma, mas agora ela é chamada para limpar o emptyState)
        plotContainer.innerHTML = ''; // Garante que o container esteja limpo
        // ...código de renderPlot original aqui...
        setupPlotInteractions(); // Habilita o clique nos pontos
    }

    function highlightPlot(highlightedIndices) {
        // (Lógica de highlightPlot permanece a mesma)
        // ...código de highlightPlot original aqui...
        setupPlotInteractions(); // Re-habilita o clique após redesenhar
    }

    function renderMetrics(data) {
        // (Lógica de renderMetrics permanece a mesma)
    }

    function renderDuplicates(data) {
        // (Lógica de renderDuplicates permanece a mesma)
    }

    function setupPlotInteractions() {
        const plotDiv = document.getElementById('plotContainer');
        plotDiv.on('plotly_click', (data) => {
            const point = data.points[0];
            const pointIndex = point.pointNumber;
            const traceIndex = point.curveNumber;
            
            // Encontrar o texto completo baseado no índice do ponto e da curva (trace)
            const traceName = point.data.name;
            const pointsInTrace = fullPlotData.filter(p => (p.cluster === traceName.replace('Cluster ', '').replace('Ruído', '-1')));
            const clickedPointData = pointsInTrace[pointIndex];

            if (clickedPointData) {
                document.getElementById('modal-cluster-id').textContent = clickedPointData.cluster === '-1' ? 'Ruído' : `Cluster ${clickedPointData.cluster}`;
                document.getElementById('modal-full-text').textContent = clickedPointData.full_text;
                pointDetailModal.show();
            }
        });
    }

    // --- Dados de Exemplo (O Feitiço de Demonstração) ---
    function generateMockData() {
        // Esta função criaria um objeto de dados falso com a mesma estrutura da sua API
        // para demonstrar a visualização sem precisar de um upload.
        return { /* ... um objeto de dados completo e falso aqui ... */ };
    }
});
