// Запуск: ./tests/run.sh  (использует встроенный в macOS JavaScriptCore, Node не нужен)
var failures = [], passed = 0;

function check(name, actual, expected) {
  if (actual === expected) passed++;
  else failures.push(name + ': ожидалось ' + expected + ', получено ' + actual);
}

function validLayout(name, L, W, r, gap) {
  var ps = r.placements;
  for (var i = 0; i < ps.length; i++) {
    var p = ps[i];
    if (p.x < 0 || p.y < 0 || p.x + p.len > L || p.y + p.wid > W) {
      failures.push(name + ': паллета ' + (i + 1) + ' выходит за кузов');
      return;
    }
    for (var j = i + 1; j < ps.length; j++) {
      var q = ps[j];
      if (p.x < q.x + q.len + gap && q.x < p.x + p.len + gap && p.y < q.y + q.wid + gap && q.y < p.y + p.wid + gap) {
        failures.push(name + ': паллеты ' + (i + 1) + ' и ' + (j + 1) + ' пересекаются');
        return;
      }
    }
  }
  passed++;
}

var cases = [
  ['Еврофура + EUR (без зазора)', 13600, 2450, 1200, 800, true, 34, 0],
  ['Еврофура + EUR (зазор 20 мм)', 13600, 2450, 1200, 800, true, 33, 20],
  ['Еврофура + FIN', 13600, 2450, 1200, 1000, true, 26],
  ['Еврофура + 1200×1200', 13600, 2450, 1200, 1200, true, 22],
  ['Контейнер 20′ + EUR', 5898, 2352, 1200, 800, true, 11],
  ['Контейнер 20′ + FIN', 5898, 2352, 1200, 1000, true, 9],
  ['Контейнер 40′ + EUR', 12032, 2352, 1200, 800, true, 25],
  ['Контейнер 40′ + FIN', 12032, 2352, 1200, 1000, true, 22],
  ['EUR без поворота', 13600, 2450, 1200, 800, false, 33],
  ['EUR без поворота, поперёк', 13600, 2450, 800, 1200, false, 34],
  ['Паллета больше кузова', 1000, 1000, 1200, 800, true, 0],
  ['Ровно по размеру', 1200, 800, 1200, 800, true, 1]
];

cases.forEach(function (c) {
  var r = Packing.pack(c[1], c[2], c[3], c[4], c[5], c[7]);
  check(c[0], r.count, c[6]);
  validLayout(c[0], c[1], c[2], r, c[7] || 0);
});

var w = Packing.applyWeight(33, 20000, 800);
check('Вес: ограничение', w.count, 25);
check('Вес: причина', w.limitedBy, 'weight');
check('Вес: без веса', Packing.applyWeight(33, 20000, 0).count, 33);

var blk = Packing.blockPack(13600, 2450, 1200, 800, true, 0);
check('Блочная эвристика: еврофура', blk.count, 34);
validLayout('Блочная эвристика', 13600, 2450, blk, 0);

var t0 = Date.now();
Packing.pack(13600, 2450, 333, 217, true);
check('Скорость (неудобный размер) < 3 c', Date.now() - t0 < 3000, true);

(failures.length ? 'ПРОВАЛ\n' + failures.join('\n') + '\n' : '') + 'Пройдено проверок: ' + passed + ', провалено: ' + failures.length;
