# AGENTS.md — packages/ui

This contract applies to `packages/ui/**` in addition to the root and `packages/AGENTS.md`
rules.

## Boundary

`@lcl/ui` owns reusable, product-agnostic presentation primitives.

It may know about:

- React presentation;
- accessibility behavior;
- generic interaction state;
- design tokens;
- reusable feedback/form/layout primitives.

It must not know about:

- Plugs, Thermometers or automation ownership;
- Shelly RPC/BLE/storage;
- mobile routes;
- `InstalledAutomation`;
- product-specific i18n copy;
- runtime safety decisions.

If a component requires product semantics to make a decision, keep that composition in
the mobile feature and pass generic props into `@lcl/ui`.

## API design

Prefer small typed APIs with semantic props and events.

Good:

```text
status="danger"
onConfirm()
ariaLabel
items
selectedId
```

Avoid props that mirror one screen's whole flow/store or leak transport/domain objects
into a generic primitive.

Do not make a universal mega-component with many unrelated boolean variants. Separate
primitives when interaction models differ.

Export intentional public components from `src/index.ts`; callers should not depend on
private source paths.

## Styling

Use design tokens from `@lcl/design-tokens`.

- no raw product color palette in components;
- no duplicated one-off spacing systems;
- no app-route-specific positioning;
- no mobile shell geometry ownership;
- keep responsive behavior intrinsic/generic where possible;
- use semantic status styling rather than product-specific names.

`styles.css` is shared infrastructure, not a dumping ground. When adding a new primitive,
keep its selectors cohesive and remove touched stale selectors when safe.

## Feedback and overlays

`ToastViewport` is a reusable visual primitive. The mobile application decides where it
is hosted. Do not teach `@lcl/ui` about `AppShell`, bottom navigation or screen-specific
offsets.

The same rule applies to other overlays: the primitive owns presentation/interaction;
the consuming app owns product placement and lifecycle.

## Accessibility

Every interactive primitive must support:

- keyboard/focus behavior where relevant;
- accessible names/labels;
- visible disabled/loading/error semantics;
- sufficient contrast;
- no color-only meaning;
- touch-friendly sizing when used on mobile.

Do not hide safety-critical meaning behind an icon without text supplied by the caller.

## Tests

Test reusable behavior at the primitive boundary. Product workflow tests belong in the
mobile feature that composes the primitive.

A UI primitive change that affects geometry or interaction must also be validated in at
least one real consuming mobile surface when practical.
