// script-palantir.js
// Ajuste API_URL se necessário (por padrão use sua API HF ou relativa)
const API_URL = "https://madras1-aethermap.hf.space/process/"; // <<--- troque aqui se preciso

document.addEventListener("DOMContentLoaded", () => {
    // elementos
    const processButton = document.getElementById("processButton");
    const fileUpload = document.getElementById("fileUpload");
    const samplesSlider = document.getElementById("samplesSlider");
    const samplesValue = document.getElementById("samplesValue");
    const plotContainer = document.getElementById("plotContainer");
    const searchInput = document.getElementById("searchInput");
    const metricsGrid = document.getElementById("metricsGrid");
    const keywordsContainer = document.getElementById("keywords-container");
    const duplicatesContainer = document.getElementById("duplicates-container");

    let fullPlotData = [];
    let fuse = null;

    samplesValue.textContent = samplesSlider.value;
    samplesSlider.addEventListener("input", () => samplesValue.textContent = samplesSlider.value);

    processButton.addEventListener("click", async () => {
        const file = fileUpload.files[0];
        const nSamples = samplesSlider.value;

        if (!file) {
            alert("Selecione um arquivo .txt antes.");
            return;
        }

        toggleLoading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("n_samples", nSamples);

            const resp = await fetch(API_URL, { method: "POST", body: fd });
            if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(`API error ${resp.status}: ${txt}`);
            }
            const data = await resp.json();
            handleResponse(data);
        } catch (err) {
            console.error("Erro:", err);
            alert("Falha: " + (err.message || err));
        } finally {
            toggleLoading(false);
        }
    });

    function toggleLoading(on){
        processButton.disabled = on;
        processButton.innerText = on ? "Processando..." : "✨ Gerar Universo ✨";
    }

    function handleResponse(data){
        fullPlotData = data.plot_data || [];
        // preparar Fuse (fallback: indexOf se necessário)
        try {
            fuse = new Fuse(fullPlotData, { keys: ["full_text"], threshold: 0.4 });
        } catch { fuse = null; }

        renderPlot(data);
        renderMetrics(data);
        renderDuplicates(data);
        // limpar busca
        searchInput.value = "";
    }

    // Plotly palantir template
    const palantirLayout = {
        paper_bgcolor: '#111318',
        plot_bgcolor: '#111318',
        font: { color: '#e5e6e8', family: 'Inter, sans-serif' },
        scene: {
            xaxis: { title: 'UMAP 1', gridcolor: "#22242A", zeroline: false },
            yaxis: { title: 'UMAP 2', gridcolor: "#22242A", zeroline: false },
            zaxis: { title: 'UMAP 3', gridcolor: "#22242A", zeroline: false }
        },
        margin: { l: 0, r: 0, t: 30, b: 0 },
        legend: { x: 0.92, y: 0.92, bgcolor: "rgba(0,0,0,0)" }
    };

    function renderPlot(data){
        const plotData = data.plot_data || [];
        // agrupar por cluster
        const clusters = {};
        plotData.forEach((p, i) => {
            const key = (p.cluster === undefined || p.cluster === null) ? "-1" : String(p.cluster);
            if (!clusters[key]) clusters[key] = [];
            // guardar também o index para highlight
            clusters[key].push({ ...p, __idx: i });
        });

        const traces = [];
        const colors = {}; // map cluster->color
        const palette = ['#9fbffb','#5fd3b4','#f07e89','#9b7dff','#ffd27a','#7ad0ff'];

        let ci = 0;
        Object.keys(clusters).sort().forEach(clusterId => {
            const pts = clusters[clusterId];
            const color = palette[ci % palette.length];
            colors[clusterId] = color;

            traces.push({
                x: pts.map(p => p.x), y: pts.map(p => p.y), z: pts.map(p => p.z),
                mode: 'markers', type: 'scatter3d',
                name: clusterId === '-1' ? 'Ruído' : `Cluster ${clusterId}`,
                text: pts.map(p => p.full_text ? p.full_text.substring(0,200) : ""),
                marker: { size: 4, color: color, opacity: 0.8 }
            });
            ci++;
        });

        Plotly.newPlot('plotContainer', traces, palantirLayout, {responsive: true});
    }

    // highlight com busca
    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (!q) {
            if (fullPlotData.length) renderPlot({ plot_data: fullPlotData, metadata: {} });
            return;
        }
        if (!fullPlotData.length) return;
        let results = [];
        try {
            results = fuse ? fuse.search(q) : [];
        } catch (err) {
            results = [];
        }
        // extrair índices
        const idxs = results.map(r => {
            if (r && typeof r.refIndex === 'number') return r.refIndex;
            if (r && r.item) return fullPlotData.indexOf(r.item);
            return -1;
        }).filter(i => i >= 0);

        // construir traces: normal + highlight
        const normal = [], highlight = [];
        fullPlotData.forEach((p, idx) => {
            if (idxs.includes(idx)) highlight.push(p);
            else normal.push(p);
        });

        const traces = [
            { x: normal.map(p=>p.x), y: normal.map(p=>p.y), z: normal.map(p=>p.z),
              mode:'markers', type:'scatter3d', name:'Outros',
              marker:{ size:3, color:'rgba(150,150,150,0.22)' }, text: normal.map(p => p.full_text?.substring(0,200) || "") },
            { x: highlight.map(p=>p.x), y: highlight.map(p=>p.y), z: highlight.map(p=>p.z),
              mode:'markers', type:'scatter3d', name:'Busca', marker:{ size:6, color:'#ffd54d' }, text: highlight.map(p => p.full_text?.substring(0,200) || "") }
        ];

        Plotly.newPlot('plotContainer', traces, palantirLayout, {responsive:true});
    });

    function renderMetrics(data){
        metricsGrid.innerHTML = "";
        const meta = data.metadata || {};
        const metrics = [
            { label: "Documentos", value: meta.num_documents_processed ?? 0 },
            { label: "Clusters", value: meta.num_clusters_found ?? 0 },
            { label: "Pontos de Ruído", value: meta.num_noise_points ?? 0 },
            { label: "Riqueza Lexical", value: data.metrics?.riqueza_lexical ?? 0 }
        ];
        metrics.forEach(m => {
            const node = document.createElement("div");
            node.className = "metric-box";
            node.innerHTML = `<div class="metric-value">${m.value}</div><div class="metric-label">${m.label}</div>`;
            metricsGrid.appendChild(node);
        });

        // entropia extra
        const entNode = document.createElement("div");
        entNode.className = "metric-box";
        entNode.innerHTML = `<div class="metric-value">${(data.metrics?.entropia ?? 0).toFixed(2)}</div><div class="metric-label">Entropia (bits)</div>`;
        metricsGrid.appendChild(entNode);

        // keywords
        const keywords = data.metrics?.palavras_relevantes || [];
        keywordsContainer.innerHTML = `<strong>Top Palavras-Chave (TF-IDF):</strong><div id="kw-list"></div>`;
        const kwList = document.getElementById("kw-list");
        keywords.forEach(w => {
            const span = document.createElement("span");
            span.className = "keyword-tag";
            span.textContent = w;
            span.addEventListener("click", () => {
                searchInput.value = w;
                searchInput.dispatchEvent(new Event('input'));
            });
            kwList.appendChild(span);
        });
    }

    function renderDuplicates(data){
        duplicatesContainer.innerHTML = "";
        const groups = data.duplicates?.grupos_exatos || {};
        const pairs = data.duplicates?.pares_semanticos || [];

        const gCount = Object.keys(groups).length;
        const header = document.createElement("div");
        header.innerHTML = `<strong>Duplicados Exatos (${gCount} grupos)</strong>`;
        duplicatesContainer.appendChild(header);

        if (gCount === 0) {
            const p = document.createElement("p"); p.className = "text-success small"; p.textContent = "Nenhum duplicado exato encontrado.";
            duplicatesContainer.appendChild(p);
        } else {
            Object.entries(groups).slice(0,10).forEach(([text, idxs]) => {
                const box = document.createElement("div");
                box.className = "duplicate-group";
                box.innerHTML = `<strong>(${idxs.length}x)</strong> ${text.substring(0,180)}...`;
                duplicatesContainer.appendChild(box);
            });
        }

        // semantic pairs
        const header2 = document.createElement("div"); header2.className = "mt-3";
        header2.innerHTML = `<strong>Duplicados Semânticos (${pairs.length} pares)</strong>`;
        duplicatesContainer.appendChild(header2);

        if (!pairs.length) {
            const p = document.createElement("p"); p.className = "text-success small"; p.textContent = "Nenhum duplicado semântico encontrado.";
            duplicatesContainer.appendChild(p);
        } else {
            pairs.slice(0,10).forEach(pair => {
                const item = document.createElement("div");
                item.className = "duplicate-group";
                item.innerHTML = `<strong>Sim: ${pair.similaridade.toFixed(3)}</strong><div class="small">1: ${pair.texto1.substring(0,140)}...<br>2: ${pair.texto2.substring(0,140)}...</div>`;
                duplicatesContainer.appendChild(item);
            });
        }
    }

});
