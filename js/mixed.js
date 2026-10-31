// Сборный груз: паллеты разных размеров в одном кузове.
// items: [{ length, width, qty, allowRotate }] — индекс в массиве = тип паллеты.
// Задача NP-трудная, поэтому перебираем несколько стратегий и берём лучшую:
//  1) «зоны»: каждый тип раскладывается оптимально (Packing.pack) в свою зону по длине кузова,
//     зоны идут друг за другом в разном порядке;
//  2) MaxRects: паллеты ставятся по одной в самое близкое к кабине свободное место,
//     в разных порядках и с разной предпочтительной ориентацией.
var Mixed = (function () {
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    var out = [];
    arr.forEach(function (v, i) {
      var rest = arr.slice(0, i).concat(arr.slice(i + 1));
      permutations(rest).forEach(function (p) { out.push([v].concat(p)); });
    });
    return out;
  }

  function usedLength(placements) {
    return placements.reduce(function (m, p) { return Math.max(m, p.x + p.len); }, 0);
  }

  // ---------- Стратегия 1: зоны ----------

  function zoneLayouts(L, W, items, g) {
    var cache = {};
    function packLen(t, len) {
      var key = t + '|' + len;
      if (!cache[key]) {
        var it = items[t];
        cache[key] = Packing.pack(len, W, it.length, it.width, it.allowRotate, g);
      }
      return cache[key];
    }
    // Минимальная длина зоны, в которую влезает qty паллет типа t (или -1, если не влезает в весь кузов).
    var minLen = items.map(function (it, t) {
      if (!it.qty) return 0;
      if (packLen(t, L).count < it.qty) return -1;
      var lo = 1, hi = L;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (packLen(t, mid).count >= it.qty) hi = mid; else lo = mid + 1;
      }
      return lo;
    });

    var types = items.map(function (_, i) { return i; }).filter(function (i) { return items[i].qty > 0; });
    var orders = types.length <= 5 ? permutations(types) : [types, types.slice().reverse()];

    return orders.map(function (order) {
      var placements = [], x0 = 0;
      order.forEach(function (t) {
        var rest = L - x0;
        if (rest <= 0) return;
        var len = minLen[t] > 0 && minLen[t] <= rest ? minLen[t] : rest;
        var lay = packLen(t, len).placements.slice(0, items[t].qty);
        if (!lay.length) return;
        lay.forEach(function (p) {
          placements.push({ x: p.x + x0, y: p.y, len: p.len, wid: p.wid, rotated: p.rotated, type: t });
        });
        x0 += usedLength(lay) + g;
      });
      return placements;
    });
  }

  // ---------- Стратегия 2: MaxRects ----------

  function maxRects(L, W, units, g, preferAcross) {
    var free = [{ x: 0, y: 0, w: L + g, h: W + g }], placed = [];
    units.forEach(function (u) {
      var orients = [[u.length + g, u.width + g, false]];
      if (u.allowRotate && u.length !== u.width) orients.push([u.width + g, u.length + g, true]);
      var best = null;
      free.forEach(function (f) {
        orients.forEach(function (o) {
          if (o[0] > f.w || o[1] > f.h) return;
          var tie = preferAcross ? o[0] : -o[0];
          if (!best || f.x < best.x || (f.x === best.x && (f.y < best.y || (f.y === best.y && tie < best.tie))))
            best = { x: f.x, y: f.y, w: o[0], h: o[1], rotated: o[2], tie: tie };
        });
      });
      if (!best) return;
      placed.push({ x: best.x, y: best.y, len: best.w - g, wid: best.h - g, rotated: best.rotated, type: u.type });
      free = splitFree(free, best);
    });
    return placed;
  }

  function splitFree(free, r) {
    var next = [];
    free.forEach(function (f) {
      if (r.x >= f.x + f.w || r.x + r.w <= f.x || r.y >= f.y + f.h || r.y + r.h <= f.y) { next.push(f); return; }
      if (r.x > f.x) next.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
      if (r.x + r.w < f.x + f.w) next.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - r.x - r.w, h: f.h });
      if (r.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
      if (r.y + r.h < f.y + f.h) next.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - r.y - r.h });
    });
    return next.filter(function (a, i) {
      return !next.some(function (b, j) {
        if (i === j) return false;
        var inside = a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
        return inside && (j < i || a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h);
      });
    });
  }

  function maxRectsLayouts(L, W, items, g, trials) {
    var units = [];
    items.forEach(function (it, t) {
      for (var k = 0; k < it.qty; k++)
        units.push({ length: it.length, width: it.width, allowRotate: it.allowRotate, type: t });
    });
    var area = function (u) { return u.length * u.width; };
    var orders = [
      units.slice(),
      units.slice().sort(function (a, b) { return area(b) - area(a); }),
      units.slice().sort(function (a, b) { return Math.max(b.length, b.width) - Math.max(a.length, a.width); })
    ];
    var rand = rng(12345);
    for (var i = 0; i < trials; i++) {
      var shuffled = units.slice();
      for (var j = shuffled.length - 1; j > 0; j--) {
        var k = Math.floor(rand() * (j + 1)), tmp = shuffled[j];
        shuffled[j] = shuffled[k]; shuffled[k] = tmp;
      }
      orders.push(shuffled);
    }
    var layouts = [];
    orders.forEach(function (order) {
      layouts.push(maxRects(L, W, order, g, true));
      layouts.push(maxRects(L, W, order, g, false));
    });
    return layouts;
  }

  // ---------- Общий вход ----------

  function pack(truckLength, truckWidth, items, gap, options) {
    var L = Math.floor(truckLength), W = Math.floor(truckWidth), g = Math.max(0, Math.floor(gap || 0));
    var trials = options && options.trials != null ? options.trials : 30;
    items = items.map(function (it) {
      return {
        length: Math.floor(it.length) || 0, width: Math.floor(it.width) || 0,
        qty: it.length >= Packing.MIN_SIDE && it.width >= Packing.MIN_SIDE ? Math.max(0, Math.floor(it.qty) || 0) : 0,
        allowRotate: it.allowRotate !== false
      };
    });
    var total = items.reduce(function (s, it) { return s + it.qty; }, 0);
    var empty = { placements: [], placedByType: items.map(function () { return 0; }), placed: 0, total: total, allFit: total === 0, usedLength: 0 };
    if (!(L > 0 && W > 0) || total === 0) return empty;

    var candidates = zoneLayouts(L, W, items, g).concat(maxRectsLayouts(L, W, items, g, trials));
    var best = null;
    candidates.forEach(function (placements) {
      Packing.compact(placements, g);
      var len = usedLength(placements);
      if (!best || placements.length > best.placements.length
        || (placements.length === best.placements.length && len < best.usedLength))
        best = { placements: placements, usedLength: len };
    });

    var placedByType = items.map(function () { return 0; });
    best.placements.forEach(function (p) { placedByType[p.type]++; });
    return {
      placements: best.placements,
      placedByType: placedByType,
      placed: best.placements.length,
      total: total,
      allFit: best.placements.length === total,
      usedLength: best.usedLength
    };
  }

  // Сколько ещё паллет типа index можно добавить к текущему набору (с учётом веса, если задан).
  function extraCapacity(truck, items, index, gap) {
    var it = items[index];
    if (!(it.length >= Packing.MIN_SIDE && it.width >= Packing.MIN_SIDE)) return 0;
    if (!pack(truck.length, truck.width, items, gap, { trials: 10 }).allFit) return 0;

    var usedArea = 0, usedWeight = 0;
    items.forEach(function (x) {
      usedArea += (x.length * x.width * x.qty) || 0;
      usedWeight += (x.weight * x.qty) || 0;
    });
    var hi = Math.floor((truck.length * truck.width - usedArea) / (it.length * it.width));
    if (truck.payload > 0 && it.weight > 0)
      hi = Math.min(hi, Math.floor((truck.payload - usedWeight) / it.weight));
    hi = Math.max(0, Math.min(hi, 500));

    function fits(n) {
      var trial = items.map(function (x, i) {
        return i === index ? Object.assign({}, x, { qty: (x.qty || 0) + n }) : x;
      });
      return pack(truck.length, truck.width, trial, gap, { trials: 10 }).allFit;
    }
    var lo = 0;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (fits(mid)) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  return { pack: pack, extraCapacity: extraCapacity };
})();
