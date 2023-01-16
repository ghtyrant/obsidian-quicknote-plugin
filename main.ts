import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFolder, FuzzyMatch, FuzzySuggestModal } from 'obsidian';

class SuggesterModal<T> extends FuzzySuggestModal<T> {
	private resolved = false;
	constructor(
		app: App,
		private textItems: string[] | ((item: T) => string),
		private items: T[],
		private resolve: (value: unknown) => void,
		private reject: (reason?: any) => void,
		placeholder: string,
		limit: number
	) {
		super(app);
		this.setPlaceholder(placeholder);
		this.limit = limit;
	}

	getItems(): T[] {
		return this.items;
	}

	getItemText(item: T): string {
		if (this.textItems instanceof Function) {
			return this.textItems(item);
		}
		return this.textItems[this.items.indexOf(item)] || "Undefined";
	}

	onChooseItem(item: T, evt: MouseEvent | KeyboardEvent) {
		this.resolved = true;
		this.resolve(item);
	}

	selectSuggestion(
		value: FuzzyMatch<T>,
		evt: MouseEvent | KeyboardEvent
	): void {
		this.onChooseSuggestion(value, evt);
		this.close();
	}

	onClose(): void {
		if (!this.resolved) {
			this.reject("Modal cancelled");
		}
	}

	onChooseSuggestion(
		item: FuzzyMatch<T>,
		evt: MouseEvent | KeyboardEvent
	): void {
		this.onChooseItem(item.item, evt);
	}
}

export async function suggest<T>(
	app: App,
	textItems: string[] | ((item: T) => string),
	items: T[],
	placeholder: string,
	limit: number
) {
	return new Promise((resolve, reject) => {
		new SuggesterModal(
			app,
			textItems,
			items,
			resolve,
			reject,
			placeholder,
			limit
		).open();
	});
}

export default class QuickPlugin extends Plugin {
	async onload() {
		this.addCommand({
			id: 'create-note-in-folder',
			name: 'Create Note in Folder',
			callback: async () => {
				const folders = this.app.vault.getAllLoadedFiles().filter(i => i instanceof TFolder).map(folder => folder as TFolder)
				const folder = await suggest(this.app, folders.map(folder => folder.name), folders, "Select target folder ...", 10)

				const created_note = await this.app.vault.create(folder + "/Untitled.md", "")
				const active_leaf = this.app.workspace.activeLeaf;
				if (!active_leaf) {
					return;
				}
				await active_leaf.openFile(created_note, {
					state: { mode: "source" },
				});
				this.app.workspace.trigger("create", created_note)
				const view = app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					const editor = view.editor;
					editor.focus()
				}
			}
		});

		this.addCommand({
			id: 'create-note-from-template-in-folder',
			name: 'Create Note from Template in Folder',
			checkCallback: (checking: boolean) => {
				if (checking) {
					//@ts-ignore
					return app.plugins.plugins.hasOwnProperty('templater-obsidian')
				}

				const folders = this.app.vault.getAllLoadedFiles().filter(i => i instanceof TFolder).map(folder => folder as TFolder)
				suggest(this.app, folders.map(folder => folder.name), folders, "Select target folder ...", 10).then(folder => {
					//@ts-ignore
					app.plugins.plugins['templater-obsidian'].fuzzy_suggester.create_new_note_from_template(folder)
				})
			}
		});
	}

	onunload() {
	}
}