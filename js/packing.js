// Расчёт раскладки паллет по полу кузова (один ярус).
// Ось X — длина кузова (от кабины к воротам), ось Y — ширина. Все размеры в мм.
var Packing = (function () {
  // Паллеты со стороной меньше этого не считаем: пока человек печатает «1200», в поле бывает «1» или «12»,
  // а раскладка тысяч крошечных паллет подвешивает страницу.
  var MIN_SIDE = 100;

  // Все значения a*l + b*w, не превышающие limit («нормальные точки»).
  // Оптимальную гильотинную раскладку достаточно искать среди разрезов в этих точках.
  function normalPoints(limit, sizes) {
    var reachable = new Uint8Array(limit + 1);
    reachable[0] = 1;
    for (var v = 0; v <= limit; v++) {
      if (!reachable[v]) continue;
      for (var i = 0; i < sizes.length; i++) {
        var n = v + sizes[i];
        if (n <= limit) reachable[n] = 1;
      }
    }
    var points = [];
    for (var p = 0; p <= limit; p++) if (reachable[p]) points.push(p);
    return points;
  }

  // Таблица: для каждого v от 0 до limit — индекс наибольшей точки <= v.
  function floorIndexTable(points, limit) {
    var table = new Int32Array(limit + 1);
    for (var v = 0, i = 0; v <= limit; v++) {
      while (i + 1 < points.length && points[i + 1] <= v) i++;
      table[v] = i;
    }
    return table;
  }

  // Гильотинное ДП: best[i][j] — максимум паллет в прямоугольнике xs[i] × ys[j].
  // gap — зазор между соседними паллетами (мм). Считаем «раздутую» на gap паллету
  // в кузове, удлинённом на gap: между паллетами остаётся ровно gap, у бортов — 0.
  function pack(truckLength, truckWidth, palletLength, palletWidth, allowRotate, gap) {
    var g = Math.max(0, Math.floor(gap || 0));
    var L0 = Math.floor(truckLength), W0 = Math.floor(truckWidth);
    var l0 = Math.floor(palletLength), w0 = Math.floor(palletWidth);
    var empty = { count: 0, placements: [], usedLength: 0, floorUsage: 0 };
    if (!(L0 > 0 && W0 > 0 && l0 >= MIN_SIDE && w0 >= MIN_SIDE)) return empty;
    var L = L0 + g, W = W0 + g, l = l0 + g, w = w0 + g;

    var xs = normalPoints(L, allowRotate ? [l, w] : [l]);
    var ys = normalPoints(W, allowRotate ? [l, w] : [w]);
    var nx = xs.length, ny = ys.length;
    // Очень мелкие «неудобные» размеры дают слишком много точек — считаем блочной эвристикой.
    if (nx * ny * (nx + ny) > 3e8) return blockPack(L0, W0, l0, w0, allowRotate, g);
    var fx = floorIndexTable(xs, L), fy = floorIndexTable(ys, W);

    var best = new Int32Array(nx * ny);
    // choice: 0 — пусто, 1 — паллета вдоль, 2 — паллета поперёк,
    // 3 — разрез по X (cut хранит индекс), 4 — разрез по Y
    var choice = new Uint8Array(nx * ny);
    var cut = new Int32Array(nx * ny);

    for (var i = 0; i < nx; i++) {
      var X = xs[i];
      for (var j = 0; j < ny; j++) {
        var Y = ys[j];
        var b = 0, c = 0, ct = 0;
        if (l <= X && w <= Y) { b = 1; c = 1; }
        else if (allowRotate && w <= X && l <= Y) { b = 1; c = 2; }

        for (var a = 1; a < nx && xs[a] * 2 <= X; a++) {
          var v = best[a * ny + j] + best[fx[X - xs[a]] * ny + j];
          if (v > b) { b = v; c = 3; ct = a; }
        }
        for (var d = 1; d < ny && ys[d] * 2 <= Y; d++) {
          var vy = best[i * ny + d] + best[i * ny + fy[Y - ys[d]]];
          if (vy > b) { b = vy; c = 4; ct = d; }
        }
        var k = i * ny + j;
        best[k] = b; choice[k] = c; cut[k] = ct;
      }
    }

    var placements = [];
    function build(i, j, ox, oy) {
      var k = i * ny + j, c = choice[k];
      if (c === 1) placements.push({ x: ox, y: oy, len: l0, wid: w0, rotated: false });
      else if (c === 2) placements.push({ x: ox, y: oy, len: w0, wid: l0, rotated: true });
      else if (c === 3) {
        var a = cut[k];
        build(a, j, ox, oy);
        build(fx[xs[i] - xs[a]], j, ox + xs[a], oy);
      } else if (c === 4) {
        var d = cut[k];
        build(i, d, ox, oy);
        build(i, fy[ys[j] - ys[d]], ox, oy + ys[d]);
      }
    }
    build(nx - 1, ny - 1, 0, 0);
    return finish(placements, L0, W0, g);
  }

  // Запасной вариант: кузов делится по длине на две зоны — паллеты вдоль и поперёк.
  function blockPack(L0, W0, l0, w0, allowRotate, g) {
    function grid(len, wid, pl, pw) {
      return { rows: Math.floor((len + g) / (pl + g)), cols: Math.floor((wid + g) / (pw + g)) };
    }
    var bestCount = -1, bestSplit = 0;
    var step = l0 + g, maxRows = Math.floor((L0 + g) / step);
    for (var r = 0; r <= maxRows; r++) {
      var front = grid(r * step - g, W0, l0, w0);
      var restLen = L0 - r * step;
      var back = allowRotate && restLen > 0 ? grid(restLen, W0, w0, l0) : { rows: 0, cols: 0 };
      var count = r * front.cols + back.rows * back.cols;
      if (count > bestCount) { bestCount = count; bestSplit = r; }
    }
    var placements = [], x, y, cols = grid(L0, W0, l0, w0).cols;
    for (x = 0; x < bestSplit; x++)
      for (y = 0; y < cols; y++)
        placements.push({ x: x * step, y: y * (w0 + g), len: l0, wid: w0, rotated: false });
    if (allowRotate) {
      var start = bestSplit * step, back = grid(L0 - start, W0, w0, l0);
      for (x = 0; x < back.rows; x++)
        for (y = 0; y < back.cols; y++)
          placements.push({ x: start + x * (w0 + g), y: y * (l0 + g), len: w0, wid: l0, rotated: true });
    }
    return finish(placements, L0, W0, g);
  }

  function finish(placements, L0, W0, g) {
    compact(placements, g);
    var usedLength = 0, area = 0;
    placements.forEach(function (p) {
      usedLength = Math.max(usedLength, p.x + p.len);
      area += p.len * p.wid;
    });
    return {
      count: placements.length,
      placements: placements,
      usedLength: usedLength,
      floorUsage: area / (L0 * W0)
    };
  }

  function overlap(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }

  // Сдвигает паллеты к кабине (по X), затем к левому борту (по Y), чтобы схема была плотной.
  // Между соседями сохраняется зазор gap.
  function compact(items, gap) {
    function slide(pos, size, oPos, oSize) {
      items.sort(function (p, q) { return p[pos] - q[pos]; });
      for (var i = 0; i < items.length; i++) {
        var p = items[i], limit = 0;
        for (var j = 0; j < i; j++) {
          var q = items[j];
          if (overlap(p[oPos], p[oPos] + p[oSize] + gap, q[oPos], q[oPos] + q[oSize] + gap))
            limit = Math.max(limit, q[pos] + q[size] + gap);
        }
        p[pos] = limit;
      }
    }
    slide('x', 'len', 'y', 'wid');
    slide('y', 'wid', 'x', 'len');
    items.sort(function (p, q) { return p.x - q.x || p.y - q.y; });
  }

  // Ограничение по грузоподъёмности.
  function applyWeight(floorCount, payloadKg, palletWeightKg) {
    var byWeight = payloadKg > 0 && palletWeightKg > 0 ? Math.floor(payloadKg / palletWeightKg) : Infinity;
    var count = Math.min(floorCount, byWeight);
    return {
      count: count,
      byFloor: floorCount,
      byWeight: byWeight,
      limitedBy: byWeight < floorCount ? 'weight' : 'floor',
      totalWeight: palletWeightKg > 0 ? count * palletWeightKg : 0
    };
  }

  return { MIN_SIDE: MIN_SIDE, pack: pack, blockPack: blockPack, compact: compact, applyWeight: applyWeight };
})();
