'use strict';
const assert=require('node:assert/strict');
const e=require('../engine.js');
const base={ug:'120052',year:'2026',dhType:'FL',emissionDate:'2026-10-28',dueDate:'2026-10-28',attestDate:'2026-10-28',payDate:'2026-10-28',payUg:'120052',creditor:'120052',description:'TESTE',process:'TESTE/2026',docNumber:'FOPAG.TESTE',docIssuer:'120052',empeUg:'120052',cc:'221A00',month:'10',ccYear:'2026',benefUg:'120052',siorg:'2332',ob:'OBF',favAccount:'FOPAG',payBank:'002',payAccount:'UNICA',layout:'DH001',headerUg:'120052',generationDate:'2026-10-28',sequence:'1',headerYear:'2026',cpf:'12345678901',others:''};
function run(pco,amount,extra={}){return e.dh({...base,pco,payments:`00000000000191 001 1607 TESTE ${amount}`,...extra});}
const pco=n=>Array.from({length:n},()=>`2026NE000001 01 DFL001 311110100 100,00`).join('\n');
let r=run(pco(50),'5.000,00');assert.equal(r.metrics.details,1);assert.equal(r.metrics.accountingLines,100);
r=run(pco(51),'5.100,00');assert.deepEqual(r.detailsSummary.map(d=>d.accountingLines),[100,2]);
r=run(pco(205),'20.500,00');assert.deepEqual(r.detailsSummary.map(d=>d.accountingLines),[100,100,100,100,10]);
const mixed=[];for(let i=1;i<=26;i++){mixed.push(`2026NE${String(i).padStart(6,'0')} 01 DFL001 311110100 100,00`);if(i<=13)mixed.push(`2026NE${String(i).padStart(6,'0')} 01 AFL001 311110100 -10,00`);}
r=run(mixed.join('\n'),'2.470,00');assert.equal(r.metrics.accountingLines,104);assert.equal(r.metrics.details,2);assert.ok(r.detailsSummary.every(d=>d.accountingLines<=100));assert.equal(r.metrics.total,247000n);
assert.throws(()=>run('2026NE000001 01 XYZ001 311110100 1,00','1,00'),/Não há quantidade/);
r=run('2026NE000001 01 XYZ001 311110100 1,00','1,00',{accountingWeights:'XYZ001=7'});assert.equal(r.metrics.accountingLines,7);
assert.throws(()=>run(pco(1),'100,00',{accountingWeights:'DFL001=1'}),/regra fixa/);
const others=['PRV001 311110101 211110101 31901137 N 1,00','PRV002 311110101 211110101 31901137 N 1,00','PRV003 311110101 211110101 31901137 N 1,00','LPA385 311110101 211110101 31901137 N 1,00'].join('\n');
const weights='PRV001=2, PRV002=2, PRV003=2, LPA385=2';
r=run(pco(1),'100,00',{others,accountingWeights:weights});assert.equal(r.metrics.accountingLines,10);
assert.throws(()=>run(pco(50),'5.000,00',{others,accountingWeights:weights}),/lotes completos/);
const isolated=pco(51)+'\n2026NE999999 02 AFL001 311110100 -1,00';assert.throws(()=>run(isolated,'5.099,00'),/excedem seus itens positivos/);
r=run('2026NE000001 01 DFL034 113110105 100,00\n2026NE000002 02 DFL038 113110105 100,00\n2026NE000003 33900802 DFL041 113110105 100,00','300,00');
assert.equal(r.rows[0].account,'218910100');assert.equal(r.rows[1].account,'211310100');assert.equal(r.rows[2].account,'—');assert.equal(r.rows[2].cc,'992300');
console.log('OK: limites 100/102, 205 itens, peso AFL, agrupamento de anulações, outras situações e classificações preservadas.');
