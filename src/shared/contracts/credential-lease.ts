import { z } from 'zod'

const RequestIdSchema = z.uuid()
const AccountIdSchema = z.union([
  z.literal('guest:local'),
  z.string().regex(/^\d{1,32}$/u)
])
const AccountGenerationSchema = z.number().int().positive()
const CookieHeaderSchema = z
  .string()
  .min(1)
  .max(32_768)
  .refine((value) => !/[\r\n\0]/u.test(value), 'Cookie header contains control characters')

export const CredentialProbeCommandSchema = z.strictObject({
  kind: z.literal('auth.session.probe'),
  requestId: RequestIdSchema,
  accountGeneration: AccountGenerationSchema,
  cookieHeader: CookieHeaderSchema
})

export const CredentialLeaseGrantCommandSchema = z.strictObject({
  kind: z.literal('auth.lease.grant'),
  requestId: RequestIdSchema,
  leaseId: z.uuid(),
  accountId: AccountIdSchema,
  accountGeneration: AccountGenerationSchema,
  expiresAt: z.number().int().positive(),
  cookieHeader: CookieHeaderSchema
})

/** Main → Utility：发放独立匿名凭据槽位，不需要正式账户探测。 */
export const GuestCredentialLeaseGrantCommandSchema = z.strictObject({
  kind: z.literal('auth.guest-lease.grant'),
  requestId: RequestIdSchema,
  leaseId: z.uuid(),
  accountId: z.literal('guest:local'),
  accountGeneration: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  cookieHeader: CookieHeaderSchema
})

export const CredentialLeaseRevokeCommandSchema = z.strictObject({
  kind: z.literal('auth.lease.revoke'),
  requestId: RequestIdSchema,
  leaseId: z.uuid().optional(),
  reason: z.enum(['logout', 'account-switch', 'expired', 'utility-shutdown', 'replaced'])
})

export const CredentialLogoutCommandSchema = z.strictObject({
  kind: z.literal('auth.logout'),
  requestId: RequestIdSchema,
  leaseId: z.uuid(),
  accountGeneration: AccountGenerationSchema
})

export const CredentialControlCommandSchema = z.discriminatedUnion('kind', [
  CredentialProbeCommandSchema,
  CredentialLeaseGrantCommandSchema,
  GuestCredentialLeaseGrantCommandSchema,
  CredentialLeaseRevokeCommandSchema,
  CredentialLogoutCommandSchema
])

export type CredentialControlCommand = z.infer<typeof CredentialControlCommandSchema>

export const CredentialProbeResultSchema = z.strictObject({
  kind: z.literal('auth.session.probe-result'),
  requestId: RequestIdSchema,
  valid: z.boolean(),
  accountId: AccountIdSchema.optional(),
  detailVerified: z.boolean(),
  displayName: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().optional(),
  reason: z.enum(['authenticated', 'missing-account', 'remote-unavailable']).optional()
})

export const CredentialLeaseAckSchema = z.strictObject({
  kind: z.literal('auth.lease.ack'),
  requestId: RequestIdSchema,
  leaseId: z.uuid().optional(),
  accepted: z.boolean()
})

export const CredentialLogoutResultSchema = z.strictObject({
  kind: z.literal('auth.logout-result'),
  requestId: RequestIdSchema,
  remoteAccepted: z.boolean()
})

export const CredentialControlFailureSchema = z.strictObject({
  kind: z.literal('auth.control-failure'),
  requestId: RequestIdSchema,
  code: z.enum(['INVALID_COMMAND', 'LEASE_MISMATCH', 'UTILITY_UNAVAILABLE'])
})

export const CredentialControlEventSchema = z.discriminatedUnion('kind', [
  CredentialProbeResultSchema,
  CredentialLeaseAckSchema,
  CredentialLogoutResultSchema,
  CredentialControlFailureSchema
])

export type CredentialControlEvent = z.infer<typeof CredentialControlEventSchema>
