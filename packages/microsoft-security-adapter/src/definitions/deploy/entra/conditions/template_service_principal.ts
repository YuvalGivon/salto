/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { getChangeData, isReferenceExpression } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'

/**
 * Base condition to check if a service principal is for a template application.
 * Returns true if appId is a reference to an application with applicationTemplateId defined.
 */
export const isTemplateServicePrincipal = ({ change }: definitions.deploy.ChangeAndExtendedContext): boolean => {
  const servicePrincipal = getChangeData(change)
  const { appId } = servicePrincipal.value

  if (isReferenceExpression(appId)) {
    const referencedApp = appId.value
    return referencedApp.value.applicationTemplateId !== undefined
  }

  // If the appId is not a reference, it is not a template application
  return false
}
