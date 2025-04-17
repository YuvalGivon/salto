/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { validatePlainObject } from '@salto-io/adapter-utils'

/**
 * AdjustFunction that converts saved search from the get format to the post format of urlencoded.
 * @param isNew - If true, include the name field in the form data. If false, omit it.
 */
export const adjustSavedSearchToPostFormat =
  (isNew: boolean = true): definitions.AdjustFunction<definitions.deploy.ChangeAndExtendedContext> =>
  async ({ value }) => {
    validatePlainObject(value, 'saved_search')
    const description = _.get(value, 'content.description')
    const search = _.get(value, 'content.search')
    const name = _.get(value, 'name')
    const cronSchedule = _.get(value, 'content.cron_schedule')
    const disabled = _.get(value, 'content.disabled')
    const isScheduled = _.get(value, 'content.is_scheduled')
    const isVisible = _.get(value, 'content.is_visible')
    const schedulePriority = _.get(value, 'content.schedule_priority')
    const scheduleWindow = _.get(value, 'content.schedule_window')
    const workloadPool = _.get(value, 'content.workload_pool')
    const earliestTime = _.get(value, 'content["dispatch.earliest_time"]')
    const latestTime = _.get(value, 'content["dispatch.latest_time"]')

    // Create form data with or without the name field based on isNew parameter
    const formData = new URLSearchParams({
      description,
      search,
      cron_schedule: cronSchedule,
      disabled,
      is_scheduled: isScheduled,
      is_visible: isVisible,
      schedule_priority: schedulePriority,
      schedule_window: scheduleWindow,
      workload_pool: workloadPool,
      'dispatch.earliest_time': earliestTime,
      'dispatch.latest_time': latestTime,
    })

    if (isNew && name) {
      formData.append('name', name)
    }

    return {
      value: formData,
    }
  }
