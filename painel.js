/* CABW - Painel de Pagamentos usando a mesma linguagem visual/estrutura do LOA 2026 */
(function(){
"use strict";
const ds=JSON.parse(document.getElementById("dataset").textContent);
const months=ds.months||[], rows=ds.rows||[];
const $=id=>document.getElementById(id);
const money=v=>"US$ "+new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(v||0);
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim();
const monthLabel=m=>{const p=String(m||"").split("/");const names={JAN:"Jan",FEV:"Fev",MAR:"Mar",ABR:"Abr",MAI:"Mai",JUN:"Jun",JUL:"Jul",AGO:"Ago",SET:"Set",OUT:"Out",NOV:"Nov",DEZ:"Dez"};return (names[p[0]]||p[0])+" "+(p[1]||"")};
let state={month:months[months.length-1]||"",vendor:"",type:"",nd:"",pi:"",tab:"overview"};
const idx={month:0,commitment:1,code:2,vendor:3,nd:8,pi:10,amount:12,type:13};
const vendors=[...new Map(rows.filter(r=>r[idx.vendor]).map(r=>[norm(r[idx.vendor]),{key:norm(r[idx.vendor]),name:r[idx.vendor],code:r[idx.code]}])).values()].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));

function options(select,values,labelFn=x=>x){
 const current=select.value; const first=select.options[0]?.outerHTML||"<option value=''>Todos</option>";
 select.innerHTML=first+values.map(v=>'<option value="'+String(v).replaceAll('"','&quot;')+'">'+labelFn(v)+'</option>').join("");
 if(values.includes(current))select.value=current;
}
function matches(r,ignoreVendor=false){
 if(r[idx.month]!==state.month)return false;
 if(state.type&&r[idx.type]!==state.type)return false;
 if(state.nd&&r[idx.nd]!==state.nd)return false;
 if(state.pi&&r[idx.pi]!==state.pi)return false;
 if(!ignoreVendor&&state.vendor&&!norm(r[idx.vendor]).includes(norm(state.vendor))&&!norm(r[idx.code]).includes(norm(state.vendor)))return false;
 return true;
}
function currentRows(){return rows.filter(r=>matches(r))}
function sum(rr,pred=()=>true){return rr.filter(pred).reduce((a,r)=>a+Number(r[idx.amount]||0),0)}
function monthBalance(vendorKey,type){
 return months.map(m=>rows.filter(r=>r[idx.month]===m&&(!vendorKey||norm(r[idx.vendor])===vendorKey)&&(!type||r[idx.type]===type)).reduce((a,r)=>a+Number(r[idx.amount]||0),0));
}
function movement(series){return series.map((v,i)=>v-(i?series[i-1]:0))}
function svgLine(target,seriesList,labels){
 const W=620,H=270,L=72,R=18,T=24,B=42,all=seriesList.flatMap(s=>s.values),max=Math.max(1,...all),min=Math.min(0,...all),span=max-min;
 const x=i=>L+(labels.length<=1?0:(i*(W-L-R)/(labels.length-1))), y=v=>T+(max-v)*(H-T-B)/span;
 let s='<svg viewBox="0 0 '+W+' '+H+'" class="account-line-chart" role="img">';
 [0,.5,1].forEach(q=>{const yy=T+q*(H-T-B);s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="#e4eaf3"/>'});
 seriesList.forEach((ser,si)=>{const stroke=si===0?"#244ec7":si===1?"#b38a1c":"#0d9488";s+='<polyline fill="none" stroke="'+stroke+'" stroke-width="3" points="'+ser.values.map((v,i)=>x(i)+','+y(v)).join(" ")+'"/>';});
 labels.forEach((m,i)=>{s+='<text x="'+x(i)+'" y="'+(H-10)+'" text-anchor="middle">'+m.slice(0,3)+'</text>'});
 s+='</svg><div class="rp-legend">'+seriesList.map((ser,i)=>'<span><i style="background:'+(i===0?"#244ec7":i===1?"#b38a1c":"#0d9488")+'"></i>'+ser.name+'</span>').join("")+'</div>';
 target.innerHTML=s;
}
function renderFilters(){
 $("month").innerHTML=months.map(m=>'<option value="'+m+'">'+monthLabel(m)+'</option>').join("");$("month").value=state.month;
 const base=rows.filter(r=>r[idx.month]===state.month);
 options($("nd-filter"),[...new Set(base.map(r=>r[idx.nd]).filter(Boolean))].sort());
 options($("pi-filter"),[...new Set(base.map(r=>r[idx.pi]).filter(Boolean))].sort());
 const vs=$("vendor-select"); vs.innerHTML='<option value="">Selecione uma empresa</option>'+vendors.map(v=>'<option value="'+v.key+'">'+v.name+'</option>').join("");
}
function renderOverview(){
 const rr=currentRows(), total=sum(rr), ex=sum(rr,r=>r[idx.type]==="exercicio"), rp=sum(rr,r=>r[idx.type]==="rap");
 const vendorCount=new Set(rr.map(r=>norm(r[idx.vendor]))).size;
 const series=months.map(m=>rows.filter(r=>r[idx.month]===m).reduce((a,r)=>a+Number(r[idx.amount]||0),0));
 const mov=movement(series), mi=months.indexOf(state.month);
 $("kpi-total").textContent=money(total);$("kpi-exercicio").textContent=money(ex);$("kpi-rp").textContent=money(rp);$("kpi-vendors").textContent=vendorCount.toLocaleString("pt-BR");$("kpi-movement").textContent=money(mi>=0?mov[mi]:0);
 $("record-count").textContent=rows.length.toLocaleString("pt-BR")+" registros";$("position-month").textContent=monthLabel(state.month);$("scope-summary").textContent=rr.length.toLocaleString("pt-BR")+" registros no recorte · "+monthLabel(state.month);
 const grouped=new Map();rr.forEach(r=>{const k=norm(r[idx.vendor]),v=grouped.get(k)||{name:r[idx.vendor],value:0};v.value+=Number(r[idx.amount]||0);grouped.set(k,v)});
 const list=[...grouped.values()].sort((a,b)=>b.value-a.value).slice(0,18),max=Math.max(1,...list.map(x=>x.value));
 $("vendor-bars").innerHTML=list.map(v=>'<button class="bar-row" data-vendor="'+v.name.replaceAll('"','&quot;')+'"><span class="bar-name">'+v.name+'</span><span class="bar-value">'+money(v.value)+'</span><span class="bar-track"><i style="width:'+Math.max(1,v.value/max*100)+'%"></i></span></button>').join("")||'<div class="empty">Sem dados no recorte.</div>';
 $("vendor-bars").querySelectorAll("[data-vendor]").forEach(b=>b.onclick=()=>{state.vendor=b.dataset.vendor;$("vendor-search").value=state.vendor;renderAll()});
 const totalSeries=months.map(m=>rows.filter(r=>r[idx.month]===m).reduce((a,r)=>a+Number(r[idx.amount]||0),0));
 const exSeries=months.map(m=>rows.filter(r=>r[idx.month]===m&&r[idx.type]==="exercicio").reduce((a,r)=>a+Number(r[idx.amount]||0),0));
 const rpSeries=months.map(m=>rows.filter(r=>r[idx.month]===m&&r[idx.type]==="rap").reduce((a,r)=>a+Number(r[idx.amount]||0),0));
 svgLine($("trend-chart"),[{name:"Total",values:totalSeries},{name:"Exercício",values:exSeries},{name:"RP",values:rpSeries}],months);
}
function renderVendor(){
 const key=$("vendor-select").value;if(!key){$("vendor-kpis").innerHTML='<article class="kpi"><strong>Selecione uma empresa</strong><p>Use a lista acima.</p></article>';$("vendor-monthly-chart").innerHTML="";$("vendor-balance-chart").innerHTML="";$("vendor-history").innerHTML="";return}
 const total=monthBalance(key,""),ex=monthBalance(key,"exercicio"),rp=monthBalance(key,"rap"),mov=movement(total),i=months.indexOf(state.month),name=vendors.find(v=>v.key===key)?.name||key;
 $("vendor-kpis").innerHTML='<article class="kpi featured"><div><span>TOTAL ACUMULADO</span></div><strong>'+money(total[i]||0)+'</strong><p>'+name+'</p><div class="featured-line"></div></article><article class="kpi"><div><span>MOVIMENTO DO MÊS</span></div><strong>'+money(mov[i]||0)+'</strong><p>Variação da posição</p></article><article class="kpi"><div><span>EXERCÍCIO</span></div><strong>'+money(ex[i]||0)+'</strong></article><article class="kpi"><div><span>RP</span></div><strong>'+money(rp[i]||0)+'</strong></article>';
 svgLine($("vendor-monthly-chart"),[{name:"Movimento",values:mov}],months);
 svgLine($("vendor-balance-chart"),[{name:"Acumulado",values:total}],months);
 $("vendor-history").innerHTML=months.map((m,j)=>'<tr><td>'+monthLabel(m)+'</td><td>'+money(mov[j])+'</td><td>'+money(total[j])+'</td></tr>').join("");
}
function renderDetails(){
 const rr=currentRows().sort((a,b)=>Number(b[idx.amount])-Number(a[idx.amount])).slice(0,500);
 $("details-body").innerHTML=rr.map(r=>'<tr><td>'+r[idx.commitment]+'</td><td>'+r[idx.vendor]+'</td><td>'+r[idx.nd]+'</td><td>'+r[idx.pi]+'</td><td>'+(r[idx.type]==="rap"?"RP":"Exercício")+'</td><td>'+money(r[idx.amount])+'</td></tr>').join("");
}
function setTab(tab){state.tab=tab;["overview","vendors","details"].forEach(t=>$(t+"-view").hidden=t!==tab);document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("selected",b.dataset.tab===tab));if(tab==="vendors")renderVendor();if(tab==="details")renderDetails()}
function renderAll(){renderOverview();if(state.tab==="details")renderDetails()}
renderFilters();
$("month").onchange=e=>{state.month=e.target.value;renderFilters();renderAll()};
$("vendor-search").oninput=e=>{state.vendor=e.target.value;renderAll()};
$("resource-type").onchange=e=>{state.type=e.target.value;renderAll()};
$("nd-filter").onchange=e=>{state.nd=e.target.value;renderAll()};
$("pi-filter").onchange=e=>{state.pi=e.target.value;renderAll()};
$("clear-filters").onclick=()=>{state.vendor="";state.type="";state.nd="";state.pi="";$("vendor-search").value="";$("resource-type").value="";$("nd-filter").value="";$("pi-filter").value="";renderAll()};
$("vendor-select").onchange=renderVendor;
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
setTab("overview");renderAll();
})();