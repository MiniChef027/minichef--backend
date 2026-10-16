const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/dados.js');

test('exemplos respeitam o contrato e permanecem independentes', () => {
  const first = M.initialState();
  assert.equal(M.validState(first), true);
  first.recipes[0].nome = 'Alterado';
  assert.equal(M.initialState().recipes[0].nome, 'Arroz soltinho');
});
test('calculadora dobra ingredientes, preserva base e rejeita porções inválidas', () => {
  const recipe = M.initialState().recipes[0];
  assert.deepEqual(M.scale(recipe, 8).map(i => i.quantidade), [800, 2, 4, 30]);
  assert.equal(recipe.ingredientes[0].quantidade, 400);
  for (const count of [0, -1, NaN, Infinity, 1.5, 10001]) assert.throws(() => M.scale(recipe, count));
});
test('compras reproduzem o exemplo documentado, excluindo ingredientes opcionais', () => {
  const recipes = M.initialState().recipes;
  const entries = [[0, 8], [1, 6], [2, 4], [3, 2], [0, 4]].map(([i, n]) => ({ receita_id: recipes[i].id, porcoes_desejadas: n }));
  assert.deepEqual(M.shopping(recipes, entries).map(i => [i.nome, i.quantidade, i.unidade]), [
    ['Alho', 13, 'dente'], ['Arroz branco', 1200, 'g'], ['Azeite', 65, 'ml'], ['Cebola', 4, 'unidade'], ['Feijão carioca', 500, 'g'], ['Ovo', 4, 'unidade'], ['Peito de frango', 800, 'g']
  ]);
});
test('compras somam antes de arredondar e separam unidades', () => {
  const recipe = { id: 'r', porcao_padrao: 3, ingredientes: [{ nome: 'Cebola', quantidade: 1, unidade: 'unidade', papel: 'Principal' }, { nome: 'Cebola', quantidade: 1, unidade: 'g', papel: 'Principal' }] };
  const entries = Array.from({ length: 3 }, () => ({ receita_id: 'r', porcoes_desejadas: 1 }));
  const list = M.shopping([recipe], entries);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map(i => i.quantidade), [1, 1]);
  assert.throws(() => M.shopping([], entries));
});
test('busca combina filtros e ignora acentos e caixa', () => {
  const recipes = M.initialState().recipes;
  assert.equal(M.filterRecipes(recipes, { query: 'FEIJAO', ingredient: 'cebola', time: 60, meal: 'Almoço' })[0].nome, 'Feijão caseiro');
  assert.equal(M.filterRecipes(recipes, { query: 'feijao', time: 30 }).length, 0);
  assert.equal(M.filterRecipes(recipes, { origin: 'francesa', purpose: 'dia a dia' })[0].nome, 'Omelete simples');
});
test('datas reais, virada de ano e semana iniciada na segunda', () => {
  assert.equal(M.parseDate('2026-02-30'), null);
  assert.equal(M.parseDate('2025-02-29'), null);
  assert.ok(M.parseDate('2024-02-29'));
  assert.equal(M.monday('2026-10-18'), '2026-10-12');
  assert.equal(M.monday('2026-10-19'), '2026-10-19');
  assert.equal(M.addDays('2026-12-31', 1), '2027-01-01');
});
test('validade distingue ontem, hoje, três dias e quatro dias', () => {
  const today = '2026-10-16';
  assert.equal(M.expiry('2026-10-15', today).kind, 'expired');
  assert.equal(M.expiry(today, today).label, 'Vence hoje');
  assert.equal(M.expiry('2026-10-19', today).kind, 'soon');
  assert.equal(M.expiry('2026-10-20', today).kind, 'ok');
});
test('armazenamento inválido e referências órfãs são rejeitados', () => {
  for (const invalid of [null, {}, { version: 2 }, { ...M.initialState(), recipes: [null] }, { ...M.initialState(), favorites: ['inexistente'] }]) assert.equal(M.validState(invalid), false);
  const state = M.initialState();
  state.planner.push({ id: 'p', semana: '2026-10-12', dia: 0, refeicao: 'Almoço', porcoes_desejadas: 2, receita_id: 'inexistente' });
  assert.equal(M.validState(state), false);
});
