/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  BuiltinTypes,
  Change,
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { QUICK_ACTION_METADATA_TYPE, SALESFORCE } from '../../src/constants'
import { createInstanceElement } from '../../src/transformers/transformer'
import changeValidator from '../../src/change_validators/access_to_send_email'

const createQuickEmailElementChanges = (): Change[] => [
  toChange({
    after: new InstanceElement(
      QUICK_ACTION_METADATA_TYPE,
      new ObjectType({ elemID: new ElemID(SALESFORCE, QUICK_ACTION_METADATA_TYPE) }),
    ),
  }),
]

describe('access to send email CV', () => {
  const emailSettingsObjectType = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'EmailAdministrationSettings'),
    fields: {
      enableSendViaGmailPref: { refType: BuiltinTypes.BOOLEAN },
      enableSendViaExchangePref: { refType: BuiltinTypes.BOOLEAN },
      someOtherField: { refType: BuiltinTypes.STRING },
    },
    isSettings: true,
  })
  let elementsSource: ReadOnlyElementsSource
  describe("when 'Access to Send Email (All Email Services)' is set to 'All email'", () => {
    beforeEach(() => {
      const emailSettingsInstance = createInstanceElement(
        {
          fullName: 'noname',
          enableSendViaGmailPref: false,
          enableSendViaExchangePref: false,
        },
        emailSettingsObjectType,
      )
      elementsSource = buildElementsSourceFromElements([emailSettingsInstance, emailSettingsObjectType])
    })
    it('should return no errors', async () => {
      const errors = await changeValidator(createQuickEmailElementChanges(), elementsSource)
      expect(errors).toBeEmpty()
    })
  })
  describe("when 'Access to Send Email (All Email Services)' is set to 'No access' or 'System email only'", () => {
    beforeEach(() => {
      const emailSettingsInstance = createInstanceElement(
        {
          fullName: 'noname',
        },
        emailSettingsObjectType,
      )
      elementsSource = buildElementsSourceFromElements([emailSettingsInstance, emailSettingsObjectType])
    })
    it('should return an error for each email type', async () => {
      const errors = await changeValidator(createQuickEmailElementChanges(), elementsSource)
      expect(errors).toHaveLength(1)
    })
  })
})
