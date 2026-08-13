import "@testing-library/jest-dom/vitest";

// jsdom 未实现 PointerEvent，@base-ui/react 的 checkbox/button 在点击时会
// new PointerEvent(...) 构造失败。这里提供最小 polyfill（基于 MouseEvent）。
if (typeof window !== "undefined" && typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    width: number;
    height: number;
    pressure: number;
    tiltX: number;
    tiltY: number;
    tangentialPressure: number;
    twist: number;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? "";
      this.isPrimary = params.isPrimary ?? false;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.twist = params.twist ?? 0;
    }
  }
  Object.defineProperty(window, "PointerEvent", { value: PointerEventPolyfill, writable: true });
  Object.defineProperty(globalThis, "PointerEvent", { value: PointerEventPolyfill, writable: true });
}
