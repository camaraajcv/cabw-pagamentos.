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

  function rubricGroups() {
    return report?engine.summarizeRubrics(report.rows):[];
  }
  function hasManualRubricChanges() {
    if(!report)return false;
    const selected=new Set(report.excludedCodes);
    const defaults=new Set(engine.DEFAULT_EXCLUDED_RUBRICS);
    return rubricGroups().some(g=>selected.has(g.code)!==defaults.has(g.code));
  }
  function refreshRubricSummary() {
    if(!report)return;
    const changes=hasManualRubricChanges();
    const selected=new Set(report.excludedCodes);
    const selectedRubrics=rubricGroups().filter(g=>selected.has(g.code));
    const baseSet=new Set(engine.DEFAULT_EXCLUDED_RUBRICS);
    const diff=rubricGroups().filter(g=>selected.has(g.code)!==baseSet.has(g.code)).length;
    $("metric-excluded").textContent=engine.brl(report.totalExcluido);
    $("metric-export-2").textContent=engine.brl(report.totalExport);
    $("metric-export").textContent=engine.brl(report.totalExport);
    $("qtd-export").textContent=report.exportaveis.length;
    $("stat-exclusoes").textContent=report.excluidas.length+" lançamentos excluídos";
    $("rubric-mode").textContent=changes?"Personalizado ("+diff+" alteração"+(diff===1?"":"ões")+")":"Exclusões padrão";
    $("rubric-custom-note").hidden=!changes;
    $("custom-confirm").hidden=!changes;
    if(!changes)$("confirm-rubrics").checked=false;
  }
  function renderRubricList() {
    if(!report)return;
    const search=$("busca-rubrica").value.trim().toLocaleLowerCase("pt-BR");
    const defaultSet=new Set(engine.DEFAULT_EXCLUDED_RUBRICS);
    const selected=new Set(report.excludedCodes);
    const groups=rubricGroups().sort((a,b)=>{
      const ad=Number(defaultSet.has(a.code)),bd=Number(defaultSet.has(b.code));
      return bd-ad || a.code.localeCompare(b.code);
    });
    const visible=groups.filter(g=>!search || (g.code+" "+g.description).toLocaleLowerCase("pt-BR").includes(search));
    $("rubric-results").textContent=visible.length+" de "+groups.length+" rubricas";
    const fragment=document.createDocumentFragment();
    for(const group of visible) {
      const label=document.createElement("label");
      label.className="rubric-row";
      label.dataset.selected=String(selected.has(group.code));
      const check=document.createElement("input");
      check.type="checkbox";
      check.dataset.rubrica=group.code;
      check.checked=selected.has(group.code);
      check.setAttribute("aria-label","Excluir rubrica "+group.code+" dos XMLs");
      const details=document.createElement("span");
      details.className="rubric-details";
      const code=document.createElement("span");
      code.className="rubric-code";
      code.textContent=group.code+(defaultSet.has(group.code)?" · Exclusão padrão":"");
      const description=document.createElement("span");
      description.className="rubric-description";
      description.textContent=group.description||"Rubrica sem descrição";
      details.append(code,description);
      const money=document.createElement("span");
      money.className="rubric-value";
      money.textContent=engine.brl(group.total);
      const count=document.createElement("small");
      count.textContent=group.count+" lançamento"+(group.count===1?"":"s");
      money.append(count);
      label.append(check,details,money);
      fragment.append(label);
    }
    $("rubric-list").replaceChildren(fragment);
  }
  function changeExclusions(excludedCodes) {
    if(!report)return;
    report=engine.applyRubricExclusions(report,excludedCodes);
    invalidateDownloads();
    $("confirm-rubrics").checked=false;
    $("form-status").hidden=true;
    refreshRubricSummary();
    renderTable();
  }
  $("rubric-list").addEventListener("change",event=>{
    const el=event.target;
    if(!report || !el.matches("input[type=checkbox][data-rubrica]"))return;
    const selected=new Set(report.excludedCodes);
    if(el.checked) selected.add(el.dataset.rubrica);
    else selected.delete(el.dataset.rubrica);
    try {
      changeExclusions(selected);
      el.closest(".rubric-row").dataset.selected=String(el.checked);
    } catch(error) {
      el.checked=!el.checked;
      status($("form-status"),"Não foi possível alterar as rubricas: "+error.message,"error");
    }
  });
  $("busca-rubrica").addEventListener("input",renderRubricList);
  $("reset-rubricas").addEventListener("click",()=>{
    if(!report)return;
    changeExclusions(engine.DEFAULT_EXCLUDED_RUBRICS);
    renderRubricList();
  });

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
      $("stat-exclusoes").textContent=report.excluidas.length+" lançamentos excluídos";
      $("stat-paginas").textContent=report.pages+" páginas verificadas";
      $("resultado").hidden=false;
      $("busca").value="";
      $("busca-rubrica").value="";
      $("confirm-rubrics").checked=false;
      refreshRubricSummary();
      renderRubricList();
      chooseTab("todos");
      const complementos=report.auxiliaryTotals
        .filter(item=>item.type!=="NÃO IDENTIFICADO")
        .map(item=>"demonstrativo "+item.type+": "+engine.brl(item.value));
      const extra=complementos.length
        ? " Totais complementares já incluídos no valor geral ("+complementos.join("; ")+")."
        : "";
      status($("status"),"Relatório "+file.name+" importado e conciliado com sucesso."+extra, "ok");
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
    if(hasManualRubricChanges()&&!$("confirm-rubrics").checked){
      status($("form-status"),"Confirme a revisão das rubricas personalizadas e do valor a exportar antes de gerar os XMLs.","error");
      return;
    }
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
