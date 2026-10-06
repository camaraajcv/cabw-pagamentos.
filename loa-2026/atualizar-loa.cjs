var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// github-portal/update-cli.ts
var import_node_fs = __toESM(require("node:fs"));

// github-portal/lib/budget.ts
var UGS = { "120038": "DIRMAB", "120026": "PAMA-LS", "120001": "GABAER", "120068": "PAMA-SP", "120048": "PAME-RJ", "120071": "CELOG", "120049": "PAMA-GL", "120090": "CABW", "120036": "DECEA", "120058": "DIRSA", "120111": "EMAER", "120136": "DIRAP", "120142": "IEAv", "120700": "DIREF", "120106": "CENIPA", "120110": "DCTA", "120047": "PAMB-RJ", "120624": "BAAN", "120115": "COMAE", "120128": "CCA-RJ", "120132": "DIRENS", "120032": "DTI", "120130": "COMGAP", "120054": "UNIFA", "120035": "CTLA", "120091": "CABE", "120127": "CISCEA", "120141": "IAE", "120143": "IFI", "120197": "IAOp", "120283": "GECAMP", "120299": "IPEV" };
var normalize = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
var aliases = { ug: ["ugresponsavelcodigo", "codigougresponsavel", "ugresponsavel", "ugr", "ug"], ugName: ["ugresponsavelsigla", "siglaugr", "siglaug", "sigla"], action: ["acaoorcamentariacodigo", "acaoorcamentaria", "acaogoverno", "codigoacao", "acao"], pi: ["planointernocodigo", "planointerno", "pi"], nd: ["naturezadedespesacodigo", "naturezadespesacodigo", "naturezadedespesa", "naturezadespesa", "nd"], month: ["meslancamento", "mesreferencia", "mes", "competencia", "periodo", "data"], paid: ["despesaspagas", "despesapaga", "pagamentosrealizados", "valorpago", "pago", "pagamentos"], committed: ["despesasempenhadas", "despesaempenhada", "empenhado", "valorempenhado"], settled: ["despesasliquidadas", "despesaliquidada", "liquidado", "valorliquidado"], budget: ["dotacaoatualizada", "creditorecebido", "creditodisponivel", "creditoautorizado", "dotacao", "provisao"] };
function autoMap(headers) {
  const map = {};
  for (const [field, names] of Object.entries(aliases)) {
    let i = headers.findIndex((h) => names.includes(normalize(h)));
    if (i < 0) i = headers.findIndex((h) => names.some((a) => a.length > 5 && normalize(h).includes(a)) && !/descricao|nome/.test(normalize(h)));
    map[field] = i < 0 ? "" : String(i);
  }
  return map;
}
function numberValue(v) {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw Error("Valor num\xE9rico inv\xE1lido");
    return v;
  }
  let s = String(v ?? "").trim();
  if (!s || s === "-" || s === "\u2014") return 0;
  s = s.replace(/R\$|US\$|USD|BRL|EUR|€|\$|\s/g, "");
  const neg = s.startsWith("(") && s.endsWith(")");
  if (neg) s = s.slice(1, -1);
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) throw Error("Valor inv\xE1lido: " + String(v));
  return Number(s) * (neg ? -1 : 1);
}
function monthValue(v, fallback) {
  if (v === void 0 || v === null || String(v).trim() === "") return fallback;
  let s = String(v).trim().toUpperCase();
  if (v instanceof Date) return v.toISOString().slice(0, 7);
  if (typeof v === "number" && v > 3e4 && v < 8e4) return new Date((v - 25569) * 864e5).toISOString().slice(0, 7);
  let m = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = s.match(/^(?:(\d{1,2})[-/])?(\d{1,2})[-/](\d{4})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[3]}-${m[2].padStart(2, "0")}`;
  const names = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  m = s.match(/([A-Z]{3})\w*\s*[-/]?\s*(\d{4})/);
  if (m && names.includes(m[1])) return `${m[2]}-${String(names.indexOf(m[1]) + 1).padStart(2, "0")}`;
  if (/^\d{1,2}$/.test(s) && +s >= 1 && +s <= 12) return `${fallback.slice(0, 4)}-${s.padStart(2, "0")}`;
  throw Error("Compet\xEAncia n\xE3o reconhecida: " + s);
}
function code(v, kind) {
  const s = String(v ?? "").trim();
  if (!s) return "N\xE3o informado";
  if (kind === "action") {
    const m = s.match(/^([0-9A-Z]{4})(?:\s|[-–·]|$)/i);
    if (m) return m[1].toUpperCase();
  }
  if (kind === "ug" || kind === "nd") {
    const m = s.match(/^(\d{6})(?:\s|[-–·]|$)/);
    if (m) return m[1];
  }
  if (kind === "pi") return s.split(/\s+[-–·]\s+/)[0];
  return s;
}
function parseRows(matrix, headerIndex, mapping, reference) {
  if (["ug", "action", "pi", "nd", "paid"].some((f) => mapping[f] === "" || mapping[f] === void 0)) throw Error("Associe UG, a\xE7\xE3o, PI, ND e pagamentos.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(reference)) throw Error("Informe a compet\xEAncia da base.");
  const headers = matrix[headerIndex].map((v, i) => String(v ?? "").trim() || "Coluna " + (i + 1));
  const mapped = new Set(Object.values(mapping).filter(Boolean).map(Number));
  const aliasesOut = {};
  let skipped = 0;
  const rows = [];
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const raw = matrix[i];
    if (!raw || raw.every((v) => v == null || String(v).trim() === "")) continue;
    const value = (f) => mapping[f] === "" || mapping[f] === void 0 ? void 0 : raw[+mapping[f]];
    const dims = ["ug", "action", "pi", "nd"].map(value);
    if (dims.some((v) => /^\s*(total|subtotal|total geral)(\b|\s)/i.test(String(v))) || dims.every((v) => v == null || String(v).trim() === "")) {
      skipped++;
      continue;
    }
    try {
      const row = { ug: code(value("ug"), "ug"), action: code(value("action"), "action"), pi: code(value("pi"), "pi"), nd: code(value("nd"), "nd"), month: monthValue(value("month"), reference), paid: Math.round(numberValue(value("paid")) * 100) / 100, committed: null, settled: null, budget: null, extra: {} };
      for (const f of ["committed", "settled", "budget"]) if (mapping[f] !== "") row[f] = Math.round(numberValue(value(f)) * 100) / 100;
      row.settled = row.paid;
      const label = String(value("ugName") ?? "").trim();
      if (label && /^[A-Za-z][A-Za-z0-9\s.-]{1,19}$/.test(label)) aliasesOut[row.ug] = label;
      headers.forEach((h, j) => {
        if (!mapped.has(j) && raw[j] != null && String(raw[j]).trim()) row.extra[`${h} [${j + 1}]`] = String(raw[j]);
      });
      rows.push(row);
    } catch (e) {
      throw Error(`Linha ${i + 1}: ${e.message}`);
    }
  }
  if (!rows.length) throw Error("Nenhum registro encontrado abaixo do cabe\xE7alho.");
  if (rows.length > 5e4) throw Error("Limite de 50.000 registros por base.");
  return { rows, skipped, ugAliases: { ...UGS, ...aliasesOut }, available: ["paid", "settled", ...["committed", "budget"].filter((f) => mapping[f] !== "")] };
}
function sum(rows, field) {
  const values = rows.map((r) => r[field]).filter((v) => v !== null);
  return values.length ? values.reduce((a, b) => a + Math.round(b * 100), 0) / 100 : null;
}
function prepareTesouro(matrix, percentBase = "credit") {
  const measure = matrix.findIndex((r) => r.some((c) => normalize(c) === "creditorecebido") && r.some((c) => normalize(c) === "pago" || normalize(c) === "percentualpago"));
  if (measure < 1) return { matrix, derived: false };
  const dims = matrix.slice(0, measure).findLast((r) => r.some((c) => normalize(c) === "ugresponsavel") && r.some((c) => normalize(c).startsWith("acao")));
  if (!dims) return { matrix, derived: false };
  const metrics = matrix[measure];
  const idx = (n) => dims.findIndex((c) => normalize(c).startsWith(n));
  const ug = idx("ugresponsavel"), action = idx("acao"), nd = idx("naturezadespesa"), pi = idx("pi");
  if ([ug, action, nd, pi].some((v) => v < 0)) return { matrix, derived: false };
  const blocks = [];
  for (let j = 0; j < metrics.length; j++) {
    if (normalize(metrics[j]) !== "creditorecebido") continue;
    let end = metrics.findIndex((v, k) => k > j && normalize(v) === "creditorecebido");
    if (end < 0) end = metrics.length;
    const ep = metrics.findIndex((v, k) => k >= j && k < end && normalize(v) === "empenhado"), pg = metrics.findIndex((v, k) => k >= j && k < end && normalize(v) === "pago");
    if (ep < 0 || pg < 0) throw Error("Bloco mensal incompleto no cabe\xE7alho do Tesouro.");
    const candidate = matrix.slice(0, measure).flatMap((r) => r.slice(j, end)).find((v) => /^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/?\d{4}$/i.test(String(v).trim()));
    if (!candidate) throw Error("Compet\xEAncia ausente no bloco de colunas " + (j + 1) + "\u2013" + end + ".");
    blocks.push({ cr: j, ep, pg, month: monthValue(candidate, "2026-01") });
  }
  if (!blocks.length) return { matrix, derived: false };
  const out = [["UG Respons\xE1vel", "Nome UG", "A\xE7\xE3o", "Descri\xE7\xE3o A\xE7\xE3o", "ND", "Descri\xE7\xE3o ND", "PI", "Descri\xE7\xE3o PI", "M\xEAs", "Cr\xE9dito Recebido", "Empenhado", "Pagamentos Realizados", "% Empenhado (original)", "% Pago (original)"]];
  const blank = (v) => v === void 0 || v === null || String(v).trim() === "";
  for (let i = measure + 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!/^\d{6}$/.test(String(r[ug]).trim())) continue;
    for (const b of blocks) {
      if ([r[b.cr], r[b.ep], r[b.pg]].every(blank)) continue;
      if (blank(r[b.cr])) throw Error(`Linha ${i + 1}, ${b.month}: cr\xE9dito ausente.`);
      const credit = numberValue(r[b.cr]);
      const ratio = (v) => String(v).trim().endsWith("%") ? numberValue(String(v).trim().slice(0, -1)) / 100 : numberValue(v);
      if (credit !== 0 && [r[b.ep], r[b.pg]].some(blank)) throw Error(`Linha ${i + 1}, ${b.month}: percentual ausente com cr\xE9dito diferente de zero.`);
      const committed = credit * ratio(r[b.ep]), paid = (percentBase === "credit" ? credit : committed) * ratio(r[b.pg]);
      out.push([r[ug], r[ug + 1], r[action], r[action + 1], r[nd], r[nd + 1], r[pi], r[pi + 1], b.month, credit, committed, paid, r[b.ep], r[b.pg]]);
    }
  }
  return { matrix: out, derived: true, reference: blocks.map((b) => b.month).sort().at(-1) };
}

// github-portal/lib/drive-update.ts
function decodeCSV(bytes) {
  let text = new TextDecoder(bytes[0] === 255 && bytes[1] === 254 ? "utf-16le" : bytes[0] === 254 && bytes[1] === 255 ? "utf-16be" : "utf-8").decode(bytes).replace(/^\uFEFF/, "");
  if (text.trimStart().startsWith("{")) {
    let wrapper;
    try {
      wrapper = JSON.parse(text);
    } catch {
      throw Error("O arquivo cont\xE9m JSON inv\xE1lido.");
    }
    if (typeof wrapper.ContentBytes !== "string") throw Error("Conte\xFAdo CSV ausente no arquivo.");
    const binary = atob(wrapper.ContentBytes);
    return decodeCSV(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  }
  return text;
}
function csvMatrix(text) {
  const delimiter = (text.split(/\r?\n/).find((l) => /UG Respons/i.test(l)) || text.split(/\r?\n/)[0]).includes(";") ? ";" : ",";
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Aspas n\xE3o fechadas no CSV.");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
function mergeDriveCSV(text, previous, fileName) {
  const prepared2 = prepareTesouro(csvMatrix(text), "credit");
  if (!prepared2.derived || !prepared2.reference) throw Error("O arquivo deve conter o relat\xF3rio Tesouro com m\xEAs, cr\xE9dito recebido e percentuais.");
  const parsed = parseRows(prepared2.matrix, 0, autoMap(prepared2.matrix[0].map(String)), prepared2.reference);
  if (parsed.rows.some((r) => !r.month.startsWith("2026-") || r.ug === "N\xE3o informado" || r.action === "N\xE3o informado" || r.pi === "N\xE3o informado" || r.nd === "N\xE3o informado")) throw Error("Per\xEDodo ou dimens\xF5es inv\xE1lidas no relat\xF3rio LOA 2026.");
  if (previous.mode !== "snapshot" || previous.currency !== "USD") throw Error("A base existente precisa ser de posi\xE7\xF5es acumuladas em USD.");
  const latest = [...new Set(parsed.rows.map((r) => r.month))].sort().at(-1);
  const incoming = parsed.rows.filter((r) => r.month === latest);
  const latestExisting = [...new Set(previous.rows.map((r) => r.month))].sort().at(-1);
  if (latestExisting && latest < latestExisting) throw Error("O arquivo \xE9 de m\xEAs anterior \xE0 \xFAltima compet\xEAncia do painel; nenhuma altera\xE7\xE3o foi feita.");
  const data = { ...previous, rows: [...previous.rows.filter((r) => r.month !== latest), ...incoming], fileName, reference: latest, mode: "snapshot", currency: "USD", derived: true, percentBase: "credit", updatedAt: (/* @__PURE__ */ new Date()).toISOString(), ugAliases: { ...parsed.ugAliases, ...previous.ugAliases }, available: [.../* @__PURE__ */ new Set([...previous.available, ...parsed.available])], skipped: parsed.skipped };
  return { data, summary: { month: latest, records: incoming.length, paid: sum(incoming, "paid"), committed: sum(incoming, "committed"), credit: sum(incoming, "budget"), preservedMonths: [...new Set(previous.rows.filter((r) => r.month !== latest).map((r) => r.month))].sort() } };
}

// github-portal/update-cli.ts
var [rawPath, currentPath, outPath] = process.argv.slice(2);
if (!rawPath || !currentPath || !outPath) throw Error("Uso: node atualizar-loa.cjs fonte.csv dados.json novos-dados.json");
var old = JSON.parse(import_node_fs.default.readFileSync(currentPath, "utf8"));
var prepared = mergeDriveCSV(decodeCSV(import_node_fs.default.readFileSync(rawPath)), old.data, "Pagamentos LOA 2026 CABW.csv");
var month = prepared.summary.month;
var before = old.data.rows.filter((r) => r.month !== month);
var after = prepared.data.rows.filter((r) => r.month !== month);
if (JSON.stringify(before) !== JSON.stringify(after)) throw Error("Hist\xF3rico alterado: publica\xE7\xE3o cancelada");
var oldTarget = old.data.rows.filter((r) => r.month === month);
var newTarget = prepared.data.rows.filter((r) => r.month === month);
var changed = JSON.stringify(oldTarget) !== JSON.stringify(newTarget);
if (changed) {
  import_node_fs.default.writeFileSync(outPath, JSON.stringify({ data: prepared.data, etag: "github", source: { fileId: "1vSKMEtAoZemky6ZUvtqC0pbTXIZD9zP5", folderId: "1cts6q4qAOZwsw3Vtz_Gq9g3cFDVuFCvU" } }));
}
console.log(JSON.stringify({ changed, ...prepared.summary }));
