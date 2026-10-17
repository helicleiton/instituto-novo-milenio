/**
 * =====================================================================
 *  INSTITUTO NOVO MILÊNIO — Envio e aprovação de mídias do site
 * =====================================================================
 *
 *  Fluxo:
 *   1. O presidente envia foto, vídeo ou link pelo Google Forms.
 *   2. Este script (vinculado à planilha de respostas) move o arquivo para
 *      "01_PENDENTES_APROVACAO", registra a mídia na aba "Base_Midias" e
 *      envia um e-mail ao desenvolvedor com os botões Aprovar / Rejeitar.
 *   3. O botão abre uma página de confirmação (Web App). Ao confirmar:
 *        - Aprovar  → arquivo vai para "02_APROVADOS", fica público para
 *                     leitura e entra no midias.json.
 *        - Rejeitar → arquivo vai para "03_REJEITADOS" e volta a ser privado.
 *   4. O site lê as mídias aprovadas em:  <URL_DO_WEB_APP>?api=midias
 *
 *  Segurança:
 *   - Cada mídia recebe um token aleatório. Sem o token certo o link não
 *     funciona.
 *   - O link do e-mail só ABRE a confirmação (GET). A decisão só é gravada
 *     com o clique em "Confirmar" (POST). Isso evita que o antivírus ou o
 *     pré-carregamento de links do provedor de e-mail aprove algo sozinho.
 *   - Funções auxiliares terminam com "_" e por isso não podem ser chamadas
 *     de fora do script. As funções do menu exigem o dono do script.
 *
 *  Configuração: veja o arquivo LEIA-ME.md, que fica na mesma pasta deste script.
 * =====================================================================
 */

/* ---------------------------------------------------------------------
 * 1. CONFIGURAÇÕES — ajuste aqui
 * ------------------------------------------------------------------- */
const CONFIG = {
  // E-mail que recebe as notificações. Vazio = e-mail da conta dona do script.
  EMAIL_DESENVOLVEDOR: '',

  // Cole aqui a URL do Web App depois de implantar (termina em /exec).
  URL_WEB_APP: '',

  NOME_PLANILHA: 'Base_Midias_Instituto',
  NOME_ABA: 'Base_Midias',
  NOME_PASTA_RAIZ: 'Instituto Novo Milênio - Mídias do Site',
  PASTAS: {
    PENDENTES: '01_PENDENTES_APROVACAO',
    APROVADOS: '02_APROVADOS',
    REJEITADOS: '03_REJEITADOS'
  },
  NOME_ARQUIVO_JSON: 'midias.json',

  CATEGORIAS: ['Música', 'Cordel', 'Capoeira', 'Eventos', 'Institucional'],

  // Opcional: notificação também no Telegram (bot) e/ou Discord (webhook).
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  DISCORD_WEBHOOK_URL: '',

  URL_SITE: 'https://helicleiton.github.io/instituto-novo-milenio/',

  // Quantas mídias aprovadas a API devolve (as mais recentes primeiro).
  LIMITE_API: 60,

  // Cidade exibida nos cards do site.
  LOCAL_PADRAO: 'Horizonte-CE'
};

/* Colunas da aba Base_Midias. As 7 primeiras são as pedidas; as demais são
 * de controle interno do fluxo (a coluna Token fica oculta). */
const COLUNAS = [
  'ID', 'Data', 'Título', 'Categoria', 'Link_Drive_Ou_URL', 'Descrição', 'Status',
  'Tipo', 'File_ID', 'Token', 'Data_Decisao', 'Enviado_Por'
];
const COL = COLUNAS.reduce(function (acc, nome, i) { acc[nome] = i + 1; return acc; }, {});

const STATUS = { PENDENTE: 'Pendente', APROVADO: 'Aprovado', REJEITADO: 'Rejeitado' };
const CHAVE_CACHE = 'midias_json_v1';


/* =====================================================================
 * 2. MENU NA PLANILHA
 * =================================================================== */

/** Cria o menu "Mídias do Site" ao abrir a planilha. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Mídias do Site')
    .addItem('1. Configurar pastas, planilha e gatilho', 'configurarTudo')
    .addSeparator()
    .addItem('Enviar mídia de teste (gera e-mail)', 'simularEnvio')
    .addItem('Sincronizar status e regenerar midias.json', 'sincronizarERegenerar')
    .addToUi();
}


/* =====================================================================
 * 3. CONFIGURAÇÃO INICIAL (rodar uma vez)
 * =================================================================== */

/**
 * Cria a estrutura no Drive, prepara a planilha e instala o gatilho
 * "Ao enviar formulário". Pode ser executada mais de uma vez sem duplicar nada.
 */
function configurarTudo() {
  exigirDono_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Abra o Apps Script pela planilha (Extensões > Apps Script) e rode de novo.');

  const props = PropertiesService.getScriptProperties();

  // 3.1 Pastas
  const raiz = obterOuCriarPasta_(CONFIG.NOME_PASTA_RAIZ, DriveApp.getRootFolder());
  props.setProperty('PASTA_RAIZ', raiz.getId());
  Object.keys(CONFIG.PASTAS).forEach(function (chave) {
    const pasta = obterOuCriarPasta_(CONFIG.PASTAS[chave], raiz);
    props.setProperty('PASTA_' + chave, pasta.getId());
  });

  // 3.2 Planilha: nome, local e aba de dados
  ss.rename(CONFIG.NOME_PLANILHA);
  try { DriveApp.getFileById(ss.getId()).moveTo(raiz); } catch (err) { console.warn('Não movi a planilha: ' + err); }
  obterAba_();

  // 3.3 Gatilho "Ao enviar formulário"
  const jaExiste = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'aoEnviarFormulario';
  });
  if (!jaExiste) {
    ScriptApp.newTrigger('aoEnviarFormulario').forSpreadsheet(ss).onFormSubmit().create();
  }

  // 3.4 Primeiro midias.json (vazio)
  atualizarJsonPublico_();

  const msg = 'Configuração concluída!\n\n' +
    '• Pasta: "' + CONFIG.NOME_PASTA_RAIZ + '" (com as 3 subpastas)\n' +
    '• Aba: "' + CONFIG.NOME_ABA + '"\n' +
    '• Gatilho: ' + (jaExiste ? 'já existia' : 'instalado') + '\n\n' +
    'Próximo passo: Implantar > Nova implantação > App da Web.';
  console.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (err) { /* rodando pelo editor */ }
}


/* =====================================================================
 * 4. GATILHO: NOVA RESPOSTA DO FORMULÁRIO
 * =================================================================== */

/**
 * Executada pelo gatilho instalável "Ao enviar formulário" da planilha.
 * @param {GoogleAppsScript.Events.SheetsOnFormSubmit} e
 */
function aoEnviarFormulario(e) {
  // Só aceita chamadas vindas de um gatilho real deste projeto.
  const gatilhoValido = e && e.triggerUid && ScriptApp.getProjectTriggers().some(function (t) {
    return t.getUniqueId() === e.triggerUid;
  });
  if (!gatilhoValido || !e.namedValues) throw new Error('aoEnviarFormulario só pode ser executada pelo gatilho do formulário.');

  const resp = lerResposta_(e.namedValues);
  const novos = [];
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const pendentes = pasta_('PENDENTES');
    const idsArquivos = extrairIdsDrive_(resp.arquivo);

    // Um registro para cada arquivo enviado
    idsArquivos.forEach(function (fileId, i) {
      const id = gerarId_();
      const arquivo = DriveApp.getFileById(fileId);
      arquivo.moveTo(pendentes);
      const sufixo = idsArquivos.length > 1 ? ' (' + (i + 1) + ')' : '';
      arquivo.setName(id + ' - ' + nomeSeguro_(resp.titulo) + sufixo + extensao_(arquivo.getName()));

      novos.push(registrar_({
        id: id,
        titulo: resp.titulo + sufixo,
        categoria: resp.categoria,
        url: 'https://drive.google.com/file/d/' + fileId + '/view',
        descricao: resp.descricao,
        tipo: arquivo.getMimeType().indexOf('video/') === 0 ? 'video' : 'imagem',
        fileId: fileId,
        enviadoPor: resp.email
      }));
    });

    // Um registro para o link externo (se houver)
    if (resp.link) {
      const url = normalizarUrl_(resp.link);
      novos.push(registrar_({
        id: gerarId_(),
        titulo: resp.titulo,
        categoria: resp.categoria,
        url: url,
        descricao: resp.descricao,
        tipo: tipoDoLink_(url),
        fileId: '',
        enviadoPor: resp.email
      }));
    }
  } finally {
    lock.releaseLock();
  }

  if (!novos.length) {
    MailApp.sendEmail(emailDev_(), '[Site INM] Envio sem arquivo e sem link',
      'Chegou uma resposta do formulário sem arquivo e sem link.\nTítulo: ' + resp.titulo);
    return;
  }
  novos.forEach(notificar_);
}


/* =====================================================================
 * 5. WEB APP: API PÚBLICA + PÁGINAS DE APROVAÇÃO
 * =================================================================== */

/**
 *  ?api=midias                    → JSON das mídias aprovadas (usado pelo site)
 *  ?acao=aprovar&id=...&token=... → página de confirmação
 */
function doGet(e) {
  const p = (e && e.parameter) || {};

  if (p.api === 'midias') {
    return ContentService
      .createTextOutput(obterJsonPublico_())
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (p.acao && p.id && p.token) {
    return paginaConfirmacao_(p.acao, p.id, p.token);
  }

  return pagina_('API de mídias', '<p>Este endereço serve as mídias aprovadas do site do Instituto Novo Milênio.</p>' +
    '<p><a href="?api=midias">Ver JSON das mídias aprovadas</a></p>');
}

/** Recebe o clique em "Confirmar" da página de confirmação. */
function doPost(e) {
  const p = (e && e.parameter) || {};
  const r = processarDecisao_(p.acao, p.id, p.token);
  const corpo = '<div class="alerta ' + (r.ok ? 'ok' : 'erro') + '">' + esc_(r.mensagem) + '</div>' +
    (r.ok ? '<p><a href="' + esc_(CONFIG.URL_SITE) + '#galeria" target="_blank">Ver a galeria do site</a></p>' : '');
  return pagina_(r.ok ? 'Pronto!' : 'Não foi possível concluir', corpo);
}


/* =====================================================================
 * 6. FUNÇÕES DO MENU (ADMIN)
 * =================================================================== */

/** Cria uma mídia de teste (link do YouTube) e dispara o e-mail de aprovação. */
function simularEnvio() {
  exigirDono_();
  const item = registrar_({
    id: gerarId_(),
    titulo: 'Teste do fluxo de mídias',
    categoria: 'Institucional',
    url: 'https://www.youtube.com/channel/UC6mZ_nJ4orLEuXa5HxRydOg',
    descricao: 'Registro de teste criado pelo menu. Pode rejeitar.',
    tipo: 'youtube',
    fileId: '',
    enviadoPor: 'teste'
  });
  notificar_(item);
  try { SpreadsheetApp.getUi().alert('Mídia de teste criada. Confira seu e-mail.'); } catch (err) { /* editor */ }
}

/**
 * Use depois de alterar a coluna Status manualmente na planilha:
 * move cada arquivo para a pasta do seu status, ajusta o compartilhamento
 * e regenera o midias.json.
 */
function sincronizarERegenerar() {
  exigirDono_();
  const aba = obterAba_();
  const dados = aba.getDataRange().getValues();
  let movidos = 0;

  for (let i = 1; i < dados.length; i++) {
    const item = linhaParaItem_(dados[i]);
    if (!item.fileId) continue;
    try {
      const arquivo = DriveApp.getFileById(item.fileId);
      const destino = item.status === STATUS.APROVADO ? 'APROVADOS'
        : item.status === STATUS.REJEITADO ? 'REJEITADOS' : 'PENDENTES';
      const pasta = pasta_(destino);
      if (!arquivo.getParents().hasNext() || arquivo.getParents().next().getId() !== pasta.getId()) {
        arquivo.moveTo(pasta);
        movidos++;
      }
      ajustarCompartilhamento_(arquivo, item.status === STATUS.APROVADO);
    } catch (err) {
      console.warn('Linha ' + (i + 1) + ': ' + err);
    }
  }
  atualizarJsonPublico_();
  const msg = 'Sincronizado. Arquivos movidos: ' + movidos + '. midias.json atualizado.';
  console.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (err) { /* editor */ }
}


/* =====================================================================
 * 7. LÓGICA DE APROVAÇÃO
 * =================================================================== */

function processarDecisao_(acao, id, token) {
  if (acao !== 'aprovar' && acao !== 'rejeitar') return { ok: false, mensagem: 'Ação inválida.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const achado = buscarItem_(id);
    if (!achado || !token || achado.item.token !== token) {
      return { ok: false, mensagem: 'Link inválido ou expirado.' };
    }
    const item = achado.item;
    if (item.status !== STATUS.PENDENTE) {
      return { ok: false, mensagem: 'Esta mídia já foi marcada como "' + item.status + '". Para mudar, edite a planilha e use o menu Sincronizar.' };
    }

    const aprovar = acao === 'aprovar';
    let aviso = '';

    if (item.fileId) {
      const arquivo = DriveApp.getFileById(item.fileId);
      arquivo.moveTo(pasta_(aprovar ? 'APROVADOS' : 'REJEITADOS'));
      aviso = ajustarCompartilhamento_(arquivo, aprovar);
    }

    const aba = obterAba_();
    aba.getRange(achado.linha, COL['Status']).setValue(aprovar ? STATUS.APROVADO : STATUS.REJEITADO);
    aba.getRange(achado.linha, COL['Data_Decisao']).setValue(new Date());
    SpreadsheetApp.flush();

    atualizarJsonPublico_();

    return {
      ok: true,
      mensagem: (aprovar ? '✅ Mídia aprovada e publicada na galeria: ' : '❌ Mídia rejeitada: ') + item.titulo + (aviso ? ' — ' + aviso : '')
    };
  } finally {
    lock.releaseLock();
  }
}

/** Aprovado = qualquer pessoa com o link pode ver (necessário para o site). */
function ajustarCompartilhamento_(arquivo, publico) {
  try {
    if (publico) arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    else arquivo.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    return '';
  } catch (err) {
    console.warn('Compartilhamento não alterado: ' + err);
    return 'atenção: não consegui alterar o compartilhamento do arquivo (' + err.message + ')';
  }
}


/* =====================================================================
 * 8. JSON PÚBLICO (consumido pelo site)
 * =================================================================== */

function obterJsonPublico_() {
  const cache = CacheService.getScriptCache().get(CHAVE_CACHE);
  return cache || atualizarJsonPublico_();
}

/** Gera o JSON, guarda no cache e grava o arquivo midias.json no Drive. */
function atualizarJsonPublico_() {
  const midias = listarAprovadas_();
  const json = JSON.stringify({
    instituicao: 'Instituto Novo Milênio',
    atualizadoEm: new Date().toISOString(),
    total: midias.length,
    midias: midias
  });

  try { CacheService.getScriptCache().put(CHAVE_CACHE, json, 21600); } catch (err) { console.warn('Cache: ' + err); }

  // Cópia no Drive (backup/consulta). O site usa a URL ?api=midias.
  try {
    const props = PropertiesService.getScriptProperties();
    const idJson = props.getProperty('ARQUIVO_JSON');
    let arquivo = null;
    if (idJson) { try { arquivo = DriveApp.getFileById(idJson); } catch (err) { arquivo = null; } }
    if (arquivo && !arquivo.isTrashed()) {
      arquivo.setContent(json);
    } else if (props.getProperty('PASTA_RAIZ')) {
      arquivo = DriveApp.getFolderById(props.getProperty('PASTA_RAIZ')).createFile(CONFIG.NOME_ARQUIVO_JSON, json, MimeType.PLAIN_TEXT);
      props.setProperty('ARQUIVO_JSON', arquivo.getId());
    }
  } catch (err) {
    console.warn('midias.json no Drive não atualizado: ' + err);
  }
  return json;
}

/** Lista as mídias aprovadas no formato que o site entende. */
function listarAprovadas_() {
  const dados = obterAba_().getDataRange().getValues();
  const lista = [];

  for (let i = 1; i < dados.length; i++) {
    const it = linhaParaItem_(dados[i]);
    if (it.status !== STATUS.APROVADO) continue;

    const data = it.data instanceof Date ? it.data : new Date(it.data);
    const pub = {
      id: it.id,
      titulo: it.titulo,
      categoria: it.categoria,
      descricao: it.descricao,
      data: isNaN(data) ? '' : data.toISOString(),
      ano: isNaN(data) ? '' : data.getFullYear(),
      local: CONFIG.LOCAL_PADRAO,
      tipo: it.tipo,
      url: it.url,
      imagem: '',
      embed: ''
    };

    if (it.fileId) {
      pub.imagem = 'https://drive.google.com/thumbnail?id=' + it.fileId + '&sz=w1200';
      pub.url = 'https://drive.google.com/file/d/' + it.fileId + '/view';
      if (it.tipo === 'video') pub.embed = 'https://drive.google.com/file/d/' + it.fileId + '/preview';
    } else if (it.tipo === 'youtube') {
      const vid = idYoutube_(it.url);
      if (vid) {
        pub.imagem = 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg';
        pub.embed = 'https://www.youtube.com/embed/' + vid;
      }
    }
    lista.push(pub);
  }

  lista.sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
  return lista.slice(0, CONFIG.LIMITE_API);
}


/* =====================================================================
 * 9. NOTIFICAÇÕES
 * =================================================================== */

function notificar_(item) {
  const base = urlWebApp_();
  const linkAcao = function (acao) {
    return base + '?acao=' + acao + '&id=' + encodeURIComponent(item.id) + '&token=' + encodeURIComponent(item.token);
  };
  const aprovar = base ? linkAcao('aprovar') : '';
  const rejeitar = base ? linkAcao('rejeitar') : '';
  const rotuloTipo = { imagem: 'Foto', video: 'Vídeo', youtube: 'YouTube', instagram: 'Instagram', link: 'Link' }[item.tipo] || item.tipo;

  // ---- E-mail ----
  const linhas = [
    ['ID', item.id], ['Título', item.titulo], ['Categoria', item.categoria],
    ['Tipo', rotuloTipo], ['Descrição', item.descricao || '—'], ['Enviado por', item.enviadoPor || '—']
  ].map(function (l) {
    return '<tr><td style="padding:6px 12px 6px 0;color:#64748b;white-space:nowrap">' + esc_(l[0]) +
      '</td><td style="padding:6px 0;color:#0f172a;font-weight:600">' + esc_(l[1]) + '</td></tr>';
  }).join('');

  const botao = function (href, texto, cor) {
    return '<a href="' + esc_(href) + '" style="display:inline-block;padding:12px 22px;margin:0 8px 8px 0;border-radius:10px;' +
      'background:' + cor + ';color:#fff;font-weight:700;text-decoration:none">' + texto + '</a>';
  };

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#334155">' +
      '<div style="background:#0f172a;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0">' +
        '<div style="font-size:12px;letter-spacing:2px;color:#f59e0b;font-weight:700">SITE · INSTITUTO NOVO MILÊNIO</div>' +
        '<div style="font-size:20px;font-weight:700;margin-top:4px">Nova mídia aguardando aprovação</div>' +
      '</div>' +
      '<div style="border:1px solid #e2e8f0;border-top:0;padding:22px;border-radius:0 0 14px 14px">' +
        '<table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">' + linhas + '</table>' +
        '<p style="margin:0 0 18px"><a href="' + esc_(item.url) + '" style="color:#0284c7;font-weight:700">' +
          (item.fileId ? '📂 Abrir arquivo no Google Drive' : '🔗 Abrir link enviado') + '</a></p>' +
        (base
          ? botao(aprovar, '✅ Aprovar Mídia', '#16a34a') + botao(rejeitar, '❌ Rejeitar Mídia', '#dc2626') +
            '<p style="font-size:12px;color:#64748b;margin-top:10px">O botão abre uma página de confirmação. Nada é publicado sem o seu clique em “Confirmar”.</p>'
          : '<p style="color:#dc2626;font-weight:700">⚠️ Web App ainda não implantado: preencha CONFIG.URL_WEB_APP para ativar os botões.</p>') +
      '</div>' +
    '</div>';

  const texto = 'Nova mídia aguardando aprovação\n\n' +
    'Título: ' + item.titulo + '\nCategoria: ' + item.categoria + '\nTipo: ' + rotuloTipo +
    '\nDescrição: ' + (item.descricao || '-') + '\nArquivo/Link: ' + item.url +
    (base ? '\n\nAprovar: ' + aprovar + '\nRejeitar: ' + rejeitar : '');

  MailApp.sendEmail({
    to: emailDev_(),
    subject: '[Site INM] Aprovar mídia: ' + item.titulo,
    htmlBody: html,
    body: texto,
    name: 'Site Instituto Novo Milênio'
  });

  // ---- Telegram (opcional) ----
  if (CONFIG.TELEGRAM_BOT_TOKEN && CONFIG.TELEGRAM_CHAT_ID) {
    const payload = {
      chat_id: CONFIG.TELEGRAM_CHAT_ID,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      text: '<b>Nova mídia para o site</b>\n' +
        '<b>Título:</b> ' + esc_(item.titulo) + '\n<b>Categoria:</b> ' + esc_(item.categoria) +
        '\n<b>Tipo:</b> ' + esc_(rotuloTipo) + '\n<b>Descrição:</b> ' + esc_(item.descricao || '—') +
        '\n<a href="' + esc_(item.url) + '">Abrir arquivo/link</a>'
    };
    if (base) payload.reply_markup = { inline_keyboard: [[{ text: '✅ Aprovar', url: aprovar }, { text: '❌ Rejeitar', url: rejeitar }]] };
    enviarWebhook_('https://api.telegram.org/bot' + CONFIG.TELEGRAM_BOT_TOKEN + '/sendMessage', payload);
  }

  // ---- Discord (opcional) ----
  if (CONFIG.DISCORD_WEBHOOK_URL) {
    enviarWebhook_(CONFIG.DISCORD_WEBHOOK_URL, {
      username: 'Site Instituto Novo Milênio',
      content: '**Nova mídia para o site:** ' + item.titulo + ' (' + item.categoria + ', ' + rotuloTipo + ')\n' +
        (item.descricao ? '> ' + item.descricao + '\n' : '') + 'Arquivo/link: <' + item.url + '>' +
        (base ? '\n✅ Aprovar: <' + aprovar + '>\n❌ Rejeitar: <' + rejeitar + '>' : '')
    });
  }
}

function enviarWebhook_(url, payload) {
  try {
    const r = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    if (r.getResponseCode() >= 300) console.warn('Webhook ' + r.getResponseCode() + ': ' + r.getContentText());
  } catch (err) {
    console.warn('Webhook falhou: ' + err);
  }
}


/* =====================================================================
 * 10. PÁGINAS HTML DO WEB APP
 * =================================================================== */

function paginaConfirmacao_(acao, id, token) {
  if (acao !== 'aprovar' && acao !== 'rejeitar') return pagina_('Ação inválida', '<p>Link incorreto.</p>');

  const achado = buscarItem_(id);
  if (!achado || achado.item.token !== token) {
    return pagina_('Link inválido', '<div class="alerta erro">Este link é inválido ou expirou.</div>');
  }
  const it = achado.item;
  if (it.status !== STATUS.PENDENTE) {
    return pagina_('Já decidido', '<div class="alerta erro">Esta mídia já está como <b>' + esc_(it.status) + '</b>.</div>');
  }

  const aprovar = acao === 'aprovar';
  let previa = '';
  if (it.fileId && it.tipo === 'imagem') {
    // A miniatura aparece porque o dono do arquivo é quem está logado.
    previa = '<img src="https://drive.google.com/thumbnail?id=' + esc_(it.fileId) + '&sz=w800" alt="" referrerpolicy="no-referrer">';
  } else if (it.tipo === 'youtube' && idYoutube_(it.url)) {
    previa = '<img src="https://i.ytimg.com/vi/' + esc_(idYoutube_(it.url)) + '/hqdefault.jpg" alt="">';
  }

  const corpo =
    previa +
    '<dl>' +
      '<dt>Título</dt><dd>' + esc_(it.titulo) + '</dd>' +
      '<dt>Categoria</dt><dd>' + esc_(it.categoria) + '</dd>' +
      '<dt>Descrição</dt><dd>' + esc_(it.descricao || '—') + '</dd>' +
    '</dl>' +
    '<p><a href="' + esc_(it.url) + '" target="_blank" rel="noopener">Abrir arquivo/link original ↗</a></p>' +
    '<form method="post" action="' + esc_(urlWebApp_() || ScriptApp.getService().getUrl()) + '" target="_top">' +
      '<input type="hidden" name="acao" value="' + esc_(acao) + '">' +
      '<input type="hidden" name="id" value="' + esc_(it.id) + '">' +
      '<input type="hidden" name="token" value="' + esc_(token) + '">' +
      '<button type="submit" class="' + (aprovar ? 'ok' : 'erro') + '">' +
        (aprovar ? '✅ Confirmar aprovação' : '❌ Confirmar rejeição') + '</button>' +
    '</form>';

  return pagina_(aprovar ? 'Aprovar mídia?' : 'Rejeitar mídia?', corpo);
}

function pagina_(titulo, corpoHtml) {
  const html =
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><base target="_top">' +
    '<style>' +
      'body{margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#334155}' +
      '.box{max-width:560px;margin:32px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden}' +
      '.top{background:#0f172a;color:#fff;padding:18px 22px}' +
      '.top small{color:#f59e0b;font-weight:700;letter-spacing:2px;font-size:11px}' +
      '.top h1{margin:4px 0 0;font-size:20px}' +
      '.in{padding:22px}' +
      'img{width:100%;border-radius:12px;margin-bottom:16px}' +
      'dl{margin:0 0 12px}dt{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b}' +
      'dd{margin:2px 0 12px;color:#0f172a;font-weight:600}' +
      'a{color:#0284c7;font-weight:700}' +
      'button{width:100%;padding:14px;border:0;border-radius:12px;color:#fff;font-size:16px;font-weight:700;cursor:pointer;margin-top:8px}' +
      'button.ok{background:#16a34a}button.erro{background:#dc2626}' +
      '.alerta{padding:14px;border-radius:12px;font-weight:700}' +
      '.alerta.ok{background:#dcfce7;color:#166534}.alerta.erro{background:#fee2e2;color:#991b1b}' +
    '</style></head><body><div class="box">' +
      '<div class="top"><small>INSTITUTO NOVO MILÊNIO · MÍDIAS DO SITE</small><h1>' + esc_(titulo) + '</h1></div>' +
      '<div class="in">' + corpoHtml + '</div>' +
    '</div></body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle(titulo + ' · Instituto Novo Milênio')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}


/* =====================================================================
 * 11. PLANILHA
 * =================================================================== */

function obterAba_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || abrirPlanilhaSalva_();
  PropertiesService.getScriptProperties().setProperty('PLANILHA_ID', ss.getId());

  let aba = ss.getSheetByName(CONFIG.NOME_ABA);
  if (!aba) aba = ss.insertSheet(CONFIG.NOME_ABA);

  if (aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS])
      .setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    aba.setFrozenRows(1);
    aba.getRange(2, COL['Status'], aba.getMaxRows() - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList([STATUS.PENDENTE, STATUS.APROVADO, STATUS.REJEITADO], true)
        .build()
    );
    aba.getRange(2, COL['Data'], aba.getMaxRows() - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm');
    aba.getRange(2, COL['Data_Decisao'], aba.getMaxRows() - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm');
    aba.hideColumns(COL['Token']);
    aba.setColumnWidth(COL['Título'], 240);
    aba.setColumnWidth(COL['Link_Drive_Ou_URL'], 260);
    aba.setColumnWidth(COL['Descrição'], 300);
  }
  return aba;
}

/** No Web App não existe "planilha ativa": abrimos pelo ID salvo. */
function abrirPlanilhaSalva_() {
  const id = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
  if (!id) throw new Error('Planilha não encontrada. Rode "configurarTudo" pela planilha primeiro.');
  return SpreadsheetApp.openById(id);
}

function registrar_(dados) {
  const item = {
    id: dados.id,
    data: new Date(),
    titulo: dados.titulo || 'Sem título',
    categoria: CONFIG.CATEGORIAS.indexOf(dados.categoria) >= 0 ? dados.categoria : (dados.categoria || 'Institucional'),
    url: dados.url,
    descricao: dados.descricao || '',
    status: STATUS.PENDENTE,
    tipo: dados.tipo,
    fileId: dados.fileId || '',
    token: Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8),
    dataDecisao: '',
    enviadoPor: dados.enviadoPor || ''
  };
  obterAba_().appendRow(itemParaLinha_(item));
  return item;
}

function buscarItem_(id) {
  if (!id) return null;
  const dados = obterAba_().getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][COL['ID'] - 1]) === String(id)) {
      return { linha: i + 1, item: linhaParaItem_(dados[i]) };
    }
  }
  return null;
}

function itemParaLinha_(it) {
  const linha = [];
  linha[COL['ID'] - 1] = it.id;
  linha[COL['Data'] - 1] = it.data;
  linha[COL['Título'] - 1] = it.titulo;
  linha[COL['Categoria'] - 1] = it.categoria;
  linha[COL['Link_Drive_Ou_URL'] - 1] = it.url;
  linha[COL['Descrição'] - 1] = it.descricao;
  linha[COL['Status'] - 1] = it.status;
  linha[COL['Tipo'] - 1] = it.tipo;
  linha[COL['File_ID'] - 1] = it.fileId;
  linha[COL['Token'] - 1] = it.token;
  linha[COL['Data_Decisao'] - 1] = it.dataDecisao;
  linha[COL['Enviado_Por'] - 1] = it.enviadoPor;
  return linha;
}

function linhaParaItem_(l) {
  return {
    id: String(l[COL['ID'] - 1]),
    data: l[COL['Data'] - 1],
    titulo: String(l[COL['Título'] - 1]),
    categoria: String(l[COL['Categoria'] - 1]),
    url: String(l[COL['Link_Drive_Ou_URL'] - 1]),
    descricao: String(l[COL['Descrição'] - 1]),
    status: String(l[COL['Status'] - 1]),
    tipo: String(l[COL['Tipo'] - 1]),
    fileId: String(l[COL['File_ID'] - 1] || ''),
    token: String(l[COL['Token'] - 1]),
    dataDecisao: l[COL['Data_Decisao'] - 1],
    enviadoPor: String(l[COL['Enviado_Por'] - 1] || '')
  };
}


/* =====================================================================
 * 12. UTILITÁRIOS
 * =================================================================== */

/** Lê a resposta do Form pelos títulos das perguntas (ignora acentos e maiúsculas). */
function lerResposta_(namedValues) {
  const r = { titulo: '', categoria: '', arquivo: '', link: '', descricao: '', email: '' };
  Object.keys(namedValues).forEach(function (pergunta) {
    const chave = pergunta.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const valor = [].concat(namedValues[pergunta]).join(', ').trim();
    if (!valor) return;
    if (chave.indexOf('titulo') >= 0) r.titulo = valor;
    else if (chave.indexOf('categoria') >= 0) r.categoria = valor;
    else if (chave.indexOf('arquivo') >= 0 || chave.indexOf('upload') >= 0) r.arquivo = valor;
    else if (chave.indexOf('link') >= 0) r.link = valor;
    else if (chave.indexOf('descri') >= 0 || chave.indexOf('legenda') >= 0) r.descricao = valor;
    else if (chave.indexOf('e-mail') >= 0 || chave.indexOf('email') >= 0) r.email = valor;
  });
  return r;
}

/** O Forms grava os uploads como "https://drive.google.com/open?id=XXXX, ...". */
function extrairIdsDrive_(texto) {
  const ids = [];
  const re = /(?:[?&]id=|\/d\/)([-\w]{20,})/g;
  let m;
  while ((m = re.exec(texto || '')) !== null) {
    if (ids.indexOf(m[1]) < 0) ids.push(m[1]);
  }
  return ids;
}

function tipoDoLink_(url) {
  if (/(?:youtube\.com|youtu\.be)/i.test(url)) return 'youtube';
  if (/instagram\.com/i.test(url)) return 'instagram';
  return 'link';
}

function idYoutube_(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : '';
}

function normalizarUrl_(url) {
  const u = String(url).trim().split(/\s+/)[0];
  return /^https?:\/\//i.test(u) ? u : 'https://' + u;
}

function gerarId_() {
  const carimbo = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  return 'MID-' + carimbo + '-' + Utilities.getUuid().slice(0, 4).toUpperCase();
}

function nomeSeguro_(texto) {
  return String(texto || 'midia').replace(/[\\/:*?"<>|#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function extensao_(nome) {
  const m = String(nome).match(/\.[A-Za-z0-9]{2,5}$/);
  return m ? m[0].toLowerCase() : '';
}

function obterOuCriarPasta_(nome, pai) {
  const it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function pasta_(chave) {
  const id = PropertiesService.getScriptProperties().getProperty('PASTA_' + chave);
  if (!id) throw new Error('Pastas não configuradas. Rode "configurarTudo" primeiro.');
  return DriveApp.getFolderById(id);
}

function emailDev_() {
  return CONFIG.EMAIL_DESENVOLVEDOR || Session.getEffectiveUser().getEmail();
}

function urlWebApp_() {
  if (CONFIG.URL_WEB_APP) return CONFIG.URL_WEB_APP;
  try { return ScriptApp.getService().getUrl() || ''; } catch (err) { return ''; }
}

/** Bloqueia funções administrativas para quem não é o dono do script. */
function exigirDono_() {
  const ativo = Session.getActiveUser().getEmail();
  const dono = Session.getEffectiveUser().getEmail();
  if (!ativo || ativo !== dono) throw new Error('Ação permitida apenas para o dono do script.');
}

function esc_(texto) {
  return String(texto === undefined || texto === null ? '' : texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
