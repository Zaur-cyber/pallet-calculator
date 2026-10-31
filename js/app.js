(function () {
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n, digits) {
    return n.toLocaleString('ru-RU', { maximumFractionDigits: digits || 0 });
  };
  var meters = function (mm) { return fmt(mm / 1000, 2) + ' м'; };
  var TYPE_COLORS = 6;

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  var palletsWord = function (n) { return plural(n, 'паллета', 'паллеты', 'паллет'); };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function num(value) {
    var v = parseFloat(value);
    return isFinite(v) && v > 0 ? v : 0;
  }

  // ---------- Шаблоны ----------

  // Описание полей шаблонов: какие инпуты соответствуют каким свойствам.
  var kinds = {
    trucks: {
      select: 'truckPreset', save: 'saveTruck', del: 'deleteTruck', tpl: 'truck', builtin: Presets.trucks,
      fields: { length: 'truckLength', width: 'truckWidth', payload: 'truckPayload' },
      defaultName: function (v) { return 'Кузов ' + meters(v.length) + ' × ' + meters(v.width); }
    },
    pallets: {
      select: 'palletPreset', save: 'savePallet', del: 'deletePallet', tpl: 'pallet', builtin: Presets.pallets,
      fields: { length: 'palletLength', width: 'palletWidth', weight: 'palletWeight' },
      defaultName: function (v) { return 'Паллета ' + v.length + '×' + v.width; }
    }
  };

  function allTemplates(kind) {
    return kinds[kind].builtin.map(function (p) { return { key: 'p:' + p.id, item: p }; })
      .concat(Store.load(kind).map(function (p) { return { key: 'u:' + p.id, item: p }; }));
  }

  function findTemplate(kind, key) {
    return allTemplates(kind).filter(function (t) { return t.key === key; })[0];
  }

  // Ключ шаблона, совпадающего со значениями (предпочитая текущий), иначе 'custom'.
  function matchTemplate(kind, values, currentKey) {
    var props = Object.keys(kinds[kind].fields);
    var matches = allTemplates(kind).filter(function (t) {
      return props.every(function (k) { return (t.item[k] || 0) === (values[k] || 0); });
    });
    if (matches.some(function (t) { return t.key === currentKey; })) return currentKey;
    return matches[0] ? matches[0].key : 'custom';
  }

  function templateName(kind, key, values) {
    var t = findTemplate(kind, key);
    return t ? t.item.name : kinds[kind].defaultName(values);
  }

  function optionsHtml(kind) {
    var user = Store.load(kind);
    var html = '<optgroup label="Справочник">' + kinds[kind].builtin.map(function (p) {
      return '<option value="p:' + p.id + '">' + escapeHtml(p.name) + '</option>';
    }).join('') + '</optgroup>';
    if (user.length) {
      html += '<optgroup label="Мои шаблоны">' + user.map(function (p) {
        return '<option value="u:' + p.id + '">' + escapeHtml(p.name) + '</option>';
      }).join('') + '</optgroup>';
    }
    return html + '<option value="custom">Свои размеры</option>';
  }

  function readValues(kind) {
    var f = kinds[kind].fields, v = {};
    Object.keys(f).forEach(function (k) { v[k] = num($(f[k]).value); });
    return v;
  }

  function writeValues(kind, item) {
    var f = kinds[kind].fields;
    Object.keys(f).forEach(function (k) { $(f[k]).value = item[k] || ''; });
  }

  function renderSelect(kind, selectedKey) {
    var sel = $(kinds[kind].select);
    sel.innerHTML = optionsHtml(kind);
    sel.value = selectedKey || 'custom';
    $(kinds[kind].del).hidden = sel.value.indexOf('u:') !== 0;
  }

  function syncSelect(kind) {
    var key = matchTemplate(kind, readValues(kind), $(kinds[kind].select).value);
    $(kinds[kind].select).value = key;
    $(kinds[kind].del).hidden = key.indexOf('u:') !== 0;
  }

  function selectedName(kind) {
    return templateName(kind, $(kinds[kind].select).value, readValues(kind));
  }

  // ---------- Режим и сборный груз ----------

  var mode = 'single';
  var items = [];

  function newItem(presetId, qty) {
    var p = Presets.pallets.filter(function (x) { return x.id === presetId; })[0] || Presets.pallets[0];
    return { preset: 'p:' + p.id, length: p.length, width: p.width, weight: p.weight, qty: qty, allowRotate: true };
  }

  function itemName(it) {
    var t = findTemplate('pallets', it.preset);
    return t ? t.item.name : it.length + '×' + it.width;
  }

  function setMode(m) {
    mode = m;
    $('modeSingle').setAttribute('aria-selected', String(m === 'single'));
    $('modeMixed').setAttribute('aria-selected', String(m === 'mixed'));
    $('palletCard').hidden = m !== 'single';
    $('needField').hidden = m !== 'single';
    $('mixedCard').hidden = m !== 'mixed';
    calculate();
  }

  function renderItems() {
    var opts = optionsHtml('pallets');
    $('items').innerHTML = items.map(function (it, i) {
      return '<div class="item t' + (i % TYPE_COLORS) + '" data-i="' + i + '">'
        + '<div class="item-head"><span class="dot"></span>'
        + '<select data-f="preset" aria-label="Тип паллеты">' + opts + '</select>'
        + '<button type="button" class="ghost danger" data-action="remove" aria-label="Удалить позицию">✕</button></div>'
        + '<div class="item-fields">'
        + '<label class="field">Длина, мм<input data-f="length" type="number" min="1" inputmode="numeric"></label>'
        + '<label class="field">Ширина, мм<input data-f="width" type="number" min="1" inputmode="numeric"></label>'
        + '<label class="field">Вес 1 шт, кг<input data-f="weight" type="number" min="0" inputmode="numeric"></label>'
        + '<label class="field">Кол-во, шт<input data-f="qty" type="number" min="0" inputmode="numeric"></label>'
        + '</div>'
        + '<div class="item-foot"><label class="check"><input data-f="allowRotate" type="checkbox"> можно поворачивать</label>'
        + '<span class="extra" id="extra-' + i + '"></span></div>'
        + '</div>';
    }).join('');
    items.forEach(function (it, i) { fillItemRow(i); });
  }

  function fillItemRow(i) {
    var row = $('items').querySelector('[data-i="' + i + '"]'), it = items[i];
    row.querySelector('[data-f="preset"]').value = it.preset;
    ['length', 'width', 'weight', 'qty'].forEach(function (f) {
      row.querySelector('[data-f="' + f + '"]').value = it[f] || '';
    });
    row.querySelector('[data-f="allowRotate"]').checked = it.allowRotate;
  }

  function onItemEdit(e) {
    var row = e.target.closest('[data-i]'), f = e.target.dataset.f;
    if (!row || !f) return;
    var i = +row.dataset.i, it = items[i];
    if (f === 'preset') {
      it.preset = e.target.value;
      var t = findTemplate('pallets', it.preset);
      if (t) { it.length = t.item.length; it.width = t.item.width; it.weight = t.item.weight || 0; fillItemRow(i); }
    } else if (f === 'allowRotate') {
      it.allowRotate = e.target.checked;
    } else {
      it[f] = num(e.target.value);
      if (f !== 'qty') {
        it.preset = matchTemplate('pallets', it, it.preset);
        row.querySelector('[data-f="preset"]').value = it.preset;
      }
    }
    scheduleCalc();
  }
  $('items').addEventListener('input', onItemEdit);
  $('items').addEventListener('change', function (e) { if (e.target.dataset.f === 'preset') onItemEdit(e); });

  $('items').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action="remove"]');
    if (!btn) return;
    items.splice(+btn.closest('[data-i]').dataset.i, 1);
    renderItems();
    calculate();
  });

  $('addItem').addEventListener('click', function () {
    items.push(newItem('eur', 1));
    renderItems();
    calculate();
  });

  $('modeSingle').addEventListener('click', function () { setMode('single'); });
  $('modeMixed').addEventListener('click', function () { setMode('mixed'); });

  // ---------- Расчёт ----------

  var last = null;

  function common() {
    return { truck: readValues('trucks'), gap: num($('gap').value) };
  }

  function calculate() {
    clearTimeout(timer);
    extrasToken++;
    if (mode === 'mixed') calculateMixed(); else calculateSingle();
  }

  function calculateSingle() {
    var c = common(), pallet = readValues('pallets');
    var allowRotate = $('allowRotate').checked, need = Math.floor(num($('need').value));
    var floor = Packing.pack(c.truck.length, c.truck.width, pallet.length, pallet.width, allowRotate, c.gap);
    var weight = Packing.applyWeight(floor.count, c.truck.payload, pallet.weight);
    last = { mode: 'single', truck: c.truck, gap: c.gap, pallet: pallet, allowRotate: allowRotate, need: need, floor: floor, weight: weight };

    var count = weight.count, verdict = $('resVerdict');
    var tooSmall = isTooSmall(pallet);
    var ready = c.truck.length && c.truck.width && pallet.length && pallet.width && !tooSmall;
    $('resCount').textContent = ready ? fmt(count) : '—';
    $('resUnit').textContent = ready ? palletsWord(count) + ' в машину' : '';

    if (!ready) {
      setVerdict('', tooSmall ? MIN_SIDE_TEXT : 'Введите размеры кузова и паллеты');
      $('resStats').innerHTML = '';
      renderSchema(null);
      return;
    }

    if (count === 0) {
      setVerdict('bad', floor.count === 0 ? 'Паллета не помещается в кузов' : 'Даже одна паллета превышает грузоподъёмность');
    } else if (need > 0) {
      var trucks = Math.ceil(need / count);
      if (trucks === 1) {
        setVerdict('ok', 'Все ' + fmt(need) + ' ' + palletsWord(need) + ' помещаются в одну машину'
          + (count > need ? ', свободно ещё ' + fmt(count - need) + ' мест' : ''));
      } else {
        var lastLoad = need - (trucks - 1) * count;
        setVerdict('warn', 'Нужно машин: ' + trucks + ' (в последней — ' + fmt(lastLoad) + ' ' + palletsWord(lastLoad) + ')');
      }
    } else if (weight.limitedBy === 'weight') {
      setVerdict('warn', 'Упираемся в грузоподъёмность: по полу встало бы ' + fmt(floor.count));
    } else {
      setVerdict('ok', 'Упираемся в площадь пола');
    }

    var loaded = floor.placements.slice(0, count);
    var stats = [
      ['По площади пола', fmt(floor.count) + ' шт'],
      ['По грузоподъёмности', isFinite(weight.byWeight) ? fmt(weight.byWeight) + ' шт' : 'вес не задан']
    ];
    if (weight.totalWeight) stats.push(weightStat(weight.totalWeight, c.truck.payload));
    renderStats(stats.concat(floorStats(loaded, c.truck)));

    var legend = [{ cls: 'along', label: 'вдоль' }, { cls: 'across', label: 'поперёк' }];
    if (floor.count > count) legend.push({ cls: 'over', label: 'не проходит по весу' });
    renderSchema(c.truck, floor.placements, function (p, i) {
      return i >= count ? 'p-over' : (p.rotated ? 'p-across' : 'p-along');
    }, legend);
  }

  // Сторона паллеты введена, но меньше минимума (обычно — человек ещё печатает число).
  var MIN_SIDE_TEXT = 'Сторона паллеты — не меньше ' + Packing.MIN_SIDE + ' мм';
  function isTooSmall(p) {
    return (p.length > 0 && p.length < Packing.MIN_SIDE) || (p.width > 0 && p.width < Packing.MIN_SIDE);
  }

  function calculateMixed() {
    var c = common();
    var res = Mixed.pack(c.truck.length, c.truck.width, items, c.gap);
    var totalWeight = items.reduce(function (s, it) { return s + (it.weight || 0) * (it.qty || 0); }, 0);
    last = { mode: 'mixed', truck: c.truck, gap: c.gap, items: items.map(function (it) { return Object.assign({}, it); }), result: res };

    var tooSmall = items.some(function (it) { return it.qty > 0 && isTooSmall(it); });
    var ready = c.truck.length && c.truck.width && res.total > 0 && !tooSmall;
    $('resCount').textContent = ready ? fmt(res.placed) + ' / ' + fmt(res.total) : '—';
    $('resUnit').textContent = ready ? palletsWord(res.total) + ' встаёт' : '';

    if (!ready) {
      setVerdict('', !(c.truck.length && c.truck.width) ? 'Введите размеры кузова'
        : tooSmall ? MIN_SIDE_TEXT : 'Добавьте паллеты в груз');
      $('resStats').innerHTML = '';
      renderSchema(null);
      renderExtras(null);
      return;
    }

    var overweight = c.truck.payload > 0 && totalWeight > c.truck.payload;
    if (!res.allFit) {
      var missing = items.map(function (it, i) {
        var n = (it.qty || 0) - res.placedByType[i];
        return n > 0 ? n + ' × ' + itemName(it) : null;
      }).filter(Boolean);
      setVerdict('bad', 'Не помещается. Не встало: ' + missing.join(', '));
    } else if (overweight) {
      setVerdict('bad', 'По полу всё встаёт, но перегруз на ' + fmt(totalWeight - c.truck.payload) + ' кг');
    } else {
      setVerdict('ok', 'Весь груз помещается');
    }

    var stats = [];
    if (totalWeight) stats.push(weightStat(totalWeight, c.truck.payload));
    renderStats(stats.concat(floorStats(res.placements, c.truck)));

    var legend = items.map(function (it, i) {
      return { cls: 'typed t' + (i % TYPE_COLORS), label: itemName(it) + ' — ' + res.placedByType[i] + ' шт' };
    }).filter(function (_, i) { return items[i].qty > 0; });
    renderSchema(c.truck, res.placements, function (p) { return 'typed t' + (p.type % TYPE_COLORS); }, legend);

    renderExtras(res.allFit && !overweight ? c : null);
  }

  // «Ещё влезет» считается после основной отрисовки, по одной позиции, чтобы не подвешивать страницу.
  var extrasToken = 0;
  function renderExtras(c) {
    var token = ++extrasToken;
    items.forEach(function (_, i) {
      var el = $('extra-' + i);
      if (!el) return;
      el.className = 'extra';
      el.innerHTML = c ? 'ещё влезет: считаю…' : '';
    });
    if (!c) return;
    var i = 0;
    (function next() {
      if (token !== extrasToken || i >= items.length) return;
      var idx = i++, el = $('extra-' + idx);
      if (el) {
        var n = Mixed.extraCapacity(c.truck, items, idx, c.gap);
        el.className = 'extra' + (n ? '' : ' none');
        el.innerHTML = 'ещё влезет: <b>+' + n + '</b> шт';
      }
      setTimeout(next, 0);
    })();
  }

  function setVerdict(cls, text) {
    $('resVerdict').className = 'verdict' + (cls ? ' ' + cls : '');
    $('resVerdict').textContent = text;
  }

  function weightStat(total, payload) {
    var pct = payload ? ' (' + fmt(total / payload * 100) + '%)' : '';
    return ['Вес груза', fmt(total) + ' кг' + pct];
  }

  function floorStats(placements, truck) {
    var used = placements.reduce(function (m, p) { return Math.max(m, p.x + p.len); }, 0);
    var area = placements.reduce(function (s, p) { return s + p.len * p.wid; }, 0);
    return [
      ['Занято по длине', meters(used) + ' из ' + meters(truck.length)],
      ['Свободно по длине', meters(Math.max(0, truck.length - used))],
      ['Заполнение пола', fmt(area / (truck.length * truck.width) * 100) + '%']
    ];
  }

  function renderStats(stats) {
    $('resStats').innerHTML = stats.map(function (s) {
      return '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>';
    }).join('');
  }

  function renderSchema(truck, placements, classFor, legend) {
    var box = $('schema');
    $('legend').innerHTML = (legend || []).map(function (l) {
      return '<li><i class="sw ' + l.cls + '"></i>' + escapeHtml(l.label) + '</li>';
    }).join('');
    if (!truck) {
      box.innerHTML = '<p class="empty">Схема появится после ввода данных.</p>';
      return;
    }
    var L = truck.length, W = truck.width;
    var k = Math.max(L, W * 2) / 800;            // мм на «пиксель» при ширине ~800
    var font = 13 * k, pad = 30 * k, top = 28 * k, bottom = 40 * k;
    var parts = [];

    parts.push('<text class="dim" x="' + pad + '" y="' + (top - 9 * k) + '" font-size="' + font + '">◀ Кабина</text>');
    parts.push('<text class="dim" x="' + (pad + L) + '" y="' + (top - 9 * k) + '" font-size="' + font + '" text-anchor="end">Ворота ▶</text>');
    parts.push('<rect class="truck" x="' + pad + '" y="' + top + '" width="' + L + '" height="' + W + '" stroke-width="' + 1.5 * k + '"/>');

    placements.forEach(function (p, i) {
      var x = pad + p.x, y = top + p.y;
      parts.push('<rect class="' + classFor(p, i) + '" x="' + x + '" y="' + y + '" width="' + p.len + '" height="' + p.wid
        + '" rx="' + 2 * k + '" stroke-width="' + k + '"/>');
      var numFont = Math.min(Math.min(p.len, p.wid) * 0.38, font * 1.3);
      parts.push('<text class="num" x="' + (x + p.len / 2) + '" y="' + (y + p.wid / 2) + '" font-size="' + numFont + '">'
        + (i + 1) + '</text>');
    });

    var dy = top + W + 18 * k;
    parts.push('<line class="dimline" x1="' + pad + '" y1="' + dy + '" x2="' + (pad + L) + '" y2="' + dy + '" stroke-width="' + k + '"/>');
    parts.push('<text class="dim" x="' + (pad + L / 2) + '" y="' + (dy + 17 * k) + '" font-size="' + font
      + '" text-anchor="middle">длина ' + fmt(L) + ' мм · ширина ' + fmt(W) + ' мм</text>');

    box.innerHTML = '<svg viewBox="0 0 ' + (L + pad * 2) + ' ' + (W + top + bottom) + '" role="img" aria-label="Схема раскладки паллет в кузове">'
      + parts.join('') + '</svg>';
  }

  // ---------- История ----------

  function renderHistory() {
    var list = Store.load('history'), ul = $('history');
    if (!list.length) {
      ul.innerHTML = '<li class="empty">Пока нет сохранённых расчётов.</li>';
      return;
    }
    ul.innerHTML = list.map(function (h) {
      var date = new Date(h.date).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
      var what = h.mode === 'mixed' ? 'Сборный: ' + h.summary : h.palletName;
      var count = h.mode === 'mixed' ? h.count + ' / ' + h.total : fmt(h.count);
      return '<li data-id="' + h.id + '">'
        + '<div class="info"><div class="title">' + escapeHtml(h.name) + '</div>'
        + '<div class="meta">' + escapeHtml(h.truckName) + ' · ' + escapeHtml(what) + ' · ' + date + '</div></div>'
        + '<span class="count">' + count + ' шт</span>'
        + '<button type="button" class="ghost" data-action="open">Открыть</button>'
        + '<button type="button" class="ghost danger" data-action="delete" aria-label="Удалить">✕</button>'
        + '</li>';
    }).join('');
  }

  $('history').addEventListener('click', function (e) {
    var btn = e.target.closest('button'), li = e.target.closest('li[data-id]');
    if (!btn || !li) return;
    var id = li.getAttribute('data-id');
    if (btn.dataset.action === 'delete') {
      Store.remove('history', id);
      renderHistory();
      return;
    }
    var h = Store.load('history').filter(function (x) { return x.id === id; })[0];
    if (!h) return;
    writeValues('trucks', h.truck);
    syncSelect('trucks');
    $('gap').value = h.gap || 0;
    $('calcName').value = h.name;
    if (h.mode === 'mixed') {
      items = h.items.map(function (it) { return Object.assign({}, it); });
      renderItems();
    } else {
      writeValues('pallets', h.pallet);
      syncSelect('pallets');
      $('allowRotate').checked = h.allowRotate;
      $('need').value = h.need || '';
    }
    setMode(h.mode === 'mixed' ? 'mixed' : 'single');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  $('saveCard').addEventListener('submit', function (e) {
    e.preventDefault();
    calculate();
    var truckName = selectedName('trucks'), entry;
    if (last.mode === 'mixed') {
      var summary = last.items.filter(function (it) { return it.qty > 0; })
        .map(function (it) { return it.qty + '×' + itemName(it); }).join(', ');
      entry = {
        mode: 'mixed', truck: last.truck, truckName: truckName, gap: last.gap, items: last.items,
        summary: summary, count: last.result.placed, total: last.result.total
      };
      entry.name = $('calcName').value.trim() || 'Сборный груз → ' + truckName;
    } else {
      var palletName = selectedName('pallets');
      entry = {
        mode: 'single', truck: last.truck, truckName: truckName, gap: last.gap, count: last.weight.count,
        pallet: last.pallet, palletName: palletName, allowRotate: last.allowRotate, need: last.need
      };
      entry.name = $('calcName').value.trim() || palletName + ' → ' + truckName;
    }
    entry.date = Date.now();
    if (!Store.add('history', entry)) { notify('Не удалось сохранить: браузер не даёт доступ к хранилищу.'); return; }
    $('calcName').value = '';
    renderHistory();
    notify('Расчёт сохранён в историю');
  });

  var toastTimer = null;
  function notify(text) {
    $('toast').textContent = text;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').hidden = true; }, 3000);
  }

  // ---------- Шаблоны и события ----------

  Object.keys(kinds).forEach(function (kind) {
    var cfg = kinds[kind];

    $(cfg.select).addEventListener('change', function () {
      $(cfg.del).hidden = this.value.indexOf('u:') !== 0;
      var t = findTemplate(kind, this.value);
      if (t) { writeValues(kind, t.item); calculate(); }
    });

    Object.keys(cfg.fields).forEach(function (k) {
      $(cfg.fields[k]).addEventListener('input', function () { syncSelect(kind); scheduleCalc(); });
    });

    // Сохранение шаблона: встроенная форма с названием вместо системного окна.
    $(cfg.save).addEventListener('click', function () {
      var v = readValues(kind);
      if (!v.length || !v.width) { notify('Сначала укажите длину и ширину.'); return; }
      $(cfg.tpl + 'TplName').value = cfg.defaultName(v);
      $(cfg.tpl + 'TplForm').hidden = false;
      $(cfg.tpl + 'TplName').select();
    });

    function saveTemplate() {
      var v = readValues(kind), name = $(cfg.tpl + 'TplName').value.trim();
      if (!name) { notify('Введите название шаблона.'); return; }
      v.name = name;
      var saved = Store.add(kind, v);
      if (!saved) { notify('Не удалось сохранить: браузер не даёт доступ к хранилищу.'); return; }
      $(cfg.tpl + 'TplForm').hidden = true;
      renderSelect(kind, 'u:' + saved.id);
      if (kind === 'pallets') renderItems();
      notify('Шаблон «' + name + '» сохранён');
    }
    $(cfg.tpl + 'TplOk').addEventListener('click', saveTemplate);
    $(cfg.tpl + 'TplName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveTemplate(); }
      if (e.key === 'Escape') $(cfg.tpl + 'TplForm').hidden = true;
    });
    $(cfg.tpl + 'TplCancel').addEventListener('click', function () { $(cfg.tpl + 'TplForm').hidden = true; });

    // Удаление шаблона: первое нажатие просит подтвердить, второе — удаляет.
    var armTimer = null;
    $(cfg.del).addEventListener('click', function () {
      var btn = this, key = $(cfg.select).value;
      if (key.indexOf('u:') !== 0) return;
      if (!btn.dataset.armed) {
        btn.dataset.armed = '1';
        btn.textContent = 'Нажмите ещё раз, чтобы удалить';
        armTimer = setTimeout(function () { delete btn.dataset.armed; btn.textContent = 'Удалить шаблон'; }, 3000);
        return;
      }
      clearTimeout(armTimer);
      delete btn.dataset.armed;
      btn.textContent = 'Удалить шаблон';
      notify('Шаблон «' + selectedName(kind) + '» удалён');
      Store.remove(kind, key.slice(2));
      renderSelect(kind);
      syncSelect(kind);
      if (kind === 'pallets') {
        items.forEach(function (it) { it.preset = matchTemplate('pallets', it, it.preset); });
        renderItems();
        calculate();
      }
    });
  });

  ['allowRotate', 'gap', 'need'].forEach(function (id) {
    $(id).addEventListener('input', scheduleCalc);
  });
  document.querySelectorAll('form').forEach(function (f) {
    if (f.id !== 'saveCard') f.addEventListener('submit', function (e) { e.preventDefault(); });
  });

  var timer = null;
  function scheduleCalc() {
    clearTimeout(timer);
    timer = setTimeout(calculate, 200);
  }

  // Старт: еврофура + европаллета; для сборного груза — 4 EUR + 2 американских.
  renderSelect('trucks', 'p:eurotruck');
  renderSelect('pallets', 'p:eur');
  writeValues('trucks', Presets.trucks[0]);
  writeValues('pallets', Presets.pallets[0]);
  items = [newItem('eur', 4), newItem('us', 2)];
  renderItems();
  renderHistory();
  setMode('single');
})();
