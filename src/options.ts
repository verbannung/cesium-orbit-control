import type { OrbitControlOptions, ResolvedOptions } from './types'

const DEFAULTS: Omit<ResolvedOptions, 'onChange'> = {
  gizmoPixelSize: 80,
  pickPaddingPx: 8,
  degenerateThreshold: 0.15,
  translateSnap: 0,
  scaleSnap: 0,
  minScale: 0.01,
  minScaleDenominator: 1e-6,
  minRotateRadius: 0.10,
  axisLimit: 0.98,
  planeLimit: 0.2,
  showOverlay: true,
}

export function resolveOptions(options: OrbitControlOptions = {}): ResolvedOptions {
  return {
    gizmoPixelSize: options.gizmoPixelSize ?? DEFAULTS.gizmoPixelSize,
    pickPaddingPx: options.pickPaddingPx ?? DEFAULTS.pickPaddingPx,
    degenerateThreshold: options.degenerateThreshold ?? DEFAULTS.degenerateThreshold,
    translateSnap: options.translateSnap ?? DEFAULTS.translateSnap,
    scaleSnap: options.scaleSnap ?? DEFAULTS.scaleSnap,
    minScale: options.minScale ?? DEFAULTS.minScale,
    minScaleDenominator: options.minScaleDenominator ?? DEFAULTS.minScaleDenominator,
    minRotateRadius: options.minRotateRadius ?? DEFAULTS.minRotateRadius,
    axisLimit: options.axisLimit ?? DEFAULTS.axisLimit,
    planeLimit: options.planeLimit ?? DEFAULTS.planeLimit,
    showOverlay: options.showOverlay ?? DEFAULTS.showOverlay,
    onChange: options.onChange,
  }
}
