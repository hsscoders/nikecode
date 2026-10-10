"use client";

import { useEffect, useRef, useState } from "react";
import { X, CircleCheck, CircleAlert } from "lucide-react";

/* ============ Toast hook — parent uses {toast, showToast} ============ */
export function useToast() {
  const [toast, setToast] = useState("");
  const [err, setErr] = useState(false);
  const timer = useRef(null);

  const showToast = (msg, isError = false) => {
    clearTimeout(timer.current);
    setToast("");
    setErr(isError);
    requestAnimationFrame(() => {
      setToast(msg);
      timer.current = setTimeout(() => setToast(""), 2600);
    });
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, showToast, isError: err };
}

export function Toast({ message, isError }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={`fixed right-3 top-3 z-[100] flex max-w-[calc(100vw-24px)] items-center gap-2.5 rounded-2xl px-4 py-3 text-[13px] font-semibold text-white shadow-[0_14px_38px_rgba(66,9,26,0.4)] sm:right-5 sm:top-5 sm:max-w-[380px] sm:px-5 sm:py-3.5 sm:text-[13.5px] ${
        isError ? "bg-[#b91c1c]" : "bg-maroon-950"
      }`}
    >
      {isError ? (
        <CircleAlert size={18} className="shrink-0 text-gold" />
      ) : (
        <CircleCheck size={18} className="shrink-0 text-gold" />
      )}
      <span>{message}</span>
    </div>
  );
}

/* ============ Modal ============ */
export function Modal({ open, title, sub, onClose, children, footer, wide }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-2.5 animate-[fade-in_0.18s_ease] sm:p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_30px_80px_rgba(66,9,26,0.4)] animate-[pop-in_0.2s_ease] sm:max-h-[90dvh] sm:rounded-[20px] ${
          wide ? "max-w-[720px]" : "max-w-[480px]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-rose bg-[#fbf3f4] px-4 py-3.5 sm:px-6 sm:py-4">
          <div>
            <div className="font-display text-[16.5px] font-bold text-ink sm:text-[18px]">{title}</div>
            {sub && <div className="mt-0.5 text-[11.5px] font-medium text-muted-rose sm:text-[12px]">{sub}</div>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[10px] bg-white text-[#a08a8f] shadow-sm transition-colors hover:bg-[#f7e3e7] hover:text-maroon-700 sm:h-8 sm:w-8"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2.5 border-t border-line-rose bg-[#fdfafa] px-4 py-3.5 sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ Confirm dialog ============ */
export function Confirm({ open, title, message, confirmLabel, onCancel, onConfirm, danger }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`admin-btn ${danger ? "admin-btn-danger" : "admin-btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel || "Confirm"}
          </button>
        </>
      }
    >
      <p className="text-[14px] leading-relaxed text-[#7d6a6e]">{message}</p>
    </Modal>
  );
}

/* ============ Status pill ============ */
const PILL_MAP = {
  Pending: "bg-[#fdf3e0] text-[#a9791c]",
  Processing: "bg-[#e8f0fe] text-[#2563eb]",
  Success: "bg-[#eafaf0] text-[#16a34a]",
  Active: "bg-[#eafaf0] text-[#16a34a]",
  Completed: "bg-[#f0f0f0] text-[#666666]",
  Rejected: "bg-[#fdecec] text-[#dc2626]",
  Banned: "bg-[#fdecec] text-[#dc2626]",
};

export function Pill({ value }) {
  const cls = PILL_MAP[value] || "bg-[#f0f0f0] text-[#666666]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.4px] ${cls}`}
    >
      <span className="h-[5px] w-[5px] rounded-full bg-current" />
      {value}
    </span>
  );
}

/* ============ Toggle switch ============ */
export function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[40px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-[#16a34a]" : "bg-[#dcc9ce]"
      }`}
    >
      <span
        className={`absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white shadow transition-all duration-200 ${
          checked ? "left-[21px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

/* ============ Field wrapper + inputs ============ */
export function Field({ label, children, hint }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.4px] text-[#8a6e75]">
        {label}
      </label>
      {children}
      {hint && <div className="mt-1 text-[11.5px] font-medium text-muted-rose">{hint}</div>}
    </div>
  );
}

export function TextInput(props) {
  return <input {...props} className={`admin-input ${props.className || ""}`} />;
}

export function Select(props) {
  return (
    <select {...props} className={`admin-input cursor-pointer ${props.className || ""}`}>
      {props.children}
    </select>
  );
}

export function TextArea(props) {
  return (
    <textarea
      rows={3}
      {...props}
      className={`admin-input resize-none ${props.className || ""}`}
    />
  );
}

/* ============ Page loader ============ */
export function Loader({ label }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-line-rose border-t-maroon-700" />
      <div className="text-[13px] font-semibold text-muted-rose">{label || "Loading..."}</div>
    </div>
  );
}
