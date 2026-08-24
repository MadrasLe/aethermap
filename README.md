# Frontend do AetherMap

Interface web estática do AetherMap para processar corpus textuais, explorar o
mapa semântico em 3D e consultar o pipeline de RAG do backend.

## Tecnologias

O frontend é implementado diretamente em HTML, CSS e JavaScript. Ele não usa
React, Streamlit nem um processo próprio de compilação.

| Tecnologia | Uso |
| --- | --- |
| Bootstrap 5 + Bootstrap Icons | Layout responsivo, componentes e ícones |
| Three.js + OrbitControls | Visualização 3D interativa |
| Plotly | Visualização alternativa quando o viewer Three.js não está disponível |
| Chart.js | Gráficos de TF-IDF e distribuição dos clusters |
| Toastify | Notificações de sucesso e erro |

Essas bibliotecas são carregadas por CDN em `index.html`.

## Funcionalidades

- upload de arquivos `.txt` e `.csv`, com seleção da coluna textual para CSV;
- configuração do tamanho mínimo e da densidade dos clusters;
- processamento do corpus pelo endpoint `/process/`;
- mapa semântico 3D com seleção e detalhes dos documentos;
- visualizações de documentos e da rede de entidades;
- busca RAG pelo endpoint `/search/`, com destaque dos resultados no mapa;
- geração de nomes e insights dos clusters por `/describe_clusters/`;
- análise narrativa do grafo por `/analyze_graph/`;
- busca web opcional por `/search_web/`;
- gráficos globais e análise de documentos duplicados;
- temas claro e escuro, persistidos no navegador.

## Integração com a API

A URL do backend está definida no início de `script.js`:

```javascript
const API_URL = "https://madras1-aethermap.hf.space";
```

Para usar uma API local, altere esse valor para o endereço do servidor, por
exemplo `http://localhost:7860`. Se frontend e backend forem servidos por origens
diferentes, a política de CORS do ambiente também precisa permitir a comunicação.

## Execução local

Como a interface é estática, basta servi-la com um servidor HTTP. Na raiz do
repositório, execute:

```bash
python -m http.server 5500 --directory frontend
```

Depois, abra `http://localhost:5500` no navegador. Abrir `index.html` diretamente
pelo protocolo `file://` não é recomendado, pois algumas políticas do navegador
podem limitar as requisições à API.

## Estrutura

```text
frontend/
├── index.html          # Estrutura da interface e dependências por CDN
├── style.css           # Tema, layout e componentes visuais
├── script.js           # Estado da interface e integração com a API
├── threejs-viewer.js   # Renderização e interação das visualizações 3D
└── logo.png            # Identidade visual
```

## Limitações atuais

- A URL da API é fixa no código e ainda não possui configuração por ambiente.
- O frontend depende de CDNs; sem acesso à internet, as bibliotecas externas não
  são carregadas.
- O estado processado pertence ao cache em memória do backend e pode desaparecer
  quando o Space reinicia.
- Tempos de processamento e busca variam conforme o tamanho do corpus, a CPU do
  Space e a latência dos serviços externos.

## Licença

Apache-2.0, conforme o frontmatter do Hugging Face Space.

Desenvolvido por Gabriel Yogi.
