# Калькулятор Fibonacci .kosmos.md

**Статус:** in progress
**Прогресс:** 0%
**Последнее обновление:** 2026-06-30

## Краткое summary (пишется в конце)

(пусто)

## Цель

Создать утилиту для вычисления чисел Фибоначчи с проверкой чётности и статистикой. Демонстрирует среднюю сложность .kosmos.md — несколько задач с взаимосвязанными шагами.

## Задача 1: Генерация последовательности

### Шаг 1: Функция генерации Fibonacci
- [ ] Выполнено
 ```js executable
      function fibonacci(n) {
          const seq = [0, 1];
          for (let i = 2; i < n; i++) {
              seq.push(seq[i-1] + seq[i-2]);
          }
          return seq.slice(0, n);
      }
      
      const result = fibonacci(10);
      console.log(`Fibonacci(10): ${result.join(", ")}`);
      console.log(`Последний элемент: ${result[result.length - 1]}`);
```
Ожидаемый результат: Последовательность из 10 чисел Фибоначчи и последний элемент (34)

Результат:
(пусто)

Верификация:
- [ ] пройдена.

### Шаг 2: Фильтрация чётных чисел
- [ ] Выполнено
 ```js executable
      function fibonacci(n) {
          const seq = [0, 1];
          for (let i = 2; i < n; i++) seq.push(seq[i-1] + seq[i-2]);
          return seq.slice(0, n);
      }
      
      const fib = fibonacci(15);
      const even = fib.filter(n => n % 2 === 0);
      const odd = fib.filter(n => n % 2 !== 0);
      console.log(`Fibonacci(15): ${fib.join(", ")}`);
      console.log(`Чётных: ${even.length} → [${even.join(", ")}]`);
      console.log(`Нечётных: ${odd.length} → [${odd.join(", ")}]`);
```
Ожидаемый результат: 15 чисел Фибоначчи, разделённых на чётные и нечётные с подсчётом

Результат:
(пусто)

Верификация:
- [ ] пройдена.

## Задача 2: Статистика и анализ

### Шаг 3: Статистика последовательности
- [ ] Выполнено
 ```js executable
      function fibonacci(n) {
          const seq = [0, 1];
          for (let i = 2; i < n; i++) seq.push(seq[i-1] + seq[i-2]);
          return seq.slice(0, n);
      }
      
      const fib = fibonacci(20);
      const sum = fib.reduce((a, b) => a + b, 0);
      const max = Math.max(...fib);
      const goldenRatio = fib[fib.length-1] / fib[fib.length-2];
      
      console.log(`Fibonacci(20) статистика:`);
      console.log(`  Сумма: ${sum}`);
      console.log(`  Макс: ${max}`);
      console.log(`  Золотое сечение ≈ ${goldenRatio.toFixed(6)}`);
      console.log(`  Реальное φ = 1.618034`);
```
Ожидаемый результат: Сумма, максимум и приближение золотого сечения из 20 чисел Фибоначчи

Результат:
(пусто)

Верификация:
- [ ] пройдена.
