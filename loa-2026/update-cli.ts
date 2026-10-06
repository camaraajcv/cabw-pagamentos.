import fs from 'node:fs';
import {decodeCSV,mergeDriveCSV} from './lib/drive-update';
const [rawPath,currentPath,outPath]=process.argv.slice(2);
if(!rawPath||!currentPath||!outPath)throw Error('Uso: node atualizar-loa.cjs fonte.csv dados.json novos-dados.json');
const old=JSON.parse(fs.readFileSync(currentPath,'utf8'));
const prepared=mergeDriveCSV(decodeCSV(fs.readFileSync(rawPath)),old.data,'Pagamentos LOA 2026 CABW.csv');
const month=prepared.summary.month;
const before=old.data.rows.filter((r:any)=>r.month!==month);
const after=prepared.data.rows.filter((r:any)=>r.month!==month);
if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Histórico alterado: publicação cancelada');
const oldTarget=old.data.rows.filter((r:any)=>r.month===month);
const newTarget=prepared.data.rows.filter((r:any)=>r.month===month);
const changed=JSON.stringify(oldTarget)!==JSON.stringify(newTarget);
if(changed){fs.writeFileSync(outPath,JSON.stringify({data:prepared.data,etag:'github',source:{fileId:'1vSKMEtAoZemky6ZUvtqC0pbTXIZD9zP5',folderId:'1cts6q4qAOZwsw3Vtz_Gq9g3cFDVuFCvU'}}));}
console.log(JSON.stringify({changed,...prepared.summary}));
