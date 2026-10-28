# Persipisos — Landing da campanha "Você de carro 0km é na Persipisos"

Página estática em **HTML + CSS + JavaScript puro**, sem nenhuma dependência de runtime
(sem framework, sem biblioteca de animação, sem build step). Basta servir a pasta.

---

## Como rodar

Qualquer servidor estático serve. Exemplos:

```bash
npx serve -l 5177 .
```

```bash
python -m http.server 5177
```

Depois abra `http://localhost:5177`.

> Abrir o `index.html` direto pelo `file://` funciona, mas o `site.webmanifest`
> e alguns recursos podem ser bloqueados pelo navegador. Prefira um servidor.

---

## Estrutura

```
.
├── index.html              Marcação de todas as 7 sessões
├── site.webmanifest        Ícones/nome para instalação como PWA
├── assets/
│   ├── css/styles.css      Estilos (comentado e numerado por sessão)
│   ├── js/main.js          Interações (comentado e numerado por bloco)
│   ├── img/                Imagens em WebP + favicons
│   └── icons/              Ícones SVG exportados do Figma
└── .claude/launch.json     Config opcional do servidor de preview
```

---

## Fidelidade ao Figma

| Arquivo | Nó | Situação |
|---|---|---|
| DESKTOP | `36:376` (1920 × 5429) | Reproduzido 1:1 em 1920px |
| DESKTOP ULTRAWIDE | `27:137` (2560) | Composição trava em 1920 e o fundo se estende |
| MOBILE | `1:488` (360 × 5699) | Reproduzido 1:1 em 360px |
| FAVICON | `1:910` | Exportado em 16/32/180/192/512 |

### Sistema de escala do KV

O hero é a única sessão com posicionamento absoluto, então usa um "pixel de prancheta":

```css
.kv { --u: min(1px, 100vw / 1920); }   /* desktop  */
.kv { --u: min(100vw / 360, 1.25px); } /* ≤1023px  */
```

Cada elemento declara `--x / --y / --w / --h` em unidades da prancheta do Figma e a
regra genérica `.kv__item` multiplica por `--u`. Resultado medido:

| Viewport | Altura do KV | Observação |
|---|---|---|
| 360px | 929px | idêntico ao Figma mobile |
| 1024px | 604px | composição desktop proporcional |
| 1920px | 1132px | idêntico ao Figma desktop |
| 2560px | 1132px | ultrawide: composição fixa, fundo estendido |

> `min()` só compara valores do mesmo tipo — por isso a razão é expressa como
> comprimento (`min(1px, 100vw/1920)`) e não como número puro.

### Card de prêmio

As proporções internas do card são idênticas nas duas pranchetas do Figma
(ex.: o nome é `39.738/519.846` = `22.787/298.095` = 7,645% da largura do card).
Por isso ele é medido em `cqw` sobre o bloco `.prize`, o que mantém o card fiel em
qualquer viewport e impede que nomes longos ("SHINERAAY 125 2027") quebrem linha.
Medido: **463 × 215px** no desktop e **298 × 125px** no mobile (Figma: 298,1 × 125,0).

---

## Interações e animações

Durações e curvas seguem o padrão do Figma: **300ms** e **600ms**, com `ease-out`
(`cubic-bezier(0, 0, 0.58, 1)`). Tokens em `--t-fast`, `--t-slow`, `--ease-out`.

### Vindas direto das variantes de componente do Figma

| Elemento | Interação |
|---|---|
| CTA "CADASTRE-SE" | hover: fundo `#f36c21` → `#d04a00` + escala **1.098** (razão exata entre as variantes) |
| Cards "Como participar" | hover: fundo sólido → gradiente `rgba(0,0,0,.44)` → `rgba(102,102,102,.44)` |
| Título do KV | loop de zoom entre **1** e **1.083** (razão entre as variantes 650×306 e 704×331 do componente LOGO) |
| Accordion | seta espelhada no estado aberto, exatamente como as variantes do card de dúvidas |

### Acrescentadas (sugestões de UI)

- **Scroll reveal**: entrada gradual com `IntersectionObserver`, direções e atraso em cascata via `data-reveal` / `data-delay`. Implementado com `animation` (não `transition`) de propósito — ver nota abaixo.
- **KV**: flutuação contínua das etiquetas de prêmio e do selo de condições. A imagem de fundo é estática, exatamente como no Figma.
- **Menu**: hover com brilho na logo, sublinhado que cresce do centro nos links, elevação no botão de login, e link da sessão atual destacado automaticamente (scroll spy).
- **Prêmios**: veículos flutuam em loop, zoom + glow no hover, barrinha que se expande.
- **CTA**: brilho que atravessa o botão no hover.
- **Geral**: barra de progresso de leitura no topo, botão "voltar ao topo", scroll suave, scrollbar na identidade da campanha, header que ganha blur/sombra ao rolar.
- **Mobile**: drawer lateral com entrada escalonada dos itens, foco preso dentro do painel, fecha com `Esc`, backdrop e trava de rolagem.
- **Busca nas dúvidas**: filtra a lista em tempo real, ignora acentos e maiúsculas, com estado vazio.

Tudo respeita `prefers-reduced-motion: reduce` (animações desligadas).

> **Por que o reveal usa `animation` e não `transition`:** `.js .reveal` tem
> especificidade maior que a dos componentes, então uma `transition` declarada ali
> sobrescreve a transição de hover do próprio componente — o hover passa a trocar
> de estado instantaneamente. Animação one-shot para a entrada e `transition` para
> estados de hover convivem sem colidir. Se for adicionar novos efeitos de entrada,
> mantenha esse padrão.

---

## Acessibilidade

- HTML semântico (`header`, `nav`, `main`, `section`, `footer`, `h1`–`h3`).
- Accordion com `aria-expanded` / `aria-controls` / `role="region"`.
- Drawer com foco preso, `Esc` para fechar e devolução do foco ao gatilho.
- Skip link, `:focus-visible` visível em tudo, `alt` descritivo nas imagens de conteúdo e `alt=""` nas decorativas.
- Sem JavaScript a página continua legível: os estados iniciais do scroll reveal só são aplicados quando a classe `js` está presente.

---

## Imagens

Todos os rasters foram convertidos para **WebP** mantendo as dimensões originais
(nenhuma imagem foi reduzida abaixo do tamanho usado em qualquer viewport):

**15,08 MB → 1,05 MB** (−93%)

| Arquivo | Dimensões | Antes | Depois |
|---|---|---|---|
| `kv-bg-desktop.webp` | 4096 × 939 | 4870 KB | 125 KB |
| `kv-bg-mobile.webp` | 841 × 1870 | 1784 KB | 107 KB |
| `premio-moto.webp` | 1536 × 1024 | 2101 KB | 219 KB |
| `premio-carro.webp` | 1536 × 1024 | 1736 KB | 148 KB |
| `kv-titulo.webp` | 1157 × 544 | 317 KB | 130 KB |
| `etapas-bg-desktop.webp` | 3752 × 817 | 1241 KB | 37 KB |
| … | | | |

### Degradê da base da hero

O PNG exportado do Figma tinha um defeito: o alfa subia linearmente até **0,965** e
a **última linha caía para 0,125**, abrindo uma fresta translúcida por onde a imagem
de fundo vazava — a "linha" visível na base da hero. Sendo raster, `object-fit`
também podia recortar justamente a faixa opaca.

Foi substituído por um gradiente CSS em `.kv__fade`, ancorado em `bottom: 0`:

```css
background: linear-gradient(to bottom, rgba(33, 37, 42, 0) 0%, var(--c-kv) 100%);
```

A cor é a mesma amostrada do arquivo original (`rgb(33,37,42)` = `#21252a`, o fundo
da hero) e o perfil de alfa do export era linear, então o visual é fiel ao design —
agora com 0% garantido no topo, 100% na base e encosto exato em qualquer viewport
(medido: folga 0,000px em 11 larguras de 320 a 2560). Dispensou dois arquivos.

Desktop e mobile carregam fundos diferentes via `<picture>` + `media`, então cada
viewport baixa só o que usa.

---

## Pontos que merecem atenção

1. **Logo em baixa resolução.** O único arquivo de logo disponível no Figma tem
   **205 × 73px**, mas o rodapé o usa a 224 × 80px — ou seja, ampliado. Ele vai
   parecer levemente suave em telas retina. **Recomendo fornecer a logo em SVG**
   (ou um PNG de pelo menos 672 × 240) e substituir `assets/img/logo-persipisos.webp`.

2. **Ícone da busca invisível no Figma.** No design o ícone de lupa é `#282828`
   sobre um fundo também `#282828`, ficando imperceptível. Foi alinhado à cor do
   placeholder (`#a9c4dc`) para ficar visível. Se a intenção era mesmo escondê-lo,
   é só trocar a cor em `.faq__search-icon`.

3. **Tamanhos de fonte abaixo do legível no mobile.** A pill dos cards de prêmio
   fica em 6,5px no Figma mobile. Foi aplicado um piso de 8px — as proporções
   seguem o design, só o mínimo muda.

   O disclaimer que o Figma coloca dentro do KV mobile foi **removido** a pedido.
   O mesmo texto continua na sessão PRÊMIOS, em ambos os viewports. A altura do
   hero mobile foi mantida em 929 unidades para não alterar o enquadramento do
   fundo nem a posição do degradê.

4. **Faixa 640–1023px.** Nessa largura a página usa a composição mobile ampliada
   (limite de 1.25×), deixando o hero com 1161px de altura. Se preferir um hero mais
   baixo nessa faixa, reduza o teto em `.kv { --u: min(100vw / 360, 1.25px) }`.

5. **Ordem das sessões.** O briefing citou "Sorteios e Ganhadores" antes de
   "Dúvidas Frequentes", mas o Figma traz **Dúvidas → Ganhadores**. Foi seguida a
   ordem do Figma.

---

## Conteúdo provisório

Os textos marcados como placeholder no Figma foram mantidos como estão e devem ser
substituídos depois:

| Onde | O que trocar |
|---|---|
| `.faq__answer` | textos "Lorem ipsum" das 5 dúvidas |
| `.winner__name` / `.winner__draw` | "Nome do ganhador" e "SORTEIO: XX/XX/XXXX" |
| Rodapé | `contato@lorem.com.br`, `0800 000 0000`, datas `DD/MM/AAAA`, certificado `00.000000/2025` |
| `href="#cadastro"` | destino real do fluxo de cadastro (5 CTAs + botão de login) |
| Rodapé / redes | `href="#"` dos links legais e das redes sociais |

**Para adicionar uma dúvida**, copie um bloco `.faq__item` inteiro em `index.html` e
troque os três `id` (`faq-bN` / `faq-pN`) — a busca e o accordion funcionam sozinhos.

---

## Compatibilidade

Chrome/Edge 105+, Firefox 110+, Safari 16+ — exigido pelas *container queries*
usadas no card de prêmio. Navegadores sem suporte recebem automaticamente os
valores em `clamp()` declarados antes do bloco `@supports`, com o mesmo visual e
apenas uma pequena diferença de proporção.
