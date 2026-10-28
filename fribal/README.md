# Sempre Presente Fribal

Hotsite da promoção comercial **Sempre Presente Fribal**, implementado a partir do
Figma `DddjoLErx7W0azoDgxZWnN`.

HTML, CSS e JavaScript puros — sem framework e sem etapa de build para publicar.
Basta subir a pasta num servidor de arquivos estáticos.

---

## Rodando localmente

```bash
npm start
```

Abre em <http://localhost:4321>.

Qualquer servidor estático serve; `tools/serve.mjs` existe só para não depender
de nada externo durante o desenvolvimento.

---

## Estrutura

```
index.html            página inteira (as 7 seções)
css/
  tokens.css          cores, tipografia, curvas de animação, medidas
  base.css            reset, acessibilidade, utilitários de reveal e parallax
  layout.css          seções, fundos, molduras, o palco do KV
  components.css      menu, botões, cards, accordion, caderno, modal, rodapé
  responsive.css      breakpoints, do ultrawide ao 320px
js/
  main.js             inicialização
  menu.js             menu fixo, menu mobile, scroll ancorado, scrollspy
  reveal.js           entrada dos elementos no scroll
  parallax.js         parallax, barra de progresso, botão "voltar ao topo"
  accordion.js        dúvidas frequentes
  modal.js            modal de cadastro
  easing.js           resolvedor de cubic-bezier (curvas do Figma em JS)
  transition.js       espera de transição com prazo máximo
assets/
  img/                imagens otimizadas (WebP + fallback)
  svg/                ícones e vetores
  icons/              favicons
  raw/                originais exportados do Figma (não vão para produção)
tools/                scripts de build e de conferência
```

---

## Conteúdo a substituir

Tudo que ainda é placeholder está marcado com o atributo `data-placeholder`
no HTML. Para listar:

```bash
grep -n "data-placeholder" index.html
```

O que precisa ser preenchido:

| Onde | O quê |
|---|---|
| Sorteios e ganhadores | data, nome, CPF e número da sorte dos 9 cards |
| Prêmios | valor mínimo de compra, quantidade de motos, modelo |
| Dúvidas frequentes | as 5 perguntas e respostas |
| Lojas participantes | nome e endereço das unidades de cada cidade |
| Rodapé | e-mail, telefone e os links de Política, Termos e Regulamento |
| Rodapé | texto legal (datas, valor da premiação, nº do certificado SPA/ME) |
| Modal de cadastro | destino dos botões "Cadastrar por aqui" e "por WhatsApp" |
| Redes sociais | URLs de Facebook, TikTok e WhatsApp (o Instagram já está preenchido) |

Os cards de ganhadores estão escritos direto no HTML, um bloco por sorteio —
copie e cole o bloco `<li class="winner">` para acrescentar mais.

---

## Reprocessar as imagens

As imagens exportadas do Figma ficam em `assets/raw/` (26 MB). O build gera
`assets/img/` em WebP 1x/2x com fallback, reduzindo para cerca de 1 MB.

```bash
npm run build
```

- `npm run build:img` — otimiza as imagens (`tools/optimize-images.mjs`)
- `npm run build:icons` — favicons e imagem de compartilhamento (`tools/make-icons.mjs`)

As larguras de referência de cada imagem ficam no objeto `PLAN` em
`tools/optimize-images.mjs`.

---

## Conferência

```bash
node tools/check.mjs
```

Verifica erros de console, requisições falhas, peso da página, ausência de
scroll horizontal em 11 larguras (2560 → 320), acessibilidade básica e se a
página continua legível com o JavaScript desligado.

Capturas para comparação visual:

```bash
node tools/shot.mjs 1440 desktop.png --full
node tools/shot.mjs 390 mobile.png --full
node tools/states.mjs
```

`SHOT_DIR` define a pasta de saída.

---

## Movimento

As durações e curvas replicam os presets do protótipo do Figma e estão em
`css/tokens.css`:

| Token | Valor | Uso |
|---|---|---|
| `--dur-fast` | 300ms | hovers, accordion, estado fixo do menu |
| `--dur-slow` | 600ms | variante do logo, reveals com overshoot |
| `--ease-slow` | `cubic-bezier(.33,0,.15,1)` | padrão de quase tudo |
| `--ease-bouncy` | `cubic-bezier(.34,1.56,.64,1)` | logo da campanha, ícones sociais |
| `--ease-gentle` | `cubic-bezier(.25,.46,.45,.94)` | loops de fundo e flutuação |

O logo da campanha reproduz a troca `Default → Variant2` do componente
LOGO CAMPANHA: o lettering "presente" cresce 1,1537× e o laço gira −4,11° e
cresce 1,2591× — os mesmos números do arquivo. Acontece uma vez na entrada e
no hover do card do KV.

`prefers-reduced-motion: reduce` desliga parallax, loops, marquee e reveals;
o conteúdo aparece direto no lugar final.

---

## Notas de implementação

- **Molduras com badge na borda.** O anel é um pseudo-elemento com máscara: a
  máscara abre um vão só na faixa superior, onde o badge se apoia. A largura do
  vão é medida em `js/main.js` com `ResizeObserver`, porque muda com a fonte e
  com o breakpoint.
- **Blocos gráficos proporcionais.** O bloco de prêmios, o selo do cupom, o
  logo do KV e os cards de "Como participar" posicionam os filhos em
  porcentagem e dimensionam texto em `cqw`, então a composição do Figma escala
  inteira em vez de se desmontar. Abaixo de 900px o bloco de prêmios vira uma
  grade empilhada.
- **Reveals sem IntersectionObserver.** A verificação é feita no scroll: blocos
  mais altos que a viewport nunca atingiriam um threshold razoável em telas
  pequenas. Os elementos saem da lista assim que aparecem.
- **Sem JavaScript.** O estado inicial escondido dos reveals é aplicado sob
  `html.js`, marcado por um script inline no `<head>` — se o JS falhar, todo o
  conteúdo continua visível.
