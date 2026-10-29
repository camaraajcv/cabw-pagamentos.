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
console.log("OK: leitura SIAPE, totais, exclusões, bancos, XML DH001/DH002 e validações.");
