/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { QUICK_ACTION_METADATA_TYPE, SALESFORCE } from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'

const accessToSendEmailsError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message:
    "Cannot deploy instances of 'emailActions' when 'Access to Send Email (All Email Services)' is not set to 'All email'",
  detailedMessage:
    "In order to deploy, you can go to the service at your target environment, go to setup, in the 'quick find' box search for 'Deliverability', choose it and change the 'Access to Send Email (All Email Services)' to 'All email'",
})

const changeValidator: ChangeValidator = async (changes, elementSource) => {
  const elements = changes.map(getChangeData).filter(isInstanceOfTypeSync(QUICK_ACTION_METADATA_TYPE))
  const emailSettings = await elementSource?.get(new ElemID(SALESFORCE, 'EmailAdministrationSettings', 'instance'))
  if (
    isInstanceElement(emailSettings) &&
    // When 'Access to Send Email (All Email Services)' under 'Deliverability' in the Salesforce UI (setup) is set to 'All email', the 'EmailAdministrationSettings' instance contains the following fields.
    // When it is set to 'No access' or 'System email only', the 'EmailAdministrationSettings' instance doesn't contain the following fields and they aren't visible in the UI.
    // Only when the 'Access to Send Email (All Email Services)' is set to 'All email' we can deploy (and fetch, but not relevant here) the QuickAction type.
    emailSettings.value.enableSendViaGmailPref === undefined &&
    emailSettings.value.enableSendViaExchangePref === undefined
  ) {
    return elements.map(accessToSendEmailsError)
  }
  return []
}

export default changeValidator
