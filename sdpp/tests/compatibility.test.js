'use strict';

// Run with: node sdpp/tests/compatibility.test.js
// Exercise the real engine in an isolated browser-like runtime without Array.at.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { TextEncoder } = require('node:util');

const enginePath = path.join(__dirname, '..', 'engine.js');
const engineSource = fs.readFileSync(enginePath, 'utf8');

function loadEngine(withoutAt) {
  const context = vm.createContext({ module: { exports: {} }, TextEncoder });
  if (withoutAt) {
    vm.runInContext('delete Array.prototype.at;', context);
    assert.equal(vm.runInContext('typeof Array.prototype.at', context), 'undefined');
  } else {
    assert.equal(vm.runInContext('typeof Array.prototype.at', context), 'function',
      'Run this comparison on a Node version that supports Array.prototype.at.');
  }
  vm.runInContext(engineSource, context, { filename: enginePath });
  return context.module.exports;
}

// Normalize cross-realm objects and BigInts for complete output comparisons.
function snapshot(value) {
  return JSON.parse(JSON.stringify(value, (key, item) =>
    typeof item === 'bigint' ? `${item}n` : item));
}

const modern = loadEngine(false);
const compatible = loadEngine(true);

const parseCases = [
  {
    name: 'five columns without classification B',
    text: '2026NE000001 31901137 DFL001 311110100 1.234,56',
    amount: 123456n, b: '', sub: '37', ndd: '31901137'
  },
  {
    name: 'six columns with explicit classification B',
    text: '2026NE000002\t33900802\tDFL041\t113110105\t211310100\t2.345,67',
    amount: 234567n, b: '211310100', sub: '02', ndd: '33900802'
  },
  {
    name: 'automatic classification B',
    text: '2026NE000003;94;DFL034;113110105;25,00',
    amount: 2500n, b: '218910100', sub: '94', ndd: ''
  },
  {
    name: 'six-column annulment with positive entered amount',
    text: '2026NE000004 43 AFL031 113110101 211110100 20,00',
    amount: -2000n, b: '211110100', sub: '43', ndd: ''
  }
];

for (const fixture of parseCases) {
  const parsed = compatible.parsePco(fixture.text);
  assert.equal(parsed.length, 1, fixture.name);
  for (const key of ['amount', 'b', 'sub', 'ndd']) {
    assert.equal(parsed[0][key], fixture[key], `${fixture.name}: ${key}`);
  }
  assert.deepEqual(snapshot(parsed), snapshot(modern.parsePco(fixture.text)),
    `${fixture.name}: identical parsing with and without Array.at`);
}

const base = {
  ug: '120052', year: '2026', dhType: 'FL',
  emissionDate: '2026-11-23', dueDate: '2026-11-23',
  attestDate: '2026-11-23', payDate: '2026-11-23',
  payUg: '120052', creditor: '120052',
  description: 'TESTE FICTICIO DE COMPATIBILIDADE', process: 'TESTE/2026',
  docNumber: 'FOPAG.TESTE', docIssuer: '120052', empeUg: '120052',
  cc: '221A00', month: '11', ccYear: '2026', benefUg: '120052', siorg: '2332',
  ob: 'OBF', favAccount: 'FOPAG', payBank: '002', payAccount: 'UNICA',
  layout: 'DH001', headerUg: '120052', generationDate: '2026-11-23',
  sequence: '1000', headerYear: '2026', cpf: '12345678901', others: ''
};

function generate(pco, amount, extra = {}) {
  const input = {
    ...base, pco,
    payments: `00000000000191 001 1607 TESTE ${amount}`,
    ...extra
  };
  const expected = modern.dh(input);
  const actual = compatible.dh(input);
  assert.deepEqual(snapshot(actual), snapshot(expected),
    'All XML bytes, names, metrics and accounting details must match the modern runtime.');
  assert.equal(actual.metrics.payments, actual.metrics.total);
  assert.equal(actual.metrics.positive - actual.metrics.negative, actual.metrics.total);
  assert.equal(actual.files.length, actual.metrics.details);
  for (const file of actual.files) {
    assert.equal((file.xml.match(/<sb:detalhe>/g) || []).length, 1);
    assert.ok(file.xml.includes('<sb:quantidadeDetalhe>1</sb:quantidadeDetalhe>'));
    assert.ok(file.xml.includes(`<sb:sequencialGeracao>${file.sequence}</sb:sequencialGeracao>`));
    assert.ok(file.accountingLines <= 100);
  }
  return actual;
}

const single = generate([
  '2026NE000001 31901143 DFL031 113110101 100,00',
  '2026NE000001 31901143 AFL031 113110101 20,00',
  '2026NE000002 31909294 DFL034 113110105 25,00',
  '2026NE000003 33900802 DFL041 113110105 211310100 50,00'
].join('\n'), '155,00');
assert.equal(single.files.length, 1);
assert.equal(single.metrics.total, 15500n);
assert.equal(single.metrics.accountingLines, 15);
assert.ok(single.xml.includes('<numClassB>211310100</numClassB>'));
assert.ok(single.xml.includes('<numClassB>218910100</numClassB>'));
assert.ok(single.xml.includes('<codSit>AFL031</codSit>'));

const others = [
  'PRV001 311110101 211110101 31901137 N 1,00',
  'PRV002 311110101 211110101 31901137 N 1,00',
  'PRV003 311110101 211110101 31901137 N 1,00',
  'LPA385 311110101 211110101 31901137 N 1,00'
].join('\n');
const multiple = generate(Array.from({ length: 34 }, (_, index) =>
  `2026NE${String(index + 1).padStart(6, '0')} 01 DFL001 311110100 100,00`
).join('\n'), '3.400,00', { others });
assert.equal(multiple.files.length, 2);
assert.equal(multiple.metrics.total, 340000n);
assert.equal(multiple.metrics.accountingLines, 102);
assert.deepEqual(Array.from(multiple.files, file => file.accountingLines), [99, 3]);
assert.deepEqual(Array.from(multiple.files, file => file.sequence), ['1000', '1001']);
assert.deepEqual(Array.from(multiple.files, file => file.filename),
  ['DH001_FOPAG_1000.xml', 'DH001_FOPAG_1001.xml']);
assert.equal((multiple.files[0].xml.match(/<outrosLanc>/g) || []).length, 4);
assert.ok(!multiple.files[1].xml.includes('<outrosLanc>'));
assert.deepEqual(Buffer.from(compatible.zip(multiple.files)),
  Buffer.from(modern.zip(multiple.files)), 'ZIP bytes must also match.');

console.log('OK: sem Array.at, PCO com 5/6 colunas, classificacao B, XML unico/multiplo e ZIP identicos ao runtime moderno.');
