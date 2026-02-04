/**
 * Mouse interaction data passed to render calls.
 */
export interface MouseData {
  /** Mouse X position relative to center (-1 to 1). */
  x: number;
  /** Mouse Y position relative to center (-1 to 1). */
  y: number;
  /** Distance from center (0 = center, 1 = edge of screen). */
  distance: number;
  /** Smoothed/interpolated X. */
  smoothX: number;
  /** Smoothed/interpolated Y. */
  smoothY: number;
  /** Mouse X velocity (for momentum physics). */
  velocityX: number;
  /** Mouse Y velocity (for momentum physics). */
  velocityY: number;
}

/**
 * Abstract renderer interface for WebGPU and WebGL implementations.
 */
export interface IRenderer {
  /** Initialize the renderer (async for WebGPU). */
  init(): Promise<void>;
  /** Handle canvas resize. */
  resize(width: number, height: number): void;
  /** Render a frame. */
  render(time: number, mouseData: MouseData): void;
  /** Cleanup resources. */
  dispose(): void;
}
