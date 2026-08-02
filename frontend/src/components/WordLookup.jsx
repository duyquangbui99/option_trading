import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getDefinition } from "../api";

const MAX_LEN = 60;
const MAX_WORDS = 6;
const EXCLUDE_SELECTOR = "input, textarea, button, .topbar, .search, .seg, .chart";

function isExcluded(node) {
  const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return !!el?.closest(EXCLUDE_SELECTOR);
}

function isValidSelection(raw) {
  if (!raw) return false;
  if (raw.length > MAX_LEN) return false;
  if (raw.split(/\s+/).length > MAX_WORDS) return false;
  if (!/[a-zA-Z]/.test(raw)) return false;
  return true;
}

export default function WordLookup() {
  const [phase, setPhase] = useState("idle"); // idle | trigger | loading | result | error
  const [selection, setSelection] = useState(null); // { text, rect }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    function evaluateSelection(e) {
      if (triggerRef.current?.contains(e.target) || popupRef.current?.contains(e.target)) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setPhase("idle");
        return;
      }
      const raw = sel.toString().trim();
      if (!isValidSelection(raw) || isExcluded(sel.anchorNode) || isExcluded(sel.focusNode)) {
        setPhase("idle");
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelection({ text: raw, rect });
      setResult(null);
      setError(null);
      setPhase("trigger");
    }

    let debounceId;
    function onSelectionChange(e) {
      clearTimeout(debounceId);
      debounceId = setTimeout(() => evaluateSelection(e), 180);
    }
    function dismiss() {
      setPhase("idle");
    }
    function onKeyDown(e) {
      if (e.key === "Escape") dismiss();
    }

    document.addEventListener("mouseup", evaluateSelection);
    document.addEventListener("touchend", evaluateSelection);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", dismiss, { capture: true, passive: true });
    window.addEventListener("resize", dismiss);

    return () => {
      clearTimeout(debounceId);
      document.removeEventListener("mouseup", evaluateSelection);
      document.removeEventListener("touchend", evaluateSelection);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", dismiss, { capture: true });
      window.removeEventListener("resize", dismiss);
    };
  }, []);

  async function handleDefine() {
    setPhase("loading");
    setError(null);
    try {
      const data = await getDefinition(selection.text);
      setResult(data);
      setPhase("result");
    } catch (err) {
      setError(err.message);
      setPhase("error");
    }
  }

  if (phase === "idle" || !selection) return null;

  const { rect } = selection;
  const left = Math.min(Math.max(rect.left + rect.width / 2, 60), window.innerWidth - 60);
  const triggerTop = Math.max(rect.top - 8, 8);
  const popupTop = rect.bottom + 8;

  return createPortal(
    <>
      {phase === "trigger" && (
        <button
          ref={triggerRef}
          className="lookup-trigger"
          style={{ left, top: triggerTop }}
          onClick={handleDefine}
        >
          Define
        </button>
      )}
      {(phase === "loading" || phase === "result" || phase === "error") && (
        <div ref={popupRef} className="lookup-popup" style={{ left, top: popupTop }}>
          <div className="term">{selection.text}</div>
          {phase === "loading" && <p className="lookup-loading">Looking up…</p>}
          {phase === "error" && <p className="lookup-error">{error}</p>}
          {phase === "result" && (
            <>
              <p className="definition">{result.definition ?? "No dictionary definition found."}</p>
              {result.vietnamese && <p className="vietnamese">{result.vietnamese}</p>}
            </>
          )}
        </div>
      )}
    </>,
    document.body,
  );
}
