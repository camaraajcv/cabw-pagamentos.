import {normalize,numberValue,monthValue,type RPRow} from './budget';

export function parseTesouroRP(matrix:string[][]):{rows:RPRow[];aliases:Record<string,string>}|null {
 const metric=matrix.findIndex(r=>r.some(v=>normalize(v)==='rpinscrito'));
 if(metric<0)return null;
 const headers=matrix[metric];
 const dims=matrix.slice(0,metric).findLast(r=>r.some(v=>normalize(v)==='ugresponsavel'));
 if(!dims)throw Error('Cabeçalho de dimensões do RP ausente.');
 const index=(s:string)=>dims.findIndex(v=>normalize(v).startsWith(s));
 const ug=index('ugresponsavel'),action=index('acao'),nd=index('naturezadespesa'),pi=index('pi');
 if([ug,action,nd,pi].some(i=>i<0))throw Error('Dimensões do RP incompletas.');
 const blocks:{ins:number;paid:number;pending:number;cancelled:number;month:string}[]=[];
 for(let ins=0;ins<headers.length;ins++){
  if(normalize(headers[ins])!=='rpinscrito')continue;
  let end=headers.findIndex((v,k)=>k>ins&&normalize(v)==='rpinscrito');if(end<0)end=headers.length;
  const paid=headers.findIndex((v,k)=>k>=ins&&k<end&&normalize(v)==='rppago');
  const pending=headers.findIndex((v,k)=>k>=ins&&k<end&&normalize(v)==='rpapagar');
  const cancelled=headers.findIndex((v,k)=>k>=ins&&k<end&&normalize(v).startsWith('rpcancelad'));
  if(paid<0||pending<0||cancelled<0)throw Error('São necessárias RP Inscrito, % RP pago, % RP a pagar e % RP cancelados.');
  const period=matrix.slice(0,metric).flatMap(r=>r.slice(ins,end)).find(v=>/^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/?\d{4}$/i.test(v.trim()));
  if(!period)throw Error('Competência do RP ausente.');
  blocks.push({ins,paid,pending,cancelled,month:monthValue(period,'2026-01')});
 }
 const blank=(v:unknown)=>v==null||String(v).trim()==='';
 const ratio=(v:string)=>v.trim().endsWith('%')?numberValue(v.trim().slice(0,-1))/100:numberValue(v);
 const cents=(v:number)=>Math.round(v*100)/100;
 const rows:RPRow[]=[],aliases:Record<string,string>={};
 for(let i=metric+1;i<matrix.length;i++){
  const r=matrix[i],id=String(r[ug]||'').trim();
  if(!/^-?\d+$/.test(id))continue;
  for(const b of blocks){
   if([r[b.ins],r[b.paid],r[b.pending],r[b.cancelled]].every(blank))continue;
   if(blank(r[b.ins]))throw Error(`Linha ${i+1}: RP Inscrito ausente.`);
   const inscribed=cents(numberValue(r[b.ins]));
   if(inscribed!==0&&[r[b.paid],r[b.pending],r[b.cancelled]].some(blank))throw Error(`Linha ${i+1}: percentual de RP ausente.`);
   const paidRate=ratio(r[b.paid]||''),pendingRate=ratio(r[b.pending]||''),cancelledRate=ratio(r[b.cancelled]||'');
   if(inscribed<0||[paidRate,pendingRate,cancelledRate].some(v=>v<0||v>1))throw Error(`Linha ${i+1}: valor ou percentual de RP inválido.`);
   if(paidRate+pendingRate+cancelledRate>1.0003)throw Error(`Linha ${i+1}: percentuais de RP excedem 100%.`);
   const actionCode=String(r[action]||'').trim(),ndCode=String(r[nd]||'').trim(),piCode=String(r[pi]||'').trim();
   if(!actionCode||!ndCode||!piCode||!b.month.startsWith('2026-'))throw Error(`Linha ${i+1}: dimensão ou período de RP inválido.`);
   const extra:Record<string,string>={};
   for(const [title,j] of [['Nome UG [2]',ug+1],['Descrição Ação [4]',action+1],['Descrição ND [6]',nd+1],['Descrição PI [8]',pi+1]] as [string,number][]){if(r[j])extra[title]=r[j];}
   extra['% RP pago (original)']=r[b.paid]||'';extra['% RP a pagar (original)']=r[b.pending]||'';
   extra['% RP cancelado (original)']=r[b.cancelled]||'';
   rows.push({ug:id,action:actionCode,nd:ndCode,pi:piCode,month:b.month,extra,inscribed,paid:cents(inscribed*paidRate),pending:cents(inscribed*pendingRate),cancelled:cents(inscribed*cancelledRate),paidRate,pendingRate,cancelledRate});
   if(r[ug+1])aliases[id]=id.startsWith('-')?'UG não informada ('+id+')':r[ug+1];
  }
 }
 return {rows,aliases};
}

export const sumRP=(rows:RPRow[],key:'inscribed'|'paid'|'pending'|'cancelled')=>rows.reduce((s,r)=>s+Math.round(r[key]*100),0)/100;
