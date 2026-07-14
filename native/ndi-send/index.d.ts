export class NdiSender {
  constructor(name: string)
  sendFrame(buffer: Buffer, width: number, height: number): Promise<void>
  destroy(): void
}
