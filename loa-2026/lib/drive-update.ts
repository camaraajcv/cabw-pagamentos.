import {autoMap,parseRows,prepareTesouro,sum,type Dataset} from './budget';
export const DRIVE_FILE_ID='1vSKMEtAoZemky6ZUvtqC0pbTXIZD9zP5';
export const DRIVE_FOLDER_ID='1cts6q4qAOZwsw3Vtz_Gq9g3cFDVuFCvU';
export function decodeCSV(bytes:Uint8Array):string{
 let text=new TextDecoder(bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8').decode(bytes).replace(/^\uFEFF/,'');
 if(text.trimStart().startsWith('{')){let wrapper;try{wrapper=JSON.parse(text)}catch{throw Error('O arquivo contém JSON inválido.');}if(typeof wrapper.ContentBytes!=='string')throw Error('Conteúdo CSV ausente no arquivo.');const binary=atob(wrapper.ContentBytes);return decodeCSV(Uint8Array.from(binary,c=>c.charCodeAt(0)));}
 return text;
}
export function csvMatrix(text:string):string[][]{
 const delimiter=(text.split(/\r?\n/).find(l=>/UG Respons/i.test(l))||text.split(/\r?\n/)[0]).includes(';')?';':',';
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('Aspas não fechadas no CSV.');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
export function mergeDriveCSV(text:string,previous:Dataset,fileName:string){
 const prepared=prepareTesouro(csvMatrix(text),'credit');if(!prepared.derived||!prepared.reference)throw Error('O arquivo deve conter o relatório Tesouro com mês, crédito recebido e percentuais.');
 const parsed=parseRows(prepared.matrix,0,autoMap(prepared.matrix[0].map(String)),prepared.reference);
 if(parsed.rows.some(r=>!r.month.startsWith('2026-')||r.ug==='Não informado'||r.action==='Não informado'||r.pi==='Não informado'||r.nd==='Não informado'))throw Error('Período ou dimensões inválidas no relatório LOA 2026.');
 if(previous.mode!=='snapshot'||previous.currency!=='USD')throw Error('A base existente precisa ser de posições acumuladas em USD.');
 const latest=[...new Set(parsed.rows.map(r=>r.month))].sort().at(-1)!;
 const incoming=parsed.rows.filter(r=>r.month===latest);
 const latestExisting=[...new Set(previous.rows.map(r=>r.month))].sort().at(-1);
 if(latestExisting&&latest<latestExisting)throw Error('O arquivo é de mês anterior à última competência do painel; nenhuma alteração foi feita.');
 const data:Dataset={...previous,rows:[...previous.rows.filter(r=>r.month!==latest),...incoming],fileName,reference:latest,mode:'snapshot',currency:'USD',derived:true,percentBase:'credit',updatedAt:new Date().toISOString(),ugAliases:{...parsed.ugAliases,...previous.ugAliases},available:[...new Set([...previous.available,...parsed.available])],skipped:parsed.skipped};
 return {data,summary:{month:latest,records:incoming.length,paid:sum(incoming,'paid'),committed:sum(incoming,'committed'),credit:sum(incoming,'budget'),preservedMonths:[...new Set(previous.rows.filter(r=>r.month!==latest).map(r=>r.month))].sort()}};
}
