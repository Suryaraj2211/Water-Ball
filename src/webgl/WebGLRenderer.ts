import type { IRenderer, MouseData } from '../core/Renderer';
import vertexSource from './shaders/water_ball.vert?raw';
import fragmentSource from './shaders/water_ball.frag?raw';

/**
 * Fallback renderer using WebGL2.
 */
export class WebGLRenderer implements IRenderer {
    private canvas: HTMLCanvasElement;
    private gl!: WebGL2RenderingContext;
    private program!: WebGLProgram;
    private vao!: WebGLVertexArrayObject;

    private uResolution!: WebGLUniformLocation | null;
    private uTime!: WebGLUniformLocation | null;
    private uMouse!: WebGLUniformLocation | null;
    private uVelocity!: WebGLUniformLocation | null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    async init(): Promise<void> {
        const gl = this.canvas.getContext('webgl2', {
            antialias: true,
            alpha: false,
        });
        if (!gl) throw new Error('WebGL2 not supported');
        this.gl = gl;

        const vs = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

        this.program = gl.createProgram()!;
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error('Program link error: ' + gl.getProgramInfoLog(this.program));
        }

        this.uResolution = gl.getUniformLocation(this.program, 'uResolution');
        this.uTime = gl.getUniformLocation(this.program, 'uTime');
        this.uMouse = gl.getUniformLocation(this.program, 'uMouse');
        this.uVelocity = gl.getUniformLocation(this.program, 'uVelocity');

        // Emptry VAO used for gl_VertexID based rendering
        this.vao = gl.createVertexArray()!;

        this.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    }

    private compileShader(type: number, source: string): WebGLShader {
        const shader = this.gl.createShader(type)!;
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const info = this.gl.getShaderInfoLog(shader);
            throw new Error('Shader compile error: ' + info);
        }
        return shader;
    }

    resize(width: number, height: number): void {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    render(time: number, mouseData: MouseData): void {
        const gl = this.gl;

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);

        gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
        gl.uniform1f(this.uTime, time);
        gl.uniform4f(this.uMouse, mouseData.smoothX, mouseData.smoothY, mouseData.x, mouseData.y);
        gl.uniform2f(this.uVelocity, mouseData.velocityX, mouseData.velocityY);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    dispose(): void {
        this.gl.deleteProgram(this.program);
        this.gl.deleteVertexArray(this.vao);
    }
}
