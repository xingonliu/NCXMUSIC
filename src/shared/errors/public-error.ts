export interface PublicError {
  readonly code: string
  readonly message: string
  readonly retryable: boolean
}
