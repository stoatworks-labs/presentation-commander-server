import type { NdiSource, Source } from '../../shared/types'

interface NdiPreviewFrame {
  width: number
  height: number
  strideBytes: number
  data: Uint8Array
}

/** A source only has host+port when it was added via network discovery
 *  (or resolved from a live Client Node), which is what makes it eligible
 *  for a real NDI receive preview instead of a placeholder box. */
export function isLiveNdiSource(
  source: Source | undefined
): source is NdiSource & { port: number } {
  return !!source && source.kind === 'ndi' && source.port !== undefined
}

/** Repacks a possibly-strided NDI frame buffer into tight RGBA rows ready for ImageData/canvas use. */
export function packFrame(frame: NdiPreviewFrame): ImageData {
  const rowBytes = frame.width * 4
  const packed =
    frame.strideBytes === rowBytes
      ? frame.data
      : (() => {
          const out = new Uint8Array(rowBytes * frame.height)
          for (let y = 0; y < frame.height; y++) {
            out.set(
              frame.data.subarray(y * frame.strideBytes, y * frame.strideBytes + rowBytes),
              y * rowBytes
            )
          }
          return out
        })()
  return new ImageData(new Uint8ClampedArray(packed), frame.width, frame.height)
}
