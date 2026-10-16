/* Interface estática: todas as mutações são exclusivas da demonstração local. */
(() => {
  'use strict';
  const M = window.MiniChef;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const KEY = 'minichef-demo-v1';
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const number = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
  const date = value => M.parseDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let state = M.initialState(), allowSave = true, rawAtLoad = null;
  let week = M.monday(), collection = 'published', editingRecipe = null, editingPantry = null, toastTimer;
  function warning(message) { $('#storage-warning').hidden = false; $('#storage-warning').textContent = message; }
  try {
    rawAtLoad = localStorage.getItem(KEY);
    if (rawAtLoad) {
      const stored = JSON.parse(rawAtLoad);
      if (!M.validState(stored)) throw new Error('Dados incompatíveis');
      state = stored;
    }
  } catch {
    allowSave = false;
    warning('Não foi possível carregar o armazenamento local. Você pode explorar os exemplos; alterações durarão apenas nesta visita. Os dados anteriores não serão sobrescritos.');
  }
  function save() {
    if (!M.validState(state)) throw new Error('Os dados da demonstração não são válidos.');
    if (!allowSave) return;
    try {
      if (localStorage.getItem(KEY) !== rawAtLoad) {
        allowSave = false;
        warning('Os dados foram alterados em outra aba. Recarregue para usar a versão salva. As alterações desta visita não serão gravadas sobre ela.');
        return;
      }
      const serialized = JSON.stringify(state);
      localStorage.setItem(KEY, serialized);
      rawAtLoad = serialized;
    } catch {
      allowSave = false;
      warning('Não foi possível salvar neste navegador. As alterações serão mantidas apenas nesta visita.');
    }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message; $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5500);
  }
  // Todo conteúdo variável entra como texto, nunca como HTML.
  function el(tag, cls, content) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function button(label, action, cls = 'btn btn-ghost') {
    const node = el('button', cls, label); node.type = 'button'; node.addEventListener('click', action); return node;
  }
  function link(label, href, cls = 'btn btn-ghost') { const node = el('a', cls, label); node.href = href; return node; }
  function empty(target, title, text, href, label) {
    const node = el('div', 'empty-state'); node.append(el('h3', '', title), el('p', 'muted', text));
    if (href) node.append(link(label, href));
    target.replaceChildren(node);
  }
  function options(select, values, keep = false) {
    if (!keep) select.replaceChildren();
    values.forEach(value => { const option = el('option', '', typeof value === 'string' ? value : value.label); option.value = typeof value === 'string' ? value : value.value; select.append(option); });
  }
  function field(label, node) { const wrapper = el('label', '', label); wrapper.append(node); return wrapper; }
  function input(type, name, value, attrs = {}) { const node = el('input'); node.type = type; node.name = name; node.value = value; Object.entries(attrs).forEach(([key, val]) => node.setAttribute(key, val)); return node; }
  function select(name, values, value) { const node = el('select'); node.name = name; options(node, values); if (value) node.value = value; return node; }
  function stat(value, label, href) { const node = el(href ? 'a' : 'div', 'stat'); if (href) node.href = href; node.append(el('strong', '', value), el('span', 'muted', label)); return node; }
  function badge(text) { return el('span', 'badge', text); }
  function published() { return state.recipes.filter(r => r.status === 'Publicada'); }
  function weekEntries() { return state.planner.filter(item => item.semana === week); }
  function period() { return `${date(week)} – ${date(M.addDays(week, 6))} · ${week.slice(0, 4)}`; }
  async function confirmRemove(message) {
    const dialog = $('#confirm-dialog'); $('#confirm-message').textContent = message;
    dialog.returnValue = ''; dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
  }
  function ingredientTable(items, caption) {
    const wrap = el('div', 'table-wrap'), table = el('table');
    table.append(el('caption', 'sr', caption));
    const head = el('thead'), row = el('tr');
    ['Ingrediente', 'Quantidade', 'Papel'].forEach(title => { const th = el('th', '', title); th.scope = 'col'; row.append(th); });
    head.append(row); table.append(head);
    const body = el('tbody');
    items.forEach(item => { const tr = el('tr'); tr.append(el('td', '', item.nome), el('td', '', `${number(item.quantidade)} ${item.unidade}`), el('td', 'muted', item.papel)); body.append(tr); });
    table.append(body); wrap.append(table); return wrap;
  }
  function steps(recipe) { const list = el('ol', 'steps'); recipe.modo_preparo.split('\n').filter(line => line.trim()).forEach(line => list.append(el('li', '', line))); return list; }
  function recipeCard(recipe) {
    const card = el('article', 'card recipe-card');
    const top = el('div', 'recipe-top'); top.append(badge(recipe.refeicao_recomendada));
    if (recipe.status === 'Publicada') {
      const favorite = state.favorites.includes(recipe.id);
      const toggle = button(favorite ? '♥' : '♡', () => {
        const section = toggle.closest('.page');
        state.favorites = favorite ? state.favorites.filter(id => id !== recipe.id) : [...state.favorites, recipe.id];
        save(); renderRecipes(); renderFavorites(); renderHome();
        const replacement = [...section.querySelectorAll('.favorite-btn')].find(b => b.dataset.recipeId === recipe.id);
        (replacement || $('#conteudo')).focus({ preventScroll: true });
        toast(favorite ? 'Receita removida dos favoritos.' : 'Receita adicionada aos favoritos.');
      }, 'favorite-btn');
      toggle.setAttribute('aria-label', `${favorite ? 'Remover dos' : 'Adicionar aos'} favoritos: ${recipe.nome}`);
      toggle.setAttribute('aria-pressed', favorite); top.append(toggle);
      toggle.dataset.recipeId = recipe.id;
    } else top.append(badge(recipe.status));
    const title = el('h3'); title.append(link(recipe.nome, `#detalhe/${encodeURIComponent(recipe.id)}`, 'recipe-link'));
    card.append(top, title, el('p', 'muted recipe-summary', recipe.ingredientes.slice(0, 3).map(i => i.nome).join(', ')), el('p', 'meta', `${recipe.tempo_medio_gasto_min} min · ${recipe.porcao_padrao} ${recipe.porcao_padrao === 1 ? 'porção' : 'porções'} · ${recipe.nacionalidade || 'Origem não informada'}`));
    const actions = el('div', 'card-actions'); actions.append(link('Ver receita →', `#detalhe/${encodeURIComponent(recipe.id)}`, 'text-link'));
    if (recipe.propria && recipe.status !== 'Publicada') actions.append(link('Editar', `#nova-receita/${encodeURIComponent(recipe.id)}`, 'text-link'));
    card.append(actions); return card;
  }
  function renderRecipes() {
    const filters = Object.fromEntries(new FormData($('#filters')));
    const result = M.filterRecipes(collection === 'mine' ? state.recipes.filter(r => r.propria) : published(), filters);
    $$('[data-collection]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.collection === collection)));
    $('#recipe-count').textContent = `${result.length} ${result.length === 1 ? 'receita encontrada' : 'receitas encontradas'}`;
    $('#recipe-list').replaceChildren(...result.map(recipeCard));
    if (!result.length) empty($('#recipe-list'), 'Nenhuma receita por aqui', 'Tente outros filtros ou cadastre sua própria receita.', '#nova-receita', 'Criar receita');
  }
  function renderFavorites() {
    const list = published().filter(r => state.favorites.includes(r.id)); $('#favorite-list').replaceChildren(...list.map(recipeCard));
    if (!list.length) empty($('#favorite-list'), 'Guarde suas receitas preferidas', 'Toque no coração de uma receita para encontrá-la aqui.', '#receitas', 'Explorar receitas');
  }
  function renderHome() {
    const alerts = state.pantry.filter(i => M.expiry(i.validade).kind !== 'ok').length;
    $('#home-stats').replaceChildren(stat(published().length, 'receitas para descobrir', '#receitas'), stat(state.planner.filter(i => i.semana === M.monday()).length, 'refeições nesta semana', '#planner'), stat(alerts, 'alertas de validade', '#alertas'));
    $('#home-recipes').replaceChildren(...published().slice(0, 3).map(recipeCard));
    $('#home-pantry').textContent = alerts ? `${alerts} ${alerts === 1 ? 'item vencido ou próximo' : 'itens vencidos ou próximos'} da validade. Confira antes de cozinhar.` : 'Cadastre seus ingredientes e acompanhe as datas de validade.';
    $('#alert-count').textContent = alerts; $('#alert-count').hidden = !alerts;
  }
  function renderDetail(id) {
    const recipe = state.recipes.find(r => r.id === id), target = $('#recipe-detail'); target.replaceChildren();
    $('#detalhe h1').textContent = recipe ? recipe.nome : 'Receita não encontrada';
    if (!recipe) { empty(target, 'Esta receita não está disponível', 'Volte à coleção para escolher outra receita.', '#receitas', 'Explorar receitas'); return; }
    const panel = el('div', 'panel');
    panel.append(badge(recipe.status), el('p', 'meta', `${recipe.refeicao_recomendada} · ${recipe.tempo_medio_gasto_min} min · ${recipe.porcao_padrao} porções`));
    if (recipe.feedback_moderacao) panel.append(el('p', 'notice', `Retorno da análise: ${recipe.feedback_moderacao}`));
    panel.append(el('h2', '', 'Ingredientes'), ingredientTable(recipe.ingredientes, 'Ingredientes da receita base'), el('h2', '', 'Modo de preparo'), steps(recipe));
    const actions = el('div', 'actions');
    if (recipe.status === 'Publicada') {
      actions.append(button('Ajustar porções', () => { updateRecipeSelects(); $('#calculator-recipe').value = recipe.id; $('#calculator-portions').value = recipe.porcao_padrao; location.hash = 'calculadora'; }), button('Adicionar ao planner', () => { updateRecipeSelects(); $('#planner-form [name="receita_id"]').value = recipe.id; $('#planner-form [name="porcoes_desejadas"]').value = recipe.porcao_padrao; location.hash = 'planner'; }));
    }
    if (recipe.propria && recipe.status !== 'Publicada') actions.append(link('Editar receita', `#nova-receita/${encodeURIComponent(recipe.id)}`));
    panel.append(actions); target.append(panel);
  }
  function ingredientRow(item = { nome: '', quantidade: 1, unidade: 'g', papel: 'Principal' }) {
    const row = el('div', 'ingredient-row');
    row.append(field('Ingrediente', input('text', 'ingrediente', item.nome, { required: '', maxlength: 100 })), field('Quantidade', input('number', 'quantidade', item.quantidade, { required: '', min: .01, max: 1000000, step: .01 })), field('Unidade', select('unidade', M.units, item.unidade)), field('Papel', select('papel', M.roles, item.papel)));
    const remove = button('Remover', () => { row.remove(); updateIngredientButtons(); }, 'btn btn-ghost remove-ingredient');
    row.append(remove); $('#ingredient-rows').append(row); updateIngredientButtons();
  }
  function updateIngredientButtons() { const rows = $$('#ingredient-rows .ingredient-row'); rows.forEach((r, i) => { const b = r.querySelector('button'); b.disabled = rows.length === 1; b.setAttribute('aria-label', `Remover ingrediente ${i + 1}`); }); }
  function prepareRecipeForm(id) {
    const recipe = id ? state.recipes.find(r => r.id === id && r.propria && r.status !== 'Publicada') : null;
    const form = $('#recipe-form'); form.reset(); form.querySelector('.status').textContent = ''; $('#ingredient-rows').replaceChildren();
    editingRecipe = recipe ? recipe.id : null; $('#recipe-form-title').textContent = recipe ? 'Editar receita' : 'Nova receita';
    if (id && !recipe) toast('Esta receita não está disponível para edição.');
    if (recipe) {
      ['nome', 'porcao_padrao', 'tempo_medio_gasto_min', 'refeicao_recomendada', 'nacionalidade', 'finalidade', 'modo_preparo'].forEach(key => { form.elements.namedItem(key).value = recipe[key]; });
      recipe.ingredientes.forEach(ingredientRow);
    } else ingredientRow();
  }
  $('#add-ingredient').addEventListener('click', () => { ingredientRow(); $('#ingredient-rows').lastElementChild.querySelector('input').focus(); });
  $('#recipe-form').addEventListener('submit', event => {
    event.preventDefault(); const form = event.currentTarget;
    if (!validate(form)) return;
    const data = Object.fromEntries(new FormData(form));
    const recipe = { id: editingRecipe || uid(), nome: data.nome.trim(), porcao_padrao: Number(data.porcao_padrao), tempo_medio_gasto_min: Number(data.tempo_medio_gasto_min), refeicao_recomendada: data.refeicao_recomendada, nacionalidade: data.nacionalidade.trim(), finalidade: data.finalidade, modo_preparo: data.modo_preparo.trim(), status: event.submitter?.value === 'draft' ? 'Rascunho' : 'Em Análise', propria: true, feedback_moderacao: '', ingredientes: $$('#ingredient-rows .ingredient-row').map(row => ({ nome: row.querySelector('[name="ingrediente"]').value.trim(), quantidade: Number(row.querySelector('[name="quantidade"]').value), unidade: row.querySelector('[name="unidade"]').value, papel: row.querySelector('[name="papel"]').value })) };
    const index = state.recipes.findIndex(r => r.id === recipe.id);
    if (index >= 0) state.recipes[index] = recipe; else state.recipes.push(recipe);
    save(); collection = 'mine'; $('#filters').reset(); location.hash = 'receitas'; toast(recipe.status === 'Rascunho' ? 'Rascunho salvo na demonstração.' : 'Receita enviada para a fila de análise local.');
  });
  function renderApprovals() {
    const list = state.recipes.filter(r => r.status === 'Em Análise'); $('#pending-count').textContent = `${list.length} pendentes`;
    $('#approval-list').replaceChildren(...list.map(recipe => {
      const panel = el('article', 'panel'); panel.append(el('h2', '', recipe.nome), el('p', 'meta', `${recipe.refeicao_recomendada} · ${recipe.tempo_medio_gasto_min} min · ${recipe.porcao_padrao} porções`), ingredientTable(recipe.ingredientes, `Ingredientes de ${recipe.nome}`), el('h3', '', 'Modo de preparo'), steps(recipe));
      const form = el('form', 'form'), feedback = el('textarea'); feedback.maxLength = 1000; feedback.rows = 2; feedback.placeholder = 'Explique o que precisa ser ajustado.';
      form.append(field('Parecer da análise (obrigatório para recusar)', feedback));
      const actions = el('div', 'actions');
      const approve = el('button', 'btn', 'Aprovar receita'); approve.type = 'submit'; approve.value = 'approve';
      const reject = el('button', 'btn btn-ghost danger-text', 'Recusar receita'); reject.type = 'submit'; reject.value = 'reject';
      actions.append(approve, reject); form.append(actions);
      form.addEventListener('submit', event => {
        event.preventDefault(); const rejection = event.submitter?.value === 'reject';
        feedback.setCustomValidity(rejection && !feedback.value.trim() ? 'Informe o motivo da recusa.' : '');
        if (!form.reportValidity()) return;
        recipe.status = rejection ? 'Recusada' : 'Publicada'; recipe.feedback_moderacao = feedback.value.trim(); recipe.analisado_em = new Date().toISOString();
        save(); renderApprovals(); renderHome(); updateRecipeSelects(); toast(rejection ? 'Receita recusada na demonstração. O parecer aparece em Minhas receitas.' : 'Receita publicada na demonstração.');
        $('#conteudo').focus({ preventScroll: true });
      });
      feedback.addEventListener('input', () => feedback.setCustomValidity(''));
      panel.append(form); return panel;
    }));
    if (!list.length) empty($('#approval-list'), 'Tudo revisado por aqui', 'Novas receitas enviadas para análise aparecerão nesta lista.');
    const history = state.recipes.filter(r => r.analisado_em && ['Publicada', 'Recusada'].includes(r.status));
    $('#approval-history').replaceChildren(...history.slice().reverse().map(r => { const p = el('div', 'panel'); p.append(link(r.nome, `#detalhe/${encodeURIComponent(r.id)}`, 'text-link'), el('p', 'muted', `${r.status}${r.feedback_moderacao ? ' · ' + r.feedback_moderacao : ''}`)); return p; }));
    if (!history.length) $('#approval-history').append(el('p', 'muted', 'Nenhuma decisão registrada nesta demonstração.'));
  }
  function updateRecipeSelects() {
    [$('#calculator-recipe'), $('#planner-form [name="receita_id"]')].forEach(node => {
      const old = node.value; options(node, published().map(r => ({ label: r.nome, value: r.id })));
      if ([...node.options].some(o => o.value === old)) node.value = old;
    });
  }
  function calculate() {
    const recipe = state.recipes.find(r => r.id === $('#calculator-recipe').value), count = Number($('#calculator-portions').value);
    const target = $('#calculator-result'); target.replaceChildren();
    if (!recipe || !M.portions(count)) { target.append(el('p', 'notice', 'Escolha uma receita e informe de 1 a 10.000 porções inteiras.')); return; }
    const panel = el('div', 'panel'); panel.append(el('h2', '', `${recipe.nome} · ${count} porções`), el('p', 'muted', `Receita base: ${recipe.porcao_padrao} porções. Multiplicador: ${number(count / recipe.porcao_padrao)}×.`), ingredientTable(M.scale(recipe, count), 'Quantidades ajustadas'), el('p', 'note', `Tempo de referência: ${recipe.tempo_medio_gasto_min} minutos. O tempo de preparo não é recalculado; quantidades são proporcionais, com até duas casas decimais.`));
    target.append(panel);
  }
  $('#calculator-form').addEventListener('submit', e => { e.preventDefault(); if (validate(e.currentTarget)) calculate(); });
  $('#calculator-form').addEventListener('input', () => { $('#calculator-result').replaceChildren(el('p', 'muted', 'Clique em Calcular porções para atualizar as quantidades.')); });
  function invalidateShopping() { Object.keys(state.checked).filter(key => key.startsWith(`${week}|`)).forEach(key => delete state.checked[key]); }
  function renderPlanner() {
    $('#week-label').textContent = period();
    $('#week-grid').replaceChildren(...days.map((day, index) => {
      const panel = el('article', 'day-card'); panel.append(el('h3', '', day), el('p', 'note', date(M.addDays(week, index))));
      const items = weekEntries().filter(i => i.dia === index).sort((a, b) => M.meals.indexOf(a.refeicao) - M.meals.indexOf(b.refeicao));
      items.forEach(item => {
        const recipe = state.recipes.find(r => r.id === item.receita_id), block = el('div', 'planned-meal');
        block.append(el('span', 'eyebrow', item.refeicao), link(recipe.nome, `#detalhe/${encodeURIComponent(recipe.id)}`, 'text-link'), el('span', 'note', `${item.porcoes_desejadas} porções`));
        block.append(button('Remover', async () => {
          if (!await confirmRemove(`Remover ${recipe.nome} de ${day.toLowerCase()}? As marcações da lista de compras desta semana serão reiniciadas.`)) return;
          state.planner = state.planner.filter(p => p.id !== item.id); invalidateShopping(); save(); renderPlanner(); renderHome(); toast('Refeição removida. Lista de compras atualizada.'); $('#conteudo').focus({ preventScroll: true });
        }, 'text-button'));
        panel.append(block);
      });
      if (!items.length) panel.append(el('p', 'muted', 'Sem refeições planejadas.'));
      panel.append(button('+ Refeição', () => { $('#planner-form [name="dia"]').value = index; $('#planner-form [name="receita_id"]').focus(); $('#planner-form').scrollIntoView({ block: 'center' }); }, 'text-button'));
      return panel;
    }));
  }
  $('#planner-form').addEventListener('submit', event => {
    event.preventDefault(); if (!validate(event.currentTarget)) return;
    const d = Object.fromEntries(new FormData(event.currentTarget));
    state.planner.push({ id: uid(), semana: week, dia: Number(d.dia), refeicao: d.refeicao, receita_id: d.receita_id, porcoes_desejadas: Number(d.porcoes_desejadas) });
    invalidateShopping(); save(); renderPlanner(); renderHome(); toast('Refeição adicionada. Lista de compras recalculada; marcações reiniciadas.');
  });
  $$('[data-week]').forEach(b => b.addEventListener('click', () => { week = M.addDays(week, Number(b.dataset.week)); renderPlanner(); }));
  $('#current-week').addEventListener('click', () => { week = M.monday(); renderPlanner(); });
  function renderShopping() {
    $('#shopping-week').textContent = `Semana de ${period()}`;
    const list = M.shopping(state.recipes, weekEntries());
    const key = item => `${week}|${item.key}|${item.quantidade}`;
    const progress = () => { $('#shopping-progress').textContent = `${list.filter(i => state.checked[key(i)]).length} de ${list.length} itens comprados`; };
    $('#shopping-list').replaceChildren(...list.map(item => {
      const label = el('label', 'shopping-item'); const check = input('checkbox', 'comprado', item.key); check.checked = !!state.checked[key(item)];
      label.classList.toggle('is-checked', check.checked);
      check.addEventListener('change', () => { if (check.checked) state.checked[key(item)] = true; else delete state.checked[key(item)]; save(); label.classList.toggle('is-checked', check.checked); progress(); });
      label.append(check, el('span', '', item.nome), el('strong', '', `${number(item.quantidade)} ${item.unidade}`)); return label;
    })); progress();
    if (!list.length) empty($('#shopping-list'), 'Sua lista começa no planejamento', 'Adicione uma receita ao planner desta semana para gerar os ingredientes.', '#planner', 'Planejar refeições');
  }
  function resetPantryForm() { editingPantry = null; $('#pantry-form').reset(); $('#pantry-form-title').textContent = 'Adicionar ingrediente'; $('#pantry-save').textContent = '+ Adicionar à despensa'; $('#pantry-cancel').hidden = true; }
  function renderExpiryAlerts() {
    const items = state.pantry.filter(item => M.expiry(item.validade).kind !== 'ok').sort((a, b) => a.validade.localeCompare(b.validade));
    const expired = items.filter(item => M.expiry(item.validade).kind === 'expired').length;
    $('#expiry-summary').textContent = `${expired} ${expired === 1 ? 'item vencido' : 'itens vencidos'} · ${items.length - expired} com vencimento em até 3 dias`;
    $('#expiry-list').replaceChildren(...items.map(item => {
      const status = M.expiry(item.validade), row = el('article', `panel pantry-item ${status.kind}`), info = el('div');
      info.append(el('h2', '', item.nome), el('p', 'meta', `${number(item.quantidade)} ${item.unidade} · Validade: ${M.parseDate(item.validade).toLocaleDateString('pt-BR')}`));
      row.append(info, el('span', `badge ${status.kind}`, status.label), link('Ver na despensa', '#despensa'));
      return row;
    }));
    if (!items.length) empty($('#expiry-list'), 'Nenhum alerta de validade', state.pantry.length ? 'Seus ingredientes cadastrados não estão vencidos nem vencem nos próximos 3 dias.' : 'Cadastre ingredientes e suas datas de validade na despensa para acompanhar os alertas.', '#despensa', 'Abrir despensa');
  }
  function renderPantry() {
    const count = kind => state.pantry.filter(p => M.expiry(p.validade).kind === kind).length;
    $('#pantry-stats').replaceChildren(stat(state.pantry.length, 'ingredientes cadastrados'), stat(count('soon'), 'vencem em até 3 dias'), stat(count('expired'), 'itens vencidos'));
    const filter = $('#pantry-filter').value;
    const list = state.pantry.filter(p => filter === 'all' || M.expiry(p.validade).kind === filter).sort((a, b) => a.validade.localeCompare(b.validade));
    $('#pantry-list').replaceChildren(...list.map(item => {
      const status = M.expiry(item.validade), row = el('article', `panel pantry-item ${status.kind}`), info = el('div');
      info.append(el('h3', '', item.nome), el('p', 'meta', `${number(item.quantidade)} ${item.unidade} · Validade: ${M.parseDate(item.validade).toLocaleDateString('pt-BR')}`));
      const statusBadge = el('span', `badge ${status.kind}`, status.label), actions = el('div', 'actions');
      actions.append(button('Editar', () => {
        editingPantry = item.id; const form = $('#pantry-form'); ['nome', 'quantidade', 'unidade', 'validade'].forEach(k => { form.elements.namedItem(k).value = item[k]; });
        $('#pantry-form-title').textContent = 'Editar ingrediente'; $('#pantry-save').textContent = 'Salvar alterações'; $('#pantry-cancel').hidden = false; form.elements.nome.focus();
      }), button('Remover', async () => {
        if (!await confirmRemove(`Remover ${item.nome} da despensa?`)) return;
        state.pantry = state.pantry.filter(p => p.id !== item.id); if (editingPantry === item.id) resetPantryForm(); save(); renderPantry(); renderHome(); toast('Ingrediente removido da despensa.'); $('#conteudo').focus({ preventScroll: true });
      }));
      row.append(info, statusBadge, actions); return row;
    }));
    if (!list.length) empty($('#pantry-list'), state.pantry.length ? 'Nenhum ingrediente neste filtro' : 'Sua despensa está pronta para começar', state.pantry.length ? 'Selecione outro filtro para ver seus ingredientes.' : 'Use o formulário acima para registrar o primeiro ingrediente e sua validade.');
  }
  $('#pantry-form').addEventListener('submit', event => {
    event.preventDefault(); if (!validate(event.currentTarget)) return;
    const d = Object.fromEntries(new FormData(event.currentTarget));
    const item = { id: editingPantry || uid(), nome: d.nome.trim(), quantidade: Number(d.quantidade), unidade: d.unidade, validade: d.validade };
    const index = state.pantry.findIndex(p => p.id === item.id);
    if (index >= 0) state.pantry[index] = item; else state.pantry.push(item);
    save(); resetPantryForm(); $('#pantry-filter').value = 'all'; renderPantry(); renderHome(); toast('Despensa atualizada na demonstração.');
  });
  $('#pantry-cancel').addEventListener('click', resetPantryForm);
  $('#pantry-filter').addEventListener('change', renderPantry);
  function validate(form) {
    form.querySelectorAll('input, textarea').forEach(node => {
      node.setCustomValidity('');
      if (node.required && !node.value.trim()) node.setCustomValidity('Preencha este campo.');
      if (node.type === 'date' && node.value && !M.parseDate(node.value)) node.setCustomValidity('Informe uma data válida.');
    });
    if (form.id === 'signup-form') {
      const f = form.elements;
      if (!/^\d{11}$/.test(f.cpf.value.replace(/[.\-\s]/g, ''))) f.cpf.setCustomValidity('Informe os 11 dígitos do CPF.');
      if (f.dataNascimento.value > M.dateKey()) f.dataNascimento.setCustomValidity('A data de nascimento não pode estar no futuro.');
      if (f.senha.value !== f.confirmacaoSenha.value) f.confirmacaoSenha.setCustomValidity('As senhas não coincidem.');
    }
    return form.reportValidity();
  }
  $$('form:not([method="dialog"])').forEach(form => { form.noValidate = true; form.addEventListener('input', event => { if (event.target.setCustomValidity) event.target.setCustomValidity(''); }); });
  $$('[data-auth]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault(); if (!validate(form)) return;
    form.querySelector('.status').textContent = form.id === 'login-form' ? 'Não foi possível entrar: login ainda não conectado ao servidor. Você pode explorar a demonstração pelo menu.' : form.id === 'signup-form' ? 'Campos válidos. A conta não foi criada: o cadastro ainda não está conectado ao servidor.' : 'O código não foi verificado: a confirmação ainda não está conectada ao servidor.';
    form.querySelectorAll('[type="password"], [name="senha"], [name="confirmacaoSenha"]').forEach(node => { node.value = ''; });
    hidePasswords(form);
  }));
  function hidePasswords(container) {
    container.querySelectorAll('[data-password]').forEach(b => {
      document.getElementById(b.dataset.password).type = 'password';
      b.textContent = 'Mostrar'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Mostrar senha');
    });
  }
  $('#signup-form [name="dataNascimento"]').max = M.dateKey();
  $$('[data-password]').forEach(b => b.addEventListener('click', () => {
    const node = document.getElementById(b.dataset.password), show = node.type === 'password'; node.type = show ? 'text' : 'password'; b.textContent = show ? 'Ocultar' : 'Mostrar'; b.setAttribute('aria-pressed', show); b.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  }));
  options($('#filters [name="meal"]'), M.meals, true);
  options($('#recipe-form [name="refeicao_recomendada"]'), M.meals);
  options($('#planner-form [name="refeicao"]'), M.meals);
  options($('#planner-form [name="dia"]'), days.map((d, i) => ({ label: d, value: String(i) })));
  options($('#pantry-form [name="unidade"]'), M.units);
  $('#filters').addEventListener('submit', event => { event.preventDefault(); renderRecipes(); });
  $('#filters').addEventListener('input', renderRecipes);
  $('#filters').addEventListener('change', renderRecipes);
  $('#filters').addEventListener('reset', () => setTimeout(renderRecipes, 0));
  $$('[data-collection]').forEach(b => b.addEventListener('click', () => { collection = b.dataset.collection; renderRecipes(); }));
  const menu = $('#menu'), open = $('#abrir-menu'), close = $('#fechar-menu'), scrim = $('#scrim'), main = $('#conteudo');
  const mobile = matchMedia('(max-width: 899px)');
  $('.skip').addEventListener('click', event => { event.preventDefault(); main.focus(); });
  function toggleMenu(show, returnFocus = false) {
    const active = show && mobile.matches; menu.classList.toggle('open', active); scrim.hidden = !active; open.setAttribute('aria-expanded', active);
    main.inert = active; $('.topbar').inert = active; $('#tema').inert = active; document.body.classList.toggle('menu-open', active);
    if (active) close.focus(); else if (returnFocus) open.focus();
  }
  open.addEventListener('click', () => toggleMenu(true)); close.addEventListener('click', () => toggleMenu(false, true)); scrim.addEventListener('click', () => toggleMenu(false, true)); mobile.addEventListener('change', () => toggleMenu(false));
  document.addEventListener('keydown', event => {
    if (!menu.classList.contains('open')) return;
    if (event.key === 'Escape') { toggleMenu(false, true); return; }
    if (event.key === 'Tab') {
      const items = [...menu.querySelectorAll('a, button')].filter(n => n.getClientRects().length), first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  let lastPage = '';
  function navigate() {
    let [id, argument] = location.hash.slice(1).split('/');
    try { argument = decodeURIComponent(argument || ''); } catch { argument = ''; }
    const pages = $$('.page'), target = pages.find(p => p.id === id) || pages[0]; id = target.id;
    // Sair de autenticação limpa os campos pessoais apenas em memória.
    if (lastPage && lastPage !== id && ['entrar', 'cadastro'].includes(lastPage)) {
      document.getElementById(lastPage).querySelectorAll('form').forEach(f => { f.reset(); f.querySelectorAll('input').forEach(n => n.setCustomValidity('')); f.querySelector('.status').textContent = ''; });
      hidePasswords(document.getElementById(lastPage));
    }
    toggleMenu(false); pages.forEach(p => { p.hidden = p !== target; }); updateRecipeSelects(); renderHome();
    if (id === 'receitas') renderRecipes();
    if (id === 'favoritos') renderFavorites();
    if (id === 'detalhe') renderDetail(argument);
    if (id === 'nova-receita') prepareRecipeForm(argument);
    if (id === 'aprovacao') renderApprovals();
    if (id === 'calculadora') calculate();
    if (id === 'planner') renderPlanner();
    if (id === 'compras') renderShopping();
    if (id === 'despensa') renderPantry();
    if (id === 'alertas') renderExpiryAlerts();
    $$('[data-nav]').forEach(a => { if (a.hash === `#${['detalhe', 'nova-receita'].includes(id) ? 'receitas' : id}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.title = `${id === 'entrar' ? 'Entrar' : target.querySelector('h1').textContent} · MiniChef`; window.scrollTo(0, 0); main.focus({ preventScroll: true }); lastPage = id;
  }
  window.addEventListener('hashchange', navigate);
  window.addEventListener('load', () => requestAnimationFrame(() => window.scrollTo(0, 0)));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderHome(); if (!$('#despensa').hidden) renderPantry(); if (!$('#alertas').hidden) renderExpiryAlerts(); } });
  navigate();
})();
