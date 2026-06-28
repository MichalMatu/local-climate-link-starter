# ADR-0004 — Design tokens from day one

## Status

Accepted

## Context

The app should not accumulate hardcoded colors, spacing, status badges, and inconsistent UI patterns. It must look trustworthy and handle safety states clearly.

## Decision

Use Style Dictionary tokens from day one.

Token categories:

```text
color
spacing
radius
typography
shadow
motion
z-index
semantic status colors
```

Generated outputs:

```text
CSS variables for Ionic theme
TypeScript token exports for UI packages
```

## Consequences

Pros:

```text
Consistent UI.
Easy theming.
Better status semantics for OK/warning/blocked/error.
```

Tradeoffs:

```text
Small initial setup cost.
Agents must not hardcode raw hex colors in components.
```
