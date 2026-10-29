'use strict';
const $=s=>document.querySelector(s);
const icons={home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',file:'<path d="M14 3H5v18h14V8z"/><path d="M14 3v5h5M8 12h8M8 16h6"/>',layers:'<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',book:'<path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1v15"/>',shield:'<path d="m12 2 8 3v6c0 5-5 9-8 11-3-2-8-6-8-11V5z"/><path d="m8 11 3 3 5-6"/>'};
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[el.dataset.icon]}</svg>`);
const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-'),year=String(now.getFullYear()),month=String(now.getMonth()+1).padStart(2,'0');
const legal=[['104','104 · Modalidade não se aplica'],['001','001 · Concorrência'],['002','002 · Tomada de preços'],['003','003 · Convite'],['004','004 · Concurso'],['005','005 · Leilão'],['006','006 · Pregão'],['007','007 · Diálogo competitivo'],['008','008 · Dispensa de licitação'],['009','009 · Inexigibilidade']];
// Cada campo mantém uma chave independente da apresentação.
function fields(container,prefix,specs){
 for(const [name,label,value='',type='text',extra] of specs){
  const div=document.createElement('div');div.className='field';
  const lab=document.createElement('label');lab.htmlFor=`${prefix}-${name}`;lab.textContent=label;
  const input=document.createElement(type==='select'?'select':'input');input.name=name;input.id=lab.htmlFor;
  if(type==='select'){for(const [v,t] of extra){const opt=document.createElement('option');opt.value=v;opt.textContent=t;input.append(opt);}}else{input.type=type;input.autocomplete='off';if(['cpf','ug','payUg','empeUg','benefUg','headerUg','siorg'].includes(name))input.inputMode='numeric';}
  input.value=value;div.append(lab,input);$(container).append(div);
 }
}
fields('#ne-identification','ne',[['cpf','CPF do responsável'],['ug','UG executora','120052'],['eventDate','Data do empenho',today,'date'],['process','NUP / processo']]);
fields('#ne-descriptions','ne',[['description','Descrição geral do empenho'],['itemDescription','Descrição dos itens']]);
fields('#ne-settings','ne',[['type','Tipo de empenho','1','select',[['1','1 · Ordinário'],['3','3 · Estimativo'],['5','5 · Global']]],['legal','Modalidade / amparo legal','104','select',legal]]);
fields('#ne-passivo','ne',[['account','Conta padrão do passivo','211110101'],['ptresText','PTRES com passivo (separados por vírgula)','168870, 249586, 137835']]);
fields('#dh-basic-fields','dh',[['ug','UG emitente','120052'],['year','Ano do documento',year],['dhType','Tipo de documento hábil','FL'],['emissionDate','Data de emissão',today,'date'],['dueDate','Data de vencimento',today,'date'],['attestDate','Data do ateste',today,'date'],['payUg','UG pagadora','120052'],['creditor','Credor / devedor (UG)','120052'],['payDate','Data do pagamento',today,'date'],['description','Descrição do pagamento'],['process','NUP / processo'],['docNumber','Documento de origem'],['docIssuer','Identificação do emitente','120052']]);
fields('#dh-pco-settings','dh',[['empeUg','UG dos empenhos','120052']]);
fields('#dh-cc-fields','dh',[['cc','Centro de custos padrão','221A00'],['month','Mês de referência (MM)',month],['ccYear','Ano de referência',year],['benefUg','UG beneficiária','120052'],['siorg','Código SIORG','2332']]);
fields('#dh-payment-fields','dh',[['ob','Tipo de ordem bancária','OBF'],['favAccount','Conta do favorecido','FOPAG'],['payBank','Banco pagador','002'],['payAccount','Conta pagadora','UNICA']]);
fields('#dh-header-fields','dh',[['layout','Leiaute do arquivo','DH001'],['headerUg','UG responsável','120052'],['generationDate','Data de geração',today,'date'],['sequence','Sequencial de geração','1'],['headerYear','Ano de referência do arquivo',year],['cpf','CPF do responsável']]);
fields('#dh-accounting-fields','dh',[['accountingWeights','Linhas por item de outras situações (opcional)']]);
$('#dh-accountingWeights').placeholder='SITUAÇÃO=quantidade, SITUAÇÃO=quantidade';
const titles={inicio:'Visão geral',empenhos:'Geração de empenhos',liquidacao:'Liquidação da folha',orientacoes:'Orientações'};
function route(){const name=location.hash.slice(1);const page=titles[name]?name:name.startsWith('guia-')?'orientacoes':'inicio';document.querySelectorAll('.page').forEach(s=>s.hidden=s.id!==`page-${page}`);document.querySelectorAll('nav a[data-page]').forEach(a=>{a.classList.toggle('active',a.dataset.page===page);if(a.dataset.page===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});$('#breadcrumb-current').textContent=titles[page];document.title=`${titles[page]} · Portal SDPP`;}
window.addEventListener('hashchange',()=>{route();const target=document.getElementById(location.hash.slice(1));if(location.hash.startsWith('#guia-')&&target)target.scrollIntoView({behavior:'smooth'});else window.scrollTo({top:0});});route();
$('.skip').addEventListener('click',e=>{e.preventDefault();$('#conteudo').focus();$('#conteudo').scrollIntoView();});
let currentStep=0;
function step(n,focus=false){currentStep=Math.max(0,Math.min(5,n));document.querySelectorAll('.dh-step').forEach((s,i)=>s.hidden=i!==currentStep);document.querySelectorAll('[data-step]').forEach((b,i)=>{b.setAttribute('aria-selected',String(i===currentStep));b.tabIndex=i===currentStep?0:-1;});$('#step-prev').disabled=currentStep===0;$('#step-next').hidden=currentStep===5;$('#step-label').textContent=`Etapa ${currentStep+1} de 6`;if(focus)$(`[data-step="${currentStep}"]`).focus();}
document.querySelectorAll('[data-step]').forEach(b=>{b.addEventListener('click',()=>step(Number(b.dataset.step)));b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();step(e.key==='Home'?0:e.key==='End'?5:currentStep+(e.key==='ArrowRight'?1:-1),true);}});});
$('#step-prev').addEventListener('click',()=>step(currentStep-1,true));$('#step-next').addEventListener('click',()=>step(currentStep+1,true));step(0);
const activeResults={ne:null,dh:null};const objectUrls={};
function clearResult(kind,message=false){if(objectUrls[kind]){for(const url of objectUrls[kind])URL.revokeObjectURL(url);delete objectUrls[kind];}if(activeResults[kind]){activeResults[kind]=null;const el=$(`#${kind}-result`);el.replaceChildren();if(message){const note=document.createElement('div');note.className='notice';note.textContent='Os dados foram alterados. Gere novamente para atualizar os XMLs.';el.append(note);}}}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function metric(label,value){const n=el('div','metric');n.append(el('small','',label),el('strong','',value));return n;}
function result(kind,r){
 clearResult(kind);activeResults[kind]=r;const host=$(`#${kind}-result`);host.replaceChildren();
 const files=r.files||[{xml:r.xml,filename:r.filename}];
 host.append(el('div','result-success',`✓ ${files.length===1?'XML gerado':files.length+' XMLs gerados'}. Confira os valores e as classificações antes de importar no SIAFI.`));
 if(files.length>1)host.append(el('div','notice',`O lote tem ${r.metrics.accountingLines} linhas contábeis e ultrapassa o limite de 100 por arquivo. Foram gerados ${files.length} XMLs separados, com uma FL em cada arquivo e sequenciais de ${files[0].sequence} a ${files.at(-1).sequence}. As DFL e suas AFL do mesmo empenho e subelemento foram mantidas juntas.`));
 const metrics=el('div','metrics');metrics.append(metric('Lançamentos informados',String(r.metrics.items)),metric(kind==='ne'?'Empenhos no arquivo':'Arquivos XML / FLs',String(r.metrics.details)),metric(kind==='ne'?'Valor total':'Valor líquido da folha',SDPP.br(r.metrics.total)));
 if(kind==='dh')metrics.append(metric('PCO positivo',SDPP.br(r.metrics.positive)),metric('Anulações',SDPP.br(r.metrics.negative)),metric('Pagamentos',SDPP.br(r.metrics.payments)),metric('Outros lançamentos',SDPP.br(r.metrics.others)),metric('Apropriação aos centros',SDPP.br(r.metrics.cc)),metric('Linhas contábeis no lote',String(r.metrics.accountingLines)));
 host.append(metrics);
 if(kind==='dh'){
  const summary=el('section','panel');summary.append(el('h2','','Divisão por arquivo XML'));
  const wrap=el('div','table-scroll'),table=el('table'),thead=el('thead'),head=el('tr');
  ['Arquivo','Sequencial','Itens DFL','Itens AFL','Grupos AFL (empenho/subelemento)','Outros lançamentos','Linhas contábeis / 100','Valor líquido'].forEach(label=>head.append(el('th','',label)));thead.append(head);table.append(thead);
  const body=el('tbody');for(const d of r.detailsSummary){const row=el('tr');[d.document,d.sequence,d.dfl,d.afl,d.aflGroups,d.others,d.accountingLines+' / 100',d.value].forEach(v=>row.append(el('td','',String(v))));body.append(row);}table.append(body);wrap.append(table);summary.append(wrap,el('p','field-help','Contagem: cada item DFL = 3 linhas; AFL = 6 linhas por combinação de empenho e subelemento, independentemente da quantidade de itens AFL nessa combinação. Outros lançamentos não entram na contagem e ficam somente no primeiro XML. As quantidades de DFL e AFL podem ser diferentes.'));host.append(summary);
 }
 for(const warning of r.warnings)host.append(el('div','notice',warning));
 objectUrls[kind]=[];
 const links=files.map(f=>{const link=el('a','secondary',`Baixar ${f.filename} ↓`);const url=URL.createObjectURL(new Blob([f.xml],{type:'application/xml;charset=utf-8'}));objectUrls[kind].push(url);link.href=url;link.download=f.filename;return link;});
 const actions=el('div','result-actions');
 if(files.length===1){const link=links[0].cloneNode(true);link.className='primary';actions.append(link);}
 else{
  const all=el('button','primary',`Baixar XMLs (${files.length} arquivos) ↓`);all.type='button';all.addEventListener('click',()=>{links.forEach(link=>link.click());hint.textContent='Downloads solicitados. Se o navegador pedir, permita vários downloads; você também pode baixar cada XML separadamente ou usar o pacote ZIP.';});actions.append(all);
  const archive=el('a','secondary','Baixar pacote ZIP ↓');const url=URL.createObjectURL(new Blob([SDPP.zip(files)],{type:'application/zip'}));objectUrls[kind].push(url);archive.href=url;archive.download=`DH001_XMLs_${files[0].sequence}_a_${files.at(-1).sequence}.zip`;actions.append(archive);
 }
 const hint=el('p','field-help',files.length===1?'Arquivo gerado neste dispositivo.':'O botão solicita um download por XML. O pacote ZIP contém os mesmos arquivos separados.');host.append(actions,hint);
 files.forEach((f,i)=>{
  const preview=el('section','panel xml-preview');preview.append(el('h2','',files.length===1?'Visualização do XML':`XML ${i+1} de ${files.length} · Sequencial ${f.sequence}`));
  const bar=el('div','result-actions');bar.append(links[i]);if(f.accountingLines!==undefined)bar.append(el('span','field-help',`${f.accountingLines} / 100 linhas contábeis · Uma FL neste arquivo`));preview.append(bar);
  const details=el('details'),summary=el('summary','',`Visualizar ${f.filename}`),pre=el('pre','',f.xml.replace(/></g,'>\n<'));details.open=files.length>1;details.append(summary,pre);preview.append(details);host.append(preview);
 });
 const panel=el('section','panel');panel.append(el('h2','','Conferência dos lançamentos'));const wrap=el('div','table-scroll'),table=el('table'),thead=el('thead'),tr=el('tr');const keys=kind==='ne'?['ndd','ptres','account','value']:['empe','ndd','sit','account','cc','value'];const labels=kind==='ne'?['NDD','PTRES','Conta do passivo','Valor']:['Empenho','NDD / SE','Situação','Classificação B','Centro de custos','Valor'];labels.forEach(l=>tr.append(el('th','',l)));thead.append(tr);table.append(thead);const tbody=el('tbody');for(const row of r.rows){const t=el('tr');keys.forEach(k=>t.append(el('td','',String(row[k]))));tbody.append(t);}table.append(tbody);wrap.append(table);panel.append(wrap);
 host.append(panel);host.scrollIntoView({behavior:'smooth',block:'start'});
}
function readForm(kind){const data=Object.fromEntries(new FormData($(`#${kind}-form`)));for(const k in data)data[k]=data[k].trim();if(kind==='ne')data.ptres=data.ptresText.split(/[,;\s]+/).filter(Boolean);return data;}
for(const kind of ['ne','dh']){
 const form=$(`#${kind}-form`);form.addEventListener('input',()=>clearResult(kind,true));form.addEventListener('change',()=>clearResult(kind,true));
 form.addEventListener('submit',e=>{e.preventDefault();try{const output=SDPP[kind](readForm(kind));for(const file of output.files||[output]){const parsed=new DOMParser().parseFromString(file.xml,'application/xml');if(parsed.getElementsByTagName('parsererror').length)throw new Error('Não foi possível validar a estrutura do XML. Confira os dados informados.');}result(kind,output);}catch(err){clearResult(kind);const host=$(`#${kind}-result`);host.replaceChildren(el('div','result-error',`Não foi possível gerar o XML. ${err.message}`));host.scrollIntoView({behavior:'smooth',block:'start'});}});
}
function setValues(kind,values){for(const [name,value] of Object.entries(values)){const field=$(`#${kind}-form`).elements.namedItem(name);if(field)field.value=value;}}
document.querySelectorAll('[data-demo]').forEach(b=>b.addEventListener('click',()=>{
 const kind=b.dataset.demo;
 if((kind==='ne'?$('#ne-data').value:$('#dh-pco').value)&&!window.confirm('Substituir os dados atuais deste módulo por um exemplo fictício?'))return;
 clearResult(kind);$(`#${kind}-result`).replaceChildren();
 if(kind==='ne')setValues(kind,{cpf:'12345678901',ug:'120052',eventDate:today,process:'EXEMPLO/2026',description:'EXEMPLO FICTÍCIO — FOLHA DE PAGAMENTO',itemDescription:'Exemplo para teste',type:'1',legal:'104',account:'211110101',ptresText:'168870, 249586, 137835',data:'1 168870 31909294 1000000000 120052 TESTE 1.000,00\n1 168870 33909259 1000000000 120052 TESTE 500,00\n1 168870 33909208 1000000000 120052 TESTE 250,00\n1 168870 33909293 1000000000 120052 TESTE 250,00'});
 else{setValues(kind,{ug:'120052',year,dhType:'FL',emissionDate:today,dueDate:today,attestDate:today,payDate:today,payUg:'120052',creditor:'120052',description:'EXEMPLO FICTÍCIO — FOLHA DE PAGAMENTO',process:'EXEMPLO/2026',docNumber:'FOPAG.TESTE',docIssuer:'120052',empeUg:'120052',cc:'221A00',month,ccYear:year,benefUg:'120052',siorg:'2332',ob:'OBF',favAccount:'FOPAG',payBank:'002',payAccount:'UNICA',layout:'DH001',headerUg:'120052',generationDate:today,sequence:'1',headerYear:year,cpf:'12345678901',accountingWeights:'',pco:'2026NE000001 33900802 DFL041 113110105 1.000,00\n2026NE000002 31909294 DFL034 113110105 500,00\n2026NE000003 33909208 DFL038 113110105 250,00\n2026NE000004 31901143 DFL031 113110101 100,00\n2026NE000004 31901143 AFL031 113110101 50,00',others:'',payments:'00.000.000/0001-91 001 1607 TESTE 1.800,00'});step(0);}
}));
