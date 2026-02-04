import type { MouseData } from '../core/Renderer';

/**
 * Tracks mouse position and provides smoothed/interpolated values
 * for fluid-like motion in the water ball.
 */
export class MouseHandler {
    private rawX = 0;
    private rawY = 0;
    private smoothX = 0;
    private smoothY = 0;
    private prevSmoothX = 0;
    private prevSmoothY = 0;
    private velocityX = 0;
    private velocityY = 0;
    private canvas: HTMLCanvasElement;
    private lerpFactor = 0.1; // Slightly faster for magnetic response
    private velocityDecay = 0.92; // Velocity dampening

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.bindEvents();
    }

    /**
     * Update the canvas element used for coordinate calculation.
     */
    setElement(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
    }

    private bindEvents(): void {
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    }

    private onMouseMove = (e: MouseEvent): void => {
        this.updatePosition(e.clientX, e.clientY);
    };

    private onTouchMove = (e: TouchEvent): void => {
        if (e.touches.length > 0) {
            this.updatePosition(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    private updatePosition(clientX: number, clientY: number): void {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Normalize to -1 to 1 range relative to center
        this.rawX = (clientX - centerX) / (rect.width / 2);
        this.rawY = (clientY - centerY) / (rect.height / 2);

        // Clamp values
        this.rawX = Math.max(-1, Math.min(1, this.rawX));
        this.rawY = Math.max(-1, Math.min(1, this.rawY));
    }

    /**
     * Update smooth values and calculate velocity (call once per frame).
     */
    update(): void {
        // Store previous smooth values for velocity calculation
        this.prevSmoothX = this.smoothX;
        this.prevSmoothY = this.smoothY;

        // Lerp towards raw values for smooth motion
        this.smoothX += (this.rawX - this.smoothX) * this.lerpFactor;
        this.smoothY += (this.rawY - this.smoothY) * this.lerpFactor;

        // Calculate velocity (change in smooth position)
        const newVelX = (this.smoothX - this.prevSmoothX) * 10; // Amplify for effect
        const newVelY = (this.smoothY - this.prevSmoothY) * 10;

        // Blend with previous velocity for smoother momentum
        this.velocityX = this.velocityX * this.velocityDecay + newVelX * (1 - this.velocityDecay);
        this.velocityY = this.velocityY * this.velocityDecay + newVelY * (1 - this.velocityDecay);
    }

    /**
     * Get current mouse data for rendering.
     */
    getData(): MouseData {
        const distance = Math.sqrt(this.smoothX * this.smoothX + this.smoothY * this.smoothY);
        return {
            x: this.rawX,
            y: this.rawY,
            distance: Math.min(1, distance),
            smoothX: this.smoothX,
            smoothY: this.smoothY,
            velocityX: this.velocityX,
            velocityY: this.velocityY,
        };
    }

    dispose(): void {
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('touchmove', this.onTouchMove);
    }
}
