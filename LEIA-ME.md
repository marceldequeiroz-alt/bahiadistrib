# Painel de Distribuição de Materiais — publicação no Netlify

Este pacote contém tudo que o Netlify precisa para servir o painel **e** guardar
a base de dados enviada pela própria página.

```
painel.html                      o painel (arquivo único, já configurado)
netlify/functions/base.mjs       função que lê e grava a base
netlify.toml                     configuração do site
package.json                     dependência da função
```

---

## Por que não basta arrastar a pasta

O Netlify serve arquivos estáticos, e um HTML sozinho não consegue gravar nada
no servidor. Quem grava é a função em `netlify/functions/`, e ela depende do
pacote `@netlify/blobs`, que precisa ser instalado no momento do deploy.

O deploy por arrastar-e-soltar **não roda instalação de dependências**, então a
função não funcionaria. Use um destes dois caminhos:

- **Repositório Git conectado ao Netlify** (recomendado). O Netlify roda
  `npm install` sozinho a cada deploy.
- **Netlify CLI**: `npm install -g netlify-cli`, depois `netlify deploy --prod`
  na pasta do projeto.

---

## Passo a passo

**1. Suba os arquivos** para um repositório e conecte ao Netlify, ou rode o
deploy pela CLI.

**2. Defina a senha de atualização.** No painel do Netlify, vá em
*Site configuration → Environment variables* e crie:

| Variável | Valor |
| --- | --- |
| `SENHA_PAINEL` | uma senha sua, com **no mínimo 12 caracteres** |

Sem essa variável a página continua funcionando normalmente, mas qualquer
tentativa de gravar responde com um aviso explicando o que falta. Quem tiver
essa senha consegue substituir a base do painel, então trate como credencial.

**3. Publique.** Ao abrir o site, o painel mostra "Atualizações valem para todos
que abrirem o painel neste site" no bloco *Base de dados*. É o sinal de que a
função foi encontrada.

---

## Como funciona a atualização

1. Você abre *Base de dados → Atualizar base* e escolhe a planilha.
2. A planilha é lida **no seu navegador**. Os nomes são conferidos contra os
   417 municípios da Bahia, duplicados e valores não numéricos são descartados,
   e aparece um relatório do que entrou e do que ficou de fora.
3. Você digita a senha e confirma. Só nesse momento algo é gravado.
4. A função confere a estrutura de novo antes de aceitar, arquiva a base que
   estava no ar como **versão anterior** e grava a nova.
5. Quem estiver com a página aberta recebe a troca em até um minuto; quem abrir
   depois já vê a base nova.

A base fica no **Netlify Blobs**, que sobrevive a novos deploys do site. Publicar
uma versão nova do painel não apaga os dados enviados.

---

## Voltar atrás

Dois caminhos, os dois no bloco *Base de dados*:

- **Restaurar anterior** — volta para a base que estava no ar antes do último
  envio. O botão mostra qual é, com nome do arquivo, número de municípios e data.
- **Voltar à base original** — retorna à planilha de 31.08.26, que fica embutida
  no próprio `painel.html` e nunca é apagada. É a rede de segurança final,
  inclusive no primeiro envio, quando ainda não existe versão anterior guardada.

Guardamos **uma** versão anterior, não um histórico. Dois envios seguidos
descartam a mais antiga. Se precisar de histórico maior, dá para ampliar.

---

## Detalhes que valem saber

- **Sempre use HTTPS.** O Netlify já entrega certificado por padrão. A senha
  trafega no corpo da requisição, então sem HTTPS ela ficaria exposta.
- **A função recusa** senha errada, base malformada, índice de território fora
  da faixa, valores negativos ou não numéricos, menos de 1 ou mais de 1000
  municípios, e corpo acima de 2 MB. Em qualquer recusa, nada é gravado e a base
  que estava no ar continua intacta.
- **O painel funciona mesmo sem a função.** Se a função estiver fora do ar, o
  painel abre com a base embutida e avisa que as alterações valem só naquela aba.
- **Municípios sem linha na base** aparecem em cinza no mapa e não entram em
  nenhum total. A geografia cobre os 417 municípios da Bahia, então qualquer
  planilha válida tem onde ser desenhada.
- **URL amigável**: o `netlify.toml` já mapeia `/api/base` para a função. O
  painel usa o caminho direto `/.netlify/functions/base`, que funciona sempre.
