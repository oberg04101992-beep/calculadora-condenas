import React from "react";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title = "Confirmar acción",
  message = "¿Estás seguro de continuar?",
  confirmText = "Eliminar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      aria-modal
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "grid",
        placeItems: "center",
        background: "rgba(0,0,0,0.45)",
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span aria-hidden>⚠️</span>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
        </div>
        <p style={{ margin: "8px 0 16px 0", color: "#374151", textAlign: "justify" }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ef4444",
              background: "#ef4444",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}