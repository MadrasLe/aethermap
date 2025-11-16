document.getElementById("sampleSlider").oninput = function() {
    document.getElementById("sampleValue").innerText = this.value;
};

document.getElementById("generateBtn").onclick = async function () {
    const fileInput = document.getElementById("fileUpload");
    const samples = document.getElementById("sampleSlider").value;

    if (!fileInput.files.length) {
        alert("Selecione um arquivo .txt primeiro");
        return;
    }

    let form = new FormData();
    form.append("file", fileInput.files[0]);
    form.append("n_samples", samples);

    const res = await fetch("https://SEU_BACKEND_URL/process/", {
        method: "POST",
        body: form
    });

    const data = await res.json();
    renderDashboard(data);
};

function renderDashboard(data) {

    // METRICS
    document.getElementById("m_docs").innerText = data.metadata.num_documents_processed;
    document.getElementById("m_clusters").innerText = data.metadata.num_clusters_found;
    document.getElementById("m_noise").innerText = data.metadata.num_noise_points;
    document.getElementById("m_lex").innerText = data.metrics.riqueza_lexical;
    document.getElementById("m_entropy").innerText = data.metrics.entropia.toFixed(2);

    // KEYWORDS
    let kwd = "";
    data.metrics.palavras_relevantes.forEach(k => {
        kwd += `<span class='keyword-tag'>${k}</span>`;
    });
    document.getElementById("keywords").innerHTML = kwd;

    // PLOT
    const pts = data.plot_data;
    const trace = {
        x: pts.map(p => p.x),
        y: pts.map(p => p.y),
        z: pts.map(p => p.z),
        mode: "markers",
        type: "scatter3d",
        marker: { size: 3, color: pts.map(p => p.cluster) }
    };

    const layout = {
        paper_bgcolor: '#111318',
        plot_bgcolor: '#111318',
        scene: {
            xaxis: { gridcolor: "#2a2d33" },
            yaxis: { gridcolor: "#2a2d33" },
            zaxis: { gridcolor: "#2a2d33" }
        }
    };

    Plotly.newPlot("plotContainer", [trace], layout);
}
