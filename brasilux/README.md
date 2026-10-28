# Pintou Presente Brasilux — landing page

Página da promoção construída a partir do Figma
[BRASILUX](https://www.figma.com/design/OBvBLVLV7vdwIY3SNI0COT/BRASILUX?node-id=44-461)
(frames `DESKTOP 44:461`, `MOBILE 47:987` e a seção `COMPONENTES 84:493`).

HTML, CSS e JavaScript puros — **não há build**. Basta servir a pasta.

```bash
npx http-server . -p 4173 -c-1
```

---

## Estrutura

```
index.html            markup das 7 seções
css/
  fonts.css           @font-face das fontes auto-hospedadas
  base.css            tokens (:root), reset, tipografia, blobs, grão, reveal
  components.css      botão, logo, hambúrguer, busca, carrossel, sociais, topo
  sections.css        menu, KV, como participar, prêmios, dúvidas, ganhadores, rodapé + responsivo
js/
  data.js             CONTEÚDO — prêmios, FAQ, ganhadores, menu e rodapé
  render.js           monta o DOM a partir do data.js
  carousel.js         carrossel coverflow (setas, arraste, teclado, loop)
  faq.js              acordeão + busca
  motion.js           Lenis + GSAP: reveals, parallax, KV, timeline, contadores
  main.js             menu, âncoras, scrollspy, luz dos cards, voltar ao topo
vendor/               gsap, ScrollTrigger e lenis (locais, sem CDN em runtime)
assets/               imagens, ícones e fontes exportados do Figma
```

## Trocar o conteúdo

Tudo que muda de campanha para campanha está em [`js/data.js`](js/data.js):
`PRIZES`, `SELLER_PRIZES`, `STORE_PRIZES`, `PRIZES_LEGAL`, `FAQ`, `WINNERS`,
`NAV` e `FOOTER`. A página é renderizada a partir desses arrays — para plugar
numa API depois, basta substituí-los pelo retorno do endpoint antes de
`render.js` rodar. As datas e o número do certificado SPA entram em
`PRIZES_LEGAL` e em `FOOTER.legal`.

No carrossel, `featured: true` marca o item que abre no centro, `scale` faz o
ajuste fino de enquadramento e `bleed` diz quanto da arte fica **além** do
quadro. As artes de estúdio trazem um reflexo longo: em vez de recortá-lo (o
que deixaria uma borda dura), a imagem é ancorada pelo topo e o reflexo escorre
para fora da caixa, desaparecendo sozinho. `bleed: 1` mantém a arte inteira
dentro do quadro.

## Design tokens

Definidos em `:root` ([`css/base.css`](css/base.css)). Os principais:

| Token | Valor | Onde aparece |
|---|---|---|
| `--lime` / `--lime-2` | `#BCFF00` / `#BFFC03` | botões, destaques, badges, seleção de texto |
| `--lime-ink` | `#005822` | texto sobre lime |
| `--lime-border` / `--lime-hover` / `--lime-active` | `#EBFFB3` / `#DCFF78` / `#F4FFD3` | contorno do botão e o início do degradê em hover e clique (`54:1410`) |
| `--navy-950 / 900 / 700` | `#021539` / `#022458` / `#044EBE` | fundo e gradientes |
| `--surface` | `rgba(2, 36, 88, .7)` | fundo dos cards (prêmios, busca, acordeão, ganhadores) — o `#022458` a 70%, para o fundo animado aparecer por trás |
| `--border-navy` / `--border-blue` | `#0D4497` / `#1F73F0` | bordas normal / hover |
| `--text-muted` | `#A9C4DC` | textos de apoio |

Tipografia: **Sora** 400/600/700/800 e **Inter** 700 (só os numerais `01 02 03`),
auto-hospedadas em `assets/fonts` — nenhuma requisição sai para o Google.

## Movimento

O arquivo Figma não expõe as curvas do protótipo pelo MCP, então as molas
nativas descritas no briefing foram convertidas para equivalentes em CSS/GSAP:

| Figma | CSS | GSAP | Uso |
|---|---|---|---|
| mola *Slow* | `--ease-slow: cubic-bezier(.22,1,.36,1)` | `power4.out` | padrão de quase tudo |
| mola *Bouncy* | `--ease-bouncy: cubic-bezier(.34,1.56,.64,1)` | `back.out(1.7)` | logo do menu, selo, dots, ícones sociais |

Durações: `--dur-fast: 300ms` e `--dur-slow: 600ms`.

### Scroll suave

Desligado por padrão. A constante `SMOOTH_SCROLL` no topo de
[`js/motion.js`](js/motion.js) liga a inércia do Lenis de volta em uma palavra.
Ele reescreve a posição do scroll a cada quadro — barato no Chromium, caro no
Firefox — e o scroll nativo do Firefox já é suave. Com ele desligado nada mais
muda: o parallax e os reveals continuam pelo ScrollTrigger (que interpola
sozinho via `scrub`) e as âncoras usam o `scroll-behavior: smooth` do CSS.

### Convenções

Três atributos cobrem quase toda a animação da página:

```html
<div data-reveal="up">           <!-- up | left | mask -->
<div data-reveal-delay="0.12">   <!-- atraso em segundos -->
<div data-parallax="0.2">        <!-- fator de deslocamento no scroll -->
<div data-mouse="12">            <!-- deslocamento máximo em px seguindo o cursor -->
```

`data-reveal="mask"` espera linhas em `.mask-line > span` — a linha sobe de
dentro de um recorte, com stagger.

Ao terminar a entrada, `motion.js` marca o elemento com `.is-revealed` e só
então apaga os estilos inline. É o que garante que o estado inicial do CSS não
volte a valer no fim da animação (o elemento saltaria de volta e passaria a
ocupar o lugar errado) e que os hovers, que também usam `transform`, não
briguem com o inline do GSAP.

### Detalhes por seção

- **Menu** — altura fixa; ao rolar 80px a barra só ganha sombra. A logo é a
  pilha de cartões que abre em leque no hover (`8.88°→23.15°`, mola *bouncy*) e
  fica colada no topo da barra em qualquer resolução; scrollspy marca a seção
  visível. Abaixo de 1024px vira painel, com o hambúrguer à direita e o botão
  de login dentro do painel.
- **KV** — camadas separadas com parallax de scroll e de mouse. Os prêmios vêm
  em dois planos (`.kv__premios` e `.kv__motos`) para que o parallax mantenha um
  na frente do outro; cada plano carrega a própria arte **e os próprios
  brilhos**, então as luzes nunca escorregam de cima dos produtos. Os quatro
  brilhos (dois faróis, a luz da JBL e o flash do celular) são
  `radial-gradient` em `mix-blend-mode: screen`, cada um com um piscar
  diferente. A logo da campanha dá zoom de ±5% em 5,5s por sentido e as latas
  flutuam 5px — ambas animam a imagem interna, enquanto o wrapper leva o
  transform do parallax, para as duas coisas não brigarem pela mesma
  propriedade. Renata e o selo levam `data-clamp="no-up"`: encostam nas bordas
  do frame, então o parallax só pode empurrá-los para dentro. Todo o palco é um
  *container query* (`cqw`), então fontes, paddings e raios escalam junto.
- **Prêmios** — carrossel coverflow com loop infinito. A posição de cada item é
  função contínua da distância até o centro (escala `0.6^n`, passo `0.83 × largura`),
  o que faz o arraste usar a mesma fórmula do snap. Setas, arraste, swipe,
  teclas ←/→ e clique num item lateral.
- **Dúvidas** — busca sem acentuação com realce, e acordeão que anima a altura
  automática por `grid-template-rows: 0fr → 1fr`.
- **Ganhadores** — o trilho da timeline se desenha conforme o scroll e cada
  marcador acende quando a linha o alcança.
- **Fundo** — um plano (`.aurora`) do tamanho do documento inteiro, não da tela:
  as luzes ficam paradas na página e quem passa por elas é o leitor. Quatro
  manchas azuis largas (quase a largura da tela, um terço da altura da página
  cada), com as alturas maiores que o passo entre elas para haver sobreposição
  de ponta a ponta. Cada mancha é a soma de três elipses descentralizadas — a
  união não tem eixo de simetria, então ao girar ela se deforma como uma mancha
  e nunca revela um contorno de círculo. Os centros ficam próximos e as
  opacidades baixas de propósito: afastados demais, os três lóbulos aparecem
  separados e o fundo fica empelotado em vez de difuso. Nada de `filter:
  blur()` — a queda do gradiente já dá o visual e só `transform` é animado,
  então o trabalho fica todo na GPU. O grão que elimina o banding vive dentro
  desse mesmo plano.

  A altura do plano é escrita por [`js/main.js`](js/main.js) numa variável
  (`--aurora-h`), e não herdada do conteúdo. É proposital: as luzes têm altura
  em % do plano, então deixá-lo acompanhar a página faria o acordeão — que
  anima a altura do documento — redimensionar e re-rasterizar os quatro
  gradientes 60 vezes por segundo. A medida é refeita com debounce (no resize,
  num `ResizeObserver` e no `transitionend` do acordeão), uma vez só, depois
  que o movimento termina.

  Detalhe que vale lembrar em qualquer degradê radial deste projeto: sem
  `closest-side`, o CSS usa `farthest-corner` e a cor só chega a zero no canto
  da caixa — na borda do círculo ainda sobram ~29% de opacidade, que aparecem
  como um anel recortado.

### Movimento reduzido

Com `prefers-reduced-motion: reduce` a classe `has-motion` nunca é aplicada:
`motion.js` sai antes de criar o Lenis e qualquer tween, e os estados iniciais
escondidos (reveals, marcadores, trilho) não chegam a existir. Um script de
segurança no fim do `index.html` também libera o conteúdo caso `motion.js`
falhe ao carregar.

## Assets

Exportados do servidor local do Figma (`localhost:3845`) e commitados em
`assets/`. O fundo do KV foi convertido para JPEG (2183 KB → 93 KB) e as artes
de motos e da logo foram recortadas para o enquadramento usado no design. As
artes de produto ficam inteiras — o reflexo longo é resolvido pelo `bleed` do
`data.js`, não por recorte.

O `smartphone.png` é a arte de menor resolução do arquivo (98×302 px) e no
carrossel aparece a cerca de 1,7× do tamanho nativo. Se houver uma versão maior
disponível, vale substituir o arquivo — o resto do código não muda.
