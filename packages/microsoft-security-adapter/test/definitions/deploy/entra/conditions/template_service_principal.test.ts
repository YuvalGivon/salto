/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, ReferenceExpression, ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import { isTemplateServicePrincipal } from '../../../../../src/definitions/deploy/entra/conditions/template_service_principal'
import { MICROSOFT_SECURITY, entraConstants } from '../../../../../src/constants'
import { contextMock } from '../../../../mocks'

describe('template application service principal conditions', () => {
  const applicationTemplateType = new ObjectType({
    elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.APPLICATION_TEMPLATE_TYPE_NAME),
  })
  const applicationType = new ObjectType({
    elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME),
  })
  const servicePrincipalType = new ObjectType({
    elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.SERVICE_PRINCIPAL_TYPE_NAME),
  })

  describe(`${isTemplateServicePrincipal.name}`, () => {
    describe("when the service principal's appId is not a reference", () => {
      it('should return false', () => {
        const servicePrincipal = new InstanceElement('test_sp', servicePrincipalType, {
          appId: 'some-id',
        })
        const spChange = toChange({ after: servicePrincipal })
        expect(isTemplateServicePrincipal({ ...contextMock, change: spChange })).toEqual(false)
      })
    })

    describe("when the service principal's appId is a reference", () => {
      describe('when the referenced app is a template application', () => {
        it('should return true', () => {
          const appTemplate = new InstanceElement('test_app_template', applicationTemplateType, {
            id: 'template-123',
          })
          const app = new InstanceElement('test_app', applicationType, {
            applicationTemplateId: new ReferenceExpression(appTemplate.elemID, appTemplate),
          })
          const sp = new InstanceElement('test_sp', servicePrincipalType, {
            appId: new ReferenceExpression(app.elemID, app),
          })
          const spChange = toChange({ after: sp })
          expect(isTemplateServicePrincipal({ ...contextMock, change: spChange })).toEqual(true)
        })
      })

      describe('when the referenced app is not a template application', () => {
        it('should return false', () => {
          const app = new InstanceElement('test_app', applicationType, {
            someOtherField: 'some-value',
          })
          const sp = new InstanceElement('test_sp', servicePrincipalType, {
            appId: new ReferenceExpression(app.elemID, app),
          })
          const spChange = toChange({ after: sp })
          expect(isTemplateServicePrincipal({ ...contextMock, change: spChange })).toEqual(false)
        })
      })
    })
  })
})
