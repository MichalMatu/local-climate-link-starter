import './SelectField.css';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';

export type SelectFieldOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type SelectFieldProps<T extends string = string> = {
  value: T | '';
  options: readonly SelectFieldOption<T>[];
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onChange(value: T): void;
};

const firstEnabledIndex = <T extends string>(
  options: readonly SelectFieldOption<T>[]
): number => options.findIndex((option) => !option.disabled);

const lastEnabledIndex = <T extends string>(
  options: readonly SelectFieldOption<T>[]
): number => {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]?.disabled) {
      return index;
    }
  }
  return -1;
};

const nextEnabledIndex = <T extends string>(
  options: readonly SelectFieldOption<T>[],
  currentIndex: number,
  direction: 1 | -1
): number => {
  if (options.length === 0) {
    return -1;
  }

  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (currentIndex + direction * offset + options.length) % options.length;
    if (!options[index]?.disabled) {
      return index;
    }
  }

  return currentIndex;
};

export const SelectField = <T extends string,>({
  value,
  options,
  ariaLabel,
  placeholder,
  disabled = false,
  className = '',
  onChange
}: SelectFieldProps<T>) => {
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value]
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options)
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) {
      return;
    }
    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  const openList = (preferredIndex = selectedIndex) => {
    if (disabled) {
      return;
    }
    const fallbackIndex = firstEnabledIndex(options);
    setActiveIndex(preferredIndex >= 0 ? preferredIndex : fallbackIndex);
    setOpen(true);
  };

  const closeList = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  const chooseOption = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) {
      return;
    }
    onChange(option.value);
    closeList(true);
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openList(
        selectedIndex >= 0
          ? nextEnabledIndex(options, selectedIndex, 1)
          : firstEnabledIndex(options)
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      openList(
        selectedIndex >= 0
          ? nextEnabledIndex(options, selectedIndex, -1)
          : lastEnabledIndex(options)
      );
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) {
        closeList();
      } else {
        openList();
      }
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeList();
    }
  };

  const handleOptionKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(nextEnabledIndex(options, index, 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(nextEnabledIndex(options, index, -1));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(firstEnabledIndex(options));
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(lastEnabledIndex(options));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      chooseOption(index);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeList(true);
      return;
    }

    if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div
      className={`lcl-select-field ${open ? 'lcl-select-field--open' : ''} ${className}`.trim()}
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="lcl-select-field__trigger"
        disabled={disabled}
        type="button"
        value={value}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          className={
            selectedOption
              ? 'lcl-select-field__value'
              : 'lcl-select-field__value lcl-select-field__value--placeholder'
          }
        >
          {selectedOption?.label ?? placeholder ?? ''}
        </span>
        <span className="lcl-select-field__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div
          aria-label={ariaLabel}
          className="lcl-select-field__listbox"
          id={listboxId}
          role="listbox"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                aria-selected={selected}
                className={`lcl-select-field__option ${
                  selected ? 'lcl-select-field__option--selected' : ''
                }`.trim()}
                disabled={option.disabled}
                role="option"
                tabIndex={index === activeIndex ? 0 : -1}
                type="button"
                onClick={() => chooseOption(index)}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                <span>{option.label}</span>
                <span className="lcl-select-field__check" aria-hidden="true">
                  {selected ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
