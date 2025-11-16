/* ========================================================
   script.js — Palantir-ready frontend for AetherMap
   Replace your script.js with this file.
   Requires: Plotly, Fuse.js loaded via CDN (your HTML already has them)
   ======================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM references
  const processButton = document.getElementById('processButton');
  const fileUpload = document.getElementById('fileUpload');
  const samplesSlider = document.getElementById('samplesSlider');
  const samplesValue = document.getElementById('samplesValue');
  const loadingSection = document.getElementById('loadingSection');
  const plotContainer = document.getElementById('plotContainer');
  const resultsPanel = document.getElementById('resultsPanel');
  const searchCard = document.getElementById('search-card');
  const searchInput = document.getElementById('searchInput');
  const metricsContainer = document.getElementById('metrics-container');
  const keywordsContainer = document.getElementById('keywords-container');
  const duplicatesContainer = document.getElementById('duplicates-container');

  // --- API URL (adjust if needed)
  const API_URL = "https://madras1-aethermap.hf.space/process/"; // keep your current endpoint

  // --- State
  let fullPlotData = [];
  let fuse = null;

  // --- Palantir-style palette for clusters (reliable, military-like)
  const CLUSTER_COLORS = [
    '#4da3ff', '#ff8f4d', '#f04d6d', '#9b7dff',
    '#66e0a3', '#ffd36d', '#6ee0ff', '#c78bff'
  ];

  // --- Plotly template (Palantir)
  const palantirLayoutBase = {
    paper_bgcolor: '#111318',
    plot_bgcolor: '#111318',
    font: { color: '#e5e6e8', family: 'Inter, Arial, sans-serif' },
    margin: { l: 0, r: 0, t: 40, b: 20 },
    scene: {
      xaxis: { title: 'UMAP 1', gridcolor: "#22242a", zeroline:false, showspikes:false, tickfont:{size:10} },
      yaxis: { title: 'UMAP 2', gridcolor: "#22242a", zeroline:false, showspikes:false, tickfont:{size:10} },
      zaxis: { title: 'UMAP 3', gridcolor: "#22242a", zeroline:false, showspikes:false, tickfont:{size:10} },
      camera: { eye: { x: 1.4, y: 1.4, z: 0.8 } }
    },
    legend: { orientation: "h", yanchor: "bottom", y: 1.02, x: 0.01, font: {size:11} },
    hoverlabel: { bgcolor: '#0d0f12', bordercolor: '#1b2430', font: { color: '#e6e7e9' } }
  };

  // --- UI helpers
  function setLoadingState(isLoading) {
    if (isLoading) {
      loadingSection.classList.remove('d-none');
      resultsPanel.classList.add('d-none');
      plotContainer.innerHTML = '';
      processButton.disabled = true;
      processButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
    } else {
      loadingSection.classList.add('d-none');
      processButton.disabled = false;
      processButton.innerHTML = '✨ Gerar Universo ✨';
    }
  }

  // --- slider display
  samplesSlider.addEventListener('input', () => samplesValue.textContent = samplesSlider.value);

  // --- main action
  processButton.addEventListener('click', async () => {
    const file = fileUpload.files[0];
    const nSamples = samplesSlider.value;

    if (!file) { alert('Selecione um arquivo .txt'); return; }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('n_samples', nSamples);

    setLoadingState(true);

    try {
      const resp = await fetch(API_URL, { method: 'POST', body: formData });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`API error ${resp.status} — ${txt}`);
      }
      const data = await resp.json();
      handleResults(data);
    } catch (err) {
      console.error('Erro API:', err);
      alert('Falha na API: ' + (err.message || err));
    } finally {
      setLoadingState(false);
    }
  });

  // --- search
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (!q) {
      // no query -> normal plot
      renderPlot({ plot_data: fullPlotData, metadata: { num_documents_processed: fullPlotData.length } });
      return;
    }
    if (!fuse) return;
    const results = fuse.search(q, { limit: 500 });
    const indices = new Set(results.map(r => (typeof r.refIndex === 'number' ? r.refIndex : r.itemIndex || r.item && r.item.__index) ));
    highlightPlot(indices);
  });

  // --- handle results
  function handleResults(data) {
    fullPlotData = data.plot_data.map((p, i) => ({ __index: i, ...p }));
    // init Fuse with simple options
    try {
      fuse = new Fuse(fullPlotData, { keys: ['full_text'], includeScore: true, shouldSort: true, threshold:0.45 });
    } catch (e) {
      console.warn('Fuse init failed', e);
      fuse = null;
    }

    renderAllResults(data);
    resultsPanel.classList.remove('d-none');
    searchCard.classList.remove('d-none');
  }

  // --- render all sections
  function renderAllResults(data) {
    renderPlot(data);
    renderMetrics(data);
    renderKeywords(data);
    renderDuplicates(data);
  }

  // --- render plot with cluster separation & palette
  function renderPlot(data) {
    const plotData = (data.plot_data || []).map((p, i) => ({ ...p, __index: i }));
    if (!plotData.length) {
      plotContainer.innerHTML = '<div class="text-muted" style="padding:20px;">Nenhum ponto para exibir.</div>';
      return;
    }

    // cluster groups
    const clusters = Array.from(new Set(plotData.map(p => p.cluster))).sort((a,b)=>{
      // keep -1 (noise) at start or end
      if (a === '-1') return -1;
      if (b === '-1') return 1;
      return a.localeCompare(b);
    });

    const traces = clusters.map((clusterId, idx) => {
      const pts = plotData.filter(p => p.cluster === clusterId);
      const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
      const isNoise = clusterId === '-1';

      return {
        x: pts.map(p => p.x),
        y: pts.map(p => p.y),
        z: pts.map(p => p.z),
        text: pts.map(p => p.full_text),
        mode: 'markers',
        type: 'scatter3d',
        name: isNoise ? 'Ruído' : `Cluster ${clusterId}`,
        marker: {
          size: isNoise ? 3.5 : 4.8,
          color: isNoise ? '#6b6b6b' : color,
          opacity: isNoise ? 0.22 : 0.92,
          line: { width: 0 }
        }
      };
    });

    const layout = Object.assign({}, palantirLayoutBase, {
      title: `Visualização de ${data.metadata.num_documents_processed} Documentos`,
    });

    const config = { responsive: true, displayModeBar: true, modeBarButtonsToRemove: ['lasso2d','select2d'] };

    Plotly.newPlot('plotContainer', traces, layout, config);
  }

  // --- highlight plot points (search)
  function highlightPlot(highlightedIndices) {
    if (!fullPlotData || fullPlotData.length === 0) return;

    const normal = [];
    const highlighted = [];

    fullPlotData.forEach((p, i) => {
      if (highlightedIndices.has(i)) highlighted.push(p);
      else normal.push(p);
    });

    const traces = [
      { x: normal.map(p => p.x), y: normal.map(p=>p.y), z: normal.map(p=>p.z), text: normal.map(p=>p.full_text), mode:'markers', type:'scatter3d',
        name:'Outros', marker:{ size:3.2, color:'#22272b', opacity:0.32 } },
      { x: highlighted.map(p=>p.x), y: highlighted.map(p=>p.y), z: highlighted.map(p=>p.z), text: highlighted.map(p=>p.full_text), mode:'markers', type:'scatter3d',
        name:'Busca', marker:{ size:6, color: 'yellow', opacity:0.95 } }
    ];

    const layout = Object.assign({}, palantirLayoutBase, {
      title: `Destacando ${highlightedIndices.size} Documentos Relevantes`
    });

    Plotly.react('plotContainer', traces, layout, { responsive:true });
  }

  // --- metrics rendering
  function renderMetrics(data) {
    const meta = data.metadata || {};
    const analysis = data.metrics || {};

    const clustersCount = meta.num_clusters_found ?? 0;
    const noise = meta.num_noise_points ?? 0;
    const docs = meta.num_documents_processed ?? (data.plot_data ? data.plot_data.length : 0);

    metricsContainer.innerHTML = `
      <div class="metric-box"><div class="metric-value">${docs}</div><div class="metric-label">Documentos</div></div>
      <div class="metric-box"><div class="metric-value">${clustersCount}</div><div class="metric-label">Clusters</div></div>
      <div class="metric-box"><div class="metric-value">${noise}</div><div class="metric-label">Pontos de Ruído</div></div>
      <div class="metric-box"><div class="metric-value">${analysis.riqueza_lexical ?? 0}</div><div class="metric-label">Riqueza Lexical</div></div>
      <div class="metric-box"><div class="metric-value">${(analysis.entropia ?? 0).toFixed(2)}</div><div class="metric-label">Entropia (bits)</div></div>
    `;
  }

  // --- keywords rendering (fixed layout)
  function renderKeywords(data) {
    const words = (data.metrics && data.metrics.palavras_relevantes) || [];
    const container = document.createElement('div');
    container.className = 'keyword-list';

    if (!words.length) {
      keywordsContainer.innerHTML = '<div class="text-muted small">Sem palavras-chave relevantes.</div>';
      return;
    }

    words.forEach(w => {
      const el = document.createElement('div');
      el.className = 'keyword-tag';
      el.textContent = w;
      container.appendChild(el);
    });

    keywordsContainer.innerHTML = `<strong>Top Palavras-Chave (TF-IDF):</strong>`;
    keywordsContainer.appendChild(container);
  }

  // --- duplicates rendering
  function renderDuplicates(data) {
    duplicatesContainer.innerHTML = '';
    const dup = data.duplicates || { grupos_exatos:{}, pares_semanticos:[] };

    // exact groups
    const groups = dup.grupos_exatos || {};
    const exKeys = Object.keys(groups);
    const exNode = document.createElement('div');
    exNode.className = 'duplicate-section';

    let html = `<div class="duplicate-head">Duplicados Exatos (${exKeys.length} grupos)</div>`;
    if (exKeys.length === 0) {
      html += `<div class="text-success small">Nenhum duplicado exato encontrado.</div>`;
    } else {
      html += '<div style="margin-top:8px;">';
      exKeys.slice(0, 10).forEach(k => {
        const ids = groups[k];
        html += `<div class="duplicate-group"><strong>(${ids.length}x)</strong> ${k.substring(0,180)}${k.length>180?'...':''}</div>`;
      });
      html += '</div>';
    }

    // semantic pairs
    const pairs = dup.pares_semanticos || [];
    html += `<div style="margin-top:12px;"><div class="duplicate-head">Duplicados Semânticos (${pairs.length} pares)</div>`;
    if (pairs.length === 0) {
      html += `<div class="text-success small" style="margin-top:8px;">Nenhum duplicado semântico encontrado.</div>`;
    } else {
      html += '<div style="margin-top:8px;">';
      pairs.slice(0,10).forEach(p => {
        html += `<div class="duplicate-group"><strong>Sim: ${p.similaridade.toFixed(3)}</strong><div class="small text-muted">${p.texto1.substring(0,140)}...</div><div class="small text-muted">${p.texto2.substring(0,140)}...</div></div>`;
      });
      html += '</div>';
    }
    html += '</div>';

    duplicatesContainer.innerHTML = html;
  }

  // --- initialize a blank plot so layout reserves space
  Plotly.newPlot('plotContainer', [], palantirLayoutBase, {responsive:true, displayModeBar:false});
});
