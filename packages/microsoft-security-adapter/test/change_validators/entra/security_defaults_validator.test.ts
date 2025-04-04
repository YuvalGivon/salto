/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { MICROSOFT_SECURITY, entraConstants } from '../../../src/constants'
import { securityDefaultsEnabledValidator } from '../../../src/change_validators/entra/security_defaults_validator'

const {
  TOP_LEVEL_TYPES: { SECURITY_DEFAULTS_TYPE_NAME, CONDITIONAL_ACCESS_POLICY_TYPE_NAME, GROUP_TYPE_NAME },
} = entraConstants

describe(securityDefaultsEnabledValidator.name, () => {
  describe('when security defaults are enabled', () => {
    it('should return an error when adding a conditional access policy', async () => {
      const securityDefaultsType = new ObjectType({
        elemID: new ElemID(MICROSOFT_SECURITY, SECURITY_DEFAULTS_TYPE_NAME),
      })
      const securityDefaults = new InstanceElement('testSecurityDefaults', securityDefaultsType, {
        isEnabled: true,
      })

      const conditionalAccessPolicyType = new ObjectType({
        elemID: new ElemID(MICROSOFT_SECURITY, CONDITIONAL_ACCESS_POLICY_TYPE_NAME),
      })
      const conditionalAccessPolicy = new InstanceElement('testPolicy', conditionalAccessPolicyType, {})

      const changes = [
        toChange({
          after: conditionalAccessPolicy.clone(),
        }),
      ]

      const elementsSource = buildElementsSourceFromElements([securityDefaults])

      const res = await securityDefaultsEnabledValidator(changes, elementsSource)
      expect(res).toHaveLength(1)
      expect(res).toEqual([
        {
          elemID: conditionalAccessPolicy.elemID,
          severity: 'Error',
          message: 'Cannot add conditional access policy when security defaults are enabled.',
          detailedMessage:
            'Conditional access policies are not supported when security defaults are enabled. Disable security defaults to add a conditional access policy.',
        },
      ])
    })
    it('should not return error when adding other type', async () => {
      const securityDefaultsType = new ObjectType({
        elemID: new ElemID(MICROSOFT_SECURITY, SECURITY_DEFAULTS_TYPE_NAME),
      })
      const securityDefaults = new InstanceElement('testSecurityDefaults', securityDefaultsType, {
        isEnabled: true,
      })

      const groupType = new ObjectType({
        elemID: new ElemID(MICROSOFT_SECURITY, GROUP_TYPE_NAME),
      })
      const group = new InstanceElement('testGroup', groupType, {})

      const changes = [
        toChange({
          after: group.clone(),
        }),
      ]

      const elementsSource = buildElementsSourceFromElements([securityDefaults])

      const res = await securityDefaultsEnabledValidator(changes, elementsSource)
      expect(res).toHaveLength(0)
    })
  })

  describe('when security defaults are disabled', () => {
    it('should not return an error when adding a conditional access policy', async () => {
      const securityDefaultsType = new ObjectType({
        elemID: new ElemID(MICROSOFT_SECURITY, SECURITY_DEFAULTS_TYPE_NAME),
      })
      const securityDefaults = new InstanceElement('testSecurityDefaults', securityDefaultsType, {
        isEnabled: false,
      })

      const conditionalAccessPolicyType = new ObjectType({
        elemID: new ElemID(MICROSOFT_SECURITY, CONDITIONAL_ACCESS_POLICY_TYPE_NAME),
      })
      const conditionalAccessPolicy = new InstanceElement('testPolicy', conditionalAccessPolicyType, {})

      const changes = [
        toChange({
          after: conditionalAccessPolicy.clone(),
        }),
      ]

      const elementsSource = buildElementsSourceFromElements([securityDefaults])

      const res = await securityDefaultsEnabledValidator(changes, elementsSource)
      expect(res).toHaveLength(0)
    })
  })
})
