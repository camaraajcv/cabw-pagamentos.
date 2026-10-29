/* Portal SDPP — interface do módulo de consignações civis. */
"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const engine = window.SIAPECIVIL;
  let report = null;
  let tab = "todos";
  let urls = [];
  const form = $("xml-form");
  const date = new Date();
  const currentYear = String(date.getFullYear());
  const currentMonth = String(date.getMonth()+1).padStart(2,"0");
  $("year").value=currentYear;
  $("anoCC").value=currentYear;
  $("mesCC").value=currentMonth;

  function status(el, message, type="info") {
    el.textContent=message;
    el.dataset.type=type;
    el.hidden=false;
  }
  function invalidateDownloads() {
    urls.forEach(u=>URL.revokeObjectURL(u));
    urls=[];
    $("downloads").hidden=true;
  }
  function resetReport() {
    report=null;
    $("resultado").hidden=true;
    invalidateDownloads();
    $("tabela-body").replaceChildren();
  }
  function addCell(tr,value,cssClass="") {
    const td=document.createElement("td");
    td.textContent=String(value);
    if(cssClass)td.className=cssClass;
    tr.append(td);
  }
  function renderTable() {
    if(!report)return;
    const records=tab==="todos"?report.rows:report.excluidas;
    const search=$("busca").value.trim().toLocaleLowerCase("pt-BR");
    const filtered=records.filter(r=>!search || [r.empresa,r.cnpjFmt,r.rubrica,r.tipo,r.bco,r.conta].some(s=>String(s).toLocaleLowerCase("pt-BR").includes(search)));
    const body=$("tabela-body"),fragment=document.createDocumentFragment();
    for(const r of filtered) {
      const tr=document.createElement("tr");
      addCell(tr,r.cnpjFmt);
      addCell(tr,r.empresa);
      addCell(tr,r.rubrica);
      addCell(tr,r.qtdServ);
      addCell(tr,engine.brl(r.bruto),"money");
      addCell(tr,engine.brl(r.serpro),"money");
      addCell(tr,engine.brl(r.liquido),"money");
      addCell(tr,r.bco);
      addCell(tr,r.ag);
      addCell(tr,r.conta);
      fragment.append(tr);
    }
    body.replaceChildren(fragment);
    $("resultado-busca").textContent=filtered.length+" de "+records.length+" registros";
  }
  function chooseTab(next) {
    tab=next;
    $("tab-todos").setAttribute("aria-selected",String(next==="todos"));
    $("tab-excluidos").setAttribute("aria-selected",String(next==="excluidos"));
    renderTable();
  }
  $("tab-todos").addEventListener("click",()=>chooseTab("todos"));
  $("tab-excluidos").addEventListener("click",()=>chooseTab("excluidos"));
  $("busca").addEventListener("input",renderTable);

  $("pdf-file").addEventListener("change",async event=>{
    resetReport();
    const file=event.target.files?.[0];
    if(!file){$("status").hidden=true;return;}
    if(file.size>30*1024*1024){status($("status"),"O PDF ultrapassa o limite de 30 MB.","error");return;}
    if(!file.name.toLocaleLowerCase("pt-BR").endsWith(".pdf")){status($("status"),"Selecione um arquivo .pdf.","error");return;}
    if(!engine||!window.pdfjsLib){status($("status"),"Não foi possível carregar a biblioteca de leitura PDF. Confira a conexão e recarregue a página.","error");return;}

    let pdf;
    try{
      window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      status($("status"),"Abrindo o relatório PDF no navegador…");
      const bytes=new Uint8Array(await file.arrayBuffer());
      pdf=await window.pdfjsLib.getDocument({data:bytes,isEvalSupported:false}).promise;
      if(pdf.numPages>200)throw new Error("Arquivo possui páginas demais para este módulo (limite: 200).");
      const pages=[];
      for(let i=1;i<=pdf.numPages;i++){
        status($("status"),"Processando página "+i+" de "+pdf.numPages+"…");
        const page=await pdf.getPage(i);
        const content=await page.getTextContent();
        pages.push(engine.linesFromItems(content.items));
      }
      report=engine.parsePdfLines(pages);
      $("metric-siape").textContent=engine.brl(report.total);
      $("metric-soma").textContent=engine.brl(report.soma);
      $("metric-diferenca").textContent=engine.brl(report.soma-report.total);
      $("metric-export").textContent=engine.brl(report.totalExport);
      $("qtd-export").textContent=report.exportaveis.length;
      $("stat-ref").textContent="Competência: "+(report.reference||"não identificada");
      $("stat-qtd").textContent=report.rows.length+" lançamentos identificados";
      $("stat-exclusoes").textContent=report.excluidas.length+" rubricas excluídas";
      $("stat-paginas").textContent=report.pages+" páginas verificadas";
      $("resultado").hidden=false;
      $("busca").value="";
      chooseTab("todos");
      status($("status"),"Relatório "+file.name+" importado e conciliado com sucesso.", "ok");
      $("form-status").hidden=true;
      $("resultado").scrollIntoView({behavior:"smooth",block:"start"});
    }catch(error){
      resetReport();
      status($("status"),"Não foi possível validar o relatório: "+(error.message||String(error)), "error");
    }finally{
      if(pdf)await pdf.destroy().catch(()=>{});
    }
  });

  form.addEventListener("input",()=>invalidateDownloads());
  form.addEventListener("change",()=>invalidateDownloads());

  form.addEventListener("submit",event=>{
    event.preventDefault();
    invalidateDownloads();
    if(!report){status($("form-status"),"Importe e concilie um PDF antes de gerar os arquivos.","error");return;}
    if(!form.reportValidity())return;
    try{
      const data=Object.fromEntries(new FormData(form).entries());
      const {fl,deducao,quantidade,totalCents}=engine.generateXml(report,data);
      const files=[{name:"xml_FL_"+data.year+"_"+data.fl+".xml",id:"download-fl",body:fl},
        {name:"xml_deducao_"+data.year+"_"+data.fl+".xml",id:"download-ded",body:deducao}];
      for (const item of files) {
        const url=URL.createObjectURL(new Blob([item.body],{type:"application/xml;charset=utf-8"}));
        urls.push(url);
        const link=$(item.id);
        link.href=url;
        link.download=item.name;
      }
      status($("form-status"),"Os dois XMLs foram gerados com sucesso. Revise os documentos antes da importação.","ok");
      $("download-status").textContent="DH001: "+engine.brl(totalCents)+" · DH002: "+quantidade+" deduções · Confira os valores e os favorecidos no SIAFI.";
      $("downloads").hidden=false;
      $("downloads").scrollIntoView({behavior:"smooth",block:"start"});
    }catch(error){
      status($("form-status"),error.message||String(error),"error");
    }
  });
})();
