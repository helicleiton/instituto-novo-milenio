# Fluxo de envio e aprovação de mídias — Instituto Novo Milênio

Tudo gratuito, usando apenas uma conta Google: **Google Forms + Planilhas + Drive + Apps Script**.

```
Presidente ──► Google Forms ──► Planilha (gatilho) ──► Apps Script
                                                     │
                     ┌───────────────────────────────┤
                     ▼                               ▼
         Drive: 01_PENDENTES_APROVACAO     E-mail ao desenvolvedor
                                           [Aprovar]  [Rejeitar]
                                                     │
                                         Página de confirmação (Web App)
                                                     │
              ┌──────────────────────────────────────┴───────────────┐
              ▼                                                      ▼
   02_APROVADOS + arquivo público                      03_REJEITADOS + privado
   Status "Aprovado" + midias.json                     Status "Rejeitado"
              │
              ▼
   Site (index.html) ──fetch──► <URL do Web App>?api=midias ──► Galeria de Impacto
```

> **Importante:** crie o formulário, a planilha e o script **com a mesma conta Google** (a conta do desenvolvedor ou uma conta institucional do Instituto). Os arquivos enviados pelo Forms ficam no Drive do dono do formulário, e o script só consegue movê-los se ele for o dono.

---

## Passo 1 — Criar o Google Forms do presidente

1. Acesse **forms.google.com** e crie um formulário em branco chamado **"Envio de Mídias - Site Instituto Novo Milênio"**.
2. Crie as perguntas **com estes títulos** (o script reconhece as palavras em destaque, sem diferenciar acentos ou maiúsculas):

| # | Título da pergunta | Tipo | Obrigatória |
|---|---|---|---|
| 1 | **Título** da Mídia / Ação | Resposta curta | Sim |
| 2 | **Categoria** | Múltipla escolha: `Música`, `Cordel`, `Capoeira`, `Eventos`, `Institucional` | Sim |
| 3 | **Arquivo** (foto ou vídeo) | Upload de arquivo | Não |
| 4 | **Link** externo (Instagram/YouTube) | Resposta curta | Não |
| 5 | **Descrição** / Legenda curta | Parágrafo | Não |

3. Na pergunta 3 (Upload de arquivo):
   - **Permitir apenas tipos de arquivo específicos:** Imagem e Vídeo.
   - **Número máximo de arquivos:** 10 (cada arquivo vira uma mídia separada para aprovação).
   - **Tamanho máximo:** 1 GB (ou mais, se a conta tiver espaço).
4. Na pergunta 4, para validar o link: os três pontinhos da pergunta > **Validação de resposta** > Texto > **É um URL**.
5. Em **Configurações > Respostas**, ative **Coletar endereços de e-mail** (opcional; o e-mail aparece na notificação como "Enviado por").

> O Forms exige que quem envia arquivos esteja logado em uma conta Google. O presidente só precisa da própria conta Gmail.
>
> Se a pessoa enviar arquivo **e** link na mesma resposta, cada um vira um item separado para aprovação.

## Passo 2 — Vincular a planilha

1. No formulário, abra a aba **Respostas** > **Vincular ao Planilhas** > **Criar uma nova planilha**.
2. Abra a planilha criada. O nome será trocado automaticamente para **Base_Midias_Instituto** no Passo 4.

> A planilha é um Google Sheets (não um .xlsx). Se precisar de uma cópia em Excel, use **Arquivo > Fazer download > Microsoft Excel (.xlsx)**.

## Passo 3 — Colar o código do Apps Script

1. Na planilha, vá em **Extensões > Apps Script**.
2. Apague o conteúdo do arquivo `Código.gs` e cole todo o conteúdo de [`Code.gs`](Code.gs).
3. Clique em **Configurações do projeto** (engrenagem) e marque **"Mostrar arquivo de manifesto appsscript.json no editor"**. Volte ao **Editor**, abra o `appsscript.json` e substitua pelo conteúdo de [`appsscript.json`](appsscript.json) (fuso horário de Fortaleza, runtime V8).
4. Opcional: no topo do `Code.gs`, em `CONFIG`, preencha `EMAIL_DESENVOLVEDOR` se as notificações devem ir para outro e-mail. Vazio = e-mail da conta dona do script.
5. Salve (Ctrl+S).

## Passo 4 — Rodar a configuração automática (cria pastas, aba e gatilho)

1. No editor, selecione a função **`configurarTudo`** e clique em **Executar**.
2. Autorize as permissões (Drive, Planilhas, Gmail e acesso externo). Se aparecer "O Google não verificou este app", clique em **Avançado > Acessar (não seguro)**. Isso é normal: o script é seu.
3. Isso cria no seu Drive:

```
Instituto Novo Milênio - Mídias do Site/
├── 01_PENDENTES_APROVACAO/
├── 02_APROVADOS/
├── 03_REJEITADOS/
├── Base_Midias_Instituto   (a planilha é movida para cá)
└── midias.json             (cópia de backup do JSON público)
```

   - Cria a aba **Base_Midias** com as colunas `ID`, `Data`, `Título`, `Categoria`, `Link_Drive_Ou_URL`, `Descrição` e `Status`, além das colunas de controle `Tipo`, `File_ID`, `Token` (oculta), `Data_Decisao` e `Enviado_Por`.
   - Instala o gatilho **"Ao enviar formulário" → `aoEnviarFormulario`**. Para conferir: menu lateral **Acionadores** (ícone de relógio).

> **Gatilho manual (alternativa):** em **Acionadores > + Adicionar acionador**, escolha a função `aoEnviarFormulario`, evento **Da planilha**, tipo **Ao enviar o formulário**. Não crie os dois, para não duplicar e-mails.

Depois disso, ao reabrir a planilha aparece o menu **Mídias do Site**.

## Passo 5 — Implantar o Web App (botões e API)

1. No editor: **Implantar > Nova implantação**.
2. Engrenagem ao lado de "Selecionar tipo" > **App da Web**.
3. Preencha:
   - **Descrição:** `Mídias do site v1`
   - **Executar como:** **Eu** (sua conta)
   - **Quem pode acessar:** **Qualquer pessoa**. Esse acesso é necessário para o site ler a API. Os botões de aprovação continuam protegidos por um token secreto por mídia.
4. Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).
5. Cole essa URL em `CONFIG.URL_WEB_APP` no `Code.gs` e salve.
6. Publique essa alteração **na mesma implantação**, para a URL não mudar: **Implantar > Gerenciar implantações > ✏️ Editar > Versão: Nova versão > Implantar**.

> Sempre que mudar o código, repita o item 6. Uma "Nova implantação" gera **outra URL**, e o site e os e-mails antigos deixariam de funcionar.

## Passo 6 — Testar o fluxo

1. Na planilha: **Mídias do Site > Enviar mídia de teste**. Chega um e-mail **"[Site INM] Aprovar mídia: Teste do fluxo de mídias"**.
2. Clique em **✅ Aprovar Mídia**. Abre a página de confirmação; clique em **Confirmar aprovação**.
3. Confira:
   - na planilha, o Status mudou para **Aprovado**;
   - abrindo `SUA_URL/exec?api=midias` no navegador, o JSON lista o item.
4. Faça um envio real pelo formulário com uma foto. O arquivo deve aparecer em `01_PENDENTES_APROVACAO`, renomeado como `MID-AAAAMMDD-HHMMSS-XXXX - Título.jpg`.
5. Rejeite a mídia de teste ou apague a linha dela e rode **Sincronizar status e regenerar midias.json**.

Formato da resposta da API:

```json
{
  "instituicao": "Instituto Novo Milênio",
  "atualizadoEm": "2026-10-17T13:20:00.000Z",
  "total": 1,
  "midias": [
    {
      "id": "MID-20261017-102000-A1B2",
      "titulo": "Oficina de Sopros",
      "categoria": "Música",
      "descricao": "Turma da tarde do Florescer Musical",
      "data": "2026-10-17T13:20:00.000Z",
      "ano": 2026,
      "local": "Horizonte-CE",
      "tipo": "imagem",
      "url": "https://drive.google.com/file/d/ID_DO_ARQUIVO/view",
      "imagem": "https://drive.google.com/thumbnail?id=ID_DO_ARQUIVO&sz=w1200",
      "embed": ""
    }
  ]
}
```

`tipo` pode ser `imagem`, `video`, `youtube`, `instagram` ou `link`.

## Passo 7 — Ligar o site à API

No `index.html`, já está implementada a função que busca e desenha os cards. Basta preencher a constante no início do `<script>`:

```js
const MIDIAS_API_URL = 'https://script.google.com/macros/s/SEU_ID/exec?api=midias';
```

Depois:

```bash
git add index.html && git commit -m "Conecta galeria à API de mídias" && git push
```

Como funciona:
- **Com mídias aprovadas:** os cards da "Galeria de Impacto" são substituídos pelas mídias da API, das mais recentes para as mais antigas, até 12 itens.
- **API vazia, fora do ar ou constante em branco:** continuam aparecendo os cards atuais do site.
- **Vídeos e YouTube:** mostram um ícone de play e abrem em nova aba.
- **Instagram:** como não há miniatura pública, aparece uma capa ilustrada com o ícone do Instagram.

Trecho principal (já incluído no `index.html`):

```js
fetch(MIDIAS_API_URL)
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(dados => renderGaleria(dados.midias))
  .catch(err => console.warn('[Galeria] mantendo cards estáticos:', err.message));
```

## Passo 8 (opcional) — Avisos no Telegram ou Discord

**Telegram**
1. No Telegram, fale com **@BotFather** > `/newbot` e copie o **token**.
2. Mande qualquer mensagem para o seu bot e abra `https://api.telegram.org/botSEU_TOKEN/getUpdates`. Copie o número em `"chat":{"id": ...}`.
3. Preencha `CONFIG.TELEGRAM_BOT_TOKEN` e `CONFIG.TELEGRAM_CHAT_ID`. A mensagem chega com os botões **✅ Aprovar** e **❌ Rejeitar**.

**Discord**
1. No canal: **Editar canal > Integrações > Webhooks > Novo webhook > Copiar URL**.
2. Cole em `CONFIG.DISCORD_WEBHOOK_URL`.

Depois de preencher, publique uma nova versão (Passo 5, item 6).

---

## Como o presidente usa (rotina)

1. Abre o link do formulário (salve nos favoritos do celular).
2. Preenche título, categoria, anexa as fotos/vídeos **ou** cola o link do post/vídeo, e escreve uma legenda curta.
3. Envia. Não precisa fazer mais nada: a mídia só vai para o site depois da aprovação.

## Mudar uma decisão

- Altere a coluna **Status** na aba `Base_Midias`, por exemplo de Aprovado para Rejeitado.
- Rode **Mídias do Site > Sincronizar status e regenerar midias.json**. O arquivo é movido para a pasta certa, o compartilhamento é ajustado e o site se atualiza.

## Cuidados importantes

- **Uso de imagem (ECA e LGPD):** fotos e vídeos de crianças e adolescentes só devem ser aprovados com **autorização de uso de imagem assinada pelos responsáveis**. Na dúvida, rejeite.
- **Arquivos aprovados ficam públicos** ("qualquer pessoa com o link pode ver"), porque é assim que o site consegue exibi-los. Os pendentes e os rejeitados ficam privados.
- **Contas Google Workspace** podem bloquear o compartilhamento público. Nesse caso, a página de aprovação mostra um aviso, e é preciso pedir ao administrador do domínio para liberar.
- **Limites gratuitos:** cerca de 100 e-mails por dia (Gmail comum) e 6 minutos por execução. Para uma ONG, sobra.
- **Miniatura de vídeo do Drive** pode levar alguns minutos para ser gerada depois do upload.
- **Cache:** a API responde do cache por até 6 horas, mas o cache é renovado na hora a cada aprovação ou rejeição.

## Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| Nenhum e-mail chega | Confira em **Acionadores** se `aoEnviarFormulario` existe. Veja erros em **Execuções**. |
| E-mail chega sem botões | `CONFIG.URL_WEB_APP` vazio ou Web App não implantado (Passo 5). |
| "Link inválido ou expirado" | O e-mail é de uma mídia já apagada da planilha, ou o link foi cortado pelo cliente de e-mail. |
| "Pastas não configuradas" | Rode `configurarTudo` de novo pela planilha. |
| Site continua com os cards antigos | `MIDIAS_API_URL` vazio, nenhuma mídia aprovada ainda, ou a URL é de outra implantação. Abra a URL `?api=midias` no navegador para conferir. |
| Imagem quebrada no site | O arquivo não está público. Rode **Sincronizar** ou verifique a política do domínio. |
| Erro "Ação permitida apenas para o dono do script" | Funções do menu só rodam com a conta dona do script. |
