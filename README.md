# OSS Admin Dashboard

Este é o painel de administração e monitoramento do ecossistema de projetos Open Source de [Marcelo Matz](https://marcelomatz.com.br). 
O projeto consome diretamente a API do GitHub para calcular métricas como Marketshare de Sistemas Operacionais, acumular totais de Downloads e centralizar estatísticas como _Stars_, _Forks_ e _Issues_ de todos os repositórios suportados.

[Visite meu perfil no GitHub](https://github.com/marcelomatz)

## Projetos Monitorados
Atualmente este painel monitora as estatísticas e logs de lançamentos de:
- [Heapi](https://github.com/marcelomatz/Heapi)
- [MyTerm](https://github.com/marcelomatz/myterm)
- [Writtt](https://github.com/marcelomatz/writtt)
- [ByCode MDE](https://github.com/marcelomatz/bycode-releases)

## Funcionalidades
- **Marketshare de SO:** Calcula os downloads detalhados em _Windows_, _macOS_, _Linux_ e _Outros_ em tempo real, gerando barras horizontais animadas.
- **Estatísticas Globais:** Agrega o total geral de Stars, Issues abertas e Forks across de todo o portfólio.
- **Histórico Completo de Versões:** Lista iterativa com links diretos para cada ChangeLog e estatísticas isoladas de _daquela_ versão.
- **Integração Svelte 5:** Utiliza `$derived` avançados para computação dos *assets* da API do GitHub.

## Executando o Projeto

Se você clonou o projeto e deseja rodar a interface localmente:

```sh
# Instale as dependências
npm install

# Inicialize o servidor de desenvolvimento
npm run dev
```

### Limites da API do GitHub
O painel consome as releases de forma pública. Para evitar _rate limit_, as requisições estão englobadas por um **cache inteligente de 4 horas**.
Caso prefira contornar as limitações de IP impostas pela rede pública (60 requests/h), você pode adicionar o seu próprio Personal Access Token criando um arquivo `.env` na raiz do projeto:

```env
GITHUB_TOKEN=ghp_seu_token_aqui
```

---

Desenvolvido como ferramenta auxiliar de Analytics da [Stack Matz](https://marcelomatz.com.br).
