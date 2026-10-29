// Тесты сборного груза. Запуск: ./tests/run.sh
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

var EUR = { length: 1200, width: 800, allowRotate: true, weight: 500 };
var US = { length: 1219, width: 1016, allowRotate: true, weight: 600 };
var FIN = { length: 1200, width: 1000, allowRotate: true, weight: 600 };
function q(type, n) { return Object.assign({}, type, { qty: n }); }
var truck = { length: 13600, width: 2450, payload: 20000 };

var cases = [
  ['4 EUR + 2 US в еврофуру', [q(EUR, 4), q(US, 2)], 0, true],
  ['34 EUR одним типом', [q(EUR, 34)], 0, true],
  ['35 EUR не влезает', [q(EUR, 35)], 0, false],
  ['20 EUR + 8 FIN', [q(EUR, 20), q(FIN, 8)], 0, true],
  ['20 EUR + 8 FIN, зазор 30', [q(EUR, 20), q(FIN, 8)], 30, true],
  ['Три типа', [q(EUR, 10), q(FIN, 6), q(US, 6)], 0, true]
];

cases.forEach(function (c) {
  var r = Mixed.pack(truck.length, truck.width, c[1], c[2]);
  check(c[0] + ' — помещается', r.allFit, c[3]);
  validLayout(c[0], truck.length, truck.width, r, c[2]);
});

var over = Mixed.pack(truck.length, truck.width, [q(EUR, 35)], 0);
check('35 EUR: размещено', over.placed, 34);

// 4 EUR (1,6 м пола при 2 рядах поперёк по 2) + US: проверяем, что подсказка «ещё влезет» реальна.
var base = [q(EUR, 4), q(US, 2)];
var extraUS = Mixed.extraCapacity(truck, base, 1, 0);
check('Ещё US: ответ > 0', extraUS > 0, true);
var withExtra = Mixed.pack(truck.length, truck.width, [q(EUR, 4), q(US, 2 + extraUS)], 0);
check('Ещё US: столько действительно влезает', withExtra.allFit, true);
var oneMore = Mixed.pack(truck.length, truck.width, [q(EUR, 4), q(US, 3 + extraUS)], 0);
check('Ещё US: на одну больше уже не влезает', oneMore.allFit, false);

// Ограничение по весу: 20 т, 4×500 + 2×2000 = 6000 кг → ещё 14 000 / 2000 = 7 (по месту влезло бы больше).
var heavy = [q(EUR, 4), Object.assign(q(US, 2), { weight: 2000 })];
check('Ещё US с учётом веса', Mixed.extraCapacity(truck, heavy, 1, 0), 7);

var t0 = Date.now();
Mixed.extraCapacity(truck, [q(EUR, 10), q(FIN, 6), q(US, 2)], 0, 0);
var ms = Date.now() - t0;
check('Скорость «ещё влезет» < 3 с (' + ms + ' мс)', ms < 3000, true);

(failures.length ? 'ПРОВАЛ\n' + failures.join('\n') + '\n' : '') + 'Сборный груз — пройдено: ' + passed + ', провалено: ' + failures.length;
