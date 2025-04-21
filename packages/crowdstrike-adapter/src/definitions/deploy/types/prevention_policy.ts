/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { getParents, validatePlainObject } from '@salto-io/adapter-utils'
import { getChangeData, isAdditionChange, isModificationChange, Value, isEqualValues } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { ClientOptions } from '../../types'

export const reformatForDeploy: definitions.AdjustFunction<definitions.deploy.ChangeAndExtendedContext> = async ({
  context,
  value,
}) => {
  // The PreventionPolicy patch API expects a different format than what we get when fetching. This
  // function transforms the value to the expected format.
  // Specifically, PreventionPolicy has prevention_settings that contains sections. For deploy, we
  // need to flatten this to include settings directly on the top level, and change the array name to
  // settings. We also only want to include settings that have changed.
  // Setting IDs are a closed list and are unique across all sections.
  validatePlainObject(value, 'PreventionPolicy')
  const getSettings = (val: Value): Record<string, Value> =>
    _.keyBy(
      _.flatMap(val?.prevention_settings, (section: Value) => {
        validatePlainObject(section, 'PreventionPolicy section')
        return section?.settings
      }),
      (item: Value): string => item?.id,
    )
  const beforeSettings = isModificationChange(context.change) ? getSettings(context.change.data.before.value) : {}
  const afterSettings = getSettings(value)

  const settings = Object.keys(afterSettings)
    .filter(key => !isEqualValues(beforeSettings[key]?.value, afterSettings[key].value))
    .map(key => ({ id: key, value: afterSettings[key].value }))

  const fieldsToPick = isAdditionChange(context.change)
    ? ['name', 'description', 'platform_name']
    : ['id', 'name', 'description']
  return {
    value: {
      resources: [{ ..._.pick(value, fieldsToPick), settings }],
    },
  }
}

export const adjustPreventionPolicyAction =
  (actionParamName?: string): definitions.AdjustFunction<definitions.deploy.ChangeAndExtendedContext> =>
  async ({ value, context }) => {
    validatePlainObject(value, 'PreventionPolicy subresource')
    // TODO(SALTO-7761): Change to use `getParent`.
    const parent = getParents(getChangeData(context.change))[0]
    return {
      value: {
        ids: [parent.value.id],
        action_parameters: [
          {
            name: actionParamName,
            value: value?.id,
          },
        ],
      },
    }
  }

const addEnabledActionStringToContext =
  () =>
  ({ change }: definitions.deploy.ChangeAndExtendedContext): Record<string, unknown> => ({
    action: getChangeData(change).value.enabled === true ? 'enable' : 'disable',
  })

export const enablementRequest: definitions.deploy.DeployRequestDefinition<ClientOptions> = {
  transformation: {
    adjust: async ({ value }) => {
      validatePlainObject(value, 'PreventionPolicy')
      return {
        value: {
          ids: [value.id],
        },
      }
    },
  },
  endpoint: {
    path: '/policy/entities/prevention-actions/v1',
    method: 'post',
    queryArgs: {
      action_name: '{action}',
    },
  },
  context: {
    custom: addEnabledActionStringToContext,
  },
}
