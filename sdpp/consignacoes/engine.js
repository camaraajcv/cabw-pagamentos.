/* Módulo de consignações civis — execução inteiramente no navegador (GitHub Pages). */
"use strict";
function moneyCents(value) {
  const s=String(value).trim();
  if (!/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(s) && !/^\d+,\d{2}$/.test(s)) throw new Error("Valor monetário SIAPE inválido: "+s);
  const [real, cents]=s.split(",");
  return Number(real.replace(/\./g,""))*100+Number(cents);
}

function brl(cents) { return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100); }

function decimal(cents) { if (!Number.isSafeInteger(cents)) throw new Error("Valor fora do limite de segurança."); return (cents/100).toFixed(2); }

function escapeXml(text) { return String(text??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }

function linesFromItems(items) {
  const groups=[];
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const x=Number(item.transform?.[4]||0), y=Number(item.transform?.[5]||0);
    let row=groups.find(g=>Math.abs(g.y-y)<=1.4);
    if (!row) {row={y,parts:[]};groups.push(row);}
    row.parts.push({x,end:x+Number(item.width||0),str:item.str});
  }
  groups.sort((a,b)=>b.y-a.y);
  return groups.map(g=>{
    const parts=g.parts.sort((a,b)=>a.x-b.x);
    let text="",right=0;
    for (const p of parts) {
      if(text && !/\s$/.test(text) && !/^\s/.test(p.str) && p.x-right>1.4) text+=" ";
      text+=p.str;
      right=Math.max(right,p.end);
    }
    return text.normalize("NFC").trimEnd();
  });
}


const DEFAULT_EXCLUDED_RUBRICS=Object.freeze(["34685","34447","30846","34742","32623"]);

/** Consolida cada rubrica que aparece no PDF, incluindo seus lançamentos e valores. */
function summarizeRubrics(rows) {
  const groups=new Map();
  for(const r of rows) {
    let group=groups.get(r.rubrica);
    if(!group) {
      group={code:r.rubrica,description:r.tipo||"",count:0,total:0};
      groups.set(r.rubrica,group);
    }
    group.count+=1;
    group.total+=r.liquido;
  }
  return [...groups.values()].sort((a,b)=>a.code.localeCompare(b.code));
}

/** Recalcula exclusivamente as rubricas a enviar, mantendo imutável a conferência SIAPE. */
function applyRubricExclusions(report, excludedCodes=DEFAULT_EXCLUDED_RUBRICS) {
  if(!report || !Array.isArray(report.rows) || report.total!==report.soma)
    throw new Error("O relatório SIAPE ainda não foi conciliado.");
  const source=excludedCodes instanceof Set?[...excludedCodes]:excludedCodes;
  if(!Array.isArray(source) || source.some(code=>typeof code!=="string"||!/^\d{5}$/.test(code)))
    throw new Error("A seleção de rubricas possui códigos inválidos.");
  const present=new Set(report.rows.map(r=>r.rubrica));
  for(const code of source) {
    if(!present.has(code) && !DEFAULT_EXCLUDED_RUBRICS.includes(code))
      throw new Error("A rubrica "+code+" não pertence ao relatório importado.");
  }
  const excluded=new Set(source);
  const excluidas=report.rows.filter(r=>excluded.has(r.rubrica));
  const exportaveis=report.rows.filter(r=>!excluded.has(r.rubrica));
  const totalExport=exportaveis.reduce((sum,r)=>sum+r.liquido,0);
  const totalExcluido=excluidas.reduce((sum,r)=>sum+r.liquido,0);
  if(!Number.isSafeInteger(totalExport) || totalExport+totalExcluido!==report.total)
    throw new Error("Falha na conferência das rubricas: valores não conciliados.");
  return {...report,excludedCodes:[...excluded],excluidas,exportaveis,totalExport,totalExcluido};
}

function parsePdfLines(pages) {
  const reCnpj=/^\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+(.+?)\s+([\d.]+)\s+([\d.]+,\d{2})\s*$/;
  const reRub=/^\s*(\d{5})\s+(.+?)\s+([\d.]+)\s+([\d.]+,\d{2})\s*$/;
  const reBank=/^\s*(\d{3})\/([A-Z0-9]+)\/([A-Z0-9]+)\s*(.*?)\s+([\d.]+,\d{2})\s*$/;
  const reStart=/^\s*\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}(?=\s)/;
  let total=null,reference="",paymentMonth="",rows=[];
  for(let pi=0;pi<pages.length;pi++) {
    const lines=pages[pi].map(l=>String(l).normalize("NFC")).filter(l=>l.trim());
    for (const line of lines) {
      const m=line.match(/VALOR\s+L[IÍ]QUIDO[.\s]*:\s*([\d.]+,\d{2})/i);
      if(m) {const n=moneyCents(m[1]); if(total===null)total=n;else if(total!==n)throw new Error("Totais gerais divergentes nas páginas do PDF.");}
      const r=line.match(/M[EÊ]S\/ANO\s+SOLIC\.\s*:\s*([A-Z]{3}\d{4})/i);
      if(r&&!reference)reference=r[1];
      const q=line.match(/M[EÊ]S\s+PAGAMENTO\s*:\s*([A-Z]{3}\d{4})/i);
      if(q&&!paymentMonth)paymentMonth=q[1];
    }
    for(let i=0;i<lines.length;i++) {
      if(!reStart.test(lines[i])) continue;
      const h=lines[i].match(reCnpj);
      const r=lines[i+1]?.match(reRub);
      const ser=lines[i+2]?.match(/([\d.]+,\d{2})\s*$/);
      const bank=lines[i+3]?.match(reBank);
      if(!(h&&r&&ser&&bank))throw new Error(`Página ${pi+1}: lançamento com CNPJ ${lines[i].trim().slice(0,18)} não pôde ser interpretado. Revise o formato do PDF.`);
      const [,,empresa,qtdServ,bruto]=h;
      const [ ,rubrica,tipo,qtdLinha,valorLinha]=r;
      const [ ,bco,agenciaOrig,conta,,liquido]=bank;
      if(!/^\d{5}[\dX]$/.test(agenciaOrig))throw new Error(`Página ${pi+1}: agência bancária fora do padrão (${agenciaOrig}).`);
      const row={cnpj:h[1].replace(/\D/g,""),cnpjFmt:h[1],empresa:empresa.trim(),qtdServ:Number(qtdServ.replace(/\./g,"")),
        bruto:moneyCents(bruto),rubrica,tipo:tipo.trim(),qtdLinha:Number(qtdLinha.replace(/\./g,"")),valorLinha:moneyCents(valorLinha),
        serpro:moneyCents(ser[1]),bco,ag:agenciaOrig.slice(1,5),agenciaOrig,conta,liquido:moneyCents(liquido),pagina:pi+1};
      if(row.bruto-row.serpro!==row.liquido) throw new Error(`Página ${pi+1}, CNPJ ${row.cnpjFmt}: valor líquido não confere com bruto menos SERPRO.`);
      rows.push(row);
    }
  }
  if(total===null)throw new Error("O total geral VALOR LIQUIDO não foi encontrado no relatório SIAPE.");
  if(!rows.length)throw new Error("Nenhuma consignação foi encontrada no relatório PDF.");
  const soma=rows.reduce((s,r)=>s+r.liquido,0);
  if(!Number.isSafeInteger(soma)||total!==soma) throw new Error(`Conferência bloqueada: total SIAPE ${brl(total)}, registros ${brl(soma)}. Diferença ${brl(soma-total)}.`);
  return applyRubricExclusions({rows,total,soma,reference,paymentMonth,pages:pages.length});
}

function generateXml(report, fields) {
  if(!report||!report.rows||report.total!==report.soma)throw new Error("O relatório não foi conciliado com o SIAPE.");
  // Recalcula os XMLs a partir da seleção vigente, sem confiar em totais antigos.
  report=applyRubricExclusions(report,report.excludedCodes??DEFAULT_EXCLUDED_RUBRICS);
  const f={...fields};
  if(!/^\d{4}NE\d{6}$/.test(f.ne||""))throw new Error("Número da NE: informe 12 caracteres, por exemplo 2026NE000001.");
  if(!/^\d{1,2}$/.test(f.sb||""))throw new Error("Subelemento: informe 1 ou 2 dígitos.");
  if(!/^\d{1,6}$/.test(f.fl||""))throw new Error("Número da FL: informe até 6 dígitos.");
  if(!/^\d{4}$/.test(f.year||"")||f.ne.slice(0,4)!==f.year)throw new Error("Ano da NE e ano de referência precisam coincidir.");
  if(!/^\d{1,4}$/.test(f.sequenceFl||"")||!/^\d{1,4}$/.test(f.sequenceDed||""))throw new Error("Informe os dois sequenciais de geração (até 4 dígitos).");
  if(!/^\d{11}$/.test(f.cpf||""))throw new Error("CPF do responsável deve ter 11 dígitos.");
  for(const k of ["dueDate","payDate"]) {if(!/^\d{4}-\d{2}-\d{2}$/.test(f[k]||"")||Number.isNaN(new Date(f[k]+"T00:00:00").getTime()))throw new Error(`Data inválida: ${k}.`);}
  if(!/^(0?[1-9]|1[0-2])$/.test(f.mesCC||"")||!/^\d{4}$/.test(f.anoCC||""))throw new Error("Competência do centro de custos inválida.");
  if(!f.observation?.trim()||!f.process?.trim())throw new Error("Preencha a observação e o processo.");
  if(!report.exportaveis.length||report.totalExport<=0)throw new Error("Não há valor positivo a exportar após as exclusões.");
  const date=new Date(),dateIso=[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-"),
    dateBR=dateIso.split("-").reverse().join("/");
  const x=escapeXml, val=decimal(report.totalExport);
  const header=(layout,seq)=>`<sb:header><sb:codigoLayout>${layout}</sb:codigoLayout><sb:dataGeracao>${dateBR}</sb:dataGeracao><sb:sequencialGeracao>${x(seq)}</sb:sequencialGeracao><sb:anoReferencia>${x(f.year)}</sb:anoReferencia><sb:ugResponsavel>120052</sb:ugResponsavel><sb:cpfResponsavel>${x(f.cpf)}</sb:cpfResponsavel></sb:header>`;
  const first=`<?xml version="1.0" encoding="UTF-8"?>
<sb:arquivo xmlns:ns2="http://services.docHabil.cpr.siafi.tesouro.fazenda.gov.br/" xmlns:sb="http://www.tesouro.gov.br/siafi/submissao">
${header("DH001",f.sequenceFl)}
<sb:detalhes><sb:detalhe><ns2:CprDhCadastrar>
<codUgEmit>120052</codUgEmit><anoDH>${x(f.year)}</anoDH><codTipoDH>FL</codTipoDH><numDH>${x(f.fl)}</numDH>
<dadosBasicos><dtEmis>${dateIso}</dtEmis><dtVenc>${x(f.dueDate)}</dtVenc><codUgPgto>120052</codUgPgto>
<vlr>${val}</vlr><txtObser>${x(f.observation)}</txtObser><txtProcesso>${x(f.process)}</txtProcesso>
<dtAteste>${x(f.dueDate)}</dtAteste><codCredorDevedor>120052</codCredorDevedor><dtPgtoReceb>${x(f.payDate)}</dtPgtoReceb>
<docOrigem><codIdentEmit>120052</codIdentEmit><dtEmis>${dateIso}</dtEmis><numDocOrigem>DESC.EXT.CV</numDocOrigem><vlr>${val}</vlr></docOrigem></dadosBasicos>
<pco><numSeqItem>1</numSeqItem><codSit>DFL001</codSit><codUgEmpe>120052</codUgEmpe>
<pcoItem><numSeqItem>1</numSeqItem><numEmpe>${x(f.ne)}</numEmpe><codSubItemEmpe>${x(f.sb)}</codSubItemEmpe>
<indrLiquidado>1</indrLiquidado><vlr>${val}</vlr><numClassA>311110100</numClassA></pcoItem></pco>
<centroCusto><numSeqItem>1</numSeqItem><codCentroCusto>310200</codCentroCusto><mesReferencia>${x(String(f.mesCC).padStart(2,"0"))}</mesReferencia>
<anoReferencia>${x(f.anoCC)}</anoReferencia><codUgBenef>120052</codUgBenef><codSIORG>2332</codSIORG>
<relPcoItem><numSeqPai>1</numSeqPai><numSeqItem>1</numSeqItem><vlr>${val}</vlr></relPcoItem></centroCusto>
</ns2:CprDhCadastrar></sb:detalhe></sb:detalhes><sb:trailler><sb:quantidadeDetalhe>1</sb:quantidadeDetalhe></sb:trailler></sb:arquivo>`;
  const details=report.exportaveis.map((r,i)=>{
    let codTipoOB="OBC",contaXml=r.conta,bancoPagador="",txtCit="";
    if(r.cnpj==="00000000000191"){codTipoOB="OBF";contaXml="FOPAG";bancoPagador="<banco>002</banco>";txtCit="<txtCit>120052ECFP310270014</txtCit>";}
    else if(r.cnpj==="00360305000104"){codTipoOB="OBF";contaXml="FOPAG";bancoPagador="<banco>002</banco>";txtCit="<txtCit>120052ECFPC128910</txtCit>";}
    else {contaXml=r.conta;}
    const agencia=(r.bco==="104"&&contaXml==="FOPAG")?"0231":r.ag;
    return `<sb:detalhe><cpr:CprDhAlterarDHIncluirItens>
<codUgEmit>120052</codUgEmit><anoDH>${x(f.year)}</anoDH><codTipoDH>FL</codTipoDH><numDH>${x(f.fl)}</numDH>
<dtEmis>${dateIso}</dtEmis><txtMotivo>${x(f.observation)}</txtMotivo>
<deducao><numSeqItem>${i+1}</numSeqItem><codSit>DOB005</codSit><dtVenc>${x(f.dueDate)}</dtVenc>
<dtPgtoReceb>${x(f.payDate)}</dtPgtoReceb><codUgPgto>120052</codUgPgto><vlr>${decimal(r.liquido)}</vlr>
<txtInscrA>${r.cnpj}</txtInscrA><numClassA>218810199</numClassA><predoc><txtObser>${x(f.observation)}</txtObser>
<predocOB><codTipoOB>${codTipoOB}</codTipoOB><codCredorDevedor>${r.cnpj}</codCredorDevedor>${txtCit}
<numDomiBancFavo><banco>${x(r.bco)}</banco><agencia>${x(agencia)}</agencia><conta>${x(contaXml)}</conta></numDomiBancFavo>
<numDomiBancPgto>${bancoPagador}<conta>UNICA</conta></numDomiBancPgto></predocOB></predoc></deducao>
</cpr:CprDhAlterarDHIncluirItens></sb:detalhe>`;
  }).join("\n");
  const second=`<?xml version="1.0" encoding="UTF-8"?>
<sb:arquivo xmlns:sb="http://www.tesouro.gov.br/siafi/submissao" xmlns:cpr="http://services.docHabil.cpr.siafi.tesouro.fazenda.gov.br/">
${header("DH002",f.sequenceDed)}<sb:detalhes>${details}</sb:detalhes>
<sb:trailler><sb:quantidadeDetalhe>${report.exportaveis.length}</sb:quantidadeDetalhe></sb:trailler></sb:arquivo>`;
  return {fl:first,deducao:second,quantidade:report.exportaveis.length,totalCents:report.totalExport};
}
window.SIAPECIVIL={moneyCents,brl,decimal,escapeXml,linesFromItems,parsePdfLines,generateXml,DEFAULT_EXCLUDED_RUBRICS,summarizeRubrics,applyRubricExclusions};
