/* CABW - Painel de Pagamentos usando a mesma linguagem visual/estrutura do LOA 2026 */
(async function(){
"use strict";
let ds=null;
try{
  const r=await fetch("./pagamentos-dados.json?ts="+Date.now(),{cache:"no-store"});
  if(!r.ok) throw new Error("HTTP "+r.status);
  ds=await r.json();
}catch(e){
  const node=document.getElementById("dataset");
  if(node&&node.textContent.trim()) ds=JSON.parse(node.textContent);
}
if(!ds||!Array.isArray(ds.months)||!Array.isArray(ds.rows)||!ds.rows.length){
  document.body.insertAdjacentHTML("afterbegin",'<div class="notice" style="margin:12px">Base de pagamentos não disponível nesta publicação.</div>');
  return;
}
const months=ds.months||[], rows=ds.rows||[];
let loa=null;
try{
  const lr=await fetch("./loa-2026/dados.json?ts="+Date.now(),{cache:"no-store"});
  if(lr.ok){const lj=await lr.json();loa=lj.data||lj;}
}catch(e){console.warn("Base LOA indisponível para percentuais",e)}
const $=id=>document.getElementById(id);
const money=v=>"US$ "+new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(v||0);
const percent=(a,b)=>b&&b>0?new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:1}).format(a/b):"—";
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim();
const monthLabel=m=>{const p=String(m||"").split("/");const names={JAN:"Jan",FEV:"Fev",MAR:"Mar",ABR:"Abr",MAI:"Mai",JUN:"Jun",JUL:"Jul",AGO:"Ago",SET:"Set",OUT:"Out",NOV:"Nov",DEZ:"Dez"};return (names[p[0]]||p[0])+" "+(p[1]||"")};
let state={month:months[months.length-1]||"",vendor:"",type:"",nd:"",pi:"",ug:"",tab:"overview"};
const idx={month:0,commitment:1,code:2,vendor:3,action:4,ug:6,ugName:7,nd:8,pi:10,amount:12,type:13};
const UGS={"120038":"DIRMAB","120026":"PAMA-LS","120001":"GABAER","120068":"PAMA-SP","120048":"PAME-RJ","120071":"CELOG","120049":"PAMA-GL","120090":"CABW","120036":"DECEA","120058":"DIRSA","120111":"EMAER","120136":"DIRAP","120142":"IEAv","120700":"DIREF","120106":"CENIPA","120110":"DCTA","120047":"PAMB-RJ","120624":"BAAN","120115":"COMAE","120128":"CCA-RJ","120132":"DIRENS","120032":"DTI","120130":"COMGAP","120054":"UNIFA","120035":"CTLA","120091":"CABE","120127":"CISCEA","120141":"IAE","120143":"IFI","120197":"IAOp","120283":"GECAMP","120299":"IPEV"};
const ugLabel=r=>UGS[String(r[idx.ug]||"").trim()]||String(r[idx.ugName]||r[idx.ug]||"").trim();
const monthISO=m=>{const p=String(m||"").split("/"),names={JAN:"01",FEV:"02",MAR:"03",ABR:"04",MAI:"05",JUN:"06",JUL:"07",AGO:"08",SET:"09",OUT:"10",NOV:"11",DEZ:"12"};return p.length===2?p[1]+"-"+(names[p[0]]||"01"):""};
function budgetBase(ugCode){
 if(!loa||!Array.isArray(loa.rows))return 0;
 const m=monthISO(state.month);
 return loa.rows.filter(r=>r.month===m&&(!ugCode||r.ug===ugCode)&&(!state.ug||r.ug===state.ug)&&(!state.nd||r.nd===state.nd)&&(!state.pi||r.pi===state.pi)).reduce((a,r)=>a+Number(r.budget||0),0);
}
function rpInscribedBase(ugCode){
 if(!loa||!Array.isArray(loa.rpRows))return 0;
 const m=monthISO(state.month);
 return loa.rpRows.filter(r=>r.month===m&&(!ugCode||r.ug===ugCode)&&(!state.ug||r.ug===state.ug)&&(!state.nd||r.nd===state.nd)&&(!state.pi||r.pi===state.pi)).reduce((a,r)=>a+Number(r.inscribed||0),0);
}
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
 if(state.ug&&String(r[idx.ug])!==state.ug)return false;
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
 const palette=["#244ec7","#b38a1c","#0d9488"];
 let svg='<svg viewBox="0 0 '+W+' '+H+'" class="account-line-chart interactive-svg" role="img">';
 [0,.5,1].forEach(q=>{const yy=T+q*(H-T-B);svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="#e4eaf3"/>'});
 seriesList.forEach((ser,si)=>{const stroke=palette[si%palette.length];svg+='<polyline fill="none" stroke="'+stroke+'" stroke-width="3" points="'+ser.values.map((v,i)=>x(i)+','+y(v)).join(" ")+'"/>';ser.values.forEach((v,i)=>{svg+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3.3" fill="'+stroke+'" opacity=".9"/>'})});
 labels.forEach((m,i)=>{svg+='<text x="'+x(i)+'" y="'+(H-10)+'" text-anchor="middle">'+m.slice(0,3)+'</text>'});
 svg+='<line class="hover-guide" x1="0" x2="0" y1="'+T+'" y2="'+(H-B)+'" stroke="#7f8ca3" stroke-dasharray="4 4" visibility="hidden"/>';
 svg+='</svg>';
 const legend='<div class="rp-legend">'+seriesList.map((ser,i)=>'<span><i style="background:'+palette[i%palette.length]+'"></i>'+ser.name+'</span>').join("")+'</div>';
 target.innerHTML='<div class="chart-interactive">'+svg+'<div class="chart-tooltip" hidden></div></div>'+legend;
 const wrap=target.querySelector(".chart-interactive"),chart=target.querySelector(".interactive-svg"),tip=target.querySelector(".chart-tooltip"),guide=target.querySelector(".hover-guide");
 if(!chart||!labels.length)return;
 const show=e=>{
   const rect=chart.getBoundingClientRect(),px=(e.clientX-rect.left)/rect.width*W;
   let i=0,best=Infinity;labels.forEach((_,j)=>{const d=Math.abs(px-x(j));if(d<best){best=d;i=j}});
   guide.setAttribute("x1",x(i));guide.setAttribute("x2",x(i));guide.setAttribute("visibility","visible");
   tip.hidden=false;
   tip.innerHTML='<div class="chart-tooltip-month">'+monthLabel(labels[i])+'</div>'+seriesList.map((ser,si)=>'<div class="chart-tooltip-row"><span><i style="background:'+palette[si%palette.length]+'"></i>'+ser.name+'</span><strong>'+money(ser.values[i]||0)+'</strong></div>').join("");
   const wr=wrap.getBoundingClientRect(),left=(e.clientX-wr.left)+14;
   tip.style.left=Math.min(Math.max(8,left),Math.max(8,wr.width-205))+"px";
   tip.style.top=Math.max(8,(e.clientY-wr.top)-28)+"px";
 };
 chart.addEventListener("mousemove",show);
 chart.addEventListener("mouseenter",show);
 chart.addEventListener("mouseleave",()=>{tip.hidden=true;guide.setAttribute("visibility","hidden")});
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
 const movementRows=rows.filter(r=>{
   if(state.type&&r[idx.type]!==state.type)return false;
   if(state.nd&&r[idx.nd]!==state.nd)return false;
   if(state.pi&&r[idx.pi]!==state.pi)return false;
   if(state.ug&&String(r[idx.ug])!==state.ug)return false;
   if(state.vendor&&!norm(r[idx.vendor]).includes(norm(state.vendor))&&!norm(r[idx.code]).includes(norm(state.vendor)))return false;
   return true;
 });
 const series=months.map(m=>movementRows.filter(r=>r[idx.month]===m).reduce((a,r)=>a+Number(r[idx.amount]||0),0));
 const mov=movement(series), mi=months.indexOf(state.month);
 $("kpi-total").textContent=money(total);$("kpi-exercicio").textContent=money(ex);$("kpi-rp").textContent=money(rp);$("kpi-vendors").textContent=vendorCount.toLocaleString("pt-BR");$("kpi-movement").textContent=money(mi>=0?mov[mi]:0);
 const vendorScoped=!!state.vendor;
 const credit=vendorScoped?0:budgetBase(""),rpInscribed=vendorScoped?0:rpInscribedBase(""),combinedBase=credit+rpInscribed;
 const totalNote=$("kpi-total").nextElementSibling,exNote=$("kpi-exercicio").nextElementSibling,rpNote=$("kpi-rp").nextElementSibling;
 if(vendorScoped){
   totalNote.textContent="Recorte por favorecido · percentual orçamentário não aplicável";
   exNote.textContent="Crédito recebido não é apropriado por empresa";
   rpNote.textContent="RP inscrito não é apropriado por empresa";
 }else{
   totalNote.textContent=combinedBase?percent(total,combinedBase)+" da base consolidada (crédito + RP inscrito)":"Exercício + restos a pagar";
   exNote.textContent=credit?percent(ex,credit)+" do crédito recebido · base "+money(credit):"Crédito recebido não disponível";
   rpNote.textContent=rpInscribed?percent(rp,rpInscribed)+" do RP inscrito · base "+money(rpInscribed):"RP inscrito não disponível";
 }
 $("record-count").textContent=rows.length.toLocaleString("pt-BR")+" registros";$("position-month").textContent=monthLabel(state.month);$("scope-summary").textContent=rr.length.toLocaleString("pt-BR")+" registros no recorte · "+monthLabel(state.month);
 const grouped=new Map();rr.forEach(r=>{const k=norm(r[idx.vendor]),v=grouped.get(k)||{name:r[idx.vendor],value:0};v.value+=Number(r[idx.amount]||0);grouped.set(k,v)});
 const list=[...grouped.values()].sort((a,b)=>b.value-a.value).slice(0,18),max=Math.max(1,...list.map(x=>x.value));
 $("vendor-bars").innerHTML=list.map(v=>'<button class="bar-row'+(norm(state.vendor)===norm(v.name)?' selected':'')+'" data-vendor="'+v.name.replaceAll('"','&quot;')+'"><span class="bar-name">'+v.name+'</span><span class="bar-track"><i style="width:'+Math.max(1,v.value/max*100)+'%"></i></span><span class="bar-value">'+money(v.value)+'</span></button>').join("")||'<div class="small-empty">Sem dados no recorte.</div>';
 $("vendor-bars").querySelectorAll("[data-vendor]").forEach(b=>b.onclick=()=>{const name=b.dataset.vendor||"";state.vendor=norm(state.vendor)===norm(name)?"":name;$("vendor-search").value=state.vendor;renderAll()});
 const ugMap=new Map();rr.forEach(r=>{const code=String(r[idx.ug]||"").trim(),v=ugMap.get(code)||{code:code,name:ugLabel(r),value:0};v.value+=Number(r[idx.amount]||0);ugMap.set(code,v)});
 const ugList=[...ugMap.values()].sort((a,b)=>b.value-a.value),ugMax=Math.max(1,...ugList.map(x=>x.value));
 $("ug-bars").innerHTML=ugList.map(v=>{const credit=budgetBase(v.code),ins=rpInscribedBase(v.code),base=state.type==="exercicio"?credit:state.type==="rap"?ins:credit+ins;const rate=!state.vendor&&base>0?percent(v.value,base):"";return '<button class="bar-row'+(state.ug===v.code?' selected':'')+'" data-ug="'+v.code+'"><span class="bar-name">'+v.name+' <small>'+v.code+'</small></span><span class="bar-track"><i style="width:'+Math.max(1,v.value/ugMax*100)+'%"></i></span><span class="bar-value">'+money(v.value)+(rate?' <em>'+rate+'</em>':'')+'</span></button>'}).join("")||'<div class="small-empty">Sem UGs no recorte.</div>';
 $("ug-bars").querySelectorAll("[data-ug]").forEach(b=>b.onclick=()=>{const code=b.dataset.ug||"";state.ug=state.ug===code?"":code;renderAll()});
 const trendMatches=r=>{
   if(state.type&&r[idx.type]!==state.type)return false;
   if(state.nd&&r[idx.nd]!==state.nd)return false;
   if(state.pi&&r[idx.pi]!==state.pi)return false;
   if(state.ug&&String(r[idx.ug])!==state.ug)return false;
   if(state.vendor&&!norm(r[idx.vendor]).includes(norm(state.vendor))&&!norm(r[idx.code]).includes(norm(state.vendor)))return false;
   return true;
 };
 const trendRows=rows.filter(trendMatches);
 const totalSeries=months.map(m=>trendRows.filter(r=>r[idx.month]===m).reduce((a,r)=>a+Number(r[idx.amount]||0),0));
 const exSeries=months.map(m=>trendRows.filter(r=>r[idx.month]===m&&r[idx.type]==="exercicio").reduce((a,r)=>a+Number(r[idx.amount]||0),0));
 const rpSeries=months.map(m=>trendRows.filter(r=>r[idx.month]===m&&r[idx.type]==="rap").reduce((a,r)=>a+Number(r[idx.amount]||0),0));
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
$("clear-filters").onclick=()=>{state.vendor="";state.type="";state.nd="";state.pi="";state.ug="";$("vendor-search").value="";$("resource-type").value="";$("nd-filter").value="";$("pi-filter").value="";renderAll()};
$("vendor-select").onchange=renderVendor;
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
setTab("overview");renderAll();
})();