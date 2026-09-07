// import {InputSource, PointerHandlers} from "../core/ports";
//
// export class EventManager {
//   private dragging = false
//   private cameraEnabledBackup = true
//   private unbind: (() => void) | null = null
//
//   constructor(
//     private readonly input: InputSource,
//   ) {
//   }
//
//   registerEvent(pointHandlers:PointerHandlers): void {
//     this.input.onDown(() => {
//       this.dragging = true
//     })
//     this.input.onMove(() => {
//       this.dragging = true
//     })
//     this.input.onUp(() => {
//       this.dragging = false
//     })
//   }
//
//   unregisterEvent(): void {
//     this.input.onDown(() => {
//       this.dragging = false
//     })
//     this.input.onMove(() => {
//       this.dragging = false
//     })
//     this.input.onUp(() => {
//       this.dragging = false
//     })
// }
