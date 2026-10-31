---
name: premium-design-craft
description: Master craftsmanship guidelines for elite, boutique, dark-mode software interfaces, fluid spring physics, and micro-interactions.
---

# Premium Design & Motion Craft Standards

Guidelines for crafting software interfaces that feel physical, high-density, tactile, and free of "AI UI slop".

## 1. The Anti-Slop Principles

Avoid these common AI-generated UI clichés:
- **No Plexus particle meshes**: Never use random dots bouncing with connecting lines or floating shooting stars across viewports.
- **No flat milky glass**: Never use `rgba(255, 255, 255, 0.08)` on pure black without surface tone elevation.
- **No unanchored scale(0) animations**: Never scale UI elements from 0 to 1 without a physical transform-origin.
- **No dead click zones**: Always use padding over margin for list items and buttons so every interactive pixel triggers.
- **No layout shifts**: Never alter `font-weight` on hover or focus states.

## 2. The Surface Ladder & Lighting

In dark interfaces, elevation is communicated through surface tone progression and specular edge highlights, not heavy dark shadows:
- **Canvas (`#05070a`)**: Deep obsidian base with microscopic tactile noise.
- **Surface 0 (Base / Sidebar - `#0a0e17`)**: Calibrated 60-75% alpha with 20px backdrop blur.
- **Surface 1 (Cards / Main Pane - `#101624`)**: Elevated surface with `inset 0 1px 0 0 rgba(255, 255, 255, 0.07)` rim lighting.
- **Surface 2 (Modals / Menus - `#161e30`)**: Popovers and dropdowns with `border: 1px solid rgba(255, 255, 255, 0.10)` and deep occlusion shadows (`0 20px 48px -12px rgba(0,0,0,0.75)`).
- **Hairlines**: Strict 1px semi-transparent white borders (`rgba(255, 255, 255, 0.06)` to `0.10`).

## 3. Motion & Physics Budget (Emil Kowalski & Rauno Freiberg)

- **Speed Budget**: Micro-interactions complete in **160ms - 220ms**. Never exceed 300ms for UI actions.
- **Easing**: 
  - Enter: Snappy spring `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out deceleration).
  - Exit: Quick acceleration `cubic-bezier(0.7, 0, 0.84, 0)`.
  - Tactile Compression: `:active { transform: scale(0.97); }` with immediate spring response.
- **Origins**: Dropdowns, context menus, and tooltips must animate from their trigger's transform-origin.
- **Compositor Only**: Animate strictly `transform` and `opacity` to maintain 60/120fps.
