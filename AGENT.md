# Guia do Agente de Desenvolvimento (AGENT.md)
## Central de Procedimentos — 9ª CIPM (PMPE)

Este documento serve como diretriz obrigatória de engenharia, arquitetura e regras de negócio para qualquer agente ou desenvolvedor que for atuar neste repositório dentro do Google AI Studio ou localmente.

---

## 1. Diretrizes Globais e Mandatórias

1. **Idioma:** Todas as respostas, documentações, comentários e interações devem ser estritamente em **Português do Brasil (PT-BR)**.
2. **Proibição de "Arquivos Deus" (Anti-Monólito):**
   - Sob nenhuma hipótese adicione centenas de linhas de rotas ou componentes em um único arquivo.
   - Mantenha a separação rígida de responsabilidades: tabelas, filtros, modais e rotas de API devem residir em arquivos atômicos e dedicados.
3. **Fuso Horário Oficial de Pernambuco (`America/Recife`, UTC-3):**
   - **NUNCA** utilize `new Date().toISOString().split('T')[0]`. No horário de Brasília/Recife, a partir das 21h o UTC vira o dia seguinte, gerando falsos positivos graves de prazos vencidos e lembretes antecipados.
   - **SEMPRE** utilize `getTodayDateBR()` ou `addDaysBR()` exportados de `src/lib/deadline-calculator.ts`.
4. **Proatividade e Caça de Inconsistências:**
   - Faça varreduras no código antes e depois de alterações para encontrar incoerências.
   - Se perceber que uma ideia ou abordagem pode gerar efeitos colaterais, relate o problema e mostre as alternativas técnicas antes de executar.
5. **Alinhamento com o Usuário:**
   - Antes de implementar novos módulos ou regras complexas, faça perguntas de esclarecimento sobre o fluxo e regras de negócio esperadas.

---

## 2. Arquitetura do Sistema

O projeto é um applet fullstack hospedado no **Google Cloud Run**, conectado a um banco **Google Cloud SQL (PostgreSQL 18)** e integrado aos modelos **Gemini** da Google.

### 📁 Backend (`src/server/`)
- **`server.ts` (Raiz):** Bootstrap enxuto (~42 linhas). Apenas inicializa o Express, escuta `process.env.PORT || 3000` (exigido pelo Cloud Run) e monta o roteador `/api`.
- **`src/server/routes/index.ts`:** Consolidador central de rotas da API.
- **Módulos de Rota em `src/server/routes/`:**
  - `auth.routes.ts`: Autenticação e perfil do usuário logado (`/api/auth/me`).
  - `dashboard.routes.ts`: Métricas agregadas de prazos, audiências e estatísticas.
  - `procedures.routes.ts`: Gestão de PDS e Sindicâncias, andamentos (timeline) e arquivamento.
  - `deadlines.routes.ts`: Motor de prazos (dias úteis e corridos, feriados de PE, prorrogações).
  - `officers.routes.ts`: CRUD de Policiais Militares (matrícula, posto/graduação, contatos).
  - `hearings.routes.ts`: Audiências judiciais (presenciais/virtuais, justificativas e redesignações).
  - `batch.routes.ts`: Importação e estruturação de mensagens em lote do WhatsApp via Gemini.
  - `notices.routes.ts`: Leitura e parsing automatizado de Ofícios Judiciais.
  - `reminders.routes.ts`: Controle de disparos de lembretes e mensagens para policiais.
  - `team.routes.ts`: Controle de acesso e permissões (Administrador, Editor, Visualizador).
  - `audit.routes.ts`: Consulta de logs de auditoria do sistema.
  - `configs.routes.ts`: Configurações gerais e parâmetros de sistema.
- **`src/server/helpers/audit.ts`:** Função utilitária `logAudit(req, action, entityType, entityId, details)` para rastreabilidade de todas as ações sensíveis.

### 📁 Frontend (`src/components/`)
A interface React utiliza TailwindCSS e Lucide Icons. Todas as telas principais foram divididas:
- **`src/components/hearings/`:**
  - `HearingsTable.tsx`: Tabela com status, alertas de proximidade e ações rápidas.
  - `HearingsFilters.tsx`: Filtros de data, tribunal, modalidade e status.
  - `HearingsCalendar.tsx`: Grade mensal de audiências.
  - `modals/`: Modais atômicos para criação, redesignação, audiência não realizada, exclusão e geração de ofício.
- **`src/components/procedures/`:**
  - `ProceduresTable.tsx`: Tabela com destaque de prazos abertos/vencidos.
  - `ProceduresFilters.tsx`: Filtros de status e fase processual.
  - `ProcedureDetailDrawer.tsx`: Gaveta lateral de timeline e documentos SEI.
  - `modals/`: Modais de criação de procedimento e inclusão de andamentos.
- **`src/components/deadlines/`:**
  - `DeadlinesTable.tsx`: Tabela com memorial de cálculo (breakdown) e feriados.
  - `DeadlinesFilters.tsx`: Filtros de vencimento.
  - `modals/`: Modais de novo prazo suplementar e prorrogação.

### 🗄️ Banco de Dados (`src/db/`)
- **Tecnologia:** PostgreSQL gerenciado no Cloud SQL, acessado via `drizzle-orm` e driver `pg`.
- **`src/db/schema.ts`:** Definição canônica de todas as tabelas:
  - `users`: Usuários e papéis de permissão.
  - `police_officers`: Cadastro de policiais militares.
  - `disciplinary_procedures`: Procedimentos disciplinares (PDS e Sindicâncias).
  - `procedure_deadlines`: Prazos associados a cada procedimento.
  - `procedure_timelines`: Histórico cronológico de andamentos e despachos.
  - `judicial_hearings`: Audiências judiciais.
  - `hearing_officers`: Associação N:N entre audiências e policiais militares.
  - `official_notices`: Ofícios de apresentação e intimações.
  - `audit_logs`: Logs de auditoria para segurança jurídica.

---

## 3. Validação e Qualidade de Código

Sempre que fizer alterações, execute obrigatoriamente:

1. **Checagem de Tipagem TypeScript:**
   ```bash
   npm run lint
   ```
   *(Executa `tsc --noEmit`. Deve passar com 0 erros).*

2. **Build de Produção:**
   ```bash
   npm run build
   ```
   *(Compila o frontend com Vite e o backend com esbuild em `dist/server.cjs`).*

---

## 4. Integração com Google Cloud Run e AI Studio

- O arquivo `server.ts` compila para `dist/server.cjs`.
- Em produção no Cloud Run, o Google AI Studio executa:
  `if [ -f server.js ]; then node server.js; else npm start; fi`
- O script `start` no `package.json` aponta para `node dist/server.cjs`.
- As variáveis de banco (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`) e a chave `GEMINI_API_KEY` são injetadas em tempo de execução pelo Cloud Run.

---
