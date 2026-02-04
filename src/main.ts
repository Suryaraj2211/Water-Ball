import './style.css';
import type { IRenderer } from './core/Renderer';
import { MouseHandler } from './input/MouseHandler';
import { WebGPURenderer } from './webgpu/WebGPURenderer';
import { WebGLRenderer } from './webgl/WebGLRenderer';

/**
 * Check if WebGPU is available.
 */
async function isWebGPUSupported(): Promise<boolean> {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Main application with renderer switching.
 */
async function main() {
  const app = document.getElementById('app')!;

  // Create canvas
  const canvas = document.createElement('canvas');
  app.appendChild(canvas);

  // Create UI controls
  const controls = document.createElement('div');
  controls.className = 'controls';
  document.body.appendChild(controls);

  const switchBtn = document.createElement('button');
  switchBtn.className = 'switch-btn';
  controls.appendChild(switchBtn);

  const rendererLabel = document.createElement('div');
  rendererLabel.className = 'renderer-label';
  document.body.appendChild(rendererLabel);

  // Initialize mouse handler
  const mouseHandler = new MouseHandler(canvas);

  // Renderer state
  let renderer: IRenderer;
  let currentRenderer: 'webgpu' | 'webgl' = 'webgpu';
  const webgpuSupported = await isWebGPUSupported();
  let animationId: number;

  // Update UI based on renderer
  function updateUI() {
    if (currentRenderer === 'webgpu') {
      switchBtn.textContent = 'Switch to WebGL';
      switchBtn.classList.remove('webgpu');
      rendererLabel.innerHTML = 'Renderer: <span>WebGPU</span>';
      rendererLabel.classList.add('webgpu');
    } else {
      switchBtn.textContent = 'Switch to WebGPU';
      switchBtn.classList.add('webgpu');
      rendererLabel.innerHTML = 'Renderer: <span>WebGL</span>';
      rendererLabel.classList.remove('webgpu');
    }

    // Disable WebGPU option if not supported
    if (!webgpuSupported && currentRenderer === 'webgl') {
      switchBtn.textContent = 'WebGPU Not Available';
      switchBtn.disabled = true;
      switchBtn.style.opacity = '0.5';
    }
  }

  // Initialize renderer
  async function initRenderer(type: 'webgpu' | 'webgl') {
    // Dispose old renderer
    if (renderer) {
      renderer.dispose();
    }

    // Cancel animation
    if (animationId) {
      cancelAnimationFrame(animationId);
    }

    // Create a NEW canvas to avoid context conflicts (WebGPU vs WebGL)
    const oldCanvas = app.querySelector('canvas');
    const newCanvas = document.createElement('canvas');
    if (oldCanvas) {
      app.replaceChild(newCanvas, oldCanvas);
    } else {
      app.appendChild(newCanvas);
    }

    // Re-initialize mouse handler with new canvas
    mouseHandler.setElement(newCanvas);

    // Create new renderer
    if (type === 'webgpu' && webgpuSupported) {
      console.log('Switching to WebGPU renderer');
      renderer = new WebGPURenderer(newCanvas);
      currentRenderer = 'webgpu';
    } else {
      console.log('Using WebGL2 renderer');
      renderer = new WebGLRenderer(newCanvas);
      currentRenderer = 'webgl';
    }

    await renderer.init();
    renderer.resize(window.innerWidth, window.innerHeight);
    updateUI();
    startAnimation();
  }

  // Animation loop
  let startTime = performance.now();
  function startAnimation() {
    function animate() {
      const time = (performance.now() - startTime) / 1000;

      mouseHandler.update();
      const mouseData = mouseHandler.getData();

      renderer.render(time, mouseData);
      animationId = requestAnimationFrame(animate);
    }
    animate();
  }

  // Switch button handler
  switchBtn.addEventListener('click', async () => {
    if (!webgpuSupported && currentRenderer === 'webgl') return;

    const newType = currentRenderer === 'webgpu' ? 'webgl' : 'webgpu';
    await initRenderer(newType);
  });

  // Handle resize
  const handleResize = () => {
    if (renderer) {
      renderer.resize(window.innerWidth, window.innerHeight);
    }
  };
  window.addEventListener('resize', handleResize);

  // Initialize with WebGPU if available, otherwise WebGL
  await initRenderer(webgpuSupported ? 'webgpu' : 'webgl');

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    mouseHandler.dispose();
    if (renderer) renderer.dispose();
  });
}

main().catch(console.error);
