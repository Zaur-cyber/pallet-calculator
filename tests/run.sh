#!/bin/sh
# Прогоняет тесты во встроенном JavaScriptCore macOS (Node не нужен).
cd "$(dirname "$0")/.." || exit 1
cat js/packing.js tests/packing.test.js | osascript -l JavaScript -
cat js/packing.js js/mixed.js tests/mixed.test.js | osascript -l JavaScript -
