/* ------------------------------------------------------ */
/* AETHERMAP — PALANTIR / GOTHAM ANALYTICS JS (2025)      */
/* ------------------------------------------------------ */

const apiURL = "https://SEU_API_AQUI/process/";

/* ---------------- PLOTLY TEMPLATE PALANTIR ---------------- */

const palantirTemplate = {
    paper_bgcolor: '#111318',
    plot_bgcolor: '#111318',
    font: { color: '#e5e6e8', family: 'Inter' },
    scene: {
        xaxis: { gridcolor: "#2a2d33", zeroline: false },
        yaxis: { gridcolor: "#2a2d33", zeroline: false },
        zaxis: { gridcolor: "#2a2d33", zeroline: false }
    },
    margin: { l: 0, r: 0, t: 0, b: 0 }
};

/* ---------------- LOADER ---------------- */

function showLoader() {
    document.getElementById("loader").style.display = "block";
}
function hideLoader() {
    document.getElementById("loader").style.display = "none";
}

/* ---------------- API CALL ---------------- */

async function gerarUniverso() {
    const fileInput = document.getElementById("fileUpload");
    const nSamples = document.getElementById("sampleRange").value;

    if (!fileInput.files.length) {
        alert("Selecione um arquivo primeiro.");
        return;
    }

    showLoader();
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("n_samples", nSamples);

    const response = await fetch(apiURL, { method: "POST", body: formData });
    const data = await response.json();

    hideLoader();
    renderResults(data);
}

/* ---------------- RENDER RESULTS ---------------- */

function renderResults(data) {
    renderMetrics(data.metadata, data.metrics);
    renderKeywords(data.metrics.palavras_relevantes);
    renderDuplicates(data.duplicates);
    renderPlot3D(data.plot_data);
}

/* ---------------- METRICS ---------------- */

function renderMetrics(meta, metrics) {
    document.getElementById("metricsContainer").innerHTML = `
        <div class="metrics-grid">
            <div class="metric-box"><div class="metric-value">${meta.num_documents_processed}</div><div class="metric-label">Documentos</div></div>
            <div class="metric-box"><div class="metric-value">${meta.num_clusters_found}</div><div class="metric-label">Clusters</div></div>
            <div class="metric-box"><div class="metric-value">${meta.num_noise_points}</div><div class="metric-label">Ruído</div></div>
            <div class="metric-box"><div class="metric-value">${metrics.riqueza_lexical}</div><div class="metric-label">Riqueza Lexical</div></div>
            <div class="metric-box"><div class="metric-value">${metrics.entropia.toFixed(2)}</div><div class="metric-label">Entropia</div></div>
        </div>
    `;
}

/* ---------------- KEYWORDS ---------------- */

function renderKeywords(list) {
    const div = document.getElementById("keywordsContainer");
    div.innerHTML = "";
    list.forEach(k => {
        const span = document.createElement("span");
        span.className = "keyword-tag";
        span.textContent = k;
        div.appendChild(span);
    });
}

/* ---------------- DUPLICATES ---------------- */

function renderDuplicates(dup) {
    const div = document.getElementById("duplicatesContainer");
    div.innerHTML = "";

    const exact = dup.grupos_exatos;
    if (Object.keys(exact).length === 0) {
        div.innerHTML = "<p>Nenhum duplicado encontrado.</p>";
        return;
    }

    for (let key in exact) {
        const box = document.createElement("div");
        box.className = "duplicate-group";
        box.innerHTML = `
            <strong>${exact[key].length}×</strong> 
            <br>${key}
        `;
        div.appendChild(box);
    }
}

/* ---------------- PLOT 3D ---------------- */

function renderPlot3D(points) {
    const trace = {
        x: points.map(p => p.x),
        y: points.map(p => p.y),
        z: points.map(p => p.z),
        text: points.map(p => p.full_text),
        mode: "markers",
        type: "scatter3d",
        marker: { size: 4, color: "#4da3ff" }
    };

    Plotly.newPlot("plotContainer", [trace], palantirTemplate);
}
