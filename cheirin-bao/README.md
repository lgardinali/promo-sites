# Natal Premiado Cheirin Bão — site da promoção

HTML/CSS/JS puros, sem dependências nem build. Basta publicar a pasta.

## Páginas
| Arquivo | Conteúdo |
|---|---|
| `index.html` | Home (KV, Como participar, Prêmio, Consulta de números, Lojas) |
| `como-participar.html` | Passo a passo + **Regulamento completo** (`#regulamento`) |
| `premio.html` | Prêmio |
| `duvidas-frequentes.html` | FAQ em acordeão |
| `lojas-participantes.html` | Mapa + busca por cidade |
| `ganhadores.html` | Ganhadores (mensagem "em breve") |
| `cadastro.html` | Formulário de cadastro |

## Pontos de integração pendentes
- **Regulamento:** `como-participar.html` → `.rules__doc` (texto ou `<iframe>` do PDF).
- **Ganhadores:** `ganhadores.html` → comentário dentro de `.winners__inner`.
- **Cadastro:** o formulário valida (CPF, maioridade, máscaras) e dispara o evento
  `cadastro:enviar` com os dados em `event.detail`. Ligue ao back-end ali.
- **Busca de lojas:** dispara `lojas:buscar` com `{ cidade }`.
- **"Consulte seus números da sorte":** aponta para `cadastro.html` até existir a área de membros.
- **Documentos do rodapé** (Política, Termos, Certificado): links `#`.
- **Open Graph:** troque `og:url`/`og:image` por URLs absolutas do domínio final.
- **Instagram:** `https://www.instagram.com/cheirinbao/` — confirmar o perfil.
- **Fonte "Bebas Neue Book"** (títulos Regulamento/Cadastro): não existe no Google Fonts;
  hoje cai para o Bebas Neue regular. Para usar a Book, adicione o `@font-face` com o arquivo licenciado.

## Movimento
- Curvas: `--ease-slow` (spring "Slow" do Figma via `linear()`) e `--ease-out`; durações 300/600ms.
- Um único `requestAnimationFrame` (`assets/js/main.js`) para paralaxe, botões magnéticos,
  barra de progresso e rolagem suave. Loops decorativos (flutuar/zoom) são keyframes CSS
  que só rodam com o elemento visível (`.is-live`).
- Rolagem suave só atua em roda de mouse "dentada"; trackpad/touch ficam no nativo.
- `prefers-reduced-motion: reduce` desliga tudo e mantém os elementos na posição final.

## Transição entre páginas
- View Transitions entre documentos (Chrome/Edge/Safari recentes): o **header** fica fixo e o
  **banner interno** também, quando está ao menos metade visível na página de origem e de destino
  (se a página estava rolada, ele só desliza de volta ao lugar). O resto faz um crossfade de 380ms
  e o conteúdo novo entra com as revelações de scroll.
- `assets/js/head.js` (síncrono no `<head>`) decide o que é compartilhado nos eventos
  `pageswap`/`pagereveal` e define `--clock`, que mantém os loops (zoom/flutuar) na mesma fase
  entre páginas.
- Sem suporte (ex.: Firefox): `main.js` faz um fade de 260ms do conteúdo antes de navegar,
  mantendo header e banner.
