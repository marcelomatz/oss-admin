# OSS Release & Download Control (`oss-admin`)

Painel unificado de controle de downloads, auditoria de binários multiplataforma e telemetria real de releases para o ecossistema Open-Source de [Marcelo Matz](https://github.com/marcelomatz), construído sobre o design system **`@matz/ui`** (`Specular Obsidian` & `Satin Alabaster`).

## Softwares Monitorados

- **[Writtt](https://github.com/marcelomatz/writtt)** — Estúdio editorial offline com cofre criptografado local (`writtt.com`)
- **[MyTerm](https://github.com/marcelomatz/myterm)** — Terminal acelerado por GPU e gerenciador SSH (`myterm.marcelomatz.com.br`)
- **[ByCode](https://github.com/marcelomatz/bycode-releases)** — Ambiente MDE / IDE nativo (`bycode.marcelomatz.com.br`)
- **[Heapi](https://github.com/marcelomatz/Heapi)** — Cliente REST, GraphQL e API Studio (`heapi-website.vercel.app`)

## Política Estrita de Telemetria Real (Zero Dados Sintéticos)

Todas as métricas exibidas no painel são calculadas deterministicamente a partir dos dados públicos oficiais retornados pela **GitHub REST API v3**:

- **Downloads Verificados**: Soma exata de `download_count` em cada binário publicado (preservando inclusive binários recém-lançados com `0` downloads para auditoria fiel de disponibilidade).
- **Volume Binário Entregue**: Cálculo exato $\sum (\text{downloads} \times \text{size})$ por ativo, versão, sistema operacional e software.
- **Matriz de Controle de Downloads (`5 formatos canônicos`)**: Auditoria imediata da versão ativa (`Windows Instalador .exe`, `Windows Portátil .exe`, `macOS .dmg`, `macOS .zip`, `Linux x64`), com download direto, cópia em 1 clique da URL permanente `/releases/latest/download/...`, URL fixa da versão e hash `SHA-256`.
- **Analytics Verificados (`@matz/ui`)**: Participação real por Sistema Operacional, preferência por formato de instalação (`Instaladores` vs `Portáteis` vs `Compactados`), trajetória cronológica por lançamento e evolução real do tamanho dos binários (`MB`) entre versões.
- **Exportação Auditável**: Exportação instantânea em `CSV` e `JSON`, além de atualização ao vivo (`?refresh=1`).

## Arquitetura em 4 Camadas

```text
oss-admin/
├── api/stats.mjs                      # Endpoint Serverless (Vercel Edge/Node cache + ?refresh=1)
├── main.go                            # Servidor HTTP autônomo em Go (/api/oss/stats + ./dist)
└── src/
    ├── domain/                        # Camada 1: Modelos puros, classificação OS/formato e motor determinístico
    ├── application/                   # Camada 2: Estado de visão, filtros, ordenação, CSV e parser seguro de notas
    ├── adapters/                      # Camada 3: Cliente HTTP (/api/oss/stats + fallback GitHub REST + cache local)
    └── presentation/                  # Camada 4: Views @matz/ui, cartões de controle, gráficos e livro-razão
```

## Execução Local

### Desenvolvimento Frontend (Vite + TypeScript)

```bash
npm install
npm run dev
```

### Testes Unitários e Build de Produção

```bash
npm test
npm run build
```

### Servidor Go Autônomo (Opcional)

```bash
npm run build
go run main.go
```

### Token da API do GitHub (Opcional)

O painel opera sem credenciais consumindo os endpoints públicos do GitHub (com cache inteligente no servidor e navegador). Para elevar o limite de requisições de `60 req/h` para `5.000 req/h` no ambiente Vercel ou Go local, defina a variável de ambiente:

```env
GITHUB_TOKEN=seu_github_pat_somente_leitura
```
