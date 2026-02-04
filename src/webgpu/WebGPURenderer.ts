import type { IRenderer, MouseData } from '../core/Renderer';
import shaderSource from './shaders/water_ball.wgsl?raw';

/**
 * Primary WebGPU renderer.
 */
export class WebGPURenderer implements IRenderer {
    private canvas: HTMLCanvasElement;
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private pipeline!: GPURenderPipeline;
    private uniformBuffer!: GPUBuffer;
    private bindGroup!: GPUBindGroup;
    private uniforms = new Float32Array(12); // res(2), time(1), pad(1), mouse(4), vel(2), pad(2)

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    async init(): Promise<void> {
        const adapter = await navigator.gpu?.requestAdapter();
        if (!adapter) throw new Error('WebGPU not supported');

        this.device = await adapter.requestDevice();
        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        const format = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format,
            alphaMode: 'premultiplied',
        });

        const shaderModule = this.device.createShaderModule({
            code: shaderSource,
        });

        this.uniformBuffer = this.device.createBuffer({
            size: 48,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' },
                },
            ],
        });

        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer },
                },
            ],
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                    },
                }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });

        this.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    }

    resize(width: number, height: number): void {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
    }

    render(time: number, mouseData: MouseData): void {
        this.uniforms[0] = this.canvas.width;
        this.uniforms[1] = this.canvas.height;
        this.uniforms[2] = time;
        this.uniforms[3] = 0;
        this.uniforms[4] = mouseData.smoothX;
        this.uniforms[5] = mouseData.smoothY;
        this.uniforms[6] = mouseData.x;
        this.uniforms[7] = mouseData.y;
        this.uniforms[8] = mouseData.velocityX;
        this.uniforms[9] = mouseData.velocityY;
        this.uniforms[10] = 0;
        this.uniforms[11] = 0;

        this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniforms);

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.draw(3);
        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    dispose(): void {
        this.uniformBuffer?.destroy();
        this.device?.destroy();
    }
}
