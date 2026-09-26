# Cesium Gizmo Controls

[English](./README.md) | [简体中文](./README.zh-CN.md)

Transform gizmo controls for Cesium scenes. Bind a Cesium `Matrix4` to edit an object's translation, rotation, and scale directly in the scene.

![Translation controls](./translate.png)

![Rotation controls](./rotate.png)

![Scale controls](./scale.png)

## Features

- **Translate** along the local X, Y, and Z axes, or move in the view plane.
- **Rotate** around the local X, Y, and Z axes, or around the view axis.
- **Scale** independently along the local X, Y, and Z axes, or scale uniformly.
- Keeps the gizmo at a screen-sized target while the camera moves.
- Offers optional snapping, interaction overlays, picking tolerance, and visibility thresholds.
- Calls `onChange` with a fresh `Matrix4` whenever an interaction changes the bound transform.

## Demo

Live example: https://verbannung.github.io/cesium-gizmo-controls/

## Install

Install from the rolling GitHub Release :

```bash
npm install https://github.com/verbannung/cesium-gizmo-controls/releases/download/latest/cesium-gizmo-controls-0.1.0.tgz
```

Release builds are published from `main`. Day-to-day development happens on `develop`.

## Requirements

- Node.js `>=18` for local development.
- Cesium Engine `^24.0.0`. The package declares `@cesium/engine` as a peer dependency.
- A Cesium `Matrix4` that can be decomposed into translation, rotation, and scale, written as `T · R · S`. `bind()` rejects matrices with shear or a non-orthogonal rotation component.

## Usage

```ts
import { Matrix4 } from '@cesium/engine'
import { OrbitControl, type ControlMode } from 'cesium-gizmo-controls'

const control = new OrbitControl(widget.canvas, widget.scene, widget.camera, {
  // Keep the Cesium primitive in sync with each completed control update.
  onChange: (modelMatrix) => Matrix4.clone(modelMatrix, primitive.modelMatrix),
})

control.bind(primitive.modelMatrix, 'translate')

const modes: ControlMode[] = ['translate', 'rotate', 'scale']
control.setMode(modes[1])
console.log(control.currentMode) // 'rotate'

// Call this when the Cesium view or its owner is torn down.
control.destroy()
```

`bind()` also updates the matrix passed to it during interaction. Use `onChange` when another object, store, or render path must stay synchronized with the new matrix.

## Public API

### `new OrbitControl(canvas, scene, camera, options?)`

Creates controls for a Cesium canvas, scene, and camera.

### `bind(modelMatrix, mode?)`

Binds a decomposable `Matrix4` and activates a mode. `mode` defaults to `'translate'`.

### `setMode(mode)`

Changes the active control mode. Valid modes are `'translate'`, `'rotate'`, and `'scale'`.

### `currentMode`

Read-only active mode.

### `destroy()`

Removes input handlers, gizmo primitives, overlays, and render resources. Call it during teardown.

## Options

| Option | Default | Purpose |
| --- | ---: | --- |
| `gizmoPixelSize` | `80` | Target on-screen size of the gizmo in pixels. |
| `pickPaddingPx` | `8` | Extra width, in pixels, for pick geometry. |
| `translateSnap` | `0` | Translation snap step. `0` disables snapping. |
| `scaleSnap` | `0` | Scale snap step. `0` disables snapping. |
| `minScale` | `0.01` | Minimum per-axis scale. |
| `showOverlay` | `true` | Draw drag guides, sectors, and values. |
| `onChange` | `undefined` | Receives a cloned `Matrix4` after a transform update. |

Advanced options are `degenerateThreshold`, `minRotateRadius`, `minScaleDenominator`, `axisLimit`, and `planeLimit`. They tune interaction behavior around degenerate camera and geometry cases.

## Local Development

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run test
```

`npm run dev` starts the local Cesium example. `npm run build` produces the package build and declaration files.

## License

[MIT](./LICENSE)
