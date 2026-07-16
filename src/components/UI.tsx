import React, { useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--md-on-surface-variant)' }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: {
  icon: string; title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="material-icons-outlined">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="loading-overlay">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  );
}

export function Badge({ variant, children }: { variant: 'success' | 'error' | 'warning' | 'info' | 'neutral'; children: React.ReactNode }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function Modal({ open, title, onClose, children, footer }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-icon btn-secondary" onClick={onClose}>
            <span className="material-icons-outlined">close</span>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, activeTab, onTabChange }: {
  tabs: { key: string; label: string; icon?: string }[];
  activeTab: string;
  onTabChange: (key: string) => void;
}) {
  return (
    <div className="tabs">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`tab ${activeTab === tab.key ? 'active' : ''}`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.icon && <span className="material-icons-outlined">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder = 'Search...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="search-bar">
      <span className="material-icons-outlined">search</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
