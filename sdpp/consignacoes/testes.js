/* Testes de regressão do módulo de consignações civis.
 * Executar a partir da raiz do repositório:
 * node sdpp/consignacoes/testes.js
 * Dados inteiramente sintéticos; nunca comitar PDFs financeiros reais.
 */
"use strict";
const assert=require("node:assert/strict");
global.window={};
require("./engine.js");
const {parsePdfLines,generateXml,linesFromItems}=window.SIAPECIVIL;

const sample=[[
"  VALOR  LIQUIDO...........:   1.242,94",
" MES/ANO SOLIC.: OUT2026 - DETALHADA - SERVIDOR",
" 00.000.000/0001-91       BANCO DO BRASIL SA         2      1.000,00",
"34116                    EMPREST BCO OFICIAL - BCO 2           3,53",
"                                                                    3,53",
"001/016071/0000997385650 BRASILIA                          996,47",
" 00.360.305/0001-04        CAIXA ECONOMICA FEDERAL   1         200,00",
"34113                  EMPREST BCO OFICIAL - CEF 1               3,53",
"      PE    3,53",
"104/008630/0006009210271 BRASILIA 196,47",
" 03.658.432/0001-82       GEAP AUTOGESTAO EM SAUDE  1          50,00",
"32623                  GEAP - PER CAPITA PATROCI 0             0,00",
"     DF     0,00",
"001/033073/0000000083488 BRASILIA 50,00"
]];
const pdf=parsePdfLines(sample);
assert.equal(pdf.rows.length,3);
assert.equal(pdf.soma,124294);
assert.equal(pdf.totalExport,119294);
assert.equal(pdf.excluidas.length,1);
assert.equal(pdf.exportaveis.length,2);
assert.equal(pdf.rows[0].ag,"1607");
assert.equal(pdf.rows[1].ag,"0863");
const fields={
  ne:"2026NE000001",sb:"01",fl:"000001",year:"2026",cpf:"12345678901",
  process:"TESTE & CIA",observation:"DESC.EXT.CV",
  dueDate:"2026-11-03",payDate:"2026-11-04",
  sequenceFl:"0001",sequenceDed:"0002",mesCC:"10",anoCC:"2026"
};
const xml=generateXml(pdf,fields);
assert.ok(xml.fl.includes("<vlr>1192.94</vlr>"));
assert.ok(xml.fl.includes("TESTE &amp; CIA"));
assert.ok(xml.deducao.includes("<sb:quantidadeDetalhe>2</sb:quantidadeDetalhe>"));
assert.ok(xml.deducao.includes("<txtCit>120052ECFP310270014</txtCit>"));
assert.ok(xml.deducao.includes("<txtCit>120052ECFPC128910</txtCit>"));
assert.ok(xml.deducao.includes("<agencia>0231</agencia>"));
assert.ok(!xml.deducao.includes("<txtInscrA>03658432000182</txtInscrA>"));
assert.throws(()=>generateXml(pdf,{...fields,ne:"2026NE"}),/Número da NE/);
assert.throws(()=>parsePdfLines([[...sample[0].slice(0,1).map(x=>x.replace("1.242,94","1.242,95")),...sample[0].slice(1)]]),/Conferência bloqueada/);
const lines=linesFromItems([
 {str:"349/000010/0000027214112 40,47",transform:[1,0,0,1,18,100],width:280},
 {str:"27.214.112/0001-00 AL5 S.A. 1 44,00",transform:[1,0,0,1,18,130],width:330}
]);
assert.equal(lines.length,2);
assert.ok(lines[0].startsWith("27.214."));
// O SIAPE permite dígito verificador X na última posição da agência.
for (const agencia of ["03262X", "00183X", "05853X", "03659X"]) {
  const novoPdf=parsePdfLines([[
    "VALOR LIQUIDO...........:   40,47",
    "12.345.678/0001-90    CONSIGNATARIA TESTE   1     44,00",
    "34140       CONTRIB ASSOCIATIVA - TESTE    1     3,53",
    "                                 3,53",
    "001/"+agencia+"/000000000012X CIDADE        40,47"
  ]]);
  assert.equal(novoPdf.total,4047);
  assert.equal(novoPdf.rows[0].agenciaOrig,agencia);
  assert.equal(novoPdf.rows[0].ag,agencia.slice(1,5));
}
assert.throws(()=>parsePdfLines([[
  "VALOR LIQUIDO...........:   40,47",
  "12.345.678/0001-90    CONSIGNATARIA TESTE   1     44,00",
  "34140       CONTRIB ASSOCIATIVA - TESTE    1     3,53",
  "                                 3,53",
  "001/0X2622/000000000012X CIDADE        40,47"
]]),/agência bancária fora do padrão/);


// Seleção flexível: 32623 excluída por padrão, mas pode ser reincluída.
// 34116 pode ser excluída pelo operador, alterando ambos os XMLs.
const {applyRubricExclusions,summarizeRubrics,DEFAULT_EXCLUDED_RUBRICS}=window.SIAPECIVIL;
assert.ok(DEFAULT_EXCLUDED_RUBRICS.includes("32623"));
const summaries=summarizeRubrics(pdf.rows);
assert.equal(summaries.length,3);
assert.equal(summaries.find(r=>r.code==="32623").total,5000);
const allIncluded=applyRubricExclusions(pdf,[]);
assert.equal(allIncluded.totalExport,124294);
assert.equal(allIncluded.excluidas.length,0);
assert.equal(allIncluded.exportaveis.length,3);
const reincXml=generateXml(allIncluded,fields);
assert.ok(reincXml.deducao.includes("<txtInscrA>03658432000182</txtInscrA>"));
assert.ok(reincXml.fl.includes("<vlr>1242.94</vlr>"));
assert.equal(reincXml.quantidade,3);
const custom=applyRubricExclusions(pdf,["32623","34116"]);
assert.equal(custom.totalExcluido,104647);
assert.equal(custom.totalExport,19647);
assert.equal(custom.excluidas.length,2);
assert.equal(custom.exportaveis.length,1);
assert.equal(custom.totalExport+custom.totalExcluido,pdf.total);
const customXml=generateXml(custom,fields);
assert.ok(customXml.fl.includes("<vlr>196.47</vlr>"));
assert.equal(customXml.quantidade,1);
assert.ok(!customXml.deducao.includes("<txtInscrA>00000000000191</txtInscrA>"));
assert.ok(customXml.deducao.includes("<agencia>0231</agencia>"));
const restored=applyRubricExclusions(custom);
assert.equal(restored.totalExport,pdf.totalExport);
assert.equal(restored.exportaveis.length,pdf.exportaveis.length);
assert.equal(pdf.totalExport,119294); // Modelo original permanece inalterado.
assert.throws(()=>applyRubricExclusions(pdf,["99999"]),/não pertence/);
assert.throws(()=>applyRubricExclusions(pdf,["ABC"]),/inválidos/);
assert.throws(()=>generateXml(applyRubricExclusions(pdf,["32623","34113","34116"]),fields),/Não há valor positivo/);
// Inclusões e exclusões preservam o agrupamento por código de rubrica.
const repeated=applyRubricExclusions({...pdf,rows:[...pdf.rows,{...pdf.rows[1]}],total:pdf.total+19647,soma:pdf.soma+19647},["34113"]);
assert.equal(summarizeRubrics(repeated.rows).find(r=>r.code==="34113").count,2);
assert.equal(repeated.excluidas.length,2);
assert.equal(repeated.totalExport+repeated.totalExcluido,repeated.total);


// O PDF de setembro contém relatório ZO com total consolidado e PR com subtotal.
// O subtotal PR já está contido no ZO, portanto jamais deve ser somado novamente.
const multiReportPages=[
  ["L.A54170.ZO - CONSULTA CONSIGNACAO MENSAL",
   "VALOR LIQUIDO...........: 1.242,94",
   ...sample[0].slice(2,10)],
  ["L.A54170.PR - CONSULTA CONSIGNACAO MENSAL",
   "VALOR LIQUIDO...........: 50,00",
   ...sample[0].slice(10)]
];
const mixed=parsePdfLines(multiReportPages);
assert.equal(mixed.total,124294);
assert.equal(mixed.soma,124294);
assert.equal(mixed.rows.length,3);
assert.equal(mixed.auxiliaryTotals.length,1);
assert.equal(mixed.auxiliaryTotals[0].type,"PR");
assert.equal(mixed.auxiliaryTotals[0].value,5000);
assert.equal(mixed.totalExport,119294);
assert.equal(generateXml(mixed,fields).quantidade,2);
assert.throws(
  ()=>parsePdfLines([multiReportPages[0],
    multiReportPages[1].map(line=>line.replace("LIQUIDO...........: 50,00","LIQUIDO...........: 50,01"))]),
  /Subtotal do demonstrativo PR não confere/
);
assert.throws(
  ()=>parsePdfLines([
    [...multiReportPages[0], "VALOR LIQUIDO...........: 1.242,95"],
    multiReportPages[1]]),
  /Totais gerais divergentes/
);
assert.throws(
  ()=>parsePdfLines([multiReportPages[0],
    ["L.A54170.PR - CONSULTA CONSIGNACAO MENSAL",
     "VALOR LIQUIDO...........: 50,00"]]),
  /Subtotal do demonstrativo PR não confere|Conferência bloqueada/
);

console.log("OK: leitura SIAPE, totais, exclusões, bancos, XML DH001/DH002 e validações.");
