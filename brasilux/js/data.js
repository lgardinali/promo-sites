/* ==========================================================================
   Conteudo da pagina.
   Tudo que muda quando a campanha muda vive aqui: trocar um premio, uma
   duvida ou uma lista de ganhadores nao exige mexer no HTML nem no CSS.
   Para plugar numa API depois, basta substituir estes arrays pelo retorno
   do endpoint antes de chamar renderAll().
   ========================================================================== */

const NAV = [
  { id: "home", label: "Home" },
  { id: "como-participar", label: "Como participar" },
  { id: "premios", label: "Prêmios" },
  { id: "duvidas", label: "Dúvidas frequentes" },
  { id: "ganhadores", label: "Ganhadores" },
];

const STEPS = [
  {
    number: "01",
    title: ["Compre produtos", "Brasilux"],
    text: "A cada R$ 300 em compras de produtos Brasilux você garante um número da sorte para concorrer.",
  },
  {
    number: "02",
    title: ["Cadastre sua", "nota fiscal"],
    text: "Acesse a página da promoção e preencha um breve cadastro com os dados da sua compra.",
  },
  {
    number: "03",
    title: ["Concorra", "aos prêmios"],
    text: "Cada número da sorte concorre aos sorteios da campanha. Quanto mais você compra, mais chances de ganhar.",
  },
];

/* qty   -> numero exibido no badge (quantidade sorteada do premio)
   img   -> arte do produto, ja com o reflexo do estudio embutido
   scale -> ajuste fino de enquadramento dentro da caixa do carrossel
   bleed -> quanto a arte passa da caixa para baixo. As artes de estudio
            trazem um reflexo longo: em vez de corta-lo, a imagem escorre
            para fora do quadro. 1 = arte inteira dentro da caixa.         */
const PRIZES = [
  {
    id: "tv",
    qty: 6,
    title: "Smart TVs",
    subtitle: "LG 50” 4K Ultra HD",
    img: "assets/premios/tv.png",
    alt: "Smart TV 50 polegadas 4K",
    scale: 1,
    bleed: 1,
  },
  {
    id: "motos",
    qty: 2,
    title: "Motos 0km",
    subtitle: "Honda CG160 Titan",
    img: "assets/premios/motos.png",
    alt: "Duas motos Honda CG160 Titan vermelhas",
    scale: 1.12,
    bleed: 1,
    featured: true, // item que abre no centro do carrossel
  },
  {
    id: "frigobar",
    qty: 8,
    title: "Frigobares",
    subtitle: "Cervejeira Consul",
    img: "assets/premios/frigobar.png",
    alt: "Cervejeira Consul",
    scale: 1,
    bleed: 1.46,
  },
  {
    id: "caixa-som",
    qty: 6,
    title: "Caixas de som",
    subtitle: "JBL Party Box Encore 2",
    img: "assets/premios/caixa-som.png",
    alt: "Caixa de som JBL Party Box Encore 2",
    scale: 1,
    bleed: 1.43,
  },
  {
    id: "smartphone",
    qty: 6,
    title: "Smartphones",
    subtitle: "Apple iPhone 16 128gb",
    img: "assets/premios/smartphone.png",
    alt: "Smartphone Apple iPhone 16",
    scale: 1,
    bleed: 1.42,
  },
];

/* O valor entra como numero para o count-up; unit/label so decoram. */
const SELLER_PRIZES = [
  { value: 2, unit: "MIL", label: ["Por", "semana"], note: "Voucher toda semana para os vendedores!" },
  { value: 5, unit: "MIL", label: ["No", "final"], note: "Prêmio para vendedor campeão!" },
];

/* Mesmo texto usado no rodape do KV (131:767) e no fim de Premios (97:69) —
   o Figma repete a nota legal nos dois lugares. */
const LEGAL_NOTE =
  "Imagens meramente ilustrativas. A premiação será entregue em cartão de crédito digital pré-pago, com função exclusiva para compras à vista, sem opção de parcelamento, saque e/ou transferência, disponibilizado por meio da carteira digital Polgo Pay. As motocicletas serão entregues fisicamente aos respectivos ganhadores. Consulte o regulamento.";

const FAQ = [
  {
    q: "Lorem ipsum dolor sit amet consectetur adipiscing?",
    a: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam eu turpis molestie, dictum est a, mattis tellus. Sed dignissim, metus nec fringilla accumsan, risus sem sollicitudin lacus.",
  },
  {
    q: "Como faço para cadastrar minha nota fiscal?",
    a: "Acesse a página da promoção, faça login ou crie sua conta e informe os dados da nota fiscal da compra dos produtos Brasilux. O número da sorte é gerado automaticamente após a validação.",
  },
  {
    q: "Quantos números da sorte eu recebo por compra?",
    a: "A cada R$ 300 em produtos Brasilux você recebe 1 número da sorte. Compras maiores geram números proporcionais, sem limite de participação.",
  },
  {
    q: "Quais produtos participam da promoção?",
    a: "Participam todos os produtos da linha Brasilux comercializados nas lojas credenciadas durante o período da campanha. Consulte o regulamento para a lista completa.",
  },
  {
    q: "Quando acontecem os sorteios?",
    a: "Os sorteios ocorrem periodicamente durante a campanha, com base na Loteria Federal. As datas completas estão no regulamento e os resultados aparecem na seção Ganhadores.",
  },
  {
    q: "O vendedor também concorre?",
    a: "Sim. O vendedor concorre a vouchers semanais de R$ 2 mil e, ao final da campanha, a um prêmio de R$ 5 mil. A loja recebe R$ 3 mil em produtos Brasilux.",
  },
  {
    q: "Como recebo meu prêmio se eu for sorteado?",
    a: "Entramos em contato pelos dados informados no cadastro. A premiação em dinheiro é entregue via carteira digital e os prêmios físicos são enviados para o endereço confirmado.",
  },
];

/* Sigla (UF) de cada estado, para o mapa clicavel e para o filtro. */
const UF_NAMES = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

const WINNERS = [
  {
    draw: "Sorteio 01",
    date: "DD/MM/AAAA",
    people: [
      { name: "Nome Do Ganhador", cpf: "###.###.###-##", prize: "Lorem ipsum dolor sit amet", uf: "SP" },
      { name: "Nome Do Ganhador", cpf: "###.###.###-##", prize: "Lorem ipsum dolor sit amet", uf: "RJ" },
    ],
  },
  {
    draw: "Sorteio 02",
    date: "DD/MM/AAAA",
    people: [
      { name: "Nome Do Ganhador", cpf: "###.###.###-##", prize: "Lorem ipsum dolor sit amet", uf: "MG" },
      { name: "Nome Do Ganhador", cpf: "###.###.###-##", prize: "Lorem ipsum dolor sit amet", uf: "BA" },
    ],
  },
  {
    draw: "Sorteio 03",
    date: "DD/MM/AAAA",
    people: [
      { name: "Nome Do Ganhador", cpf: "###.###.###-##", prize: "Lorem ipsum dolor sit amet", uf: "RS" },
      { name: "Nome Do Ganhador", cpf: "###.###.###-##", prize: "Lorem ipsum dolor sit amet", uf: "PR" },
    ],
  },
];

const FOOTER = {
  columns: [
    {
      title: "Sessões",
      links: [
        { label: "Home", href: "#home" },
        { label: "Como Participar", href: "#como-participar" },
        { label: "Prêmios", href: "#premios" },
        { label: "Dúvidas Frequentes", href: "#duvidas" },
        { label: "Ganhadores", href: "#ganhadores" },
      ],
    },
    {
      title: "Legais",
      links: [
        { label: "Política de Privacidade", href: "#" },
        { label: "Termos de Uso", href: "#" },
        { label: "Regulamento", href: "#" },
      ],
    },
    {
      title: "Contato",
      links: [
        { label: "Fale Conosco", href: "#" },
        { label: "contato@lorem.com.br", href: "mailto:contato@lorem.com.br" },
        { label: "0800 000 0000", href: "tel:08000000000" },
      ],
    },
  ],
  social: [
    { name: "Instagram", href: "#", icon: "instagram" },
    { name: "Facebook", href: "#", icon: "facebook" },
    { name: "TikTok", href: "#", icon: "tiktok" },
    { name: "WhatsApp", href: "#", icon: "whatsapp" },
  ],
  legal:
    "Participação válida apenas no período de DD/MM/AAAA a DD/MM/AAAA. Consulte os termos de participação, datas dos sorteios e regulamentos. Imagens meramente ilustrativas. A premiação será entregue em cartão de crédito digital pré-pago, com função exclusiva para compras à vista, sem opção de parcelamento, saque e/ou transferência, disponibilizado por meio da carteira digital Polgo Pay. As motocicletas serão entregues fisicamente aos respectivos ganhadores. Consulte os termos de participação, datas dos sorteios e regulamentos. CERTIFICADO DE AUTORIZAÇÃO SPA/ME Nº 00.000000/2025.",
};
