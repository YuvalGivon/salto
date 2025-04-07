/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { fetch as fetchUtils } from '@salto-io/adapter-components'

const { recursiveNestedTypeName } = fetchUtils.element

type DefenderTypeName = `Defender${string}`

/* Field names */
export const ASSIGNMENTS_FIELD_NAME = 'assignments'

/* Type names */
export const TOP_LEVEL_TYPES = {
  INDICATOR_TYPE_NAME: 'DefenderIndicator',
  POLICY_TEMPLATE_TYPE_NAME: 'DefenderPolicyTemplate',
  ATTACK_SURFACE_REDUCTION_POLICY_TYPE_NAME: 'DefenderADRPolicy',
  ENDPOINT_DETECTION_AND_RESPONSE_POLICY_TYPE_NAME: 'DefenderEDRPolicy',
  ANTIVIRUS_POLICY_TYPE_NAME: 'DefenderAntivirusPolicy',
  FIREWALL_POLICY_TYPE_NAME: 'DefenderFirewallPolicy',
  DISK_ENCRYPTION_POLICY_TYPE_NAME: 'DefenderDiskEncryptionPolicy',
  ACCOUNT_PROTECTION_POLICY_TYPE_NAME: 'DefenderAccountProtectionPolicy',
} as const

// This anonymous function is only used for compile time validation.
// Once we upgrade to TS 4.9 or newer we can use the new `satisfies` syntax instead.
;(<T extends Record<string, DefenderTypeName>>(_value: T): void => {})(TOP_LEVEL_TYPES)

// Urls
export const SERVICE_BASE_URL = 'https://security.microsoft.com'

// Policies
export const POLICY_TYPE_TO_TEMPLATE_FAMILY_NAME: Record<string, string> = {
  [TOP_LEVEL_TYPES.ATTACK_SURFACE_REDUCTION_POLICY_TYPE_NAME]: 'endpointSecurityAttackSurfaceReduction',
  [TOP_LEVEL_TYPES.ENDPOINT_DETECTION_AND_RESPONSE_POLICY_TYPE_NAME]: 'endpointSecurityEndpointDetectionAndResponse',
  [TOP_LEVEL_TYPES.ANTIVIRUS_POLICY_TYPE_NAME]: 'endpointSecurityAntivirus',
  [TOP_LEVEL_TYPES.FIREWALL_POLICY_TYPE_NAME]: 'endpointSecurityFirewall',
  [TOP_LEVEL_TYPES.DISK_ENCRYPTION_POLICY_TYPE_NAME]: 'endpointSecurityDiskEncryption',
  [TOP_LEVEL_TYPES.ACCOUNT_PROTECTION_POLICY_TYPE_NAME]: 'endpointSecurityAccountProtection',
}

export const POLICY_TYPE_NAMES = Object.keys(POLICY_TYPE_TO_TEMPLATE_FAMILY_NAME)

export const POLICY_ASSIGNMENTS_NESTED_TYPE = POLICY_TYPE_NAMES.map(typeName =>
  recursiveNestedTypeName(typeName, ASSIGNMENTS_FIELD_NAME),
)
export const POLICY_ASSIGNMENT_TARGET_NESTED_TYPE = POLICY_TYPE_NAMES.map(typeName =>
  recursiveNestedTypeName(typeName, ASSIGNMENTS_FIELD_NAME, 'target'),
)
export const POLICY_SETTINGS_NESTED_TYPE = POLICY_TYPE_NAMES.map(typeName =>
  recursiveNestedTypeName(typeName, 'settings'),
)
