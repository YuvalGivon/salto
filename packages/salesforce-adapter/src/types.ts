/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { WeakReferencesHandler as ComponentsWeakReferencesHandler } from '@salto-io/adapter-components'
import * as constants from './constants'
import { SalesforceConfig } from './config/types'

// Based on the list in https://salesforce.stackexchange.com/questions/101844/what-are-the-object-and-field-name-suffixes-that-salesforce-uses-such-as-c-an
export const INSTANCE_SUFFIXES = [
  'c',
  'r',
  'ka',
  'kav',
  'Feed',
  'ViewStat',
  'VoteStat',
  'DataCategorySelection',
  'x',
  'xo',
  'mdt',
  'Share',
  'Tag',
  'History',
  'pc',
  'pr',
  'hd',
  'hqr',
  'hst',
  'b',
  'latitude__s',
  'longitude__s',
  'e',
  'p',
  'ChangeEvent',
  'chn',
  'gvs',
]

export type MetadataInstance = {
  metadataType: string
  namespace: string
  name: string
  isFolderType: boolean
  changedAt: string | undefined
}

export type TypeWithNestedInstances = (typeof constants.TYPES_WITH_NESTED_INSTANCES)[number]
export type TypeWithNestedInstancesPerParent = (typeof constants.TYPES_WITH_NESTED_INSTANCES_PER_PARENT)[number]
export type LastChangeDateOfTypesWithNestedInstances = {
  [key in TypeWithNestedInstancesPerParent]: Record<string, string>
} & {
  [key in TypeWithNestedInstances]: string | undefined
}

export type ProfileRelatedMetadataType = (typeof constants.PROFILE_RELATED_METADATA_TYPES)[number]

export type WeakReferencesHandler = ComponentsWeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
  config: SalesforceConfig
}>

export enum ProfileSection {
  ApplicationVisibilities = 'applicationVisibilities',
  CategoryGroupVisibilities = 'categoryGroupVisibilities',
  ClassAccesses = 'classAccesses',
  CustomMetadataTypeAccesses = 'customMetadataTypeAccesses',
  CustomPermissions = 'customPermissions',
  CustomSettingAccesses = 'customSettingAccesses',
  ExternalDataSourceAccesses = 'externalDataSourceAccesses',
  FieldPermissions = 'fieldPermissions',
  FlowAccesses = 'flowAccesses',
  LayoutAssignments = 'layoutAssignments',
  ObjectPermissions = 'objectPermissions',
  PageAccesses = 'pageAccesses',
  RecordTypeVisibilities = 'recordTypeVisibilities',
  TabVisibilities = 'tabVisibilities',
  UserPermissions = 'userPermissions',
}
