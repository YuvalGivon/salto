/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeDataType,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isModificationChange,
  ModificationChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { JiraConfig } from '../config/config'
import JiraClient from '../client/client'
import { PROJECT_TYPE } from '../constants'
import { doesProjectHaveIssues } from './projects/project_deletion'

const { awu } = collections.asynciterable

const RELEVANT_FIELDS = ['priorityScheme', 'workflowScheme', 'issueTypeScheme']
type RelevantField = (typeof RELEVANT_FIELDS)[number]
const FIELD_FORMATS: Record<RelevantField, string> = {
  priorityScheme: 'priority scheme',
  workflowScheme: 'workflow scheme',
  issueTypeScheme: 'issue type scheme',
}

const projectSchemeChanged = (change: ModificationChange<InstanceElement>): RelevantField[] => {
  const { before, after } = change.data
  const changedFields = RELEVANT_FIELDS.filter(
    field => before.value[field] instanceof ReferenceExpression && after.value[field] instanceof ReferenceExpression,
  ).filter(type => !before.value[type].elemID.isEqual(after.value[type].elemID))
  return changedFields
}

const getRelevantChanges = async (
  changes: ReadonlyArray<Change<ChangeDataType>>,
  client: JiraClient,
  useJqlSearch: boolean,
): Promise<ModificationChange<InstanceElement>[]> =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === PROJECT_TYPE)
    .filter(change => projectSchemeChanged(change).length > 0)
    .filter(async change => doesProjectHaveIssues(getChangeData(change), client, useJqlSearch))
    .toArray()

const getChangeErrorForChange = (change: ModificationChange<InstanceElement>): ChangeError[] => {
  const changedFields = projectSchemeChanged(change)
  return changedFields.map(field => ({
    elemID: getChangeData(change).elemID,
    severity: 'Error',
    message: `Can’t replace non-empty project ${FIELD_FORMATS[field]}`,
    detailedMessage: `Salto cannot change ${FIELD_FORMATS[field]} for a project with existing issues. To perform this action manually, you can use the Jira interface. This will allow you to migrate the necessary issues.`,
  }))
}

export const activeSchemeChangeValidator =
  (client: JiraClient, config: JiraConfig): ChangeValidator =>
  async changes => {
    const useJqlSearch = config.fetch.useJqlSearch === true
    const relevantChanges = await getRelevantChanges(changes, client, useJqlSearch)
    return relevantChanges.flatMap(getChangeErrorForChange)
  }
