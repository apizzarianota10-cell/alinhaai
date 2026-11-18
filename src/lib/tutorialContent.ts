/** Content of the in-app tutorial (Central de Ajuda). `section` links a topic to the screen it explains. */
export interface TutorialStep {
  title: string;
  text: string;
}

export interface TutorialTopic {
  id: string;
  title: string;
  summary: string;
  section?: string; // app section opened by "Abrir esta tela"
  roles?: string; // who usually does it
  steps: TutorialStep[];
  tips?: string[];
}

export const TUTORIAL: TutorialTopic[] = [
  {
    id: 'primeiros-passos',
    title: 'Primeiros passos',
    summary: 'Criar a conta, cadastrar a clínica e entrar pela primeira vez.',
    roles: 'Administrador',
    steps: [
      { title: 'Crie sua conta', text: 'Na tela de login, clique em "Criar conta", informe seu nome, e-mail e uma senha de pelo menos 6 caracteres.' },
      { title: 'Confirme o e-mail', text: 'Abra o e-mail de confirmação enviado pelo sistema e clique no link. Sem isso o login não é liberado. Confira também a caixa de spam.' },
      { title: 'Cadastre a clínica', text: 'No primeiro acesso aparece "Cadastre sua clínica". Informe o nome da clínica e o seu nome como deve aparecer nas evoluções. Você será o administrador.' },
      { title: 'Comece vazio', text: 'Deixe desmarcada a opção "Importar os dados deste navegador" para não levar os pacientes fictícios da demonstração. A clínica começa com o catálogo de exercícios e planos de exemplo, que você pode editar.' },
      { title: 'Tudo salvo na nuvem', text: 'O selo "Salvo" no topo indica que as alterações já estão no servidor. Se aparecer "Sem conexão", continue trabalhando: o sistema tenta enviar de novo sozinho.' },
    ],
    tips: [
      'Esqueceu a senha? Use "Esqueci a senha" na tela de login para receber um link de redefinição.',
      'Quer conhecer antes de criar conta? Clique em "Experimentar demonstração" (5 minutos, dados fictícios).',
    ],
  },
  {
    id: 'configuracoes',
    title: 'Configurações iniciais',
    summary: 'Dados da clínica, horários, regras de cancelamento e reposição, planos e aparência.',
    section: 'settings',
    roles: 'Administrador',
    steps: [
      { title: 'Dados institucionais', text: 'Em Configurações, preencha nome, slogan, telefone, WhatsApp e endereço. Eles aparecem nos relatórios, fichas impressas, recibos e no portal do paciente.' },
      { title: 'Horário de funcionamento', text: 'Defina abertura e fechamento. A agenda mostra as linhas de horário de acordo com esse intervalo.' },
      { title: 'Regras de cancelamento', text: 'Em "Aviso prévio de cancelamento (horas)" defina o prazo mínimo. Cancelamentos dentro do prazo não descontam sessão e liberam reposição.' },
      { title: 'Faltas e reposições', text: 'Marque se falta ou cancelamento fora do prazo desconta sessão do plano, e defina o "Máximo de reposições por mês".' },
      { title: 'Planos', text: 'Em "Planos e Mensalidades" crie ou edite planos com valor, quantidade de sessões, frequência semanal e validade. Planos desativados deixam de aparecer para novos pacientes, mas continuam valendo para quem já tem.' },
      { title: 'Mensagem de aniversário', text: 'Personalize o texto usando {nome} (primeiro nome do paciente) e {clinica} (nome da clínica).' },
      { title: 'Salvar', text: 'Clique em "Salvar Alterações" no topo do formulário.' },
    ],
    tips: ['O modo claro/escuro é trocado pelo botão de sol/lua no topo da tela e vale só para o seu navegador.'],
  },
  {
    id: 'equipe',
    title: 'Equipe e perfis de acesso',
    summary: 'Liberar o acesso de profissionais e recepção, cada um com suas permissões.',
    section: 'professionals',
    roles: 'Administrador',
    steps: [
      { title: 'A pessoa cria a conta', text: 'Peça para cada membro da equipe criar a própria conta na tela de login e confirmar o e-mail.' },
      { title: 'Libere o acesso', text: 'Em Profissionais → "Acesso ao sistema", informe nome, e-mail da conta e o perfil, e clique em "Liberar".' },
      { title: 'Cadastro profissional', text: 'Em "Novo Profissional" cadastre especialidade, registro no CREFITO e horário de expediente. Profissionais ativos aparecem na agenda.' },
      { title: 'Remover acesso', text: 'Use a lixeira ao lado do nome. O histórico e as evoluções assinadas pela pessoa são mantidos.' },
    ],
    tips: [
      'Administrador: acesso total.',
      'Recepção: agenda, pacientes, financeiro e aniversariantes. Não vê prontuários nem dados clínicos (LGPD).',
      'Profissional: agenda, atendimentos, fichas, exercícios e prontuários. Não vê o financeiro.',
    ],
  },
  {
    id: 'pacientes',
    title: 'Pacientes',
    summary: 'Cadastro, importação, perfil 360°, renovação de plano e arquivamento.',
    section: 'patients',
    roles: 'Recepção e Administrador',
    steps: [
      { title: 'Novo paciente', text: 'Clique em "Novo Paciente" e preencha nome, nascimento, telefone com DDD, e-mail, endereço, contato de emergência, profissional responsável, modalidade e plano inicial. O CPF é opcional, mas o sistema impede CPF duplicado.' },
      { title: 'Alertas clínicos', text: 'Informe condições importantes separadas por vírgula (ex.: hérnia L5-S1, labirintite). Elas aparecem em destaque na agenda e durante o atendimento.' },
      { title: 'Importar planilha', text: 'Em "Importar CSV", envie um arquivo com as colunas Nome; Telefone; Nascimento; E-mail; CPF (separado por vírgula ou ponto e vírgula, datas em dd/mm/aaaa). Pacientes já cadastrados com o mesmo CPF ou nome são ignorados.' },
      { title: 'Perfil 360°', text: 'Clique no paciente para ver as abas: resumo, agenda, plano, pagamentos, avaliação, fichas, evolução (com o gráfico de dor), histórico e documentos.' },
      { title: 'Renovar plano', text: 'Na aba "Plano Contratado", "Renovar Ciclo" adiciona as sessões do plano ao saldo e já gera a cobrança correspondente no financeiro.' },
      { title: 'Arquivar', text: 'Use "Arquivar" quando o paciente deixar a clínica. Nada é apagado: prontuário e histórico são preservados e o paciente pode ser reativado.' },
    ],
    tips: ['Na busca, digite parte do nome, do e-mail ou só os números do telefone/CPF.'],
  },
  {
    id: 'portal',
    title: 'Portal do paciente',
    summary: 'Enviar ao paciente um link com sessões, saldo e ficha de exercícios animada.',
    section: 'patients',
    roles: 'Recepção e Profissional',
    steps: [
      { title: 'Gerar o link', text: 'No perfil do paciente, clique em "Portal do paciente".' },
      { title: 'Enviar', text: 'Clique em "Enviar por WhatsApp" (ou copie o link). O paciente abre no celular, sem precisar de senha.' },
      { title: 'O que o paciente vê', text: 'Saldo de sessões, próximas sessões e a ficha de exercícios ativa com as demonstrações animadas. Prontuário, alertas e valores não aparecem.' },
      { title: 'Atualizar', text: 'O link mostra os dados do momento em que foi gerado e vale 60 dias. Se a agenda ou a ficha mudarem, gere e envie um novo.' },
    ],
    tips: ['Envie o link apenas para o próprio paciente: quem tiver o link consegue abrir a página.'],
  },
  {
    id: 'agenda',
    title: 'Agenda',
    summary: 'Agendar, criar séries recorrentes, confirmar, registrar faltas e reposições.',
    section: 'schedule',
    roles: 'Recepção',
    steps: [
      { title: 'Novo agendamento', text: 'Clique em "Novo Agendamento" ou em um horário vazio da grade. Escolha paciente, profissional, modalidade, data, horário e duração.' },
      { title: 'Sem conflitos', text: 'Se o profissional já tiver atendimento no horário, o sistema avisa e não deixa salvar.' },
      { title: 'Série recorrente', text: 'Marque "Agendamento recorrente" e escolha 1x, 2x ou 3x por semana: o sistema cria 4 semanas de sessões e pula as datas com conflito, avisando quais foram.' },
      { title: 'Visualizações', text: 'Alterne entre Dia, Semana e Mês e filtre por profissional ou modalidade.' },
      { title: 'Confirmar', text: 'Clique no agendamento e use "Confirmar" quando o paciente confirmar presença.' },
      { title: 'Cancelamento', text: 'Em "Cancelar", escolha o motivo. Dentro do prazo, ou se a clínica cancelou, a sessão não é descontada e o sistema oferece agendar a reposição na hora.' },
      { title: 'Falta', text: '"Faltou" registra a ausência e, conforme a regra da clínica, desconta 1 sessão do plano.' },
      { title: 'Reposição', text: 'Escolha data, horário e profissional. O sistema respeita o limite mensal de reposições e verifica conflitos. Também dá para agendar depois pelo botão "Agendar Reposição" no agendamento cancelado.' },
    ],
  },
  {
    id: 'atendimento',
    title: 'Atendimento (sessão ao vivo)',
    summary: 'Conduzir a sessão, registrar exercícios, dor e evolução clínica.',
    section: 'attendance',
    roles: 'Profissional',
    steps: [
      { title: 'Iniciar', text: 'Na Visão Geral, na Agenda ou em Atendimentos, clique em "Iniciar". A ficha ativa do paciente é carregada automaticamente.' },
      { title: 'Durante a sessão', text: 'Marque cada exercício concluído, ajuste séries e repetições, indique adaptações com observação, adicione ou remova exercícios.' },
      { title: 'Escala de dor (EVA)', text: 'Registre a dor de 0 a 10 no início e no fim da sessão. Esses valores formam o gráfico de evolução da dor do paciente.' },
      { title: 'Evolução clínica', text: 'Descreva a resposta do paciente e as orientações. O campo é obrigatório para finalizar.' },
      { title: 'Finalizar', text: '"Finalizar Atendimento" desconta 1 sessão do plano, grava a evolução no prontuário e marca o agendamento como realizado.' },
      { title: 'Iniciou por engano?', text: 'Use "Descartar atendimento": nada é gravado e o agendamento volta ao status anterior.' },
    ],
    tips: ['O cronômetro e os dados digitados são mantidos mesmo se a página for recarregada.'],
  },
  {
    id: 'exercicios',
    title: 'Biblioteca de exercícios',
    summary: 'Consultar demonstrações animadas, favoritar e cadastrar exercícios com fotos próprias.',
    section: 'exercises',
    roles: 'Profissional',
    steps: [
      { title: 'Consultar', text: 'Filtre por categoria, aparelho, região do corpo ou favoritos. Passe o mouse no cartão para ver a animação.' },
      { title: 'Demonstração em 3 fases', text: 'Abra o exercício para ver as fases inicial, intermediária e final animadas, com objetivo, orientações, variações e contraindicações. Use "Baixar GIF" para enviar ao paciente.' },
      { title: 'Fotos da clínica', text: 'Em "Usar fotos próprias", envie 3 fotos (início, meio e fim do movimento). A animação passa a usar as suas imagens.' },
      { title: 'Novo exercício', text: 'Em "Novo Exercício" informe nome, categoria, aparelho, objetivo, orientações (uma por linha), variações, contraindicações e, se quiser, as 3 fotos.' },
    ],
  },
  {
    id: 'planejamento',
    title: 'Fichas de exercícios (Planejamento)',
    summary: 'Montar a ficha semanal do paciente e entregar em PDF.',
    section: 'planning',
    roles: 'Profissional',
    steps: [
      { title: 'Nova ficha', text: 'Clique em "Nova Ficha Individual", escolha o paciente e escreva o objetivo terapêutico.' },
      { title: 'Distribuir na semana', text: 'Selecione o dia e clique em "Adicionar Exercício". Defina séries, repetições, molas/resistência e observações.' },
      { title: 'Ficha ativa', text: 'A ficha nova vira a ficha ativa do paciente e é a que carrega no atendimento. Para trocar, use "Ativar" em outra ficha.' },
      { title: 'Duplicar', text: 'Use o ícone de cópia para criar uma variação a partir de uma ficha existente (a cópia começa inativa).' },
      { title: 'PDF', text: 'Clique na impressora → "Baixar PDF" e escolha "Salvar como PDF". A ficha sai com as 3 imagens de cada exercício (pode desmarcar para economizar papel).' },
    ],
  },
  {
    id: 'prontuario',
    title: 'Prontuário eletrônico',
    summary: 'Anamnese, avaliação postural, evoluções com adendos e gráfico de dor.',
    section: 'records',
    roles: 'Profissional',
    steps: [
      { title: 'Escolher o paciente', text: 'Selecione o paciente no topo da tela.' },
      { title: 'Anamnese e avaliação', text: 'Preencha as abas "Anamnese" e "Avaliação Postural & Testes" e clique em salvar. Um aviso mostra quando há alterações não salvas.' },
      { title: 'Evoluções', text: 'As evoluções dos atendimentos entram automaticamente. Use "Inserir Nova Evolução" para registros avulsos.' },
      { title: 'Adendos', text: 'Evoluções gravadas não podem ser editadas. Para complementar, use "Adendo": ele fica registrado com autor, data e hora.' },
      { title: 'Gráfico de dor', text: 'No topo da aba de evoluções, veja a dor no início e no fim de cada sessão e a variação desde a primeira sessão.' },
    ],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    summary: 'Cobranças, recebimentos parciais, estornos, despesas e fechamento de caixa.',
    section: 'financial',
    roles: 'Recepção e Administrador',
    steps: [
      { title: 'Nova cobrança', text: 'Clique em "Nova Cobrança", escolha o paciente, a descrição, o valor (ex.: 420,00) e o vencimento.' },
      { title: 'Receber', text: 'Na linha da cobrança, clique em "Receber". É possível receber em partes e com formas diferentes (ex.: R$ 200 no Pix + R$ 220 em dinheiro). O sistema não aceita valor acima do saldo.' },
      { title: 'Vencidas', text: 'Cobranças em aberto com vencimento passado aparecem como "Vencido". Use o filtro "Vencidas" para cobrar.' },
      { title: 'Comprovante', text: 'O ícone de recibo mostra os pagamentos e a trilha de auditoria. "Copiar comprovante" gera o texto para enviar no WhatsApp.' },
      { title: 'Estorno', text: '"Estornar" registra o motivo, retira o valor da receita e lança a saída no fechamento do dia.' },
      { title: 'Despesas', text: 'Em "Nova Despesa" cadastre contas da clínica e use "Pagar" quando quitar.' },
      { title: 'Fechamento', text: 'Na aba "Fechamento Diário", escolha a data para conferir entradas por forma de pagamento, saídas e saldo, e imprima.' },
      { title: 'Exportar', text: 'Em "Fluxo de Caixa", "Exportar Demonstrativo" gera uma planilha com todas as movimentações, pronta para o Excel ou para o contador.' },
    ],
  },
  {
    id: 'aniversariantes',
    title: 'Aniversariantes',
    summary: 'Alertas de aniversário e mensagem pronta no WhatsApp.',
    section: 'birthdays',
    steps: [
      { title: 'Alerta automático', text: 'Quando há aniversários hoje ou nos próximos 3 dias, um aviso aparece ao entrar no sistema (uma vez por dia).' },
      { title: 'Enviar parabéns', text: 'Clique em "Enviar Parabéns" para abrir o WhatsApp com a mensagem personalizada, ou em "Copiar".' },
      { title: 'Calendário', text: 'Navegue pelos meses para planejar ações e mimos.' },
    ],
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    summary: 'Atendimentos, pacientes, financeiro, assiduidade e aniversariantes.',
    section: 'reports',
    steps: [
      { title: 'Escolher', text: 'Selecione o tipo de relatório e o período (hoje, semana, mês ou ano).' },
      { title: 'Assiduidade', text: 'O relatório de frequência mostra sessões realizadas, faltas, cancelamentos e a taxa de presença.' },
      { title: 'Exportar e imprimir', text: '"Exportar CSV / Excel" baixa a planilha. "Visualizar Impressão" gera o documento com o cabeçalho da clínica para imprimir ou salvar em PDF.' },
    ],
  },
  {
    id: 'backup',
    title: 'Backup e segurança (LGPD)',
    summary: 'Cópia de segurança, restauração e boas práticas com dados de saúde.',
    section: 'settings',
    roles: 'Administrador',
    steps: [
      { title: 'Baixar backup', text: 'Em Configurações → "Backup e Restauração", clique em "Baixar backup" periodicamente (sugestão: toda semana).' },
      { title: 'Restaurar', text: '"Restaurar de um arquivo" substitui todos os dados atuais pelos do backup. O sistema pede confirmação antes.' },
      { title: 'Guarde com segurança', text: 'O arquivo contém dados de saúde: guarde em local protegido e nunca envie por canais abertos.' },
      { title: 'Saia em computadores compartilhados', text: 'Use o botão de sair (ao lado do seu nome). Ao sair, os dados da clínica são apagados daquele navegador.' },
    ],
  },
];

export const FAQ: { q: string; a: string }[] = [
  { q: 'Os dados da demonstração ficam salvos?', a: 'Não. A demonstração usa uma clínica fictícia que fica só no seu navegador e é apagada ao sair ou quando o tempo de 5 minutos acaba.' },
  { q: 'Posso usar no celular?', a: 'Sim. O sistema funciona no navegador do celular e do tablet. Para acesso rápido, adicione o site à tela inicial.' },
  { q: 'Duas pessoas podem usar ao mesmo tempo?', a: 'Sim. As alterações aparecem nos outros computadores em poucos segundos. Evite que duas pessoas editem o mesmo módulo exatamente ao mesmo tempo.' },
  { q: 'Fiquei sem internet. Perco o que fiz?', a: 'Não. O sistema guarda no navegador e envia quando a conexão voltar (o selo no topo mostra "Sem conexão" enquanto isso). Não feche a aba antes de aparecer "Salvo".' },
  { q: 'O e-mail de confirmação não chegou.', a: 'Confira a caixa de spam e aguarde alguns minutos. Se tentou várias vezes seguidas, espere um pouco: há um limite de envios por hora.' },
  { q: 'Como trocar a senha?', a: 'Na tela de login, use "Esqueci a senha" e siga o link enviado por e-mail.' },
];
