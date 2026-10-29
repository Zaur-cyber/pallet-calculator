// Справочник типовых кузовов и паллет. Размеры внутренние, в мм; грузоподъёмность в кг.
// Значения типовые — у конкретной машины они могут отличаться.
var Presets = {
  trucks: [
    { id: 'eurotruck', name: 'Еврофура (тент) 13,6 м', length: 13600, width: 2450, payload: 20000 },
    { id: 'reefer', name: 'Рефрижератор 13,3 м', length: 13300, width: 2460, payload: 20000 },
    { id: 'mega', name: 'Мега-трейлер 13,6 м', length: 13620, width: 2480, payload: 20000 },
    { id: 'c20', name: 'Контейнер 20′', length: 5898, width: 2352, payload: 28200 },
    { id: 'c40', name: 'Контейнер 40′', length: 12032, width: 2352, payload: 26700 },
    { id: 'c40hc', name: 'Контейнер 40′ HC', length: 12032, width: 2352, payload: 26500 },
    { id: 't10', name: 'Грузовик 10 т (8 м)', length: 8000, width: 2450, payload: 10000 },
    { id: 't5', name: 'Грузовик 5 т (6,2 м)', length: 6200, width: 2450, payload: 5000 },
    { id: 'gazelle42', name: 'Газель удлинённая 4,2 м', length: 4200, width: 2000, payload: 1500 },
    { id: 'gazelle3', name: 'Газель 3 м', length: 3000, width: 2000, payload: 1500 }
  ],
  pallets: [
    { id: 'eur', name: 'EUR (европаллета) 1200×800', length: 1200, width: 800, weight: 500 },
    { id: 'fin', name: 'FIN 1200×1000', length: 1200, width: 1000, weight: 600 },
    { id: 'us', name: 'Американская 1219×1016', length: 1219, width: 1016, weight: 600 },
    { id: 'sq', name: 'Квадратная 1200×1200', length: 1200, width: 1200, weight: 700 },
    { id: 'half', name: 'Полупаллета 800×600', length: 800, width: 600, weight: 250 },
    { id: 'quarter', name: 'Четверть-паллета 600×400', length: 600, width: 400, weight: 120 }
  ]
};
