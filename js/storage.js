// Сохранение истории расчётов и своих шаблонов в localStorage браузера.
var Store = (function () {
  var KEYS = { history: 'pallet-calc.history', trucks: 'pallet-calc.trucks', pallets: 'pallet-calc.pallets' };

  function load(key) {
    try {
      var raw = localStorage.getItem(KEYS[key]);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function save(key, list) {
    try {
      localStorage.setItem(KEYS[key], JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  function add(key, item) {
    var list = load(key);
    item.id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    list.unshift(item);
    return save(key, list) ? item : null;
  }

  function remove(key, id) {
    save(key, load(key).filter(function (item) { return item.id !== id; }));
  }

  return { load: load, add: add, remove: remove };
})();
