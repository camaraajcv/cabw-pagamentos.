// Importa posições mensais do Tesouro sem somar saldos e preserva meses ausentes no novo arquivo.
const fs=require('fs'),path=require('path'),XLSX=require('xlsx');
const cents=v=>Math.round(v*100)||0;
const monthNumbers={JAN:'01',FEV:'02',MAR:'03',ABR:'04',MAI:'05',JUN:'06',JUL:'07',AGO:'08',SET:'09',OUT:'10',NOV:'11',DEZ:'12'};
function parseWorkbook(input){
 const book=XLSX.readFile(input,{cellDates:false}),months={};let extractedOn=null;
 for(const name of book.SheetNames){
  const a=XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:null});
  const heading=a.findIndex(row=>row.some(v=>String(v).trim()==='Compromissos')&&row.some(v=>String(v).trim()==='Diferido'));
  if(heading<1)continue;
  const stamp=a.flat().map(String).join('\n').match(/Data de Execução do Relatório:\s*(\d{2}\/\d{2}\/\d{4})/);
  if(stamp)extractedOn=stamp[1];
  for(let col=0;col<a[heading-1].length;col++){
   const match=String(a[heading-1][col]||'').trim().match(/^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(\d{4})$/);
   if(!match)continue;
   if(a[heading][col]!=='Compromissos'||a[heading][col+1]!=='Disponibilidade Financeira'||a[heading][col+2]!=='Diferido')throw Error('Cabeçalhos incompatíveis em '+name);
   const key=match[2]+'-'+monthNumbers[match[1]];if(months[key])throw Error('Mês duplicado: '+key);
   const rows=[];let declared=null;
   const number=v=>{if(v===null||v==='')return 0;if(typeof v!=='number'||!Number.isFinite(v))throw Error('Valor inválido em '+key+': '+v);return cents(v)};
   for(const row of a.slice(heading+1)){
    if(String(row[0]||'').trim()==='Total'){declared=[0,1,2].map(i=>number(row[col+i]));continue;}
    const code=String(row[0]??'').trim();if(!/^[0-9A-Z]{10}$/.test(code))continue;
    const [commitments,availability,deferred]=[0,1,2].map(i=>number(row[col+i]));
    if(availability-commitments!==deferred)throw Error('Diferido não confere: '+key+' / '+code);
    rows.push({code,description:String(row[1]||'').trim(),commitments:commitments/100,availability:availability/100,deferred:deferred/100});
   }
   if(!rows.length||!declared)throw Error('Detalhamento ou total ausente: '+key);
   const totals=['commitments','availability','deferred'].map(k=>rows.reduce((n,r)=>n+cents(r[k]),0));
   if(totals.some((v,i)=>v!==declared[i]))throw Error('Total não confere em '+key);
   months[key]={month:key,rows,totals:{commitments:totals[0]/100,availability:totals[1]/100,deferred:totals[2]/100},sourceFile:path.basename(input),sheet:name,extractedOn};
  }
 }
 if(!Object.keys(months).length)throw Error('Nenhuma posição mensal encontrada.');
 return months;
}
function merge(current,incoming){return {schemaVersion:1,currency:'USD',months:{...(current.months||{}),...incoming}};}
module.exports={parseWorkbook,merge};
if(require.main===module){
 const [input,existing,output]=process.argv.slice(2);
 if(!input||!existing||!output)throw Error('Uso: node atualizar-diferido.cjs fonte.xlsx base.json nova-base.json');
 const current=fs.existsSync(existing)?JSON.parse(fs.readFileSync(existing,'utf8')):{};
 const incoming=parseWorkbook(input),result=merge(current,incoming);
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({importedMonths:Object.keys(incoming).sort(),storedMonths:Object.keys(result.months).sort(),totals:Object.fromEntries(Object.entries(incoming).map(([m,v])=>[m,v.totals]))},null,2));
}
