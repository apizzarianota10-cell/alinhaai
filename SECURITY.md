# Diretrizes de Segurança da Informação e Conformidade LGPD

O sistema **PilatesFlow** foi concebido sob os princípios de *Privacy by Design* e *Privacy by Default*, garantindo o tratamento estrito de dados pessoais (Art. 5º, I da LGPD) e dados pessoais sensíveis de saúde (Art. 5º, II da LGPD).

---

## 1. Segregação Lógica entre Dados Administrativos e Clínicos

- **Dados Administrativos (Recepção / Financeiro):**
  - Nome, telefone, endereço, cobranças, comprovantes de pagamento e agendamentos.
  - Acessíveis por operadores com perfil `receptionist` e `admin`.
- **Dados Clínicos Sensíveis (Sigilo Profissional):**
  - Anamneses, patologias pregressas (ex: hérnias discais), escala analógica de dor (EVA), queixas álgicas e evoluções de fisioterapia/Pilates.
  - O acesso é restrito e auditado exclusivamente para `professional` e `admin`.

---

## 2. Princípio da Imutabilidade dos Prontuários (Resoluções COFFITO)

- Conforme as normas dos conselhos de saúde (COFFITO / CREFITO / CFM), registros clínicos finalizados **não podem ser alterados ou apagados silenciosamente**.
- Qualquer retificação ou complemento é realizado por meio de **Adendos Auditáveis**, contendo:
  - Timestamp com carimbo de tempo inviolável;
  - Identificação digital do profissional autor;
  - Texto retificador, mantendo o histórico original intacto.

---

## 3. Prevenção de Exclusão Destrutiva Acidental (*Soft Delete*)

- A remoção de pacientes no sistema não apaga dados clínicos do banco de dados. O status é alterado para `arquivado`.
- Prontuários, cobranças históricas e contratos permanecem guardados pelo tempo legal de retenção exigido por lei (mínimo de 20 anos para prontuários em meio eletrônico).

---

## 4. Auditoria Financeira e Registro de Transações

- Cada cobrança emitida possui um array de `auditTrail`.
- Nenhum valor pendente é considerado receita até a compensação do comprovante (Pix, dinheiro ou cartão).
- Valores são computados em **centavos inteiros** (`price_cents`) para evitar erros de arredondamento de ponto flutuante em fechamentos de caixa.

---

## 5. Isolamento do Modo de Demonstração

- A base de dados de demonstração utiliza nomes, contatos e diagnósticos **100% fictícios** (Maria Oliveira, João Ferreira, etc.).
- Não há conexão entre dados de demonstração e a base de dados de produção em nuvem.
