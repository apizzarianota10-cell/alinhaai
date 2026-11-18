# Arquitetura do Sistema PilatesFlow

O **PilatesFlow** é um SaaS moderno desenvolvido para atender clínicas de atendimentos individuais de Pilates, com capacidade arquitetural para expansão em Fisioterapia Traumato-Ortopédica, Quiropraxia e outras terapias integradas.

---

## 1. Visão Geral da Arquitetura

```
+-------------------------------------------------------------------+
|                           PilatesFlow                             |
+-------------------------------------------------------------------+
|                                                                   |
|   [Layout Shell: Header, Responsive Sidebar, Birthday Radar]       |
|                                                                   |
|   +-------------------+  +-------------------+  +---------------+ |
|   | 1. Visão Geral    |  | 2. Agenda         |  | 3. Pacientes  | |
|   | (KPIs & Gráficos) |  | (Conflitos & Rec) |  | (9 Abas 360°) | |
|   +-------------------+  +-------------------+  +---------------+ |
|   | 4. Atendimentos   |  | 5. Exercícios     |  | 6. Planejam.  | |
|   | (Condução ao vivo)|  | (Sequência Visual)|  | (Ficha Semanal)| |
|   +-------------------+  +-------------------+  +---------------+ |
|   | 7. Prontuários    |  | 8. Financeiro     |  | 9. Aniversário| |
|   | (Adendos & LGPD)  |  | (Centavos & Pix)  |  | (Radar 3 dias)| |
|   +-------------------+  +-------------------+  +---------------+ |
|   | 10. Relatórios    |  | 11. Profissionais |  | 12. Configs   | |
|   | (PDF/Excel/CSV)   |  | (RBAC & CREFITO)  |  | (Regras & Val)| |
|   +-------------------+  +-------------------+  +---------------+ |
|                                                                   |
|   +-------------------------------------------------------------+ |
|   |           Reactivity & Persistence Storage Layer            | |
|   |   (Local Storage + Mock Engine + Supabase Ready Connectors) | |
|   +-------------------------------------------------------------+ |
+-------------------------------------------------------------------+
```

---

## 2. Tecnologias & Escolhas de Projeto

- **Frontend:** React 19 + TypeScript + Vite.
- **Estilização & Design System:** Tailwind CSS v4, com paleta clínica de alto contraste:
  - Fundo principal: `#F8FAF9`
  - Superfícies: `#FFFFFF`
  - Verde principal: `#426B5B`
  - Verde secundário: `#E9F1EC`
  - Texto principal: `#17231D`
  - Bordas: `#E5EAE7`
- **Ícones:** Lucide React.
- **Gráficos:** Recharts (barras comparativas e pizza de pagamentos).
- **Datas:** date-fns com fuso horário `America/Recife`.
- **Validação de Conflitos:** Algoritmo server-side/service layer para evitar agendamentos simultâneos do mesmo profissional.

---

## 3. Fluxo Principal Integrado (End-to-End)

1. **Cadastro do Paciente:** Administrador cadastra paciente e associa plano.
2. **Cobrança Emitida:** Cobrança gerada e exibida em contas a receber.
3. **Agendamento Individual:** Sessão agendada na agenda com prevenção de conflitos.
4. **Ficha de Exercícios:** Profissional monta ficha semanal no Reformer, Chair ou Mat.
5. **Início do Atendimento:** O profissional clica em "Iniciar" diretamente na agenda ou no card do dashboard.
6. **Condução ao Vivo:** Exercícios executados são marcados, adaptações registradas e dor (EVA) pontuada.
7. **Finalização Automática:**
   - Atendimento marcado como realizado;
   - 1 sessão deduzida do plano do paciente;
   - Registro de evolução gravado com carimbo no prontuário;
   - Dashboard atualizado em tempo real.
8. **Pagamento Registrado:** Recebimento efetuado (ex: Pix + Dinheiro) quitando a fatura.
9. **Relatórios e Aniversários:** Emissão de PDF/CSV e envio de parabéns por WhatsApp.
