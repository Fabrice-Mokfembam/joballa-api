import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getStatusPage(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Joballa Backend Terminal</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07130f;
      --panel: rgba(5, 17, 13, 0.88);
      --line: #163f31;
      --text: #9fffd0;
      --muted: #63d8a6;
      --accent: #34f5a2;
      --warning: #ffd166;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top, rgba(52, 245, 162, 0.18), transparent 32%),
        linear-gradient(180deg, #06110d 0%, #020504 100%);
      color: var(--text);
      font-family: Consolas, "Courier New", monospace;
      overflow: hidden;
    }

    .shell {
      width: min(960px, calc(100vw - 32px));
      height: min(720px, calc(100vh - 32px));
      margin: 16px auto;
      border: 1px solid rgba(159, 255, 208, 0.18);
      border-radius: 18px;
      background: var(--panel);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
      display: grid;
      grid-template-rows: auto 1fr;
      overflow: hidden;
      backdrop-filter: blur(12px);
    }

    .shell__topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid rgba(159, 255, 208, 0.12);
      background: rgba(9, 24, 18, 0.9);
    }

    .shell__dots {
      display: flex;
      gap: 8px;
    }

    .shell__dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(159, 255, 208, 0.35);
    }

    .shell__title {
      color: var(--muted);
      font-size: 0.92rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .shell__badge {
      border: 1px solid rgba(52, 245, 162, 0.3);
      border-radius: 999px;
      padding: 6px 10px;
      color: var(--accent);
      font-size: 0.78rem;
    }

    .terminal {
      padding: 18px 20px 28px;
      overflow-y: auto;
      white-space: pre-wrap;
      line-height: 1.6;
    }

    .headline {
      margin: 0 0 18px;
      color: var(--accent);
      text-shadow: 0 0 18px rgba(52, 245, 162, 0.35);
    }

    .line {
      margin: 0 0 6px;
      color: var(--text);
      text-shadow: 0 0 10px rgba(52, 245, 162, 0.22);
    }

    .line--muted {
      color: var(--muted);
    }

    .line--warning {
      color: var(--warning);
    }

    .prompt {
      color: var(--accent);
      margin-right: 10px;
    }

    .cursor {
      display: inline-block;
      width: 10px;
      margin-left: 6px;
      background: var(--accent);
      animation: blink 1s steps(1) infinite;
    }

    @keyframes blink {
      50% {
        opacity: 0;
      }
    }

    @media (max-width: 640px) {
      .shell {
        width: calc(100vw - 18px);
        height: calc(100vh - 18px);
        margin: 9px auto;
        border-radius: 12px;
      }

      .shell__topbar {
        padding: 12px 14px;
      }

      .terminal {
        padding: 16px 14px 24px;
      }

      .shell__title,
      .shell__badge {
        font-size: 0.72rem;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <div class="shell__topbar">
      <div class="shell__dots">
        <span class="shell__dot"></span>
        <span class="shell__dot"></span>
        <span class="shell__dot"></span>
      </div>
      <div class="shell__title">joballa backend terminal</div>
      <div class="shell__badge">api online</div>
    </div>

    <section id="terminal" class="terminal" aria-live="polite">
      <h1 id="headline" class="headline"></h1>
    </section>
  </main>

  <script>
    const terminal = document.getElementById("terminal");
    const headline = document.getElementById("headline");

    const bootLines = [
      { text: "Booting Joballa platform services...", type: "muted" },
      { text: "Loading modular monolith core...", type: "muted" },
      { text: "Mounting auth, users, jobs, and payments modules...", type: "muted" },
      { text: "Connecting to PostgreSQL through Prisma...", type: "muted" },
      { text: "Database connection: stable", type: "normal" },
      { text: "Checking bilingual support: EN and FR ready", type: "normal" },
      { text: "Verifying worker and employer gateways...", type: "normal" },
      { text: "Monitoring queue: calm for now", type: "normal" },
      { text: "----------------------------------------", type: "muted" },
      { text: "SYSTEM STATUS: JOBALLA BACKEND ONLINE", type: "normal" },
      { text: "----------------------------------------", type: "muted" },
      { text: "Reminder: all real API routes belong in module controllers", type: "warning" },
      { text: "Frontend handshake: ready to receive requests", type: "normal" },
    ];

    const liveLogs = [
      "GET / -> 200",
      "GET /health -> 200",
      "POST /auth/login -> awaiting implementation",
      "GET /jobs -> route loading soon",
      "POST /applications -> profile snapshot pending",
      "GET /worker-profiles/me -> frontend will love this one",
      "POST /payments/disbursements -> guarded",
      "GET /admin-review/queue -> restricted",
      "GET /notifications -> standing by",
      "SYSTEM NOTE: modular boundaries intact",
    ];

    function appendLine(text, type = "normal") {
      const line = document.createElement("div");
      line.className = "line";

      if (type === "muted") {
        line.classList.add("line--muted");
      }

      if (type === "warning") {
        line.classList.add("line--warning");
      }

      const prompt = document.createElement("span");
      prompt.className = "prompt";
      prompt.textContent = ">";

      const content = document.createElement("span");
      content.textContent = text;

      line.append(prompt, content);
      terminal.appendChild(line);
      terminal.scrollTop = terminal.scrollHeight;
    }

    function typeHeadline(text, index = 0) {
      if (index < text.length) {
        headline.textContent += text[index];
        setTimeout(() => typeHeadline(text, index + 1), 28);
        return;
      }

      const cursor = document.createElement("span");
      cursor.className = "cursor";
      cursor.setAttribute("aria-hidden", "true");
      headline.appendChild(cursor);

      setTimeout(runBootSequence, 260);
    }

    function runBootSequence(index = 0) {
      if (index >= bootLines.length) {
        setInterval(() => {
          appendLine(liveLogs[Math.floor(Math.random() * liveLogs.length)]);
        }, 1200);
        return;
      }

      const entry = bootLines[index];
      appendLine(entry.text, entry.type);

      const delay = entry.type === "warning" ? 850 : 420 + Math.random() * 380;
      setTimeout(() => runBootSequence(index + 1), delay);
    }

    typeHeadline(">>> JOBALLA BACKEND TERMINAL v1.0");
  </script>
</body>
</html>`;
  }
}
