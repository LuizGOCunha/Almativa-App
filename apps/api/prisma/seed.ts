import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@almativa.com.br';
const ADMIN_SENHA = process.env.SEED_ADMIN_SENHA ?? 'almativa123';

const hash = (senha: string) => bcrypt.hash(senha, 10);

/** Data pura em UTC - mesmo formato em que o Postgres devolve colunas `date`. */
const data = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Hoje como data pura em UTC. */
const hojeData = () => {
  const agora = new Date();
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
};

async function main(): Promise<void> {
  console.log('Semeando o banco da Almativa...\n');

  /* --------------------------- Modalidades --------------------------- */
  const modalidades = await Promise.all([
    prisma.modalidade.upsert({
      where: { slug: 'pilates' },
      update: {},
      create: {
        nome: 'Pilates',
        slug: 'pilates',
        descricao:
          'Fortalecimento, mobilidade e consciencia corporal em aulas reduzidas com acompanhamento individual.',
        cor: '#5C9A98',
        icone: 'self_improvement',
        ordem: 1,
      },
    }),
    prisma.modalidade.upsert({
      where: { slug: 'jiu-jitsu' },
      update: {},
      create: {
        nome: 'Jiu-Jitsu',
        slug: 'jiu-jitsu',
        descricao: 'Do fundamento a competicao: tecnica, condicionamento e disciplina para todas as idades.',
        cor: '#1E4D3B',
        icone: 'sports_martial_arts',
        ordem: 2,
      },
    }),
    prisma.modalidade.upsert({
      where: { slug: 'fisioterapia' },
      update: {},
      create: {
        nome: 'Fisioterapia',
        slug: 'fisioterapia',
        descricao: 'Reabilitacao, prevencao de lesoes e retorno seguro a atividade fisica.',
        cor: '#88A86B',
        icone: 'healing',
        ordem: 3,
      },
    }),
  ]);

  const [pilates, jiu, fisio] = modalidades;
  console.log(`  modalidades: ${modalidades.length}`);

  /* ---------------------------- Instrutores -------------------------- */
  const instrutores = await Promise.all([
    prisma.instrutor.upsert({
      where: { email: 'marina@almativa.com.br' },
      update: {},
      create: {
        nome: 'Marina Alves',
        email: 'marina@almativa.com.br',
        telefone: '(11) 98877-1020',
        bio: 'Fisioterapeuta e instrutora de Pilates ha 12 anos, especialista em coluna.',
        registroProfissional: 'CREFITO 3/123456-F',
        modalidades: { connect: [{ id: pilates.id }, { id: fisio.id }] },
      },
    }),
    prisma.instrutor.upsert({
      where: { email: 'rafael@almativa.com.br' },
      update: {},
      create: {
        nome: 'Rafael Nunes',
        email: 'rafael@almativa.com.br',
        telefone: '(11) 98877-3040',
        bio: 'Faixa preta 3o grau, competidor e professor de Jiu-Jitsu ha 15 anos.',
        modalidades: { connect: [{ id: jiu.id }] },
      },
    }),
    prisma.instrutor.upsert({
      where: { email: 'carla@almativa.com.br' },
      update: {},
      create: {
        nome: 'Carla Menezes',
        email: 'carla@almativa.com.br',
        telefone: '(11) 98877-5060',
        bio: 'Fisioterapeuta esportiva, foco em reabilitacao de joelho e ombro.',
        registroProfissional: 'CREFITO 3/654321-F',
        modalidades: { connect: [{ id: fisio.id }, { id: pilates.id }] },
      },
    }),
  ]);
  const [marina, rafael, carla] = instrutores;
  console.log(`  instrutores: ${instrutores.length}`);

  /* ------------------------------ Planos ----------------------------- */
  const planosDados = [
    { nome: 'Pilates 2x/semana', modalidadeId: pilates.id, valorCentavos: 32000, aulasPorSemana: 2, ordem: 1 },
    { nome: 'Pilates 3x/semana', modalidadeId: pilates.id, valorCentavos: 42000, aulasPorSemana: 3, ordem: 2 },
    { nome: 'Jiu-Jitsu Mensal', modalidadeId: jiu.id, valorCentavos: 25000, aulasPorSemana: 3, ordem: 3 },
    { nome: 'Jiu-Jitsu Trimestral', modalidadeId: jiu.id, valorCentavos: 67500, aulasPorSemana: 3, ordem: 4, periodicidade: 'TRIMESTRAL' as const },
    { nome: 'Fisioterapia - pacote 10 sessoes', modalidadeId: fisio.id, valorCentavos: 90000, aulasPorSemana: 2, ordem: 5 },
    { nome: 'Almativa Total (todas as modalidades)', modalidadeId: null, valorCentavos: 55000, aulasPorSemana: 6, ordem: 6 },
  ];

  const planos = [];
  for (const dados of planosDados) {
    const existente = await prisma.plano.findFirst({ where: { nome: dados.nome } });
    planos.push(
      existente
        ? await prisma.plano.update({ where: { id: existente.id }, data: dados })
        : await prisma.plano.create({ data: dados }),
    );
  }
  console.log(`  planos: ${planos.length}`);

  /* ------------------------------ Turmas ----------------------------- */
  const turmasDados = [
    { nome: 'Pilates Manha', modalidadeId: pilates.id, instrutorId: marina.id, diaSemana: 1, horaInicio: '07:00', horaFim: '08:00', capacidade: 8, sala: 'Studio 1', nivel: 'Todos os niveis' },
    { nome: 'Pilates Manha', modalidadeId: pilates.id, instrutorId: marina.id, diaSemana: 3, horaInicio: '07:00', horaFim: '08:00', capacidade: 8, sala: 'Studio 1', nivel: 'Todos os niveis' },
    { nome: 'Pilates Noite', modalidadeId: pilates.id, instrutorId: carla.id, diaSemana: 2, horaInicio: '19:00', horaFim: '20:00', capacidade: 8, sala: 'Studio 1', nivel: 'Todos os niveis' },
    { nome: 'Pilates Noite', modalidadeId: pilates.id, instrutorId: carla.id, diaSemana: 4, horaInicio: '19:00', horaFim: '20:00', capacidade: 8, sala: 'Studio 1', nivel: 'Todos os niveis' },
    { nome: 'Jiu-Jitsu Adulto', modalidadeId: jiu.id, instrutorId: rafael.id, diaSemana: 1, horaInicio: '20:00', horaFim: '21:30', capacidade: 24, sala: 'Tatame', nivel: 'Adulto' },
    { nome: 'Jiu-Jitsu Adulto', modalidadeId: jiu.id, instrutorId: rafael.id, diaSemana: 3, horaInicio: '20:00', horaFim: '21:30', capacidade: 24, sala: 'Tatame', nivel: 'Adulto' },
    { nome: 'Jiu-Jitsu Adulto', modalidadeId: jiu.id, instrutorId: rafael.id, diaSemana: 5, horaInicio: '20:00', horaFim: '21:30', capacidade: 24, sala: 'Tatame', nivel: 'Adulto' },
    { nome: 'Jiu-Jitsu Kids', modalidadeId: jiu.id, instrutorId: rafael.id, diaSemana: 2, horaInicio: '17:30', horaFim: '18:30', capacidade: 18, sala: 'Tatame', nivel: '6 a 12 anos' },
    { nome: 'Jiu-Jitsu Kids', modalidadeId: jiu.id, instrutorId: rafael.id, diaSemana: 4, horaInicio: '17:30', horaFim: '18:30', capacidade: 18, sala: 'Tatame', nivel: '6 a 12 anos' },
    { nome: 'Fisioterapia Individual', modalidadeId: fisio.id, instrutorId: carla.id, diaSemana: 2, horaInicio: '09:00', horaFim: '10:00', capacidade: 3, sala: 'Sala Clinica', nivel: null },
    { nome: 'Fisioterapia Individual', modalidadeId: fisio.id, instrutorId: carla.id, diaSemana: 5, horaInicio: '09:00', horaFim: '10:00', capacidade: 3, sala: 'Sala Clinica', nivel: null },
    { nome: 'Pilates Sabado', modalidadeId: pilates.id, instrutorId: marina.id, diaSemana: 6, horaInicio: '09:00', horaFim: '10:00', capacidade: 10, sala: 'Studio 1', nivel: 'Todos os niveis' },
  ];

  const turmas = [];
  for (const dados of turmasDados) {
    const existente = await prisma.turma.findFirst({
      where: { nome: dados.nome, diaSemana: dados.diaSemana, horaInicio: dados.horaInicio },
    });
    turmas.push(
      existente
        ? await prisma.turma.update({ where: { id: existente.id }, data: dados })
        : await prisma.turma.create({ data: dados }),
    );
  }
  console.log(`  turmas: ${turmas.length}`);

  /* ---------------------------- Timers ------------------------------- */
  const timersDados = [
    {
      nome: 'Aquecimento + Mobilidade',
      descricao: 'Bloco inicial de qualquer aula.',
      modalidadeId: null,
      rounds: 1,
      intervalos: [
        { tipo: 'PREPARO', rotulo: 'Preparacao', duracaoSegundos: 60 },
        { tipo: 'TRABALHO', rotulo: 'Mobilidade', duracaoSegundos: 480 },
      ],
      ordem: 1,
    },
    {
      nome: 'Pilates - Serie 45s / 15s',
      descricao: '10 estacoes de 45 segundos com 15 de transicao.',
      modalidadeId: pilates.id,
      rounds: 10,
      intervalos: [
        { tipo: 'TRABALHO', rotulo: 'Exercicio', duracaoSegundos: 45 },
        { tipo: 'TRANSICAO', rotulo: 'Troca', duracaoSegundos: 15 },
      ],
      ordem: 2,
    },
    {
      nome: 'Jiu-Jitsu - Drill 5x3min',
      descricao: 'Cinco rounds de drill com 1 minuto de descanso.',
      modalidadeId: jiu.id,
      rounds: 5,
      intervalos: [
        { tipo: 'TRABALHO', rotulo: 'Drill', duracaoSegundos: 180 },
        { tipo: 'DESCANSO', rotulo: 'Descanso', duracaoSegundos: 60 },
      ],
      ordem: 3,
    },
    {
      nome: 'Jiu-Jitsu - Rola 6x5min',
      descricao: 'Sparring de competicao.',
      modalidadeId: jiu.id,
      rounds: 6,
      intervalos: [
        { tipo: 'TRABALHO', rotulo: 'Rola', duracaoSegundos: 300 },
        { tipo: 'DESCANSO', rotulo: 'Troca de parceiro', duracaoSegundos: 60 },
      ],
      segundosAviso: 15,
      ordem: 4,
    },
    {
      nome: 'Fisioterapia - Isometria 3x40s',
      descricao: 'Tres series isometricas com descanso longo.',
      modalidadeId: fisio.id,
      rounds: 3,
      intervalos: [
        { tipo: 'TRABALHO', rotulo: 'Isometria', duracaoSegundos: 40 },
        { tipo: 'DESCANSO', rotulo: 'Recuperacao', duracaoSegundos: 80 },
      ],
      ordem: 5,
    },
    {
      nome: 'Volta a calma',
      descricao: 'Alongamento e respiracao para encerrar.',
      modalidadeId: null,
      rounds: 1,
      intervalos: [{ tipo: 'DESCANSO', rotulo: 'Alongamento', duracaoSegundos: 300 }],
      ordem: 6,
    },
  ];

  for (const dados of timersDados) {
    const existente = await prisma.timerPreset.findFirst({ where: { nome: dados.nome } });
    if (existente) {
      await prisma.timerPreset.update({ where: { id: existente.id }, data: dados });
    } else {
      await prisma.timerPreset.create({ data: dados });
    }
  }
  console.log(`  timers: ${timersDados.length}`);

  /* --------------------------- Playlists ----------------------------- */
  const playlistsDados = [
    {
      nome: 'Pilates - Ambiente calmo',
      descricao: 'Instrumental leve para aulas de solo e aparelhos.',
      modalidadeId: pilates.id,
      somenteAudio: true,
      volumePadrao: 30,
      itens: [
        { videoId: 'jfKfPfyJRdk', titulo: 'Lofi calmo (ao vivo)', duracaoSegundos: null, inicioEm: null },
        { videoId: '5qap5aO4i9A', titulo: 'Estudo e foco', duracaoSegundos: null, inicioEm: null },
      ],
      ordem: 1,
    },
    {
      nome: 'Jiu-Jitsu - Treino forte',
      descricao: 'Playlist energetica para drills e sparring.',
      modalidadeId: jiu.id,
      somenteAudio: true,
      volumePadrao: 55,
      embaralhar: true,
      itens: [
        { videoId: 'MIHiKyPmGxg', titulo: 'Workout mix', duracaoSegundos: null, inicioEm: null },
        { videoId: '7NOSDKb0HlU', titulo: 'Treino pesado', duracaoSegundos: null, inicioEm: null },
      ],
      ordem: 2,
    },
    {
      nome: 'Tecnica em video - Fundamentos',
      descricao: 'Videos exibidos na TV durante a explicacao tecnica.',
      modalidadeId: jiu.id,
      somenteAudio: false,
      volumePadrao: 70,
      itens: [
        { videoId: 'dQw4w9WgXcQ', titulo: 'Substituir pelo video tecnico da equipe', duracaoSegundos: null, inicioEm: null },
      ],
      ordem: 3,
    },
  ];

  for (const dados of playlistsDados) {
    const existente = await prisma.playlist.findFirst({ where: { nome: dados.nome } });
    if (existente) {
      await prisma.playlist.update({ where: { id: existente.id }, data: dados });
    } else {
      await prisma.playlist.create({ data: dados });
    }
  }
  console.log(`  playlists: ${playlistsDados.length}`);

  /* ------------------------------ Admin ------------------------------ */
  await prisma.usuario.upsert({
    where: { email: ADMIN_EMAIL },
    update: { nome: 'Administracao Almativa', role: 'ADMIN', ativo: true },
    create: {
      email: ADMIN_EMAIL,
      senhaHash: await hash(ADMIN_SENHA),
      nome: 'Administracao Almativa',
      role: 'ADMIN',
    },
  });
  console.log(`  admin: ${ADMIN_EMAIL}`);

  /* ------------------------------ Alunos ----------------------------- */
  const alunosDados = [
    { nome: 'Ana Beatriz Ramos', email: 'ana.ramos@exemplo.com', telefone: '(11) 99110-2233', cpf: '11144477735', dataNascimento: '1990-04-12', plano: 'Pilates 2x/semana', diaVencimento: 5, objetivos: 'Fortalecer lombar e melhorar postura.' },
    { nome: 'Bruno Carvalho', email: 'bruno.carvalho@exemplo.com', telefone: '(11) 99220-3344', cpf: '52998224725', dataNascimento: '1988-09-30', plano: 'Jiu-Jitsu Mensal', diaVencimento: 10, objetivos: 'Competir na faixa azul.' },
    { nome: 'Camila Souza', email: 'camila.souza@exemplo.com', telefone: '(11) 99330-4455', cpf: '15350946056', dataNascimento: '1995-01-22', plano: 'Pilates 3x/semana', diaVencimento: 10, objetivos: 'Reabilitacao pos-cirurgica de joelho.' },
    { nome: 'Diego Martins', email: 'diego.martins@exemplo.com', telefone: '(11) 99440-5566', cpf: '19100000034', dataNascimento: '1992-07-08', plano: 'Almativa Total (todas as modalidades)', diaVencimento: 15, objetivos: 'Condicionamento geral.' },
    { nome: 'Elisa Prado', email: 'elisa.prado@exemplo.com', telefone: '(11) 99550-6677', cpf: '11122233396', dataNascimento: '2000-11-03', plano: 'Jiu-Jitsu Trimestral', diaVencimento: 20, objetivos: 'Defesa pessoal e disciplina.' },
    { nome: 'Felipe Andrade', email: 'felipe.andrade@exemplo.com', telefone: '(11) 99660-7788', cpf: '48151623491', dataNascimento: '1985-03-17', plano: 'Fisioterapia - pacote 10 sessoes', diaVencimento: 5, objetivos: 'Tratar tendinite no ombro.' },
    { nome: 'Gabriela Lima', email: 'gabriela.lima@exemplo.com', telefone: '(11) 99770-8899', cpf: '30962194080', dataNascimento: '1998-06-25', plano: 'Pilates 2x/semana', diaVencimento: 10, objetivos: 'Mobilidade e alivio de dores cervicais.' },
    { nome: 'Henrique Bastos', email: 'henrique.bastos@exemplo.com', telefone: '(11) 99880-9900', cpf: '87748248800', dataNascimento: '1993-12-11', plano: 'Jiu-Jitsu Mensal', diaVencimento: 15, objetivos: 'Voltar a treinar depois de 2 anos parado.' },
  ];

  const hoje = new Date();
  const inicioMatricula = new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1);
  const senhaAluno = await hash('almativa123');
  let alunosCriados = 0;

  for (const dados of alunosDados) {
    const plano = planos.find((p) => p.nome === dados.plano);
    if (!plano) continue;

    const aluno = await prisma.aluno.upsert({
      where: { cpf: dados.cpf },
      update: {},
      create: {
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone,
        cpf: dados.cpf,
        dataNascimento: data(dados.dataNascimento),
        objetivos: dados.objetivos,
        cidade: 'Sao Paulo',
        uf: 'SP',
        dataMatricula: inicioMatricula,
        contatoEmergenciaNome: 'Contato de emergencia',
        contatoEmergenciaTelefone: '(11) 90000-0000',
      },
    });
    alunosCriados++;

    await prisma.usuario.upsert({
      where: { email: dados.email },
      update: { alunoId: aluno.id },
      create: {
        email: dados.email,
        senhaHash: senhaAluno,
        nome: dados.nome,
        role: 'ALUNO',
        alunoId: aluno.id,
        precisaTrocarSenha: false,
      },
    });

    const matriculaExistente = await prisma.matricula.findFirst({
      where: { alunoId: aluno.id, planoId: plano.id },
    });
    const matricula =
      matriculaExistente ??
      (await prisma.matricula.create({
        data: {
          alunoId: aluno.id,
          planoId: plano.id,
          dataInicio: inicioMatricula,
          diaVencimento: dados.diaVencimento,
          status: 'ATIVA',
        },
      }));

    // Tres competencias: duas pagas e a atual em aberto.
    for (let i = 2; i >= 0; i--) {
      const referencia = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const competencia = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, '0')}`;
      const ultimoDia = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0).getDate();
      const vencimento = new Date(
        Date.UTC(referencia.getFullYear(), referencia.getMonth(), Math.min(dados.diaVencimento, ultimoDia)),
      );
      const quitada = i > 0;

      const mensalidade = await prisma.mensalidade.upsert({
        where: { matriculaId_competencia: { matriculaId: matricula.id, competencia } },
        update: {},
        create: {
          matriculaId: matricula.id,
          alunoId: aluno.id,
          competencia,
          valorCentavos: plano.valorCentavos,
          vencimentoEm: vencimento,
          status: quitada ? 'PAGA' : vencimento < hojeData() ? 'VENCIDA' : 'ABERTA',
          pagoEm: quitada ? vencimento : null,
        },
      });

      if (quitada) {
        const jaPago = await prisma.pagamento.findFirst({ where: { mensalidadeId: mensalidade.id } });
        if (!jaPago) {
          await prisma.pagamento.create({
            data: {
              mensalidadeId: mensalidade.id,
              alunoId: aluno.id,
              valorCentavos: plano.valorCentavos,
              metodo: i % 2 === 0 ? 'PIX' : 'CARTAO_CREDITO',
              pagoEm: vencimento,
            },
          });
        }
      }
    }
  }
  console.log(`  alunos: ${alunosCriados} (senha padrao: almativa123)`);

  /* --------------------------- Configuracoes ------------------------- */
  const configuracoes = [
    {
      chave: 'contato',
      valor: {
        telefone: '(11) 3000-1020',
        whatsapp: '(11) 99000-1020',
        email: 'contato@almativa.com.br',
        endereco: 'Rua das Oliveiras, 245 - Vila Madalena, Sao Paulo/SP',
        instagram: '@almativa',
        horarioFuncionamento: 'Seg a Sex 06h-22h · Sab 08h-12h',
      },
    },
    {
      chave: 'site',
      valor: {
        chamada: 'Movimento com proposito.',
        subtitulo:
          'Pilates, Jiu-Jitsu e Fisioterapia em um so lugar. Um time que cuida do seu corpo com tecnica e atencao individual.',
        sobre:
          'A Almativa nasceu da uniao entre reabilitacao e treino. Aqui o fisioterapeuta conversa com o instrutor, e o seu plano de aula respeita a sua historia.',
      },
    },
  ];

  for (const config of configuracoes) {
    await prisma.configuracao.upsert({
      where: { chave: config.chave },
      update: { valor: config.valor },
      create: config,
    });
  }
  console.log(`  configuracoes: ${configuracoes.length}`);

  /* ------------------------ Dispositivo da TV ------------------------ */
  const jaTemDispositivo = await prisma.dispositivo.findFirst({ where: { nome: 'TV Tatame' } });
  if (!jaTemDispositivo) {
    const { createHash } = await import('node:crypto');
    const token = 'almativa-tv-demo-token-0001';
    await prisma.dispositivo.create({
      data: {
        nome: 'TV Tatame',
        sala: 'Tatame',
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiraEm: new Date(Date.now() + 365 * 86_400_000),
      },
    });
    console.log(`  dispositivo TV: token de demonstracao "${token}"`);
  }

  /* --------------------------- Aulas futuras ------------------------- */
  const turmasAtivas = await prisma.turma.findMany({ where: { ativo: true } });
  const paraCriar: {
    turmaId: string;
    instrutorId: string | null;
    inicioEm: Date;
    fimEm: Date;
    capacidade: number;
  }[] = [];

  const comHora = (dia: Date, hora: string) => {
    const [h, m] = hora.split(':').map(Number);
    const saida = new Date(dia);
    saida.setHours(h, m, 0, 0);
    return saida;
  };

  const inicioJanela = new Date(hoje);
  inicioJanela.setDate(inicioJanela.getDate() - 14);
  inicioJanela.setHours(0, 0, 0, 0);

  for (let i = 0; i < 42; i++) {
    const dia = new Date(inicioJanela);
    dia.setDate(dia.getDate() + i);
    for (const turma of turmasAtivas.filter((t) => t.diaSemana === dia.getDay())) {
      paraCriar.push({
        turmaId: turma.id,
        instrutorId: turma.instrutorId,
        inicioEm: comHora(dia, turma.horaInicio),
        fimEm: comHora(dia, turma.horaFim),
        capacidade: turma.capacidade,
      });
    }
  }

  const aulas = await prisma.aula.createMany({ data: paraCriar, skipDuplicates: true });
  console.log(`  aulas materializadas: ${aulas.count} (4 semanas a frente, 2 atras)`);

  console.log('\nPronto. Entre com:');
  console.log(`  admin  -> ${ADMIN_EMAIL} / ${ADMIN_SENHA}`);
  console.log('  aluno  -> ana.ramos@exemplo.com / almativa123');
  console.log('  TV     -> token almativa-tv-demo-token-0001\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (erro) => {
    console.error('Falha no seed:', erro);
    await prisma.$disconnect();
    process.exit(1);
  });
