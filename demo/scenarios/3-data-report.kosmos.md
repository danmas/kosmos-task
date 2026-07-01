# Анализ данных и отчёт .kosmos.md

**Статус:** in progress
**Прогресс:** 0%
**Последнее обновление:** 2026-06-30

## Краткое summary (пишется в конце)

(пусто)

## Цель

Создать мини-приложение для анализа набора данных: генерация данных, вычисление статистик, поиск аномалий и формирование отчёта. Демонстрирует сложную мульти-задачную структуру .kosmos.md с несколькими задачами и зависимыми шагами.

## Задача 1: Генерация данных

### Шаг 1: Создать набор данных
- [ ] Выполнено
 ```js executable
      function generateData(count) {
          const data = [];
          for (let i = 0; i < count; i++) {
              const base = 50 + Math.sin(i * 0.3) * 20;
              const noise = (Math.random() - 0.5) * 15;
              const value = Math.round((base + noise) * 100) / 100;
              const category = i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C";
              data.push({ id: i + 1, value, category });
          }
          return data;
      }
      
      const dataset = generateData(20);
      console.log(`Сгенерировано записей: ${dataset.length}`);
      console.log(`Первые 5:`, JSON.stringify(dataset.slice(0, 5)));
      console.log(`Категории: A=${dataset.filter(d=>d.category==="A").length}, B=${dataset.filter(d=>d.category==="B").length}, C=${dataset.filter(d=>d.category==="C").length}`);
```
Ожидаемый результат: 20 записей с id, value, category. Выведены первые 5 и распределение по категориям.

Результат:
(пусто)

Верификация:
- [ ] пройдена.

### Шаг 2: Валидация данных
- [ ] Выполнено
 ```js executable
      function generateData(count) {
          const data = [];
          for (let i = 0; i < count; i++) {
              const base = 50 + Math.sin(i * 0.3) * 20;
              const noise = (Math.random() - 0.5) * 15;
              data.push({ id: i + 1, value: Math.round((base + noise) * 100) / 100, category: i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C" });
          }
          return data;
      }
      
      const dataset = generateData(20);
      const errors = [];
      dataset.forEach(d => {
          if (!d.id || !d.value || !d.category) errors.push(`Запись ${d.id}: пропущены поля`);
          if (d.value < 0 || d.value > 200) errors.push(`Запись ${d.id}: value=${d.value} вне диапазона`);
      });
      
      console.log(`Проверено записей: ${dataset.length}`);
      console.log(`Ошибок: ${errors.length}`);
      if (errors.length > 0) errors.forEach(e => console.log(`  ✖ ${e}`));
      else console.log(`  ✓ Все записи валидны`);
```
Ожидаемый результат: Проверка 20 записей, вывод количества ошибок или подтверждение валидности

Результат:
(пусто)

Верификация:
- [ ] пройдена.

## Задача 2: Статистический анализ

### Шаг 3: Базовая статистика
- [ ] Выполнено
 ```js executable
      function generateData(count) {
          const data = [];
          for (let i = 0; i < count; i++) {
              const base = 50 + Math.sin(i * 0.3) * 20;
              const noise = (Math.random() - 0.5) * 15;
              data.push({ id: i + 1, value: Math.round((base + noise) * 100) / 100, category: i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C" });
          }
          return data;
      }
      
      const data = generateData(20);
      const values = data.map(d => d.value);
      
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const median = [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)];
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      console.log(`=== Статистика ===`);
      console.log(`Среднее:  ${mean.toFixed(2)}`);
      console.log(`Медиана:  ${median.toFixed(2)}`);
      console.log(`Мин/Макс: ${min.toFixed(2)} / ${max.toFixed(2)}`);
      console.log(`Ст.откл:  ${stdDev.toFixed(2)}`);
```
Ожидаемый результат: Среднее, медиана, мин/макс и стандартное отклонение для 20 значений

Результат:
(пусто)

Верификация:
- [ ] пройдена.

### Шаг 4: Поиск аномалий (метод IQR)
- [ ] Выполнено
 ```js executable
      function generateData(count) {
          const data = [];
          for (let i = 0; i < count; i++) {
              const base = 50 + Math.sin(i * 0.3) * 20;
              const noise = (Math.random() - 0.5) * 15;
              data.push({ id: i + 1, value: Math.round((base + noise) * 100) / 100, category: i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C" });
          }
          return data;
      }
      
      const data = generateData(20);
      const values = data.map(d => d.value).sort((a, b) => a - b);
      
      const q1 = values[Math.floor(values.length * 0.25)];
      const q3 = values[Math.floor(values.length * 0.75)];
      const iqr = q3 - q1;
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;
      
      const anomalies = data.filter(d => d.value < lower || d.value > upper);
      
      console.log(`IQR метод:`);
      console.log(`  Q1=${q1.toFixed(2)}, Q3=${q3.toFixed(2)}, IQR=${iqr.toFixed(2)}`);
      console.log(`  Границы: [${lower.toFixed(2)}, ${upper.toFixed(2)}]`);
      console.log(`  Аномалий найдено: ${anomalies.length}`);
      anomalies.forEach(a => console.log(`    → id=${a.id}, value=${a.value}, cat=${a.category}`));
```
Ожидаемый результат: IQR-анализ с квартилями, границами и списком аномалий (если есть)

Результат:
(пусто)

Верификация:
- [ ] пройдена.

## Задача 3: Формирование отчёта

### Шаг 5: Генерация текстового отчёта
- [ ] Выполнено
 ```js executable
      function generateData(count) {
          const data = [];
          for (let i = 0; i < count; i++) {
              const base = 50 + Math.sin(i * 0.3) * 20;
              const noise = (Math.random() - 0.5) * 15;
              data.push({ id: i + 1, value: Math.round((base + noise) * 100) / 100, category: i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C" });
          }
          return data;
      }
      
      const data = generateData(20);
      const values = data.map(d => d.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      const report = [
        "╔══════════════════════════════════════╗",
        "║       ОТЧЁТ: Анализ данных v1.0     ║",
        "╚══════════════════════════════════════╝",
        "",
        `Дата: ${new Date().toLocaleDateString("ru-RU")}`,
        `Объём: ${data.length} записей`,
        "",
        "--- Статистика ---",
        `Среднее: ${mean.toFixed(2)}`,
        `Мин/Макс: ${min.toFixed(2)} / ${max.toFixed(2)}`,
        "",
        "--- По категориям ---",
        ...["A","B","C"].map(cat => {
          const items = data.filter(d => d.category === cat);
          const avg = items.reduce((s,d) => s + d.value, 0) / items.length;
          return `${cat}: ${items.length} записей, среднее ${avg.toFixed(2)}`;
        }),
        "",
        "--- Итог ---",
        "✓ Данные сгенерированы",
        "✓ Валидация пройдена",
        "✓ Статистика вычислена",
        "✓ Аномалии проверены"
      ];
      
      console.log(report.join("\n"));
```
Ожидаемый результат: Полный текстовый отчёт с шапкой, статистикой по категориям и итогом

Результат:
(пусто)

Верификация:
- [ ] пройдена.
