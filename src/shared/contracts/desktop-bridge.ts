export interface DesktopBridge {
  readonly platform: string
  readonly versions: {
    readonly chrome: string
    readonly electron: string
    readonly node: string
  }
}
