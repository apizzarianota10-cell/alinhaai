# PilatesFlow - Sistema de Gestão Clínica de Pilates

Sistema completo, modular, responsivo e em conformidade com as normas clínicas e de privacidade (LGPD), projetado para eliminar o uso de planilhas e agendas em papel em clínicas de Pilates e reabilitação postural individualizada.

---

## 🌟 Principais Funcionalidades

1. **Visão Geral (Dashboard Executivo):** Indicadores em tempo real, receita efetiva vs despesas, gráficos de distribuição de pagamento e faturamento mensal.
2. **Agenda Inteligente com Prevenção de Conflitos:** Agendamentos individuais por profissional, detecção rigorosa de sobreposição de horários e suporte a sessões recorrentes semanais.
3. **Perfil do Paciente 360° com 9 Abas:** Resumo, Agenda, Plano Contratado, Pagamentos, Avaliação Clínica, Fichas de Exercícios, Evolução, Histórico e Documentos. Importação e exportação em CSV com validação.
4. **Condução de Atendimento ao Vivo:** Tela de condução clínica com checklist de exercícios, registro de adaptações, escala analógica de dor (EVA 0-10) e finalização automática com dedução de sessões e inclusão de evolução no prontuário.
5. **Biblioteca Inteligente de Exercícios:** Catálogo técnico (Reformer, Step Chair, Solo MAT, Mobilidade) com player de sequência visual em 3 etapas (Inicial, Intermediária, Final).
6. **Planejamento Semanal de Fichas:** Construtor de treinos com distribuição de segunda a sábado, prescrição de molas e impressão em PDF timbrado.
7. **Prontuário Eletrônico & Evoluções:** Registro de anamnese, avaliação postural e linha do tempo de evoluções com adendos auditáveis e assinados.
8. **Gestão Financeira em Centavos:** Contas a receber, contas a pagar, fluxo de caixa e múltiplos recebimentos fracionados (ex: R$ 100 Pix + R$ 100 Dinheiro).
9. **Radar de Aniversariantes (Prioritário):** Alertas antecipados escalonados (3 dias, 2 dias, 1 dia e hoje), popup elegante de boas-vindas com botão de WhatsApp pré-preenchido e tratamento de 29 de fevereiro.
10. **Relatórios Profissionais:** Exportação para CSV e visualização para impressão/PDF oficial.
11. **Equipe & RBAC:** Perfis de Administrador, Recepcionista e Profissional de Saúde.
12. **Modo Demonstração Integrado:** Dados fictícios pré-carregados (Maria Oliveira, João Ferreira, etc.) com restauração instantânea.

---

## 🚀 Como Executar

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev

# 3. Compilar para produção
npm run build
```

---

## 📁 Estrutura de Pastas

```
├── src/
│   ├── components/
│   │   ├── common/       # Modal, Toast, BirthdayPopup
│   │   ├── layout/       # Header, Sidebar responsiva
│   │   └── views/        # 12 módulos de tela
│   ├── lib/
│   │   ├── constants.ts  # Dados iniciais, exercícios e configurações
│   │   ├── storage.ts    # Camada de persistência reativa e regras clínicas
│   │   └── utils.ts      # Formatação BRL, cálculo de aniversários, conflitos
│   ├── types/            # Tipos e interfaces estritas em TypeScript
│   ├── App.tsx           # Roteamento e orquestração do layout
│   ├── index.css         # Variáveis e Tailwind CSS v4
│   └── main.tsx          # Ponto de entrada React
├── ARCHITECTURE.md       # Documento de arquitetura
├── DATABASE.md           # Modelagem relacional e DDL PostgreSQL / Supabase
├── SECURITY.md           # Conformidade com a LGPD e sigilo COFFITO
├── ROADMAP.md            # Próximas etapas de expansão multidisciplinar
├── PROGRESS.md           # Checklist de entrega
└── .env.example          # Exemplo de variáveis de ambiente
```
