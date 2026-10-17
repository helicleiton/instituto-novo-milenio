# Fluxo de envio e aprovação de mídias — Instituto Novo Milênio

Tudo gratuito, com uma única conta Google: **Planilhas + Drive + Apps Script**. Não usa o Google Forms.

```
Presidente ──► Página de envio (PIN) ──► Apps Script
                                        │
                     ┌──────────────────┤
                     ▼                  ▼
         Drive: 01_PENDENTES     E-mail ao desenvolvedor
                                 [Aprovar]  [Rejeitar]
                                        │
                            Página de confirmação
                                        │
          ┌─────────────────────────────┴─────────────────┐
          ▼                                               ▼
  02_APROVADOS + arquivo público              03_REJEITADOS + privado
  Status "Aprovado" + midias.json             Status "Rejeitado"
          │
          ▼
  Site ──fetch──► <URL do Web App>?api=midias ──► Galeria de Impacto
```

**Arquivos desta pasta**

| Arquivo | Para que serve |
|---|---|
| `Code.gs` | Toda a lógica: página de envio, PIN, Drive, planilha, e-mails, aprovação e API. |
| `Envio.html` | A página que o presidente usa no celular para enviar as mídias. |
| `appsscript.json` | Manifesto do projeto (fuso de Fortaleza, configuração do Web App). |

**Um único endereço** (a URL do Web App, que termina em `/exec`) atende tudo:

| Endereço | O que abre |
|---|---|
| `…/exec` | Página de envio do presidente (pede o PIN) |
| `…/exec?api=midias` | JSON das mídias aprovadas, lido pelo site |
| `…/exec?acao=aprovar&id=…&token=…` | Confirmação de aprovação (link do e-mail) |

---

## Passo 1 — Criar a planilha e o projeto do Apps Script

> Use a conta Google que vai **guardar os arquivos** (a sua ou uma conta institucional do Instituto). Tudo fica no Drive dessa conta.

1. Acesse **sheets.new** para criar uma planilha em branco. O nome é trocado sozinho para **Base_Midias_Instituto** no Passo 2.
2. Na planilha: **Extensões > Apps Script**.
3. **Code.gs:** apague o conteúdo do arquivo `Código.gs` e cole todo o [`Code.gs`](Code.gs).
4. **Envio.html:** clique em **+ (Adicionar arquivo) > HTML**, digite o nome **`Envio`** (sem `.html`) e cole todo o [`Envio.html`](Envio.html).
5. **Manifesto:** em **Configurações do projeto** (engrenagem), marque **"Mostrar arquivo de manifesto appsscript.json no editor"**. Volte ao **Editor** e substitua o `appsscript.json` pelo conteúdo de [`appsscript.json`](appsscript.json).
6. Salve (Ctrl+S).

> Opcional: no topo do `Code.gs`, em `CONFIG`, preencha `EMAIL_DESENVOLVEDOR` se os avisos devem ir para outro e-mail. Vazio = e-mail da conta dona.

## Passo 2 — Rodar a configuração automática

1. No editor, selecione a função **`configurarTudo`** e clique em **Executar**.
2. Autorize as permissões (Drive, Planilhas, Gmail e acesso externo). Se aparecer "O Google não verificou este app", clique em **Avançado > Acessar (não seguro)**. É normal: o script é seu.
3. Resultado no Drive:

```
Instituto Novo Milênio - Mídias do Site/
├── 01_PENDENTES_APROVACAO/
├── 02_APROVADOS/
├── 03_REJEITADOS/
├── Base_Midias_Instituto   (a planilha é movida para cá)
└── midias.json             (cópia de backup do JSON público)
```

   A aba **Base_Midias** é criada com as colunas `ID`, `Data`, `Título`, `Categoria`, `Link_Drive_Ou_URL`, `Descrição` e `Status`, além das colunas de controle `Tipo`, `File_ID`, `Token` (oculta), `Data_Decisao` e `Enviado_Por`.

4. Recarregue a planilha. Aparece o menu **Mídias do Site**.

> Não há gatilho para configurar: a própria página de envio chama o script.

## Passo 3 — Definir o código de acesso (PIN)

1. Na planilha: **Mídias do Site > 2. Definir código de acesso (PIN)**.
2. Digite um código com **pelo menos 6 caracteres**, de preferência misturando letras e números (ex.: `Sopro47Cordel`).
3. Envie o código ao presidente **por um canal privado** (ligação ou mensagem direta), separado do link.

Como o código é protegido:
- Ele é guardado só como **hash** nas Propriedades do script, e nunca fica no código (que é público no GitHub).
- Depois de **8 tentativas erradas**, a página bloqueia novos acessos por 15 minutos.
- O acesso dura **2 horas**. Depois disso, é preciso digitar o código de novo.
- Para trocar o código, repita este passo. Quem estava com a página aberta é desconectado na hora.

## Passo 4 — Implantar o Web App

1. No editor: **Implantar > Nova implantação**.
2. Engrenagem ao lado de "Selecionar tipo" > **App da Web**.
3. Preencha:
   - **Descrição:** `Mídias do site v1`
   - **Executar como:** **Eu**
   - **Quem pode acessar:** **Qualquer pessoa**. Esse acesso é necessário para o presidente abrir sem login e para o site ler a API. O envio continua protegido pelo PIN e a aprovação por token.
4. **Implantar**. Copie a **URL do app da Web** (termina em `/exec`).
5. Cole essa URL em `CONFIG.URL_WEB_APP` no `Code.gs` e salve.
6. Publique a alteração **na mesma implantação**, para a URL não mudar: **Implantar > Gerenciar implantações > ✏️ Editar > Versão: Nova versão > Implantar**.

> Sempre que mudar o código, repita o item 6. Uma "Nova implantação" cria **outra URL**, e o link do presidente, o site e os e-mails antigos deixariam de funcionar.

## Passo 5 — Testar

1. Abra a URL `/exec` no celular. Deve aparecer a página **"Enviar fotos e vídeos"** pedindo o código.
2. Digite o PIN, preencha título e categoria, escolha 1 ou 2 fotos e toque em **Enviar para aprovação**. A barra de progresso mostra cada arquivo.
3. Confira:
   - os arquivos aparecem em `01_PENDENTES_APROVACAO`, como `MID-AAAAMMDD-HHMMSS-XXXX - Título.jpg`;
   - a planilha ganhou uma linha por arquivo, com Status **Pendente**;
   - chegou um e-mail **"[Site INM] Aprovar mídia: …"** para cada item.
4. No e-mail, clique em **✅ Aprovar Mídia** e depois em **Confirmar aprovação**.
5. Abra `SUA_URL/exec?api=midias`. A mídia aprovada deve aparecer no JSON.

> Atalho de teste sem a página: **Mídias do Site > Enviar mídia de teste**.

## Passo 6 — Ligar o site

São duas constantes, em dois arquivos do repositório do site:

| Arquivo | Constante | Valor |
|---|---|---|
| `index.html` | `MIDIAS_API_URL` | `https://script.google.com/macros/s/SEU_ID/exec?api=midias` |
| `enviar/index.html` | `URL_PAGINA_ENVIO` | `https://script.google.com/macros/s/SEU_ID/exec` |

Depois:

```bash
git add index.html enviar/index.html && git commit -m "Conecta galeria e página de envio ao Apps Script" && git push
```

O que acontece depois disso:
- A galeria passa a mostrar as mídias aprovadas, das mais recentes para as mais antigas, até 12. Se a API estiver vazia ou fora do ar, ficam os cards fixos atuais.
- O link curto **https://helicleiton.github.io/instituto-novo-milenio/enviar/** leva direto à página de envio.

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

## Passo 7 (opcional) — Avisos no Telegram ou Discord

**Telegram**
1. No Telegram, fale com **@BotFather** > `/newbot` e copie o **token**.
2. Mande uma mensagem ao seu bot e abra `https://api.telegram.org/botSEU_TOKEN/getUpdates`. Copie o número em `"chat":{"id": ...}`.
3. Preencha `CONFIG.TELEGRAM_BOT_TOKEN` e `CONFIG.TELEGRAM_CHAT_ID`.

**Discord:** em **Editar canal > Integrações > Webhooks > Novo webhook > Copiar URL**, e cole em `CONFIG.DISCORD_WEBHOOK_URL`.

> ⚠️ O repositório do site é **público**. Preencha tokens e webhooks **só no editor do Apps Script**, nunca no `Code.gs` do GitHub.

Depois de preencher, publique uma nova versão (Passo 4, item 6).

---

## O que enviar ao presidente

- **Link:** `https://helicleiton.github.io/instituto-novo-milenio/enviar/`, ou a URL `/exec` diretamente.
- **Código de acesso:** enviado separadamente, por ligação ou mensagem privada.

Mensagem sugerida:

> Olá! Por este link você envia fotos, vídeos e links das ações do Instituto para o site: https://helicleiton.github.io/instituto-novo-milenio/enviar/
> O código de acesso eu te passo em outra mensagem. Salve o link nos favoritos do celular.
> Depois de enviar, a mídia passa por uma revisão antes de aparecer na galeria.
> Lembrete: fotos de crianças e adolescentes só com a autorização de uso de imagem assinada pelos responsáveis.

## Como a página funciona para o presidente

1. Abre o link e digita o código de acesso.
2. Preenche o **título** e escolhe a **categoria** (Música, Cordel, Capoeira, Eventos, Institucional).
3. Toca em **"Toque para escolher ou tirar fotos"** e escolhe várias fotos ou vídeos, até 20 por envio. Também pode colar um **link** do Instagram ou do YouTube.
4. Escreve uma **legenda curta** (opcional) e toca em **Enviar para aprovação**.
5. A barra de progresso mostra cada arquivo. No fim, aparece o resumo do que foi recebido.

**Limites:**
- Cada arquivo pode ter até **30 MB**.
- Fotos grandes são **reduzidas automaticamente** no celular (máximo de 2000 px), então qualquer foto de câmera passa.
- **Vídeos acima de 30 MB:** publique no YouTube ou no Instagram e envie o link.

## Mudar uma decisão

1. Altere a coluna **Status** na aba `Base_Midias`.
2. Rode **Mídias do Site > Sincronizar status e regenerar midias.json**. O arquivo vai para a pasta certa, o compartilhamento é ajustado e o site se atualiza.

## Cuidados importantes

- **Uso de imagem (ECA e LGPD):** fotos e vídeos de crianças e adolescentes só devem ser aprovados com autorização assinada pelos responsáveis. Na dúvida, rejeite.
- **Arquivos aprovados ficam públicos** ("qualquer pessoa com o link"), porque é assim que o site consegue exibi-los. Pendentes e rejeitados ficam privados.
- **Aviso do Google:** em contas Gmail comuns, o Google mostra no topo da página a faixa *"Este aplicativo foi criado por um usuário do Google Apps Script"*. É padrão e não dá para remover. O link curto `/enviar/` deixa a entrada mais amigável.
- **Limites gratuitos:** cerca de 100 e-mails por dia (Gmail comum) e 6 minutos por execução. Cada arquivo é enviado numa chamada separada, então muitos arquivos não estouram o tempo.
- **Contas Google Workspace** podem bloquear o compartilhamento público. Nesse caso, a página de aprovação avisa, e é preciso liberar com o administrador do domínio.
- **Miniatura de vídeo do Drive** pode levar alguns minutos para aparecer depois do envio.

## Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| "O código de acesso ainda não foi configurado" | Rode **Mídias do Site > 2. Definir código de acesso**. |
| "Muitas tentativas erradas" | Aguarde 15 minutos. Se foi você testando, trocar o PIN zera o bloqueio. |
| Página em branco ou erro "Envio não encontrado" | O arquivo HTML no Apps Script precisa se chamar exatamente **`Envio`**. |
| "Pastas não configuradas" | Rode `configurarTudo` pela planilha. |
| Envio funciona, mas o e-mail não chega | Veja **Execuções** no Apps Script. Confira também o spam. |
| E-mail chega sem botões | `CONFIG.URL_WEB_APP` vazio ou sem nova versão implantada (Passo 4). |
| Site continua com os cards antigos | `MIDIAS_API_URL` vazio, nada aprovado ainda, ou URL de outra implantação. Abra `?api=midias` no navegador para conferir. |
| Imagem quebrada no site | O arquivo não está público. Rode **Sincronizar** ou verifique a política do domínio. |
| "Ação permitida apenas para o dono do script" | Funções do menu só rodam com a conta dona do script. |
