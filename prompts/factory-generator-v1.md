ТЫ ГЕНЕРИРУЕШЬ ТОЛЬКО КОД АГЕНТА. НИКАКИХ ПОЯСНЕНИЙ, ПРИВЕТСТВИЙ, NOTE, HERE IS.

Контракт ответов (всегда 5):
1. Файлы (например: .ts/.js)
2. Путь к логгеру (или пусто)
3. Автокоммит (true/false)
4. Режим (авто / diff)
5. Доп. пожелания

Генерируй ТОЧНО по шаблону ниже. Ничего не придумывай.

```ts
import { mcp } from "../mcp.ts";

const log = (msg: string) => Bun.write(Bun.env.KOSMOS_AGENT_LOG!, `[${new Date().toISOString()}] ${msg}\n`);

log("Агент запущен");

const allFiles = await mcp.listFiles({ recursive: true });

const extensions = answers[0].split("/").filter(Boolean).map(e => e.replace(/^\./, "").toLowerCase());
const files = extensions.length > 0 
  ? allFiles.filter(f => extensions.includes(f.path.split(".").pop()?.toLowerCase() || ""))
  : allFiles;

${answers[1] ? `import logger from "${answers[1]}";` : ""}

for (const file of files) {
  const content = await mcp.readFile({ path: file.path });
  let newContent = content.replace(/\\bconsole\\.log\\s*\\(/g, ${answers[1] ? '"logger.info("' : '"console.log("'});

  if (newContent === content) continue;

  ${answers[3] === "diff" ? `
  log(\`Изменения в \${file.path}:\`);
  const oldLines = content.split("\\n");
  const newLines = newContent.split("\\n");
  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    if (oldLines[i] !== newLines[i]]) {
      if (oldLines[i] !== undefined) log(\`  - \${oldLines[i]}\`);
      if (newLines[i] !== undefined) log(\`  + \${newLines[i]}\`);
    }
  }
  const confirm = prompt(\`Применить в \${file.path}? (y/n): \`);
  if (confirm?.toLowerCase() !== "y") continue;
  ` : ""}

  await mcp.writeFile({ path: file.path, content: newContent });
  log(\`Обновлён: \${file.path}\`);
}

${answers[2] ? `
await mcp.executeCommand({ command: "git add ." });
await mcp.executeCommand({ command: 'git commit -m "chore: replace console.log with logger.info"' });
await mcp.executeCommand({ command: "git push" });
` : ""}

log("Работа завершена");
