// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  RECOVERY_BUTTON_CLASS,
  applyFailureScreenContainer,
  setRecoveryBusy,
  styleRecoveryButton
} from '@/bootScreenStyle';

afterEach(() => {
  document.getElementById('phlix-boot-screen-style')?.remove();
  document.body.replaceChildren();
});

describe('bootScreenStyle (WIN-22/WIN-23)', () => {
  it('injects one sheet carrying hover + focus-visible rules, once', () => {
    const a = document.createElement('button');
    const b = document.createElement('button');
    styleRecoveryButton(a);
    styleRecoveryButton(b, 'secondary');
    const sheets = document.querySelectorAll('#phlix-boot-screen-style');
    expect(sheets.length).toBe(1);
    expect(sheets[0].textContent).toContain(':hover');
    expect(sheets[0].textContent).toContain(':focus-visible');
    expect(a.classList.contains(RECOVERY_BUTTON_CLASS)).toBe(true);
    expect(b.dataset.variant).toBe('secondary');
  });

  it('busy shows the in-flight label; every re-arm restores the idle label', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Try again';
    styleRecoveryButton(btn);
    setRecoveryBusy(btn, true, 'Checking…');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('Checking…');
    setRecoveryBusy(btn, false);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('Try again');
    // a label-less busy (the paired sibling) keeps its own label
    setRecoveryBusy(btn, true);
    expect(btn.textContent).toBe('Try again');
    setRecoveryBusy(btn, false);
  });

  it('shares the container look between screens; overlay adds fixed positioning', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    applyFailureScreenContainer(a);
    applyFailureScreenContainer(b, { overlay: true });
    expect(a.getAttribute('style')).toContain('background:#1a1a2e');
    expect(b.getAttribute('style')).toContain('background:#1a1a2e');
    expect(b.getAttribute('style')).toContain('position:fixed');
    expect(a.getAttribute('style')).not.toContain('position:fixed');
  });
});
