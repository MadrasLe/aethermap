---
title: AetherMap
emoji: 🧭
colorFrom: indigo
colorTo: pink
sdk: docker
pinned: false
license: apache-2.0
---

# AetherMap 🧭

**Plataforma de cartografia semântica e RAG híbrido**: ingere TXT/CSV, projeta o espaço semântico em um mapa 3D navegável, agrupa documentos por densidade e responde perguntas com citações e abstenção controlada.

🔗 **Demo no Hugging Face Space:** [madras1-aethermap.hf.space](https://madras1-aethermap.hf.space) · 🤖 **Embedding próprio:** [Madras1/minilm-gooaq-mnr-v5](https://huggingface.co/Madras1/minilm-gooaq-mnr-v5)

## Destaques

- **RAG híbrido medido, não no chute**: `MRR 0.99` e `Hit@3 1.00` no modo `hybrid_rerank` sobre SQuAD-PT real (50 queries/modo), com `refusal accuracy 1.00`. Veja [Resultados](#resultados).
- **Embedding fine-tunado próprio** (`minilm-gooaq-mnr-v5`, MNR loss em GooAQ), avaliado contra baseline com resultados separados por dataset e etapa do pipeline.
- **Avaliação experimental reproduzível**: benchmark de duas camadas, LLM-as-judge (Mistral) desacoplado e determinista, bootstrap CI + Cohen's d, e profiling de latência local vs. Space publicado.
- **Abstenção testada de verdade**: controles "sem resposta" construídos retirando o contexto-fonte do corpus, com âncora nomeada e checagem de vazamento — o sistema recusa em vez de alucinar.
- **5 modos de ablação** (`faiss_only` até `full`) expostos no próprio endpoint `/search/`, mais mapa 3D (UMAP/HDBSCAN), grafo de entidades e observabilidade Prometheus.

## Status

Backend FastAPI em [app.py](app.py); frontend estático (viewer 3D) em [frontend/](frontend/), que conversa com a API publicada no Hugging Face Space. A suíte de avaliação é parte central do projeto, não um extra:

- Benchmarks end-to-end e harness de métricas em [metrics/](metrics/), com resultados versionados em [metrics/results/](metrics/results/).
- RAGAS em [evaluate_rag.py](evaluate_rag.py) e estudo de ablação com significância estatística em [ablation_study_v3.py](ablation_study_v3.py).
- Comparação contra pipelines LangChain/LangGraph em [benchmark_rag_colab.py](benchmark_rag_colab.py).

## Arquitetura Resumida

```text
Arquivo TXT/CSV
  -> limpeza e seleção de textos
  -> embeddings minilm-gooaq-mnr-v5 (fine-tunado)
  -> normalização vetorial
  -> índice FAISS para busca semântica
  -> índice BM25 para busca lexical
  -> UMAP ou PCA para mapa 3D
  -> HDBSCAN para clusters
  -> métricas globais, TF-IDF, duplicados e grafo de entidades

Pergunta do usuário
  -> expansão opcional da query por LLM
  -> busca semântica FAISS
  -> busca lexical BM25
  -> fusão RRF
  -> reranking CrossEncoder
  -> prompt com contexto recuperado
  -> resposta final via OpenRouter com citações [ID: x]
```

Mais detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Pipeline RAG

O endpoint `/search/` implementa um pipeline de RAG híbrido com modos de ablação:

| Modo | Componentes |
| --- | --- |
| `faiss_only` | Busca semântica FAISS, sem BM25, sem reranker, sem expansão |
| `bm25_only` | Busca lexical BM25, sem FAISS, sem reranker, sem expansão |
| `hybrid` | FAISS + BM25 + RRF, sem reranker, sem expansão |
| `hybrid_rerank` | FAISS + BM25 + RRF + CrossEncoder |
| `full` | FAISS + BM25 + RRF + CrossEncoder + expansão de query |

O modo `full` é o padrão. Ele privilegia qualidade, enquanto `turbo_mode=true` reduz custo e latência ao pular expansão e usar menos candidatos.

## Modelos e Componentes

| Camada | Implementação atual |
| --- | --- |
| API | FastAPI + Uvicorn |
| Embeddings | `Madras1/minilm-gooaq-mnr-v5` (MiniLM multilíngue fine-tunado com MNR loss em GooAQ); configurável por `RETRIEVAL_MODEL` |
| Reranker | `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` |
| Busca vetorial | FAISS `IndexFlatIP` para bases menores, `IndexHNSWFlat` para bases maiores |
| Busca lexical | BM25 simples implementado no próprio projeto |
| Fusão híbrida | Reciprocal Rank Fusion, RRF |
| Mapa 3D | UMAP; em `fast_mode`, PCA |
| Clustering | HDBSCAN |
| Entidades | spaCy PT/EN com fallback quando indisponível |
| Geração | OpenRouter, modelo configurável por `LLM_MODEL` |
| Busca web | Tavily, quando `TAVILY_API_KEY` está configurada |
| Observabilidade | Prometheus via `/metrics` + histograma customizado de latência LLM |

## Endpoints Principais

| Endpoint | Método | Função |
| --- | --- | --- |
| `/` | GET | Health check simples |
| `/metrics` | GET | Métricas Prometheus instrumentadas automaticamente |
| `/csv_columns/` | POST | Retorna colunas de um CSV antes do processamento |
| `/process/` | POST | Processa TXT/CSV, cria embeddings, clusters, índices e métricas |
| `/search/` | POST | Executa busca RAG sobre um `job_id` já processado |
| `/describe_clusters/` | POST | Usa LLM para nomear e resumir clusters |
| `/search_web/` | POST | Busca Tavily e transforma resultados em mapa semântico |
| `/entity_graph/` | POST | Extrai entidades e constrói grafo de documentos/entidades |
| `/analyze_graph/` | POST | Análise por LLM sobre o grafo de entidades |

O endpoint `/analyze_graph/` usa o mesmo cliente OpenRouter (`llm_client`) dos demais endpoints de LLM, produzindo uma análise narrativa do grafo de entidades com referência explícita aos clusters.

## Configuração

Variáveis de ambiente relevantes:

| Variável | Obrigatória? | Uso |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Sim para respostas LLM | Gera respostas, expande query e descreve clusters |
| `LLM_MODEL` | Não | Modelo OpenRouter; padrão no código: `nex-agi/deepseek-v3.1-nex-n1:free` |
| `RETRIEVAL_MODEL` | Não | Modelo de embeddings; padrão no código: `Madras1/minilm-gooaq-mnr-v5` |
| `TAVILY_API_KEY` | Apenas para busca web | Habilita `/search_web/` |
| `FAISS_HNSW_MIN_SIZE` | Não | Tamanho mínimo para usar HNSW em vez de FlatIP |
| `FAISS_HNSW_M` | Não | Conectividade do grafo HNSW |
| `FAISS_HNSW_EF_CONSTRUCTION` | Não | Qualidade/custo de construção HNSW |
| `FAISS_HNSW_EF_SEARCH` | Não | Qualidade/custo de busca HNSW |
| `DUPLICATE_KNN_K` | Não | Vizinhos usados na detecção de duplicados semânticos |
| `DUPLICATE_SIM_THRESHOLD` | Não | Similaridade mínima para duplicado semântico |
| `DUPLICATE_TOP_K` | Não | Quantidade máxima de pares duplicados retornados |

## Como Rodar Localmente

```bash
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 7860
```

Com Docker:

```bash
docker build -t aethermap .
docker run --rm -p 7860:7860 --env OPENROUTER_API_KEY=... aethermap
```

A documentação interativa do FastAPI fica em:

```text
http://localhost:7860/docs
```

## Métricas Importantes

As métricas implementadas no backend e na suíte de avaliação se dividem em quatro famílias:

1. Métricas de corpus: número de documentos, clusters, ruído, riqueza lexical, entropia, top TF-IDF e duplicados.
2. Métricas de recuperação e citação: Hit@k, MRR, posição do documento-fonte, citação válida e suporte ao documento esperado.
3. Métricas de geração: exact-match estrito, qualidade semântica, correção, fidelidade, sucesso de geração e taxa de recusa correta.
4. Métricas de latência e operação: tempo de ingestão, média/mediana/p95 de busca, tempo por etapa do pipeline, chamadas HTTP e erros.

O guia detalhado está em [docs/METRICS.md](docs/METRICS.md).

## Avaliação Experimental

A avaliação é tratada como cidadã de primeira classe: o projeto separa recuperação, geração, abstenção, latência e custo, e versiona os resultados em [metrics/results/](metrics/results/).

### Scripts de avaliação (raiz)

- RAGAS em [evaluate_rag.py](evaluate_rag.py), com `faithfulness` e `answer_relevancy`.
- Estudo de ablação rigoroso em [ablation_study_v3.py](ablation_study_v3.py), comparando `faiss_only`, `bm25_only`, `hybrid`, `hybrid_rerank` e `full`, com intervalo de confiança por bootstrap, Cohen's d e eficiência score/latência.
- Benchmark comparativo contra LangChain/LangGraph em [benchmark_rag_colab.py](benchmark_rag_colab.py).

### Harness de métricas (`metrics/`)

| Script | Papel |
| --- | --- |
| [run_aethermap_squad_llm_metrics.py](metrics/run_aethermap_squad_llm_metrics.py) | Benchmark end-to-end contra a API publicada usando SQuAD-PT como ground truth; mede recuperação e resposta gerada, sem depender de LLM avaliador |
| [run_aethermap_portfolio_metrics.py](metrics/run_aethermap_portfolio_metrics.py) | Benchmark pequeno, controlado e reproduzível sobre corpus sintético com fatos conhecidos |
| [run_mistral_llm_judge.py](metrics/run_mistral_llm_judge.py) | LLM-as-judge (Mistral) sobre os JSONs de benchmark salvos, pontuando correção e fidelidade |
| [compare_embedding_runs.py](metrics/compare_embedding_runs.py) | Compara duas execuções (baseline vs. embedding customizado) para detectar regressão de qualidade |
| [profile_retrieval_latency.py](metrics/profile_retrieval_latency.py) | Profiling local por estágio (encode, FAISS, BM25, RRF, rerank, prompt), sem chamar LLM |
| [profile_space_search_timings.py](metrics/profile_space_search_timings.py) | Profiling de latência do `/search` no backend publicado |
| [summarize_answer_quality.py](metrics/summarize_answer_quality.py) | Coloca o exact-match literal lado a lado com a qualidade semântica do judge |

### Embedding próprio

O embedding de produção, `Madras1/minilm-gooaq-mnr-v5`, é um MiniLM multilíngue fine-tunado com Multiple Negatives Ranking (MNR) loss sobre GooAQ. No [benchmark controlado de sanidade](metrics/results/embedding_ablation_custom_vs_minilm.md), ele melhorou o modo `faiss_only` em MRR (`+0.135`) e Hit@1 (`+0.125`), enquanto os modos com CrossEncoder convergiram. Esse ganho não foi universal: na [rodada pequena de SQuAD em inglês](metrics/results/embedding_ablation_squad_en_gooq_vs_minilm.md), o baseline foi melhor no `faiss_only` e os modos com reranker voltaram a empatar em retrieval.

A conclusão sustentada pelos experimentos é que o projeto inclui fine-tuning, avaliação A/B e análise de generalização por domínio; os resultados atuais não justificam afirmar superioridade universal do embedding customizado. A evidência principal do AetherMap continua sendo o benchmark end-to-end em SQuAD-PT descrito abaixo.

Mais detalhes em [docs/EVALUATION.md](docs/EVALUATION.md) e [docs/METRICS.md](docs/METRICS.md).

## Resultados

Snapshot do benchmark end-to-end executado em 2026-05-11 sobre `nunorc/squad_v1_pt` (split `validation`): 120 contextos enviados, 40 perguntas com resposta + 10 controladas sem resposta = 50 queries por modo, medidas contra o Space publicado, que servia o embedding fine-tunado `Madras1/minilm-gooaq-mnr-v5`. Fonte: [metrics/results/squad_llm_latest.md](metrics/results/squad_llm_latest.md).

| Modo | Hit@1 | Hit@3 | MRR | Strict gold | Citação válida | Refusal acc. | Latência média | p95 | Erros |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| faiss_only | 0.57 | 0.80 | 0.69 | 0.60 | 0.88 | 1.00 | 9.31s | 24.18s | 0 |
| bm25_only | 0.80 | 0.82 | 0.83 | 0.72 | 0.93 | 1.00 | 10.30s | 26.94s | 0 |
| hybrid | 0.72 | 0.90 | 0.82 | 0.70 | 0.88 | 1.00 | 8.11s | 18.45s | 0 |
| hybrid_rerank | 0.97 | 1.00 | 0.99 | 0.68 | 0.97 | 1.00 | 22.34s | 36.26s | 0 |
| full | 0.97 | 1.00 | 0.99 | 0.70 | 1.00 | 1.00 | 24.82s | 35.61s | 0 |

Qualidade da resposta avaliada por LLM-as-judge (Mistral), do mesmo run. Fonte: [metrics/results/answer_quality_summary_squadpt_50q_strict_specific_20260511T191047Z.md](metrics/results/answer_quality_summary_squadpt_50q_strict_specific_20260511T191047Z.md).

| Modo | Qualidade semântica | Correção (Mistral) | Taxa de aprovação | Fidelidade | Verdict pass rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| faiss_only | 0.92 | 4.60 | 0.88 | 4.82 | 0.90 |
| bm25_only | 0.97 | 4.86 | 0.97 | 4.92 | 0.98 |
| hybrid | 0.95 | 4.76 | 0.93 | 4.80 | 0.94 |
| hybrid_rerank | 0.98 | 4.88 | 0.97 | 4.98 | 0.98 |
| full | 0.98 | 4.92 | 0.97 | 5.00 | 0.96 |

Leitura principal:

- `hybrid_rerank` atinge a melhor recuperação observada (`MRR = 0.99`, `Hit@3 = 1.00`) e é o modo recomendado para portfólio.
- `full` serve como teto de qualidade, mas, nesta execução, não superou `hybrid_rerank` e aumentou a latência média e o p95.
- `Refusal accuracy = 1.00` em todos os modos: o sistema recusou corretamente as perguntas cujo contexto não foi carregado, sem alucinar.
- `Strict gold` é exact-match literal e subestima paráfrases válidas; por isso, a qualidade semântica e a fidelidade do judge são as métricas de qualidade preferidas.

## Roadmap e Limitações

Decisões conscientes do estado atual e os próximos passos planejados:

- **Estado em memória**: o cache de jobs (embeddings, índices, DataFrame) vive em RAM e some na reinicialização. Próximo passo: persistir o índice FAISS em disco com carregamento incremental.
- **CI de avaliação**: a suíte de avaliação já existe; falta um workflow que a rode como gate de regressão a cada PR (falhar se o `MRR` cair abaixo de um limiar).
- **CPU-bound**: o processamento é CPU-bound sem GPU; aceitável para o Space de demonstração, mas não é otimizado para alto volume.
- **RAGAS**: [evaluate_rag.py](evaluate_rag.py) pode passar a usar `retrieved_texts` (já retornado por `/search/`) como contexto direto, em vez de placeholders de índice/score.

## Licença

Apache-2.0, conforme o frontmatter do Hugging Face Space.

Desenvolvido por Gabriel Yogi.
