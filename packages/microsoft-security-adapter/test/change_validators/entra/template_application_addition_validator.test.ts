/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { MICROSOFT_SECURITY, entraConstants } from '../../../src/constants'
import { templateApplicationAdditionValidator } from '../../../src/change_validators/entra/template_application_addition_validator'

const {
  TOP_LEVEL_TYPES: { APPLICATION_TYPE_NAME },
} = entraConstants

describe(templateApplicationAdditionValidator.name, () => {
  describe('when the change is an addition change', () => {
    describe('when applicationTemplateId is defined', () => {
      it('should return an informational message', async () => {
        const applicationType = new ObjectType({
          elemID: new ElemID(MICROSOFT_SECURITY, APPLICATION_TYPE_NAME),
        })
        const application = new InstanceElement('testApplication', applicationType, {
          applicationTemplateId: 'some-id',
        })
        const changes = [
          toChange({
            after: application.clone(),
          }),
        ]
        const res = await templateApplicationAdditionValidator(changes)
        expect(res).toHaveLength(1)
        expect(res).toEqual([
          {
            elemID: application.elemID,
            severity: 'Info',
            message: 'Additional resources may be created automatically.',
            detailedMessage:
              'When creating an application from a template, the following resources may be created automatically: ' +
              'a Service Principal (Enterprise Application), App Roles, and OAuth2 Permission Scopes',
          },
        ])
      })
    })

    describe('when applicationTemplateId is not defined', () => {
      it('should not return an error', async () => {
        const applicationType = new ObjectType({
          elemID: new ElemID(MICROSOFT_SECURITY, APPLICATION_TYPE_NAME),
        })
        const application = new InstanceElement('testApplication', applicationType, {})
        const changes = [
          toChange({
            after: application.clone(),
          }),
        ]
        const res = await templateApplicationAdditionValidator(changes)
        expect(res).toHaveLength(0)
      })
    })
  })

  describe.each(['modification', 'removal'])('when the change is a %s change', changeType => {
    it('should not return an error', async () => {
      const applicationType = new ObjectType({
        elemID: new ElemID(MICROSOFT_SECURITY, APPLICATION_TYPE_NAME),
      })
      const application = new InstanceElement('testApplication', applicationType, {
        applicationTemplateId: 'some-id',
      })
      const changes =
        changeType === 'modification'
          ? [
              toChange({
                before: application.clone(),
                after: application.clone(),
              }),
            ]
          : [
              toChange({
                before: application.clone(),
              }),
            ]
      const res = await templateApplicationAdditionValidator(changes)
      expect(res).toHaveLength(0)
    })
  })
})
