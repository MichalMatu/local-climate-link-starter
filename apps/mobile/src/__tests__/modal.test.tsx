import { Modal } from '@lcl/ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Modal dismissal policy', () => {
  afterEach(() => {
    cleanup();
  });

  it('dismisses an idle modal from the backdrop and Escape key', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal closeLabel="Close" open title="Idle modal" onClose={onClose}>
        <p>Body</p>
      </Modal>
    );

    const backdrop = document.querySelector('.lcl-modal-backdrop');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    rerender(
      <Modal closeLabel="Close" open title="Idle modal" onClose={onClose}>
        <p>Body</p>
      </Modal>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks ambient dismissal while a modal is busy', () => {
    const onClose = vi.fn();
    render(
      <Modal busy closeLabel="Close" open title="Busy modal" onClose={onClose}>
        <p>Body</p>
      </Modal>
    );

    const backdrop = document.querySelector('.lcl-modal-backdrop');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('supports explicit-only modals for safety gates', () => {
    const onClose = vi.fn();
    render(
      <Modal
        closeLabel="Close"
        dismissible={false}
        open
        title="Explicit modal"
        onClose={onClose}
      >
        <p>Body</p>
      </Modal>
    );

    const backdrop = document.querySelector('.lcl-modal-backdrop');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
