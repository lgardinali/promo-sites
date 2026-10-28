# Festival 9 Anos — Açaí no Kilo

Landing page da promoção, feita em **HTML + CSS + JavaScript puro**, sem
dependências, build ou framework. Basta servir a pasta.

Design de origem: Figma `ACAI NOKILO` — frames `DESKTOP` (1920),
`DESKTOP ULTRAWIDE` (2560) e `MOBILE` (360).

---

## Como rodar

Abrir `index.html` direto no navegador já funciona. Para testar com um
servidor local (recomendado, por causa dos caminhos e do cache):

```bash
node dev-server.js
```

Depois abra <http://localhost:4173>.

Para publicar, envie a pasta inteira para qualquer host estático
(Netlify, Vercel, S3, Apache, nginx). Habilite **gzip/brotli**: o maior
arquivo é o SVG do padrão decorativo, que comprime muito bem
(333 KB → ~138 KB).

---

## Estrutura

```
index.html            página inteira, uma seção por bloco comentado
favicon.svg/.ico      favicon (node 272:2190 do Figma)
site.webmanifest      ícones e cores para instalação/PWA
dev-server.js         servidor estático de 20 linhas, só para desenvolvimento
css/
  tokens.css          cores, tipografia, medidas e curvas de movimento
  style.css           reset, layout, componentes e responsivo
  motion.css          entradas com scroll, parallax, loops e reduced-motion
js/
  app.js              scroll suave, menu, reveal, parallax, accordion e
                      ganhadores (abas, busca e barra de rolagem)
assets/
  fonts/              Amsi Pro SemiBold e Ultra (WOFF2 + OTF) — ver LEIA-ME
  img/                fotos e composições em WebP otimizado
  svg/                vetores (padrão de fundo, folhas, logo, tickets)
  icons/              ícones de interface e redes sociais
```

### Seções (na ordem da página)

1. **Menu** — header fixo, vira gaveta abaixo de 1140 px
2. **KV** — composição do hero
3. **Como participar**
4. **Prêmios**
5. **Dúvidas frequentes**
6. **Ganhadores**
7. **Rodapé**

---

## O que precisa ser preenchido

| Onde | O quê |
|---|---|
| `index.html` — `href="#cadastro"` | Apontar os 4 CTAs (`Participe!` / `Cadastre-se!` / `Login/Cadastro`) para a URL real de cadastro |
| `js/app.js` — `WINNERS` | Lista de ganhadores: `{ nome, cpf, premio, data }`, separada em `sorteios` e `roleta`. Trocar por um `fetch` da API quando existir |
| `index.html` — blocos `.ac` | Perguntas e respostas reais (hoje em Lorem ipsum, como no Figma) |
| `index.html` — rodapé | Certificado SPA/ME, datas, valor da premiação, links legais e redes sociais (só o Instagram está com URL) |

Todo texto marcado como `0000`, `DD/MM/AAAA`, `###.###.###-##` ou Lorem
ipsum é placeholder vindo do Figma.

---

## Tipografia

**Amsi Pro** é a fonte da marca, nos dois pesos que o Figma usa:

| Arquivo | `font-weight` | Onde |
|---|---|---|
| `AmsiPro-SemiBold` | 600 | corpo de texto, menu, perguntas, rodapé |
| `AmsiPro-Ultra` | 800 | títulos, números, rótulos de prêmio, botões |

Os WOFF2 foram gerados dos OTF originais (155 KB → 51 KB e 145 KB →
48 KB) e o OTF fica como reserva. **Luckiest Guy** (títulos em destaque)
e **Inter** (busca e crédito do rodapé) vêm do Google Fonts — as mesmas
do arquivo original.

As métricas reais dos arquivos (cap-height 703 / 708 em 1000 unidades)
estão em `tokens.css` como `--cap-offset-*`. Elas são o que permite
posicionar a faixa da mecânica do KV nas coordenadas exatas do Figma:
as medidas de texto do Figma partem do topo da maiúscula
(`text-box-trim`), não do topo da linha.

---

## Movimento

As curvas em `tokens.css` foram **geradas a partir dos presets de spring
do Figma** (massa 1) e convertidas para a função `linear()` do CSS, então
o overshoot é o mesmo do protótipo:

| Token | Preset do Figma | Rigidez / amortecimento |
|---|---|---|
| `--ease-slow` | Slow | 80 / 20 |
| `--ease-quick` | Quick | 300 / 20 |
| `--ease-gentle` | Gentle | 100 / 15 |
| `--ease-bouncy` | Bouncy | 600 / 15 |

Durações: `--t-quick: 300ms` (hovers, micro-interações) e
`--t-slow: 600ms` (entradas, accordion, parallax do ponteiro).

### Interações por seção

- **Menu** — hover na logo (escala + giro do sol), underline amarelo nos
  itens, item ativo acompanhando o scroll, botão de cadastro com ícone
  que balança, barra que encolhe e ganha blur ao rolar, gaveta com
  entrada em cascata no mobile.
- **KV** — entrada em cascata; loops de respiro tirados das variantes
  `Default → Variant2` dos componentes do Figma (logo em zoom, folhas
  balançando, pote flutuando e girando, colagem de prêmios respirando,
  selos pulsando); camadas seguem o ponteiro com profundidades
  diferentes; padrão e card com parallax de scroll.
- **Como participar** — cada etapa é o componente do Figma (Default →
  Variant2): no hover o painel e o círculo vão de `#631174` para
  `#6b0b76`, o número cresce de 36.628 para 43.954, o texto muda para
  `#6b0b76` e a foto amplia e desliza dentro do painel (a de cima 1.104×,
  a do meio 1.087×, a de baixo 1.12×, cada uma com o deslocamento
  medido no Figma). Setas deslizam e as folhas laranja respiram.
- **Prêmios** — cards sobem com sombra, imagem cresce e inclina no hover,
  flutuação contínua em cada prêmio. Nos vouchers, a arte de cada
  bilhete balança ±1.4° em volta do ângulo do Figma (ciclos de 7 a 9 s,
  defasados) e, no hover, os bilhetes sobem e crescem 4.5% em onda de
  45 ms, com o número indo junto; tudo em spring "Slow", sem overshoot.
- **Dúvidas** — accordion animado por `grid-template-rows` (0fr → 1fr),
  sinal `+` que vira `−` girando 180°, card que sobe no hover. Começam
  todos fechados e só um fica aberto por vez na seção inteira: abrir um
  fecha o anterior, e clicar no que está aberto fecha tudo.
- **Ganhadores** — abas com troca em cascata, busca ao vivo (insensível a
  acento), linhas que deslizam no hover, barra de rolagem customizada e
  arrastável igual à do desenho.
- **Global** — scroll suave com easing próprio, barra de progresso no
  topo, botão de voltar ao topo, brilho que atravessa o CTA no hover.

O fundo é **chapado**: sem elipses desfocadas, sem degradês. Os botões
crescem no hover, sem halo externo.

### Acessibilidade e performance

- `prefers-reduced-motion: reduce` desliga loops, parallax e entradas.
- Navegação por teclado nas abas, accordion com `aria-expanded`/`region`,
  skip link, `focus-visible` amarelo, rótulos nos campos de busca.
- Todo o scroll roda num único `requestAnimationFrame`; o parallax do
  ponteiro só liga em `hover: hover` e a partir de 1024 px.
- Imagens convertidas para WebP: **17 MB → 1,3 MB** (−92%).

---

## Responsivo

Há dois desenhos de origem, não um só redimensionado: o frame **DESKTOP**
(1920) e o frame **MOBILE** (360). O corte entre eles é **1023 px**.

| Faixa | Comportamento |
|---|---|
| ≥ 1921 px | Conteúdo travado em 1920 e centralizado; fundos sangram (igual ao frame ultrawide) |
| 1141 – 1920 px | Desktop; o KV escala proporcionalmente pelas coordenadas do Figma |
| 1024 – 1140 px | Desktop com o menu em gaveta |
| ≤ 1023 px | Frame mobile do Figma: KV remontado, card único no "Como participar", prêmios em grade e componentes nas medidas do desenho de 360 |

### As duas unidades que sustentam o layout

Nada na página usa `transform: scale` nem JavaScript para escalar. As
coordenadas absolutas do Figma continuam valendo em qualquer largura por
causa de duas unidades:

- **`--p`** — dentro de um "palco" (`container-type: inline-size` mais
  `--dw` com a largura do frame), `calc(100cqw / var(--dw))` vale 1 px do
  Figma. É o que monta o KV: o palco principal e, dentro dele, quatro
  palcos aninhados (mulher, prêmios, claim e faixa da mecânica), cada um
  com o seu próprio `--dw`.
- **`--cp`** — 1 px do Figma medido pela **coluna de conteúdo**
  (`(100vw - 2 * --gutter) / 299.997`), já que a coluna mobile vale 300
  no desenho. É o que dimensiona accordeons, cards de ganhadores, abas,
  busca e o card do "Como participar".

Por que duas: um elemento **não é o seu próprio container query** — o
`cqw` dentro de um elemento que declara `container-type` resolve contra o
ancestral, não contra ele mesmo. Então quem define `--p` para os filhos
precisa medir a si próprio com porcentagem ou com `--cp`. E o `cqw` dos
filhos resolve contra a **caixa de conteúdo** do container, por isso o
`--dw` desconta borda e padding (o cartão de ganhadores é
299.997 − 2×1.915 − 2×12.766 = 270.638).

O `--cp` tem teto de 1.72 px — a razão desktop/mobile dessas peças —, o
que impede que elas passem do tamanho do desktop no topo da faixa
(tablet), onde a coluna já supera 700 px.

### Detalhes do mobile

- `--gutter` volta a 30 px em 360 (`clamp(20px, 8.333vw, 40px)`): o clamp
  global ficava preso no mínimo e não entregava a margem do Figma.
- O menu mobile é outro componente: barra de 41.5 px com o disco da logo
  (63.4 px) estourando para fora e o botão trocado pelo "hambúrguer".
- O padrão de fundo do KV usa um SVG próprio
  (`pattern-shapes-mobile.svg`, retrato 332×634); o do
  desktop é paisagem 1644×800 e ficaria achatado.
- O KV mobile é um palco de 360 × 976.847 limitado a 520 px de largura,
  com as camadas posicionadas em porcentagem do frame.
- No desktop, os links do menu ficam no x do Figma (291 da borda da
  barra) e o botão Login/Cadastro encosta na direita com 6 px — o mesmo
  respiro que ele tem em cima e embaixo (barra de 70 menos 6 de borda =
  64 de conteúdo, botão de 52). Daí o `flex: 1` com
  `justify-content: flex-start` no `.nav`.
- A barra do menu tem altura fixa, mas o KV escala com a largura, então
  a logo "9 ANOS" subia até encostar no menu entre 1300 e 1600 px. O
  `.kv` ganhou um `padding-top` que mantém pelo menos ~74 px de folga
  abaixo da barra e se desliga sozinho acima de ~1675 px:
  `min(48px, max(0px, 175.4px - 10.479vw))` — 10.479vw é o topo da logo
  do KV em qualquer largura (201.2 / 1920).
- A folha laranja direita do "Como participar" gira −87,79°, então a
  caixa que o Figma mostra (67.964 × 77.441) é a **envoltória depois do
  giro**, não o tamanho do elemento (o SVG é 193.15 × 167.74). Usar a
  envoltória como width/height achatava o desenho; o tamanho certo é
  74.987 × 65.121, com left/top compensando o giro fora do centro.

Uma observação de renderização: o Chrome trunca `border-width` para pixel
inteiro, então bordas fracionadas do Figma (3.583 px no card do "Como
participar") saem como 3 px. É comportamento do navegador, não do CSS.

### Componente das etapas do "Como participar"

As três etapas são o mesmo componente (foto em painel, número, título e
texto), em **`--u`** = 1px do Figma. No desktop `--u` vale 1px e encolhe
com a largura quando o card de 1212px deixa de caber; no mobile vale
`0.66146 * --cp`, porque o frame de 360 é o desktop multiplicado por
0.66146, só que em coluna (por isso a seta gira 16° → 106°). O tamanho
de cada foto e o deslocamento do hover são variáveis por etapa
(`--iw/--ih/--cx/--cy/--dx/--dy/--hs` em `.step--1/2/3`), tiradas das
posições do Figma nas duas variantes.

Duas armadilhas de tipografia que custaram medição: o `line-height:
normal` do navegador varia por plataforma e por fonte da linha (a Ultra
do negrito deixava cada linha ~0.9px mais alta), então o texto usa
`1.3825` (desktop) e `1.4286` (mobile) e o `<b>` fica com `line-height:
0`; e o título usa `text-box: trim-both cap alphabetic`, que é como o
Figma mede a altura dele.

### Armadilhas que já custaram um bug

- **`mask-image` não funciona em `file://`.** O Chrome busca máscara em
  modo CORS e bloqueia arquivo local, então o padrão de shapes do KV
  sumia ao abrir o `index.html` direto do disco (e só aparecia via
  servidor). O padrão agora é `background-image` comum, com a cor já no
  SVG (`pattern-shapes.svg` roxo, `pattern-shapes-orange.svg` para o
  Ganhadores e `pattern-shapes-mobile.svg`).
- **`[data-reveal]` mata o hover do próprio elemento.** Enquanto o
  atributo existe, a transição da entrada (opacity + transform) vence a
  do componente, e o `.is-done` a zerava — cards de prêmio, accordions,
  CTAs e itens da faixa passavam a estalar no hover depois de revelados.
  Agora o JS remove o `data-reveal` quando a entrada termina (medido em
  38 elementos: opacidade, transform e posição idênticos antes e depois).
  As camadas do KV (`data-depth`) ficam de fora porque controlam o
  próprio transform.

### Centragem óptica dos números

Os números 1/2/3 do "Como participar" não centram só com
`place-items: center`. Com `line-height: 1` a baseline do Amsi Pro Ultra
cai a **1.002em** do topo da caixa (ascent 1.19 / descent 0.185) e o
dígito só ocupa 0.7188em de caixa-alta, então o desenho nasce **0.1416em
abaixo** do centro — 4,2px num círculo de 50. O `translate` em `em` sobe
o número de volta e vale igual em qualquer breakpoint.

Dois detalhes somam a isso: o giro de 6° entra **depois** do translate,
então balança o dígito 0.1416 × sen 6° = 0.0148em para a esquerda; e o
"1" tem bearing 0 à esquerda contra 0.076em à direita, nascendo 0.0314em
fora do centro do avanço. Daí o `--nudge-x`. Desvio final medido: menos
de 0,5px em qualquer eixo.

### Nota sobre o CTA

O botão do KV diz **"Participe!"** (texto do frame desktop) enquanto o
frame mobile do Figma escreve "CADASTRE-SE!". Deixei um texto só nos dois
para não criar divergência de copy — é decisão de conteúdo, não técnica:
se o certo for o do mobile, basta trocar em `#kv .btn--cta`.
