const editor = document.getElementById("editor");
const highlight = document.getElementById("highlight");
const locatorBox = document.getElementById("locatorBox");
const locatorOptions = document.getElementById("locatorOptions");
const selectedInfo = document.getElementById("selectedInfo");

let firstUrl = true;
let pendingComment = "";

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function highlightCode(code) {
  const pattern =
    /(\/\/.*$|`[^`]*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\b(?:const|let|function|return|async|await|require|test|if|else|true|false|null)\b|\b\d+(?:\.\d+)?\b|\.(?:goto|locator|click|fill|waitFor|getByText|getByLabel|getByTestId|toBeVisible|toContainText)\b)/gm;

  return code.replace(pattern, (token) => {
    let type = "token-keyword";

    if (token.startsWith("//")) type = "token-comment";
    else if (/^[`'"]/.test(token)) type = "token-string";
    else if (/^\./.test(token)) type = "token-method";
    else if (/^\d/.test(token)) type = "token-number";

    return `<span class="${type}">${escapeHtml(token)}</span>`;
  });
}

function updateHighlight() {
  highlight.innerHTML = `${highlightCode(editor.value)}\n`;
}

function addPageUrl(url) {
  if (!firstUrl) return;

  firstUrl = false;
  const lines = editor.value.split("\n");
  const index = lines.findIndex((line) => line.trim().startsWith("await page.goto("));

  if (index >= 0) {
    lines[index] = `  await page.goto('${escapeText(url)}');`;
  }

  editor.value = lines.join("\n");
  updateHighlight();
}

function addComment(text) {
  pendingComment = `    // ${text}\n\n`;
}

function createChoiceButton(name, code, isRecommended, onClick) {
  const button = document.createElement("button");
  const nameElement = document.createElement("span");
  const codeElement = document.createElement("span");

  nameElement.className = "locatorName";
  nameElement.textContent = name;
  codeElement.className = "locatorCode";
  codeElement.textContent = code;

  if (isRecommended) button.classList.add("recommended");

  button.append(nameElement, codeElement);
  button.onclick = onClick;
  return button;
}

function showLocatorOptions(data) {
  locatorOptions.innerHTML = "";
  document.querySelector("#locatorBox h3").textContent = "Choose locator";
  selectedInfo.textContent = `<${data.tagName.toLowerCase()}> ${
    data.text || data.placeholder || data.testId || "Selected element"
  }`;

  const choices = (data.xpathSuggestions || []).map((item) => [
    item.name,
    `page.locator('xpath=${escapeText(item.xpath)}')`,
  ]);

  if (data.testId) choices.unshift(["Test ID", `page.getByTestId('${escapeText(data.testId)}')`]);
  if (data.label) choices.unshift(["Label", `page.getByLabel('${escapeText(data.label)}')`]);
  if (data.placeholder) choices.unshift(["Placeholder", `page.getByPlaceholder('${escapeText(data.placeholder)}')`]);
  if (data.text) choices.unshift(["Text", `page.getByText('${escapeText(data.text)}')`]);

  choices.forEach(([name, locator], index) => {
    locatorOptions.appendChild(
      createChoiceButton(name, locator, index === 0, () => showActionOptions(data, locator)),
    );
  });

  locatorBox.style.display = "block";
}

function showActionOptions(data, locator) {
  locatorOptions.innerHTML = "";
  document.querySelector("#locatorBox h3").textContent = "Choose action";

  const actions = [
    ["Click", `${locator}.click()`],
    ["Wait for visible", `${locator}.waitFor({ state: 'visible' })`],
    ["Assert visible", `expect(${locator}).toBeVisible()`],
  ];

  if (data.tagName === "INPUT" || data.tagName === "TEXTAREA") {
    actions.splice(1, 0, ["Fill", `${locator}.fill('')`]);
  }

  if (data.text) actions.push(["Assert text", `expect(${locator}).toContainText('${escapeText(data.text)}')`]);

  actions.forEach(([name, action], index) => {
    const code = `await ${action};`;
    const button = createChoiceButton(name, code, index === 0, () => {
      addCode(action);
      closeChooser();
    });

    button.classList.add("action-choice");
    locatorOptions.appendChild(button);
  });
}

function closeChooser() {
  locatorBox.style.display = "none";
}

function addCode(action) {

  const position = editor.value.lastIndexOf("});");
  const code = `    await ${action};\n\n${pendingComment}`;

  pendingComment = "";
  editor.value =
    position < 0
      ? editor.value + code
      : editor.value.slice(0, position) + code + editor.value.slice(position);

  updateHighlight();
  editor.focus();
  editor.selectionStart = editor.selectionEnd = editor.value.length;
  
}

editor.oninput = updateHighlight;
editor.onscroll = () => {
  highlight.scrollTop = editor.scrollTop;
  highlight.scrollLeft = editor.scrollLeft;
};

document.getElementById("cancelLocator").onclick = closeChooser;
document.getElementById("open").onclick = () => {
  const value = document.getElementById("url").value.trim();
  if (value) window.recorderAPI.openUrl(value);
};
document.getElementById("select").onclick = () => window.recorderAPI.startSelection();

window.recorderAPI.onElementSelected(showLocatorOptions);
window.recorderAPI.onPageOpened(addPageUrl);
window.recorderAPI.onNavigationHappened((url) => addComment(`Navigation happened after this step: ${url}`));
window.recorderAPI.onContentChanged((url) => addComment(`Page content changed after this step: ${url}`));

updateHighlight();