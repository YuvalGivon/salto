/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isRemovalChange,
  RemovalChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { JiraConfig } from '../config/config'
import { ISSUE_TYPE_NAME } from '../constants'
import JiraClient from '../client/client'

const { awu } = collections.asynciterable

const log = logger(module)

const isIssueTypeUsed = async (
  instance: InstanceElement,
  client: JiraClient,
  useJqlSearch: boolean,
): Promise<boolean> => {
  let response: clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>
  try {
    response = await client.get({
      url: useJqlSearch ? '/rest/api/3/search/jql' : '/rest/api/3/search',
      queryParams: {
        jql: `issuetype = "${instance.value.name}"`,
        maxResults: useJqlSearch ? '1' : '0',
      },
    })
  } catch (e) {
    log.error(
      `Received an error Jira search API, ${e.message}. Assuming issue type ${instance.elemID.getFullName()} has no issues.`,
    )
    return false
  }

  if (useJqlSearch) {
    if (Array.isArray(response.data) || !Array.isArray(response.data.issues)) {
      log.error(
        `Received invalid response from Jira search API, ${safeJsonStringify(response.data, undefined, 2)}. Assuming issue type ${instance.elemID.getFullName()} has no issues.`,
      )
      return false
    }

    const { issues } = response.data
    const hasIssues = issues.length > 0
    log.debug(`Issue type ${instance.elemID.getFullName()} has ${hasIssues ? '' : 'no'} issues.`)

    return hasIssues
  }

  if (Array.isArray(response.data) || response.data.total === undefined) {
    log.error(
      `Received invalid response from Jira search API, ${safeJsonStringify(response.data, undefined, 2)}. Assuming issue type ${instance.elemID.getFullName()} has no issues.`,
    )
    return false
  }

  log.debug(`Issue type ${instance.elemID.getFullName()} has ${response.data.total} issues.`)

  return response.data.total !== 0
}
const getRelevantChanges = (changes: ReadonlyArray<Change>): RemovalChange<InstanceElement>[] =>
  changes
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .filter(change => getChangeData(change).elemID.typeName === ISSUE_TYPE_NAME)

const getRemovedIssueTypeUsedError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error' as SeverityLevel,
  message: 'Cannot remove issue type with existing issues.',
  detailedMessage:
    'There are existing issues of this issue type. You must delete them before you can delete the issue type itself.',
})

export const issueTypeDeletionValidator: (client: JiraClient, config: JiraConfig) => ChangeValidator =
  (client, config) => async changes => {
    const relevantChanges = getRelevantChanges(changes)
    const useJqlSearch = config.fetch.useJqlSearch === true
    return awu(relevantChanges)
      .map(getChangeData)
      .filter(instance => isIssueTypeUsed(instance, client, useJqlSearch))
      .map(getRemovedIssueTypeUsedError)
      .toArray()
  }
