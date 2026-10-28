/* Regras NE001/DH001 migradas dos geradores SDPP. Sem dependências de rede. */
(function(root){
'use strict';
const SB='http://www.tesouro.gov.br/siafi/submissao';
const DH='http://services.docHabil.cpr.siafi.tesouro.fazenda.gov.br/';
const ORC='http://services.orcamentario.siafi.tesouro.fazenda.gov.br/';
const digits=s=>String(s??'').replace(/\D/g,'');
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const tag=(name,value)=>`<${name}>${esc(value)}</${name}>`;
const tags=(obj,keys)=>keys.map(k=>tag(k,obj[k])).join('');
function fail(message){throw new Error(message);}
function money(value,brOnly=false){
 let s=String(value??'').trim().replace(/\s/g,'');
 if(brOnly||s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
 if(!/^[+-]?\d+(?:\.\d{1,2})?$/.test(s))fail(`Valor inválido: "${value}". Use até duas casas decimais.`);
 const sign=s.startsWith('-')?-1n:1n;s=s.replace(/^[+-]/,'');
 const [a,b='']=s.split('.');return sign*(BigInt(a)*100n+BigInt(b.padEnd(2,'0')));
}
const fmt=n=>(n<0n?'-':'')+(abs(n)/100n)+'.'+String(abs(n)%100n).padStart(2,'0');
const abs=n=>n<0n?-n:n;
const br=n=>{const [a,b]=fmt(n).split('.');return a.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+b;};
const sum=(items,key='amount')=>items.reduce((a,i)=>a+i[key],0n);
function date(value,label='Data'){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)fail(`${label}: informe uma data válida.`);
 return value;
}
const dmy=value=>{const [y,m,d]=date(value).split('-');return `${d}/${m}/${y}`;};
function code(value,len,label){if(!new RegExp(`^\\d{${len}}$`).test(value||''))fail(`${label} deve conter ${len} dígitos.`);return value;}
function table(text,cols,label){
 return String(text||'').split(/\r?\n/).flatMap((raw,index)=>{
  if(!raw.trim())return [];
  const s=raw.trim();const parts=s.includes('\t')?s.split('\t').map(x=>x.trim()):s.includes(';')?s.split(';').map(x=>x.trim()):s.split(/\s*\|\s*|\s+/);
  if(!cols.includes(parts.length))fail(`${label}, linha ${index+1}: esperado ${cols.join(' ou ')} colunas; recebidas ${parts.length}.`);
  return [{parts,line:index+1}];
 });
}
const PASSIVO={'31909294':'218910100','33909259':'211210100','33909208':'211310100','33909293':'211310100'};
const CC_ESPECIAL=new Set(['33900802','33900804','33909208','33909233']);
const ccFor=(ndd,standard)=>CC_ESPECIAL.has(digits(ndd))?'992300':standard;
function ne(input){
 const cpf=code(digits(input.cpf),11,'CPF');const ug=code(input.ug,6,'UG executora');date(input.eventDate,'Data do empenho');
 const rows=table(input.data,[7],'Dados orçamentários').map(({parts:p,line})=>{
  const [esfera,ptres,ndd0,fonte,ugr,pi,v]=p;const ndd=digits(ndd0);
  code(ptres,6,`PTRES na linha ${line}`);code(ndd,8,`NDD na linha ${line}`);
  if(!fonte)fail(`Fonte vazia na linha ${line}.`);
  return {esfera,ptres,ndd,nd:ndd.slice(0,6),sub:ndd.slice(-2),fonte,ugr,pi,amount:money(v,true)};
 });
 if(!rows.length)fail('Informe ao menos uma linha de dados orçamentários.');
 const selected=new Set(input.ptres||[]),groups=new Map();
 for(const r of rows){
  r.account=PASSIVO[r.ndd]||((selected.has(r.ptres)||['319092','339092'].includes(r.nd))?input.account:null);
  if(r.account!==null)code(r.account,9,'Conta do passivo anterior');
  const key=JSON.stringify([r.esfera,r.ptres,r.nd,r.fonte,r.ugr,r.pi,r.account]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
 }
 const sorted=[...groups].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,rows])=>rows);
 const details=sorted.map(items=>{
  const r=items[0];const cell={esfera:r.esfera,codPTRES:r.ptres,codFonteRec:r.fonte,codNatDesp:r.nd,ugResponsavel:r.ugr,codPlanoInterno:r.pi};
  let xml=tags({ugEmitente:ug,anoEmpenho:'2026',tipoEmpenho:input.type},['ugEmitente','anoEmpenho','tipoEmpenho']);
  xml+=`<celulaOrcamentaria>${tags(cell,Object.keys(cell))}</celulaOrcamentaria>`;
  xml+=tags({dtEmis:input.eventDate,txtProcesso:input.process,vlrEmpenho:fmt(sum(items)),codFavorecido:'120052',codAmparoLegal:input.legal,txtDescricao:input.description},['dtEmis','txtProcesso','vlrEmpenho','codFavorecido','codAmparoLegal','txtDescricao']);
  if(r.account!==null)xml+=`<passivoAnterior>${tag('codContaContabil',r.account)}</passivoAnterior>`;
  xml+=items.map((item,i)=>`<itemEmpenho>${tag('numSeqItem',i+1)}${tag('codSubElemento',item.sub)}${tag('descricao',`${input.itemDescription} - ND ${r.nd} SE ${item.sub}`)}<operacaoItemEmpenho>${tag('tipoOperacaoItemEmpenho','INCLUSAO')}${tag('quantidade','1')}${tag('vlrUnitario',fmt(item.amount))}${tag('vlrOperacao',fmt(item.amount))}</operacaoItemEmpenho></itemEmpenho>`).join('');
  return `<sb:detalhe><ns2:orcEmpenhoDados>${xml}</ns2:orcEmpenhoDados></sb:detalhe>`;
 }).join('');
 const header={codigoLayout:'NE001',dataGeracao:dmy(input.eventDate),sequencialGeracao:'1',anoReferencia:'2026',ugResponsavel:ug,cpfResponsavel:cpf,identificadorOrigem:'SIAFI-STN'};
 const xml=`<?xml version="1.0" encoding="utf-8"?><sb:arquivo xmlns:ns2="${ORC}" xmlns:sb="${SB}"><sb:header>${Object.entries(header).map(([k,v])=>tag('sb:'+k,v)).join('')}</sb:header><sb:detalhes>${details}</sb:detalhes><sb:trailler>${tag('sb:quantidadeDetalhe',sorted.length)}</sb:trailler></sb:arquivo>`;
 return {xml,filename:'NE001.xml',metrics:{items:rows.length,details:sorted.length,total:sum(rows)},warnings:[],rows:rows.map(r=>({ndd:r.ndd,ptres:r.ptres,account:r.account||'—',value:br(r.amount)}))};
}
function parsePco(text){
 const lines=table(text,[5,6],'PCO').map(({parts:p,line})=>{
  const [empe,sub0,sit0,a]=p;const supplied=p.length===6?p[4]:'';const v=p.at(-1);const sub=digits(sub0);const sit=sit0.toUpperCase();
  if(![1,2,8].includes(sub.length))fail(`PCO, linha ${line}: informe subelemento de 2 dígitos ou NDD de 8 dígitos.`);
  return {empe,sub:sub.slice(-2).padStart(2,'0'),sit,a:digits(a),b:({'DFL034':'218910100','DFL038':'211310100'})[sit]||digits(supplied),ndd:sub.length===8?sub:'',amount:money(v)};
 });
 if(!lines.length)fail('Informe ao menos um lançamento PCO.');return lines;
}
function parseOthers(text){return table(text,[6],'Outros lançamentos').map(({parts:p,line})=>{
 const [sit0,a,b,ndd,normal,v]=p;const sit=sit0.toUpperCase();const ne=normal.toUpperCase();
 if(ne&&!['N','E'].includes(ne))fail(`Outros lançamentos, linha ${line}: use N ou E.`);
 const amount=money(v);return {sit,a:digits(a),b:['PRV001','PRV002','PRV003'].includes(sit)?digits(b):'',d:['PRV001','PRV002','PRV003'].includes(sit)?'':digits(b),ndd:digits(ndd),normal:ne,amount};
});}
function parsePayments(text,input){return table(text,[5],'Pagamentos').map(({parts:p,line})=>{
 const [cnpj,bank,agency,cit,v]=p;const amount=money(v);if(amount<0n)fail(`Pagamento negativo na linha ${line}.`);
 return {creditor:digits(cnpj),bank:bank.padStart(3,'0'),agency:agency.padStart(4,'0'),cit,amount,ob:input.ob,favAccount:input.favAccount,payBank:input.payBank.padStart(3,'0'),payAccount:input.payAccount};
});}
function rebuild(chunk,input){
 const pcoMap=new Map(),daMap=new Map(),others=[];
 for(const entry of chunk){const it=entry.item;if(entry.type==='OUTROS')others.push(it);else{const map=entry.type==='PCO'?pcoMap:daMap;if(!map.has(it.sit))map.set(it.sit,[]);map.get(it.sit).push(it);}}
 const refs={pco:[],da:[],others:[]};
 function groups(map,refType){return [...map].map(([sit,items],index)=>({sit,seq:index+1,items:items.map((it,i)=>{
  const amount=abs(it.amount);refs[refType].push({parent:index+1,seq:i+1,amount,cc:ccFor(it.ndd,input.cc)});return {...it,amount,seq:i+1};
 })}));}
 const pco=groups(pcoMap,'pco'),da=groups(daMap,'da');
 others.forEach((it,i)=>refs.others.push({seq:i+1,ndd:it.ndd,amount:it.amount,cc:ccFor(it.ndd,input.cc)}));
 const totalPos=sum(chunk.filter(x=>x.type==='PCO').map(x=>x.item));const totalNeg=sum(chunk.filter(x=>x.type==='DA').map(x=>x.item).map(it=>({amount:abs(it.amount)})));
 return {pco,da,others,refs,net:totalPos-totalNeg};
}
function allocate(payments,details){
 const balances=payments.map(p=>({...p,balance:p.amount}));
 for(const d of details){let left=d.net;d.payments=[];if(left<0n)fail('Uma FL ficou com valor líquido negativo após a divisão de 100 linhas. Reorganize o lote antes de gerar.');
  for(const p of balances){if(left===0n)break;if(p.balance<=0n)continue;const take=p.balance<left?p.balance:left;d.payments.push({...p,amount:take});p.balance-=take;left-=take;}
  if(left!==0n)fail(`Não foi possível ratear os pagamentos. Faltam ${br(left)}.`);
 }
}
function accountingCounter(config){
 const overrides=new Map();
 for(const part of String(config||'').split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean)){
  const match=/^([A-Za-z]{3}\d{3})\s*=\s*(\d+)$/.exec(part);
  if(!match||Number(match[2])<1||Number(match[2])>100)fail('Linhas de outras situações: use SITUAÇÃO=quantidade, com quantidade de 1 a 100.');
  const sit=match[1].toUpperCase();
  if(sit.startsWith('DFL')||sit.startsWith('AFL'))fail('DFL e AFL já têm regra fixa: 2 e 4 linhas por item, respectivamente.');
  if(overrides.has(sit))fail(`Situação repetida na configuração de linhas: ${sit}.`);
  overrides.set(sit,Number(match[2]));
 }
 return entry=>{
  const sit=entry.item.sit;
  if(sit.startsWith('DFL'))return 2;
  if(sit.startsWith('AFL'))return 4;
  if(overrides.has(sit))return overrides.get(sit);
  fail(`Não há quantidade de linhas contábeis configurada para ${sit}. Informe ${sit}=quantidade no campo de outras situações, conforme a regra do SIAFI.`);
 };
}
function accountingBatches(flat,cost){
 const size=entries=>entries.reduce((n,e)=>n+cost(e),0);
 const value=entries=>entries.reduce((n,e)=>n+(e.type==='DA'?-abs(e.item.amount):e.type==='PCO'?e.item.amount:0n),0n);
 if(size(flat)<=100)return [flat];
 if(flat.some(e=>e.type==='OUTROS'))fail('O lote ultrapassa 100 linhas contábeis e contém Outros Lançamentos. Separe a folha em lotes completos, com suas respectivas provisões e pagamentos; o portal não rateia Outros Lançamentos automaticamente.');
 // Mantém as anulações junto aos itens do mesmo empenho e subelemento.
 const groups=new Map();
 for(const e of flat){const key=JSON.stringify([e.item.empe,e.item.sub]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
 const batches=[];let current=[];
 const units=[...groups.values()].flatMap(entries=>entries.some(e=>e.type==='DA')?[entries]:entries.map(e=>[e]));
 for(const entries of units){
  if(size(entries)>100)fail(`O empenho ${entries[0].item.empe}, subelemento ${entries[0].item.sub}, excede sozinho 100 linhas contábeis. Divida esse grupo com suas anulações correspondentes.`);
  if(value(entries)<0n)fail(`As anulações do empenho ${entries[0].item.empe}, subelemento ${entries[0].item.sub}, excedem seus itens positivos neste lote. Revise a vinculação antes de dividir.`);
  if(current.length&&size(current)+size(entries)>100){batches.push(current);current=[];}
  current.push(...entries);
 }
 if(current.length)batches.push(current);
 // Um grupo totalmente anulado não pode produzir uma FL sem valor próprio.
 for(let i=batches.length-1;i>=0;i--){
  if(value(batches[i])!==0n)continue;
  const target=batches.findIndex((b,j)=>j!==i&&value(b)>0n&&size(b)+size(batches[i])<=100);
  if(target<0)fail('Um grupo totalmente anulado ficaria isolado em uma FL de valor zero. Reorganize esse grupo junto a um lote positivo, respeitando as 100 linhas contábeis.');
  batches[target].push(...batches[i]);batches.splice(i,1);
 }
 return batches;
}
function dhItem(item){return tags({numSeqItem:item.seq,numEmpe:item.empe,codSubItemEmpe:item.sub,vlr:fmt(item.amount),numClassA:item.a},['numSeqItem','numEmpe','codSubItemEmpe','vlr','numClassA'])+(item.b?tag('numClassB',item.b):'');}
function dhDetail(d,input){
 let xml=tags({codUgEmit:input.ug,anoDH:input.year,codTipoDH:input.dhType},['codUgEmit','anoDH','codTipoDH']);
 const basic={dtEmis:input.emissionDate,dtVenc:input.dueDate,codUgPgto:input.payUg,vlr:fmt(d.net),txtObser:input.description,txtProcesso:input.process,dtAteste:input.attestDate,codCredorDevedor:input.creditor,dtPgtoReceb:input.payDate};
 const doc={codIdentEmit:input.docIssuer,dtEmis:input.emissionDate,numDocOrigem:input.docNumber,vlr:fmt(d.net)};
 xml+=`<dadosBasicos>${tags(basic,Object.keys(basic))}<docOrigem>${tags(doc,Object.keys(doc))}</docOrigem></dadosBasicos>`;
 function groupXml(g,name,itemName){return `<${name}>${tag('numSeqItem',g.seq)}${tag('codSit',g.sit)}${tag('codUgEmpe',input.empeUg)}${g.items.map(it=>`<${itemName}>${dhItem(it)}</${itemName}>`).join('')}</${name}>`;}
 xml+=d.pco.map(g=>groupXml(g,'pco','pcoItem')).join('');
 xml+=d.others.map((o,i)=>`<outrosLanc>${tag('numSeqItem',i+1)}${tag('codSit',o.sit)}${tag('vlr',fmt(o.amount))}${o.a?tag('numClassA',o.a):''}${o.b?tag('numClassB',o.b):''}${o.d?tag('numClassD',o.d):''}${o.normal?tag('tpNormalEstorno',o.normal):''}</outrosLanc>`).join('');
 xml+=d.da.map(g=>groupXml(g,'despesaAnular','despesaAnularItem')).join('');
 const centers=new Map();for(const type of ['pco','others','da'])for(const r of d.refs[type]){if(!centers.has(r.cc))centers.set(r.cc,{pco:[],others:[],da:[]});centers.get(r.cc)[type].push(r);}
 let ccSeq=0;for(const [cc,refs] of centers){
  const config={numSeqItem:++ccSeq,codCentroCusto:cc,mesReferencia:input.month.padStart(2,'0'),anoReferencia:input.ccYear,codUgBenef:input.benefUg,codSIORG:input.siorg};
  let block=tags(config,Object.keys(config));
  block+=refs.pco.map(r=>`<relPcoItem>${tag('numSeqPai',r.parent)}${tag('numSeqItem',r.seq)}${tag('vlr',fmt(r.amount))}</relPcoItem>`).join('');
  block+=refs.others.map(r=>`<relOutrosLanc>${tag('numSeqItem',r.seq)}${r.ndd?tag('codNatDespDet',r.ndd):''}${tag('vlr',fmt(r.amount))}</relOutrosLanc>`).join('');
  block+=refs.da.map(r=>`<relDespesaAnular>${tag('numSeqPai',r.parent)}${tag('numSeqItem',r.seq)}${tag('vlr',fmt(r.amount))}</relDespesaAnular>`).join('');
  xml+=`<centroCusto>${block}</centroCusto>`;
 }
 for(const p of d.payments){
  const bankFav=tag('banco',p.bank)+tag('agencia',p.agency)+tag('conta',p.favAccount);
  const bankPay=tag('banco',p.payBank)+tag('conta',p.payAccount);
  const pob=tag('codTipoOB',p.ob)+tag('codCredorDevedor',p.creditor)+tag('txtCit',p.cit)+`<numDomiBancFavo>${bankFav}</numDomiBancFavo><numDomiBancPgto>${bankPay}</numDomiBancPgto>`;
  xml+=`<dadosPgto>${tag('codCredorDevedor',p.creditor)}${tag('vlr',fmt(p.amount))}<predoc>${tag('txtObser','PAGAMENTO FOPAG')}<predocOB>${pob}</predocOB></predoc></dadosPgto>`;
 }
 return `<sb:detalhe><dh:CprDhCadastrar>${xml}</dh:CprDhCadastrar></sb:detalhe>`;
}
function dh(input){
 for(const key of ['emissionDate','dueDate','attestDate','payDate'])date(input[key],'Data da liquidação');
 date(input.generationDate,'Data de geração');code(digits(input.cpf),11,'CPF');
 for(const key of ['ug','payUg','empeUg','benefUg','headerUg'])code(input[key],6,'UG');
 if(!/^(0?[1-9]|1[0-2])$/.test(input.month))fail('Mês de referência deve estar entre 01 e 12.');
 if(!/^\d{4}$/.test(input.year)||!/^\d{4}$/.test(input.ccYear)||!/^\d{4}$/.test(input.headerYear))fail('Informe os anos com quatro dígitos.');
 if(!/^[1-9]\d{0,3}$/.test(input.sequence))fail('O sequencial de geração deve estar entre 1 e 9999, sem zero à esquerda.');
 const lines=parsePco(input.pco),positive=lines.filter(x=>x.amount>=0n),negative=lines.filter(x=>x.amount<0n),others=parseOthers(input.others),payments=parsePayments(input.payments,input);
 if(input.dhType.toUpperCase()==='FL'&&others.length){
  const sits=new Set(others.map(o=>o.sit));const missing=['PRV001','PRV002','PRV003'].filter(s=>!sits.has(s));
  if(missing.length)fail('Outros lançamentos: faltam as situações obrigatórias '+missing.join(', ')+'.');
  if(!sits.has('LPA385')&&!sits.has('LPA386'))fail('Outros lançamentos: inclua LPA385 e/ou LPA386 (benefícios previdenciários e assistenciais).');
 }
 const totalPos=sum(positive),totalNeg=negative.reduce((a,i)=>a+abs(i.amount),0n),net=totalPos-totalNeg,totalPay=sum(payments);
 if(totalPay!==net)fail(`Pagamentos (${br(totalPay)}) diferem do líquido (${br(net)}). Diferença: ${br(totalPay-net)}.`);
 const flat=[...positive.map(item=>({type:'PCO',item})),...negative.map(item=>({type:'DA',item})),...others.map(item=>({type:'OUTROS',item}))];
 const cost=accountingCounter(input.accountingWeights);
 const batches=accountingBatches(flat,cost);
 const details=batches.map(batch=>rebuild(batch,input));allocate(payments,details);
 const detailsSummary=batches.map((batch,i)=>({document:i+1,items:batch.length,dfl:batch.filter(e=>e.item.sit.startsWith('DFL')).length,afl:batch.filter(e=>e.item.sit.startsWith('AFL')).length,accountingLines:batch.reduce((n,e)=>n+cost(e),0),value:br(details[i].net)}));
 const header={codigoLayout:input.layout,dataGeracao:dmy(input.generationDate),sequencialGeracao:BigInt(input.sequence).toString(),anoReferencia:input.headerYear,ugResponsavel:input.headerUg,cpfResponsavel:digits(input.cpf)};
 const initialSequence=Number(input.sequence);
 if(initialSequence+details.length-1>9999)fail('A quantidade de arquivos ultrapassaria o sequencial 9999. Informe um sequencial inicial que comporte todos os XMLs.');
 const files=details.map((detail,i)=>{
  const sequence=String(initialSequence+i),fileHeader={...header,sequencialGeracao:sequence};
  const filename=details.length===1?'DH001_FOPAG.xml':`DH001_FOPAG_${sequence}.xml`;
  const xml=`<?xml version="1.0" encoding="utf-8"?><sb:arquivo xmlns:sb="${SB}" xmlns:dh="${DH}"><sb:header>${Object.entries(fileHeader).map(([k,v])=>tag('sb:'+k,v)).join('')}</sb:header><sb:detalhes>${dhDetail(detail,input)}</sb:detalhes><sb:trailler>${tag('sb:quantidadeDetalhe',1)}</sb:trailler></sb:arquivo>`;
  Object.assign(detailsSummary[i],{sequence,filename});
  return {xml,filename,sequence,accountingLines:detailsSummary[i].accountingLines};
 });
 const warnings=lines.some(l=>!l.ndd)?['Há itens PCO com apenas o subelemento. Nesses itens, será usado o centro padrão; informe a NDD completa para aplicar a regra 992300.']:[];
 return {xml:files[0].xml,filename:files[0].filename,files,metrics:{items:flat.length,details:details.length,total:net,positive:totalPos,negative:totalNeg,others:sum(others),payments:totalPay,cc:totalPos+sum(others)-totalNeg,accountingLines:detailsSummary.reduce((n,d)=>n+d.accountingLines,0)},detailsSummary,warnings,rows:lines.map(l=>({empe:l.empe,ndd:l.ndd||l.sub,sit:l.sit,account:l.b||'—',cc:ccFor(l.ndd,input.cc),value:br(l.amount)}))};
}
function zip(files){
 const encoder=new TextEncoder(),localParts=[],centralParts=[];let offset=0;
 const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 const crc=data=>{let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
 const header=(length,signature)=>{const bytes=new Uint8Array(length),view=new DataView(bytes.buffer);view.setUint32(0,signature,true);return {bytes,view};};
 for(const f of files){
  const name=encoder.encode(f.filename),data=encoder.encode(f.xml),checksum=crc(data);
  const l=header(30,0x04034b50);l.view.setUint16(4,20,true);l.view.setUint16(6,0x0800,true);l.view.setUint16(12,33,true);l.view.setUint32(14,checksum,true);l.view.setUint32(18,data.length,true);l.view.setUint32(22,data.length,true);l.view.setUint16(26,name.length,true);
  localParts.push(l.bytes,name,data);
  const c=header(46,0x02014b50);c.view.setUint16(4,20,true);c.view.setUint16(6,20,true);c.view.setUint16(8,0x0800,true);c.view.setUint16(14,33,true);c.view.setUint32(16,checksum,true);c.view.setUint32(20,data.length,true);c.view.setUint32(24,data.length,true);c.view.setUint16(28,name.length,true);c.view.setUint32(42,offset,true);centralParts.push(c.bytes,name);
  offset+=30+name.length+data.length;
 }
 const centralSize=centralParts.reduce((n,p)=>n+p.length,0),end=header(22,0x06054b50);end.view.setUint16(8,files.length,true);end.view.setUint16(10,files.length,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true);
 const result=new Uint8Array(offset+centralSize+22);let position=0;for(const p of [...localParts,...centralParts,end.bytes]){result.set(p,position);position+=p.length;}return result;
}
const api={ne,dh,money,fmt,br,parsePco,parseOthers,ccFor,zip};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SDPP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
