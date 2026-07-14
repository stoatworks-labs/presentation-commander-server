export interface NdiFrame {
  width: number
  height: number
  strideBytes: number
  data: Buffer
}

export class NdiReceiver {
  constructor(urlAddress: string)
  captureFrame(timeoutMs?: number): Promise<NdiFrame | null>
  destroy(): void
}
