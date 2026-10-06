import monthly from './accounts-data.json';
export const reports=monthly;
export const reportMonths=Object.keys(reports).sort().reverse();
export const latestReportMonth=reportMonths[0];
export const accountSections=[
 {id:'summary',label:'Resumo do mês'},
 {id:'balances',label:'Disponibilidades e DCF'},
 {id:'movements',label:'Movimentos bancários'},
 {id:'investments',label:'Aplicações e rendimentos'},
 {id:'reconciliation',label:'Conciliação e trânsito'},
 {id:'guarantees',label:'Garantias contratuais'},
 {id:'receipts',label:'Receitas por GRU'},
 {id:'times',label:'Tempos médios'},
 {id:'sources',label:'Fontes e observações'}
];
export const monthNames=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export const timing=[
 {name:'Obtenção / compra',values:[0,50,49,37,60,99,75,100,108],annual:76},
 {name:'Entrega',values:[58,110,100,119,123,75,98,100,70],annual:95},
 {name:'Armazenagem / embarque',values:[22,17,31,28,5,28,18,32,14],annual:27},
 {name:'Transporte',values:[15,18,7,21,15,29,17,20,25],annual:16},
 {name:'Compra total',values:[95,195,187,205,203,231,208,252,217],annual:214},
 {name:'Pagamento',values:[4,5,4,2,3,2,3,4,4],annual:3}
];
