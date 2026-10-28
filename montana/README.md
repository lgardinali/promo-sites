# Lata do Tesouro · Montana Química

Landing page da promoção **Lata do Tesouro** (Osmocolor), layout **V3** do Figma. HTML, CSS e JavaScript puros, sem dependências.

```
index.html
assets/
  css/style.css      estilos (mobile-first)
  js/main.js         interações e animações
  img/               imagens WebP + SVGs exportados do Figma
  fonts/             Onest (variável, woff2)
  favicon/           favicon.ico, PNGs e apple-touch-icon
.claude/             servidor local de visualização (não vai para a hospedagem)
```

## Visualizar

Sirva a pasta com qualquer servidor estático (ex.: extensão *Live Server* do VS Code, ou `node .claude/dev-server.js . 5173`). Abrir o `index.html` direto do disco funciona, mas alguns navegadores bloqueiam a fonte nesse modo.

## O que falta preencher

| Onde | O quê |
|---|---|
| `assets/js/main.js` → `CONFIG.links.cadastro` | URL do cadastro (todos os "Participe já!" e "Cadastre-se") |
| `assets/js/main.js` → `CONFIG.links.regulamento` | URL/PDF do regulamento (abre em nova aba) |
| `index.html` → seção `#duvidas` | Respostas das 12 perguntas (placeholders "Lorem ipsum") |
| `index.html` → `.winners__list` | Ganhadores — um `<li class="winner">` por pessoa. A busca lê a lista na hora, inclusive se vier de CMS/API |
| `index.html` → `.footer__legal` | Texto legal do rodapé: datas da participação (`xx/xx/2026 a xx/xx/202x`) e nº do certificado SPA/ME |
| `index.html` → `og:image` | Trocar por URL absoluta de uma imagem 1200×630 (JPG/PNG) quando houver domínio |

Enquanto uma URL estiver como `'#'`, o botão correspondente não navega.

## Breakpoints

| Faixa | Layout (frame do Figma) |
|---|---|
| < 700px | Mobile V3 (360) |
| 700 – 1279px | Tablet V3 (800) |
| ≥ 1280px | Desktop V3 (1920) · Ultrawide V3 (2560) mantém o conteúdo em 1520px |

- O KV usa a composição desktop também em telas ≥ 1024px em **paisagem**.
- Medidas do KV = valores do Figma × `--u`, então posição e proporção se mantêm em qualquer largura. No desktop, `--u` considera largura **e** altura da janela para o KV caber na primeira dobra (em 1920×1080 fica idêntico ao layout). Para escalar só pela largura, troque o `min(...)` por `calc(100vw / 1920)` na regra `.hero` do bloco desktop.
- Ilustração dos cards (círculo, brilho, produto) e dos Prêmios: medidas do Figma × `--s` / `--ps` por breakpoint.

### Fundo de papel

Um único papel contínuo do KV até o FAQ, com a mesma escala de textura do Figma em cada breakpoint. Cada aparelho baixa só o seu recorte (mobile 284 KB · tablet 516 KB · desktop 1,1 MB). A textura **não** reescala quando a página cresce (ex.: ao abrir o FAQ): se o conteúdo passar da altura da imagem, uma cópia espelhada continua o papel sem emenda.

**Parallax do fundo:** ao rolar, o papel desce a 14% da velocidade da rolagem, então o conteúdo passa "por cima" dele com profundidade. Ajuste em `CONFIG.paperParallax` (`main.js`): `0` desliga, `0.25` fica bem perceptível. Em navegadores com *scroll-driven animations* (Chrome/Edge 115+, Safari 26+) o movimento roda no compositor, colado na rolagem e sem trepidar no touch; nos demais, o JS aplica o deslocamento a cada quadro. Na posição inicial (topo da página) o fundo fica exatamente como no Figma.

## Movimento

- Curva **"Slow" do Figma** (spring mass 1 · stiffness 80 · damping 20) reproduzida com `linear()` → `--ease-slow`; `--ease-out` e `--ease-in-out` são as curvas padrão do Figma. Durações: `--dur-1` 300ms e `--dur-2` 600ms.
- Tudo é animado só com `transform`/`opacity`, com um único `requestAnimationFrame`.
- `prefers-reduced-motion` desliga animações, parallax e rolagem suave.

### Rolagem suave

`CONFIG.smoothScroll` em `main.js`:

- `'override'` (padrão) — na primeira "clicada" da roda, mede se o navegador já suaviza a rolagem (resultado em `<html data-native-smooth>`). A partir daí a roda é suavizada só pela página (a nativa é cancelada), então as duas nunca se somam.
- `'respect'` — se o navegador já tiver rolagem suave, mantém a dele; senão, usa a da página.
- `'off'` — desliga.

Velocidade: `wheelStep` (padrão `70` px por clique — o evento é normalizado em "cliques", então não muda com escala de tela ou "linhas por clique" do sistema), `wheelMaxLead` (quanto o alvo pode se adiantar) e `smoothLerp` (suavidade). Trackpad, touch, teclado e barra de rolagem continuam nativos.

### Movimento sem "escada"

Chrome e Firefox arredondam para o pixel inteiro a posição de camadas cujo transform é só uma translação 2D; em movimentos lentos (parallax, cursor, flutuação, zoom) X e Y mudam de pixel em quadros diferentes e a camada anda em degraus. As camadas de imagem em movimento contínuo recebem `rotate: .02deg` + `will-change: transform` (rotação imperceptível que tira o arredondamento — a GPU posiciona com precisão subpixel). Botões magnéticos recebem o mesmo só enquanto seguem o cursor. Durante a rolagem suave, o parallax é aplicado no mesmo quadro da rolagem.

## Imagens

Convertidas para WebP sem reduzir abaixo do tamanho exibido.

O **carrinho** do card "Compre Osmocolor" (`carrinho.webp`, 564×542) vem da foto original em alta enviada pelo cliente — a do Figma tem só 176×169px. Para trocar por outra versão sem mexer no código, mantenha o nome e a proporção ≈ 1,04 (largura/altura), com o carrinho ocupando o quadro do mesmo jeito.
