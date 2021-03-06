"use strict";
var __awaiter =
	(this && this.__awaiter) ||
	function(thisArg, _arguments, P, generator) {
		return new (P || (P = Promise))(function(resolve, reject) {
			function fulfilled(value) {
				try {
					step(generator.next(value));
				} catch (e) {
					reject(e);
				}
			}
			function rejected(value) {
				try {
					step(generator["throw"](value));
				} catch (e) {
					reject(e);
				}
			}
			function step(result) {
				result.done
					? resolve(result.value)
					: new P(function(resolve) {
							resolve(result.value);
					  }).then(fulfilled, rejected);
			}
			step((generator = generator.apply(thisArg, _arguments || [])).next());
		});
	};
Object.defineProperty(exports, "__esModule", { value: true });
const coc_nvim_1 = require("coc.nvim");
const pairs = new Map();
pairs.set("{", "}");
pairs.set("[", "]");
pairs.set("(", ")");
pairs.set("<", ">");
pairs.set('"', '"');
pairs.set("'", "'");
pairs.set("`", "`");
function activate(context) {
	return __awaiter(this, void 0, void 0, function*() {
		let { subscriptions } = context;
		const config = coc_nvim_1.workspace.getConfiguration("pairs");
		const disableLanguages = config.get("disableLanguages");
		const characters = config.get("enableCharacters");
		const alwaysPairCharacters = config.get("alwaysPairCharacters", []);
		let enableBackspace = config.get("enableBackspace");
		if (enableBackspace) {
			let map = yield coc_nvim_1.workspace.nvim.call("maparg", ["<bs>", "i"]);
			if (map && !map.startsWith("coc#_insert_key")) enableBackspace = false;
		}
		if (characters.length == 0) return;
		const { nvim } = coc_nvim_1.workspace;
		function insertPair(character, pair) {
			return __awaiter(this, void 0, void 0, function*() {
				let samePair = character == pair;
				let arr = yield nvim.eval('[bufnr("%"),get(b:,"coc_pairs_disabled",[]),coc#util#cursor()]');
				let doc = coc_nvim_1.workspace.getDocument(arr[0]);
				if (!doc) return character;
				let { filetype } = doc;
				if (disableLanguages.indexOf(filetype) !== -1) return character;
				let chars = arr[1];
				if (chars && chars.length && chars.indexOf(character) !== -1) return character;
				let pos = { line: arr[2][0], character: arr[2][1] };
				let line = doc.getline(pos.line);
				let pre = line.slice(0, pos.character);
				let rest = line.slice(pos.character);
				let previous = pre.length ? pre[pre.length - 1] : "";
				if (alwaysPairCharacters.indexOf(character) == -1 && rest && isWord(rest[0]))
					return character;
				if ((filetype === "cpp" || filetype === "c") && character == "<" && previous != " ") {
					return character;
				}
				if (
					filetype != "cpp" &&
					filetype != "c" &&
					character == "<" &&
					(previous == " " || previous == "<")
				)
					return character;
				if (samePair && rest[0] == character && rest[1] != character) {
					// move position
					yield nvim.eval(`feedkeys("\\<C-G>U\\<Right>", 'in')`);
					return "";
				}
				if (samePair && pre && (isWord(previous) || previous == character)) return character;
				// Only pair single quotes if previous character is not word.
				if (character === "'" && pre.match(/.*\w$/)) {
					return character;
				}
				// Rust: don't pair single quotes that are part of lifetime annotations Foo::<'a>
				if (filetype === "rust" && character === "'" && pre.endsWith("<")) {
					return character;
				}
				if (
					(filetype === "vim" || filetype === "help") &&
					character === '"' &&
					pos.character === 0
				) {
					return character;
				}
				if (
					samePair &&
					pre.length >= 2 &&
					previous == character &&
					pre[pre.length - 2] == character
				) {
					if (pre[pre.length - 3] == character) {
						if (character == '"') {
							nvim.command(`call feedkeys('"""'."${"\\<C-G>U\\<Left>".repeat(3)}", 'in')`, true);
						} else {
							nvim.command(
								`call feedkeys("${character.repeat(3)}${"\\<C-G>U\\<Left>".repeat(3)}", 'in')`,
								true
							);
						}
						return;
					}
					return character;
				}
				if (character == '"') {
					nvim.command(`call feedkeys('""'."\\<C-G>U\\<Left>", 'in')`, true);
				} else {
					nvim.command(
						`call feedkeys("${character}${pair}${"\\<C-G>U\\<Left>".repeat(pair.length)}", 'in')`,
						true
					);
				}
				return "";
			});
		}
		function closePair(character) {
			return __awaiter(this, void 0, void 0, function*() {
				let bufnr = yield nvim.call("bufnr", "%");
				let doc = coc_nvim_1.workspace.getDocument(bufnr);
				if (!doc) return character;
				if (disableLanguages.indexOf(doc.filetype) !== -1) return character;
				let pos = yield coc_nvim_1.workspace.getCursorPosition();
				let line = doc.getline(pos.line);
				let rest = line.slice(pos.character);
				if (rest[0] == character) {
					nvim.command(`call feedkeys("\\<C-G>U\\<Right>", 'in')`, true);
					return "";
				}
				return character;
			});
		}
		nvim.pauseNotification();
		for (let character of characters) {
			if (pairs.has(character)) {
				subscriptions.push(
					coc_nvim_1.workspace.registerExprKeymap(
						"i",
						character,
						insertPair.bind(null, character, pairs.get(character)),
						false
					)
				);
			}
			let matched = pairs.get(character);
			if (matched != character) {
				subscriptions.push(
					coc_nvim_1.workspace.registerExprKeymap(
						"i",
						matched,
						closePair.bind(null, matched),
						false
					)
				);
			}
		}
		if (enableBackspace) {
			subscriptions.push(coc_nvim_1.workspace.registerExprKeymap("i", "<bs>", onBackspace, false));
		}
		// tslint:disable-next-line: no-floating-promises
		nvim.resumeNotification(false, true);
		function createBufferKeymap(doc) {
			return __awaiter(this, void 0, void 0, function*() {
				if (!doc) return;
				let pairs = doc.getVar("pairs", null);
				if (!pairs) return;
				if (coc_nvim_1.workspace.bufnr != doc.bufnr) return;
				nvim.pauseNotification();
				for (let p of pairs) {
					if (Array.isArray(p) && p.length == 2) {
						let [character, matched] = p;
						subscriptions.push(
							coc_nvim_1.workspace.registerExprKeymap(
								"i",
								character,
								insertPair.bind(null, character, matched),
								true
							)
						);
						if (matched != character) {
							subscriptions.push(
								coc_nvim_1.workspace.registerExprKeymap(
									"i",
									matched,
									closePair.bind(null, matched),
									true
								)
							);
						}
					}
				}
				// tslint:disable-next-line: no-floating-promises
				nvim.resumeNotification(false, true);
			});
		}
		yield createBufferKeymap(coc_nvim_1.workspace.getDocument(coc_nvim_1.workspace.bufnr));
		coc_nvim_1.workspace.onDidOpenTextDocument((e) =>
			__awaiter(this, void 0, void 0, function*() {
				yield createBufferKeymap(coc_nvim_1.workspace.getDocument(e.uri));
			})
		);
	});
}
exports.activate = activate;
// remove paired characters when possible
function onBackspace() {
	return __awaiter(this, void 0, void 0, function*() {
		let { nvim } = coc_nvim_1.workspace;
		let res = yield nvim.eval(
			'[getline("."),col("."),synIDattr(synID(line("."), col(".") - 2, 1), "name")]'
		);
		if (res) {
			let [line, col, synname] = res;
			if (col > 1 && !/string/i.test(synname)) {
				let buf = Buffer.from(line, "utf8");
				if (col - 1 < buf.length) {
					let pre = buf.slice(col - 2, col - 1).toString("utf8");
					let next = buf.slice(col - 1, col).toString("utf8");
					if (pairs.has(pre) && pairs.get(pre) == next) {
						yield nvim.eval(`feedkeys("\\<C-G>U\\<right>\\<bs>\\<bs>", 'in')`);
						return;
					}
				}
			}
		}
		yield nvim.eval(`feedkeys("\\<bs>", 'in')`);
	});
}
function byteSlice(content, start, end) {
	let buf = Buffer.from(content, "utf8");
	return buf.slice(start, end).toString("utf8");
}
exports.byteSlice = byteSlice;
function wait(ms) {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, ms);
	});
}
exports.wait = wait;
function isWord(character) {
	let code = character.charCodeAt(0);
	if (code > 128) return false;
	if (code == 95) return true;
	if (code >= 48 && code <= 57) return true;
	if (code >= 65 && code <= 90) return true;
	if (code >= 97 && code <= 122) return true;
	return false;
}
exports.isWord = isWord;
//# sourceMappingURL=index.js.map
