import { useEffect, useRef } from "react";

const keywords = [
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "import", "from", "export", "default", "class", "new", "async", "await",
  "true", "false", "null", "undefined",
];

const builtInNames = [
  "console", "window", "document", "Math", "JSON", "Array", "Object", "String", "Number",
];

const playwrightNames = ["test", "expect", "page", "require"];
const playwrightMethods = ["goto", "locator", "click", "press", "fill", "waitFor", "toBeVisible", "toContainText"];

function getTokenColor(token) {
  if (keywords.includes(token)) return "syntax-keyword";
  if (playwrightNames.includes(token)) return "syntax-playwright";
  if (playwrightMethods.includes(token)) return "syntax-method";
  if (builtInNames.includes(token)) return "syntax-built-in";
  if (/^\d+(\.\d+)?$/.test(token)) return "syntax-number";
  if (/^["'`].*["'`]$/.test(token)) return "syntax-string";
  if (token.startsWith("//") || token.startsWith("#") || token.startsWith("/*")) return "syntax-comment";
  if (/^[+\-*/%=!<>|&?:]+$/.test(token)) return "syntax-operator";
  if (/^[{}()[\].,;:]$/.test(token)) return "syntax-punctuation";
  if (/^[A-Z][A-Za-z0-9_]*$/.test(token)) return "syntax-type";
  return "syntax-normal";
}

function colorLine(line) {
  const tokenPattern = /(\/\/.*|#[^\n]*|\/\*[\s\S]*?\*\/|["'`][^"'`]*["'`]|\b\d+(?:\.\d+)?\b|\b(?:const|let|var|function|return|if|else|for|while|import|from|export|default|class|new|async|await|true|false|null|undefined|console|window|document|Math|JSON|Array|Object|String|Number|test|expect|page|require|goto|locator|click|press|fill|waitFor|toBeVisible|toContainText)\b|[+\-*/%=!<>|&?:]+|[{}()[\].,;:])/g;
  const parts = line.split(tokenPattern);

  return parts.map((part, index) => (
    <span className={getTokenColor(part)} key={`${index}-${part}`}>{part}</span>
  ));
}

function CodeEditor({ value, onChange, language, placeholder }) {
  const textareaRef = useRef(null);
  const codeRef = useRef(null);
  const lines = value ? value.split("\n") : [""];

  function keepHighlightAligned() {
    if (!textareaRef.current || !codeRef.current) return;
    codeRef.current.scrollTop = textareaRef.current.scrollTop;
    codeRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }

  useEffect(() => {
    keepHighlightAligned();
  }, [value]);

  return (
    <div className={`code-editor language-${language}`}>
      <div className="line-numbers" aria-hidden="true">
        {lines.map((_, index) => <span key={index}>{index + 1}</span>)}
      </div>
      <pre ref={codeRef} className="highlighted-code" aria-hidden="true">
        {value ? lines.map((line, index) => <span className="code-line" key={index}>{colorLine(line)}{"\n"}</span>) : <span className="code-placeholder">{placeholder}</span>}
      </pre>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={keepHighlightAligned}
        spellCheck="false"
        aria-label="Document editor"
        placeholder={placeholder}
      />
      <div className="code-minimap" aria-hidden="true">
        {lines.slice(0, 80).map((line, index) => (
          <span key={index} className={`minimap-line ${index % 7 === 0 ? "highlight" : ""}`} style={{ width: `${Math.max(12, Math.min(94, line.length * 2.2))}%` }} />
        ))}
      </div>
    </div>
  );
}

export default CodeEditor;
