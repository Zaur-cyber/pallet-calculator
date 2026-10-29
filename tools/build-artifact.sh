#!/bin/sh
# Собирает приложение в один HTML-файл (стили и скрипты внутри) для публикации по ссылке.
# Использование: tools/build-artifact.sh путь/к/выходному.html
set -e
cd "$(dirname "$0")/.."
OUT=${1:?укажите путь к выходному файлу}
{
  echo '<title>Паллетный калькулятор</title>'
  echo '<meta name="claude:viewport-fit-sides" content="cover">'
  echo '<style>'
  cat css/styles.css
  echo '</style>'
  # Разметка страницы: всё между <body> и подключением скриптов.
  sed -n '/<body>/,/<script /p' index.html | sed '1d;$d'
  echo '<script>'
  cat js/presets.js js/storage.js js/packing.js js/mixed.js js/app.js
  echo '</script>'
} > "$OUT"
echo "Собрано: $OUT"
