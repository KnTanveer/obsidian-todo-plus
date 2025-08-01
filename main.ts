import { App, Editor, MarkdownView, Plugin, Platform, setIcon, normalizePath } from 'obsidian';

export default class TodoPlusPlugin extends Plugin {
  async onload() {
    console.log("Todo+ Enhanced Plugin loaded");

    this.registerAutoHotkeys();

    this.addCommand({
      id: 'todo-cycle-checkbox',
      name: 'Cycle Todo Status (☐ → ✔ → ✘)',
      icon: 'refresh-cw',
      hotkeys: [{ modifiers: ["Alt"], key: "x" }],
      editorCallback: (editor: Editor) => {
        this.toggleTaskCycle(editor);
      }
    });

    this.addCommand({
      id: 'todo-toggle-done',
      name: 'Toggle Done (✔)',
      icon: 'check-circle',
      hotkeys: [{ modifiers: ["Alt"], key: "d" }],
      editorCallback: (editor: Editor) => {
        this.toggleTaskStatus(editor, '✔', '@done');
      }
    });

    this.addCommand({
      id: 'todo-toggle-cancelled',
      name: 'Toggle Cancelled (✘)',
      icon: 'x-circle',
      hotkeys: [{ modifiers: ["Alt"], key: "c" }],
      editorCallback: (editor: Editor) => {
        this.toggleTaskStatus(editor, '✘', '@cancelled');
      }
    });

    this.addCommand({
      id: 'todo-toggle-started',
      name: 'Toggle Started (@started)',
      icon: 'play-circle',
      hotkeys: [{ modifiers: ["Alt"], key: "a" }],
      editorCallback: (editor: Editor) => {
        this.toggleStarted(editor);
      }
    });

    this.addCommand({
      id: 'todo-new-task',
      name: 'New Task',
      icon: 'plus-circle',
      hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
      editorCallback: (editor: Editor) => {
        this.insertNewTask(editor);
      }
    });

    this.addCommand({
      id: 'todo-remove-line',
      name: 'Remove Task Line',
      icon: 'trash',
      hotkeys: [{ modifiers: ["Alt"], key: "r" }],
      editorCallback: (editor: Editor) => {
        const cursor = editor.getCursor();
        editor.replaceRange('', { line: cursor.line, ch: 0 }, { line: cursor.line + 1, ch: 0 });
      }
    });
  }

  registerAutoHotkeys() {
    const commandsToBind = [
      { id: 'todo-cycle-checkbox', hotkeys: [{ modifiers: ["Alt"], key: "x" }] },
      { id: 'todo-toggle-done', hotkeys: [{ modifiers: ["Alt"], key: "d" }] },
      { id: 'todo-toggle-cancelled', hotkeys: [{ modifiers: ["Alt"], key: "c" }] },
      { id: 'todo-toggle-started', hotkeys: [{ modifiers: ["Alt"], key: "a" }] },
      { id: 'todo-new-task', hotkeys: [{ modifiers: ["Mod"], key: "Enter" }] },
      { id: 'todo-remove-line', hotkeys: [{ modifiers: ["Alt"], key: "r" }] }
    ];

    setTimeout(() => {
      const hotkeyManager = (this.app as any).hotkeyManager;
      if (!hotkeyManager) return;

      commandsToBind.forEach(({ id, hotkeys }) => {
        const existing = hotkeyManager.customKeys?.[id];
        if (!existing || existing.length === 0) {
          hotkeyManager.setHotkeys(id, hotkeys);
        }
      });
    }, 1000);
  }

  toggleTaskCycle(editor: Editor) {
    const cursor = editor.getCursor();
    let line = editor.getLine(cursor.line).trim();

    const states = ['☐', '✔', '✘'];
    const currentState = states.find(s => line.startsWith(s)) || '☐';
    const nextState = states[(states.indexOf(currentState) + 1) % states.length];

    const startedMatch = line.match(/@started\((.*?)\)/);

    line = line.replace(/^(☐|✔|✘)\s*/, '')
               .replace(/~~(.*?)~~/g, '$1')
               .replace(/_(.*?)_/g, '$1')
               .replace(/(@[a-z]+\([^)]*\))/g, '')
               .replace(/\s{2,}/g, ' ')
               .trim();

    let newLine = '';
    if (nextState === '✔') {
      const now = this.getCurrentTimestamp();
      let timeTags = ` @done(${now})`;
      if (startedMatch) {
        const started = new Date(startedMatch[1]);
        const done = new Date();
        const duration = this.formatDuration(done.getTime() - started.getTime());
        timeTags = ` @started(${startedMatch[1]}) @done(${now}) @lasted(${duration})`;
      }
      newLine = `✔ ~~${line}~~${timeTags}`;
    } else if (nextState === '✘') {
      const now = this.getCurrentTimestamp();
      let timeTags = ` @cancelled(${now})`;
      if (startedMatch) {
        const started = new Date(startedMatch[1]);
        const cancelled = new Date();
        const duration = this.formatDuration(cancelled.getTime() - started.getTime());
        timeTags = ` @started(${startedMatch[1]}) @cancelled(${now}) @wasted(${duration})`;
      }
      newLine = `✘ _${line}_${timeTags}`;
    } else {
      newLine = `☐ ${line}`;
      if (startedMatch) newLine += ` @started(${startedMatch[1]})`;
    }

    editor.setLine(cursor.line, newLine.trimEnd());
  }

  toggleTaskStatus(editor: Editor, mark: string, tag?: string) {
    const cursor = editor.getCursor();
    let line = editor.getLine(cursor.line);
    if (!line.trim().startsWith('☐') && !line.trim().startsWith('✔') && !line.trim().startsWith('✘')) return;

    const startedMatch = line.match(/@started\((.*?)\)/);
    const hasMark = line.trim().startsWith(mark);

    const contentPart = line.replace(/^(☐|✔|✘)\s*/, '')
                            .replace(/~~|~~/g, '')
                            .replace(/_(.*?)_/g, '$1')
                            .replace(/(@[a-z]+\([^)]*\))/g, '')
                            .replace(/\s{2,}/g, ' ')
                            .trim();

    if (hasMark) {
      // Removing mark — revert to ☐ and preserve @started if present
      let newLine = `☐ ${contentPart}`;
      if (startedMatch) newLine += ` @started(${startedMatch[1]})`;
      editor.setLine(cursor.line, newLine.trimEnd());
    } else {
      if (mark === '✔') {
        const now = this.getCurrentTimestamp();
        let timeTags = ` @done(${now})`;
        if (startedMatch) {
          const started = new Date(startedMatch[1]);
          const done = new Date();
          const duration = this.formatDuration(done.getTime() - started.getTime());
          timeTags = ` @started(${startedMatch[1]}) @done(${now}) @lasted(${duration})`;
        }
        editor.setLine(cursor.line, `✔ ~~${contentPart}~~${timeTags}`);
      } else if (mark === '✘') {
        const now = this.getCurrentTimestamp();
        let timeTags = ` @cancelled(${now})`;
        if (startedMatch) {
          const started = new Date(startedMatch[1]);
          const cancelled = new Date();
          const duration = this.formatDuration(cancelled.getTime() - started.getTime());
          timeTags = ` @started(${startedMatch[1]}) @cancelled(${now}) @wasted(${duration})`;
        }
        editor.setLine(cursor.line, `✘ _${contentPart}_${timeTags}`);
      }
    }
  }

  toggleStarted(editor: Editor) {
    const cursor = editor.getCursor();
    let line = editor.getLine(cursor.line);
    if (!line.trim().startsWith('☐')) return;
    if (line.includes('@done') || line.includes('✘')) return;

    const startedRegex = /@started\([^)]*\)/;
    if (startedRegex.test(line)) {
      line = line.replace(startedRegex, '').replace(/\s{2,}/g, ' ').trimEnd();
    } else {
      const now = this.getCurrentTimestamp();
      line += ` @started(${now})`;
    }

    editor.setLine(cursor.line, line.trimEnd());
  }

  insertNewTask(editor: Editor) {
    const cursor = editor.getCursor();
    const currentLine = editor.getLine(cursor.line);

    if (/^\s*$/.test(currentLine)) {
      editor.setLine(cursor.line, '☐ ');
      editor.setCursor({ line: cursor.line, ch: 2 });
    } else {
      editor.replaceRange('\n☐ ', { line: cursor.line, ch: currentLine.length });
      editor.setCursor({ line: cursor.line + 1, ch: 2 });
    }
  }

  getCurrentTimestamp(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}-${MM}-${dd} ${hh}:${mm}`;
  }

  formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    const h = hours > 0 ? `${hours}h` : '';
    const m = remMinutes > 0 ? `${remMinutes}m` : '';
    return h + m || '0m';
  }
}
