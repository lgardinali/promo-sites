/* ==========================================================================
   GANHADORES — dados da campanha
   --------------------------------------------------------------------------
   Como funciona a exibição (automática):
   • Um mês é considerado "premiado" quando tem ganhadores cadastrados abaixo.
   • Todos os meses premiados são exibidos (com a lista de ganhadores).
   • O PRIMEIRO mês ainda sem ganhadores é exibido com a contagem regressiva
     até a data de apuração ("apuracao").
   • Os meses seguintes ficam ocultos até o mês anterior ser premiado.
   → No início da campanha, só aparece o "Mês 01" com contagem regressiva.
   → Ao publicar os ganhadores do Mês 01, o Mês 02 aparece com a contagem, etc.

   Para publicar ganhadores, basta preencher o array "ganhadores" do mês:
     { nome: 'Nome Do Ganhador', cpf: '123.***.***-00', premio: '600 m² de grama Esmeralda' }

   Datas de apuração: formato ISO com fuso de Brasília (-03:00).
   ⚠ As datas abaixo são PROVISÓRIAS — substitua pelas datas do regulamento.

   Pré-visualização do layout com ganhadores fictícios (igual ao Figma):
   abra a página com  ?preview=ganhadores  no final da URL.
   ========================================================================== */
window.ITOGRASS_GANHADORES = {
  // 'asc' = Mês 01 no topo (como no Figma) | 'desc' = mês mais recente no topo
  ordem: 'asc',
  meses: [
    { mes: 1,  apuracao: '2026-11-10T15:00:00-03:00', ganhadores: [] },
    { mes: 2,  apuracao: '2026-12-10T15:00:00-03:00', ganhadores: [] },
    { mes: 3,  apuracao: '2027-01-11T15:00:00-03:00', ganhadores: [] },
    { mes: 4,  apuracao: '2027-02-10T15:00:00-03:00', ganhadores: [] },
    { mes: 5,  apuracao: '2027-03-10T15:00:00-03:00', ganhadores: [] },
    { mes: 6,  apuracao: '2027-04-12T15:00:00-03:00', ganhadores: [] },
    { mes: 7,  apuracao: '2027-05-10T15:00:00-03:00', ganhadores: [] },
    { mes: 8,  apuracao: '2027-06-10T15:00:00-03:00', ganhadores: [] },
    { mes: 9,  apuracao: '2027-07-12T15:00:00-03:00', ganhadores: [] },
    { mes: 10, apuracao: '2027-08-10T15:00:00-03:00', ganhadores: [] },
    { mes: 11, apuracao: '2027-09-10T15:00:00-03:00', ganhadores: [] },
    { mes: 12, apuracao: '2027-10-11T15:00:00-03:00', ganhadores: [] }
  ]
};
