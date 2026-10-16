/* Modelo da demonstração. Não autentica usuários nem acessa o backend. */
(function (root) {
  'use strict';
  const meals = ['Café da manhã', 'Almoço', 'Jantar', 'Lanche'];
  const units = ['g', 'kg', 'ml', 'l', 'unidade', 'dente', 'colher de sopa', 'xícara'];
  const roles = ['Principal', 'Secundário', 'Removível', 'Opcional'];
  const statuses = ['Rascunho', 'Em Análise', 'Publicada', 'Recusada', 'Arquivada'];
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const positive = n => Number.isFinite(n) && n > 0;
  const portions = n => positive(n) && Number.isInteger(n) && n <= 10000;
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && dateKey(date) === value ? date : null;
  }
  function addDays(value, days) {
    const date = parseDate(value);
    if (!date) throw new Error('Data inválida.');
    date.setDate(date.getDate() + days);
    return dateKey(date);
  }
  function monday(value = dateKey()) {
    const date = parseDate(value);
    if (!date) throw new Error('Data inválida.');
    return addDays(value, -((date.getDay() + 6) % 7));
  }
  function expiry(value, today = dateKey()) {
    if (!parseDate(value) || !parseDate(today)) throw new Error('Data inválida.');
    const days = Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    return { days, kind: days < 0 ? 'expired' : days <= 3 ? 'soon' : 'ok', label: days < 0 ? 'Vencido' : days === 0 ? 'Vence hoje' : days === 1 ? 'Vence amanhã' : `Vence em ${days} dias` };
  }
  function scale(recipe, count) {
    if (!portions(count) || !portions(recipe.porcao_padrao)) throw new Error('Informe de 1 a 10.000 porções inteiras.');
    return recipe.ingredientes.map(item => ({ ...item, quantidade: Number((item.quantidade * count / recipe.porcao_padrao).toFixed(2)) }));
  }
  function shopping(recipes, entries) {
    const total = new Map();
    for (const entry of entries) {
      const recipe = recipes.find(item => item.id === entry.receita_id);
      if (!recipe) throw new Error('Uma receita do planejamento não está mais disponível.');
      if (!portions(entry.porcoes_desejadas)) throw new Error('Porções inválidas no planejamento.');
      for (const item of recipe.ingredientes) {
        if (item.papel === 'Opcional') continue;
        const key = JSON.stringify([normalize(item.nome), item.unidade]);
        const row = total.get(key) || { key, nome: item.nome, unidade: item.unidade, quantidade: 0 };
        // Somar antes de arredondar evita acumular erros de cada refeição.
        row.quantidade += item.quantidade * entry.porcoes_desejadas / recipe.porcao_padrao;
        total.set(key, row);
      }
    }
    return [...total.values()].map(item => ({ ...item, quantidade: ['unidade', 'dente'].includes(item.unidade) ? Math.ceil(item.quantidade) : Number(item.quantidade.toFixed(2)) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  function filterRecipes(recipes, filters) {
    return recipes.filter(recipe => (!filters.query || normalize(recipe.nome).includes(normalize(filters.query))) && (!filters.ingredient || recipe.ingredientes.some(item => normalize(item.nome).includes(normalize(filters.ingredient)))) && (!filters.meal || recipe.refeicao_recomendada === filters.meal) && (!filters.time || recipe.tempo_medio_gasto_min <= Number(filters.time)) && (!filters.origin || normalize(recipe.nacionalidade).includes(normalize(filters.origin))) && (!filters.purpose || recipe.finalidade === filters.purpose));
  }
  const ingredient = (nome, quantidade, unidade, papel = 'Principal') => ({ nome, quantidade, unidade, papel });
  function initialState() {
    const definitions = [
      ['Arroz soltinho', 4, 'Almoço', 25, 'Brasileira', 'dia a dia', 'Publicada', 'Refogue alho e cebola no azeite.\nJunte o arroz e refogue.\nCubra com água e cozinhe tampado até secar.', [ingredient('Arroz branco', 400, 'g'), ingredient('Cebola', 1, 'unidade', 'Secundário'), ingredient('Alho', 2, 'dente', 'Secundário'), ingredient('Azeite', 15, 'ml', 'Removível')]],
      ['Feijão caseiro', 6, 'Almoço', 60, 'Brasileira', 'dia a dia', 'Publicada', 'Cozinhe o feijão na pressão.\nRefogue alho e cebola, junte ao feijão e apure.', [ingredient('Feijão carioca', 500, 'g'), ingredient('Cebola', 1, 'unidade', 'Secundário'), ingredient('Alho', 3, 'dente', 'Secundário')]],
      ['Frango grelhado', 2, 'Jantar', 30, 'Brasileira', 'nutrição', 'Publicada', 'Tempere o frango com alho.\nAqueça o azeite e grelhe até ficar completamente cozido.', [ingredient('Peito de frango', 400, 'g'), ingredient('Alho', 2, 'dente', 'Secundário'), ingredient('Azeite', 10, 'ml', 'Removível')]],
      ['Omelete simples', 1, 'Café da manhã', 10, 'Francesa', 'dia a dia', 'Publicada', 'Bata os ovos.\nAdicione os ingredientes opcionais de sua preferência.\nCozinhe em frigideira até firmar e dobre ao meio.', [ingredient('Ovo', 2, 'unidade'), ingredient('Tomate', 1, 'unidade', 'Opcional'), ingredient('Cebola', .5, 'unidade', 'Opcional'), ingredient('Queijo muçarela', 30, 'g', 'Opcional')]],
      ['Panqueca de banana', 2, 'Lanche', 15, 'Brasileira', 'dia a dia', 'Em Análise', 'Amasse a banana e misture com o ovo e a farinha.\nColoque pequenas porções na frigideira e doure dos dois lados.', [ingredient('Banana', 2, 'unidade'), ingredient('Ovo', 1, 'unidade'), ingredient('Farinha de trigo', 60, 'g', 'Secundário')]],
      ['Molho de tomate rústico', 4, 'Almoço', 35, 'Italiana', 'festa', 'Rascunho', 'Refogue alho e cebola no azeite.\nJunte tomates picados e cozinhe em fogo baixo até encorpar.', [ingredient('Tomate', 6, 'unidade'), ingredient('Cebola', 1, 'unidade', 'Secundário'), ingredient('Alho', 3, 'dente', 'Secundário'), ingredient('Azeite', 20, 'ml', 'Removível')]]
    ];
    return { version: 1, recipes: definitions.map((r, i) => ({ id: `exemplo-${i + 1}`, nome: r[0], porcao_padrao: r[1], refeicao_recomendada: r[2], tempo_medio_gasto_min: r[3], nacionalidade: r[4], finalidade: r[5], status: r[6], modo_preparo: r[7], ingredientes: r[8], propria: i >= 4, feedback_moderacao: '' })), favorites: [], planner: [], pantry: [], checked: {} };
  }
  const text = (value, max = 10000) => typeof value === 'string' && value.length <= max;
  const unique = list => new Set(list.map(item => item.id)).size === list.length;
  function validState(state) {
    if (!state || state.version !== 1 || !Array.isArray(state.recipes) || !Array.isArray(state.planner) || !Array.isArray(state.pantry) || !Array.isArray(state.favorites) || !state.checked || typeof state.checked !== 'object' || Array.isArray(state.checked)) return false;
    const recipeValid = r => r && text(r.id, 100) && text(r.nome, 150) && r.nome.trim() && portions(r.porcao_padrao) && Number.isInteger(r.tempo_medio_gasto_min) && r.tempo_medio_gasto_min > 0 && r.tempo_medio_gasto_min <= 10080 && meals.includes(r.refeicao_recomendada) && text(r.nacionalidade, 60) && ['dia a dia', 'festa', 'nutrição'].includes(r.finalidade) && statuses.includes(r.status) && text(r.modo_preparo) && text(r.feedback_moderacao, 1000) && typeof r.propria === 'boolean' && Array.isArray(r.ingredientes) && r.ingredientes.length > 0 && r.ingredientes.every(i => i && text(i.nome, 100) && i.nome.trim() && positive(i.quantidade) && i.quantidade <= 1000000 && units.includes(i.unidade) && roles.includes(i.papel));
    if (!state.recipes.every(recipeValid) || !unique(state.recipes)) return false;
    if (!state.planner.every(p => p && text(p.id, 100) && parseDate(p.semana) && monday(p.semana) === p.semana && Number.isInteger(p.dia) && p.dia >= 0 && p.dia <= 6 && meals.includes(p.refeicao) && portions(p.porcoes_desejadas) && state.recipes.some(r => r.id === p.receita_id)) || !unique(state.planner)) return false;
    return state.pantry.every(p => p && text(p.id, 100) && text(p.nome, 100) && p.nome.trim() && positive(p.quantidade) && p.quantidade <= 1000000 && units.includes(p.unidade) && parseDate(p.validade)) && unique(state.pantry) && state.favorites.every(id => state.recipes.some(r => r.id === id)) && Object.values(state.checked).every(v => v === true);
  }
  const api = { meals, units, roles, statuses, normalize, portions, dateKey, parseDate, addDays, monday, expiry, scale, shopping, filterRecipes, initialState, validState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MiniChef = api;
})(globalThis);
