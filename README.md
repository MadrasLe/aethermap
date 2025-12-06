# 🌌 AetherMap 7.0: High-Dimensional Semantic Cartography & Precision RAG

<div align="center">

![Status](https://img.shields.io/badge/Status-Production-success?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.10-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.95-green?style=for-the-badge&logo=fastapi)
![Architecture](https://img.shields.io/badge/Architecture-Microservices-orange?style=for-the-badge)
![NLP](https://img.shields.io/badge/Focus-Semantic_Analysis-red?style=for-the-badge)

**[ 🚀 Live Demo Frontend ](https://aethermap.onrender.com/#)**

**[ 📡 Backend API Docs ](https://huggingface.co/spaces/Madras1/AetherMap)**

</div>

---

## 📖 Abstract
**AetherMap 7.0** is not just a search engine; it is a dual-purpose **Unstructured Data Intelligence Platform**. It solves two critical problems in modern NLP:
1.  **The "Black Box" of Large Corpora:** How to visualize and extract specific topics from thousands of documents without manual labeling.
2.  **The "Hallucination" Problem in GenAI:** How to ensure answers are factually accurate and grounded in specific evidence.

By combining **Topological Data Analysis (UMAP)** with a **Two-Stage Reranking RAG Pipeline**, AetherMap transforms raw text into navigable 3D knowledge clusters and provides a citation-backed QA system.

---

## The Engineering Behind

### 1. The RAG Pipeline: Bi-Encoder vs. Cross-Encoder Architecture
Standard RAG implementations rely solely on Cosine Similarity, which is fast but lacks syntactic nuance. AetherMap implements a **Hybrid Retrieval System** to maximize precision:

*   **Stage 1: Retrieval (Recall Layer)**
    *   **Model:** `all-MiniLM-L6-v2` (Bi-Encoder).
    *   **Mechanism:** Converts query and documents into fixed vectors.
    *   **Function:** Rapidly scans the entire vector space to find the top 50 candidates.
*   **Stage 2: Reranking (Precision Layer)**
    *   **Model:** `cross-encoder/ms-marco-MiniLM-L-6-v2`.
    *   **Mechanism:** Takes the query and the candidate document as a *pair* and outputs a raw relevance score (logit).
    *   **Why it matters:** This stage understands the relationship between terms (e.g., "Snake kills man" vs "Man kills snake"), filtering out high-similarity but irrelevant noise before the LLM sees it.

### 2. Unsupervised Insight Extraction
We move beyond simple keyword counting. The system treats text as data points in a high-dimensional manifold:
*   **Dimensionality Reduction (UMAP):** Projects 384-dimensional embeddings into 3D space, preserving both local structure (neighbors) and global structure (clusters).
*   **Density-Based Clustering (HDBSCAN):** Unlike K-Means, HDBSCAN does not require specifying "K" clusters. It finds dense regions of data organically and classifies scattered points as "Noise" (-1), ensuring that only strong semantic trends are reported as topics.
*   **Corpus Metrics:**
    *   **Shannon Entropy:** Measures the information density of the uploaded text.
    *   **Lexical Richness:** Analyzes vocabulary diversity to gauge text complexity.

---

## 🏗️ System Architecture

The application is built on **FastAPI** for asynchronous performance, serving a React/Streamlit frontend.

graph TD

    User((User)) -->|Query / File| API[FastAPI Gateway]
    
    subgraph "Data Ingestion & Analytics"
        API -->|Raw Text| Cleaner[Normalization Layer]
        Cleaner --> Embed[SBERT Embedding]
        Embed --> UMAP[UMAP Reduction]
        UMAP --> HDB[HDBSCAN Clusterer]
        HDB --> TFIDF[TF-IDF Keyword Extractor]
    end
    
    subgraph "Inference & Retrieval"
        API -->|Search Query| Retriever[Bi-Encoder]
        Retriever -->|Top 50 Docs| Reranker[Cross-Encoder]
        Reranker -->|Top 5 Contexts| Prompt[Context Injection]
        Prompt -->|System Prompt + Context| LLM[Groq Inference API]
        LLM -->|"Answer with [IDs]"| User
    end
    

🛠️ Project Structure(backend)
```bash
AetherMap/
├── app.py                 # Main FastAPI Application entry point
├── stopwords.txt          # Configurable exclusion layer for analysis
├── requirements.txt       # Production dependencies
├── Dockerfile             # Containerization logic for Hugging Face
```
# Tech Stck

| Component | Technology | Reasoning |
| :--- | :--- | :--- |
| **Backend** | `FastAPI` | Chosen for high-performance Async I/O. |
| **Vector Ops** | `PyTorch` + `NumPy` | Optimized tensor operations for embedding calculations. |
| **NLP Core** | `Sentence-Transformers` | State-of-the-art pre-trained models for semantic mapping. |
| **Clustering** | `HDBSCAN` | Superior to K-Means for handling noise and variable cluster shapes. |
| **LLM Inference** | `Groq Cloud` | Chosen for LPU inference speed (ultra-low latency generation). |

🧪 Benchmark & Performance

Vectorization Speed: ~10 docs/sec (on CPU).

Max Dataset Size: Tested up to 15,000 documents on 16GB RAM environments.


This project is licensed under the MIT License - see the LICENSE file for details.

Developed by Gabriel Yogi.
