import { App, Editor, MarkdownView, Plugin, Platform, setIcon, normalizePath } from 'obsidian';

export default class TodoPlusPlugin extends Plugin {
  async onload() {
    console.log("Todo+ Clone Plugin loaded");

    this.registerAutoHotkeys();

    this.addCommand({
      id: 'todo-toggle-done',
      name: 'Toggle Done (✔)',
      hotkeys: [{ modifiers: ["Alt"], key: "d" }],
      editorCallback: (editor: Editor) => {
        this.toggleTaskStatus(editor, '✔', '@done');
      }
    });

    this.addCommand({
      id: 'todo-toggle-cancelled',
      name: 'Toggle Cancelled (✘)',
      hotkeys: [{ modifiers: ["Alt"], key: "c" }],
      editorCallback: (editor: Editor) => {
        this.toggleTaskStatus(editor, '✘');
      }
    });

    this.addCommand({
      id: 'todo-toggle-started',
      name: 'Toggle Started (@started)',
      hotkeys: [{ modifiers: ["Alt"], key: "a" }],
      editorCallback: (editor: Editor) => {
        this.toggleStarted(editor);
      }
    });

    this.addCommand({
      id: 'todo-new-task',
      name: 'New Task (☐)',
      hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
      editorCallback: (editor: Editor) => {
        const cursor = editor.getCursor();
        const newLine = cursor.line + 1;
        editor.replaceRange(`☐ `, { line: newLine, ch: 0 });
        editor.setCursor({ line: newLine, ch: 2 });
      }
    });

    this.addCommand({
      id: 'todo-remove-line',
      name: 'Remove Task Line',
      hotkeys: [{ modifiers: ["Alt"], key: "r" }],
      editorCallback: (editor: Editor) => {
        const cursor = editor.getCursor();
        editor.replaceRange('', { line: cursor.line, ch: 0 }, { line: cursor.line + 1, ch: 0 });
      }
    });
  }

  registerAutoHotkeys() {
    const commandsToBind = [
      { id: 'todo-toggle-done', hotkeys: [{ modifiers: ["Alt"], key: "d" }] },
      { id: 'todo-toggle-cancelled', hotkeys: [{ modifiers: ["Alt"], key: "c" }] },
      { id: 'todo-toggle-started', hotkeys: [{ modifiers: ["Alt"], key: "a" }] },
      { id: 'todo-new-task', hotkeys: [{ modifiers: ["Mod"], key: "Enter" }] },
      { id: 'todo-remove-line', hotkeys: [{ modifiers: ["Alt"], key: "r" }] },
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

  onunload() {
    console.log("Todo+ Clone Plugin unloaded");
  }

  toggleTaskStatus(editor: Editor, mark: string, tag?: string) {
    const cursor = editor.getCursor();
    let line = editor.getLine(cursor.line);
    if (!line.trim().startsWith('☐') && !line.trim().startsWith('✔') && !line.trim().startsWith('✘')) return;

    const timePartMatch = line.match(/(@[a-z]+\([^)]*\))/g) || [];
    let contentPart = line.replace(/^(☐|✔|✘)\s*/, '').replace(/(@[a-z]+\([^)]*\)|\s)+$/g, '').trim();
    contentPart = contentPart.replace(/^~~|~~$/g, '').replace(/^_|_$/g, '');

    if (line.includes(mark)) {
      line = line.replace(mark, '☐');
      if (tag) line = line.replace(new RegExp(`\s*${tag}\\([^)]*\\)`, 'g'), '');
      if (tag === '@done') line = line.replace(/\s*@lasted\([^)]*\)/g, '');
      line = `☐ ${contentPart} ${this.removeTagText(line)}`.replace(/\s{2,}/g, ' ').trimEnd();
    } else {
      if (mark === '✔') {
        const now = this.getCurrentTimestamp();
        const startedMatch = line.match(/@started\((.*?)\)/);
        let timeTags = ` @done(${now})`;
        if (startedMatch) {
          const started = new Date(startedMatch[1]);
          const done = new Date();
          const duration = this.formatDuration(done.getTime() - started.getTime());
          timeTags = ` @started(${startedMatch[1]}) @done(${now}) @lasted(${duration})`;
          line = line.replace(/\s*@started\([^)]*\)/, '');
        }
        line = this.cleanTimeTags(line);
        line = `${mark} ~~${contentPart}~~ ${timeTags}`.replace(/\s{2,}/g, ' ').trimEnd();
      } else if (mark === '✘') {
        line = this.cleanTimeTags(line);
        line = `${mark} _${contentPart}_ ${timePartMatch.join(' ')}`.replace(/\s{2,}/g, ' ').trimEnd();
      }
    }

    editor.setLine(cursor.line, line.trimEnd());
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
      line = this.cleanTimeTags(line);
      line += ` @started(${now})`;
    }

    editor.setLine(cursor.line, line.trimEnd());
  }

  cleanTimeTags(line: string): string {
    return line
      .replace(/\s*@done\([^)]*\)/g, '')
      .replace(/\s*@lasted\([^)]*\)/g, '')
      .replace(/\s*@started\([^)]*\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .trimEnd();
  }

  removeTagText(line: string): string {
    const tagText = line.match(/(@[a-z]+\([^)]*\))/g);
    return tagText ? tagText.join(' ') : '';
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
