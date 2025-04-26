/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { definitions } from '@salto-io/adapter-components'
import { Credentials } from '../../auth'
import { Options } from '../types'
import { SAVED_SEARCH_TYPE_NAME } from '../../constants'

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = {
  // hide
  created_at: {
    hide: true,
  },
  updated_at: {
    hide: true,
  },
  created_by_id: {
    hide: true,
  },
  updated_by_id: {
    hide: true,
  },
  updated: {
    hide: true,
  },
  created: {
    hide: true,
  },

  // omit
  links: {
    omit: true,
  },
}

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  [SAVED_SEARCH_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/services/saved/searches',
          queryArgs: {
            output_mode: 'json',
          },
        },
        transformation: {
          root: 'entry',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['name'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        alias: { aliasComponents: [NAME_ID_FIELD] },
        serviceUrl: {
          path: '', // this part is ignored
          custom:
            ({ baseUrl }) =>
            value => {
              const encodedName = encodeURIComponent(value.name)
              return new URL(`/en-US/app/search/report?s=${encodedName}`, baseUrl).href
            },
        },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
        // TODO: SALTO-7699 we need to understand if it is interesting as read only data
        acl: {
          hide: true,
        },
        author: {
          hide: true,
        },
      },
    },
  },
  saved_search__content: {
    element: {
      fieldCustomizations: {
        vsid: {
          omit: true,
        },
        'durable_lag_time@vu': {
          omit: true,
        },
        'durable_backfill_type@vu': {
          omit: true,
        },
        'durable_max_backfill_intervals@vuu': {
          omit: true,
        },
        'durable_track_time_type@vuu': {
          omit: true,
        },
        'eai_acl@f': {
          omit: true,
        },
        'embed_enabled@v': { omit: true },
        schedule_as: { omit: true },
        // schedule_priority: { omit: true },
        // schedule_window: { omit: true },
        dispatchAs: { omit: true },
        displayview: { omit: true },
        'action_email_useNSSubject@v': { omit: true },
        'action_webhook_enable_allowlist@vvu': { omit: true },
        next_scheduled_time: { omit: true },
        realtime_schedule: { omit: true },
        restart_on_searchpeer_add: { omit: true },
        'request_ui_dispatch_app@vuu': {
          omit: true,
        },
        'request_ui_dispatch_view@vuu': {
          omit: true,
        },
        'dispatch_allow_partial_results@vuu': {
          omit: true,
        },
        'dispatch_auto_cancel@vu': {
          omit: true,
        },
        'dispatch_auto_pause@vu': {
          omit: true,
        },
        'dispatch_buckets@v': {
          omit: true,
        },
        'dispatch_indexedRealtimeMinSpan@v': {
          omit: true,
        },
        'dispatch_indexedRealtimeOffset@v': {
          omit: true,
        },
        'dispatch_lookups@v': {
          omit: true,
        },
        'dispatch_max_count@vu': { omit: true },
        'dispatch_reduce_freq@vu': { omit: true },
        'dispatch_rt_backfill@vu': { omit: true },
        'dispatch_rt_maximum_span@vuu': { omit: true },
        'dispatch_sample_ratio@vu': { omit: true },
        'dispatch_spawn_process@vu': { omit: true },
        'dispatch_time_format@vu': { omit: true },
        'dispatch_ttl@v': { omit: true },
        'display_events_fields@v': { omit: true },
        'display_events_list_drilldown@v': { omit: true },
        'display_events_list_wrap@v': { omit: true },
        'display_events_maxLines@v': { omit: true },
        'display_events_raw_drilldown@v': { omit: true },
        'display_events_rowNumbers@v': { omit: true },
        'display_events_table_drilldown@v': { omit: true },
        'display_events_table_wrap@v': { omit: true },
        'display_events_type@v': { omit: true },
        'display_general_enablePreview@v': { omit: true },
        'display_general_migratedFromViewState@v': { omit: true },
        'display_general_timeRangePicker_show@v': { omit: true },
        'display_general_type@v': { omit: true },
        'display_page_search_mode@v': { omit: true },
        'display_page_search_patterns_sensitivity@v': { omit: true },
        'display_page_search_showFields@v': { omit: true },
        'display_page_search_tab@v': { omit: true },
        'display_page_search_timeline_format@v': { omit: true },
        'display_page_search_timeline_scale@v': { omit: true },
        'display_statistics_drilldown@v': { omit: true },
        'display_statistics_overlay@v': { omit: true },
        'display_statistics_percentagesRow@v': { omit: true },
        'display_statistics_rowNumbers@v': { omit: true },
        'display_statistics_show@v': { omit: true },
        'display_statistics_totalsRow@v': { omit: true },
        'display_statistics_wrap@v': { omit: true },
        'display_visualizations_chartHeight@v': { omit: true },
        'display_visualizations_charting_axisLabelsX_majorLabelStyle_overflowMode@v': { omit: true },
        'display_visualizations_charting_axisLabelsX_majorLabelStyle_rotation@v': { omit: true },
        'display_visualizations_charting_axisLabelsX_majorUnit@v': { omit: true },
        'display_visualizations_charting_axisLabelsY_majorUnit@v': { omit: true },
        'display_visualizations_charting_axisLabelsY2_majorUnit@v': { omit: true },
        'display_visualizations_charting_axisTitleX_text@v': { omit: true },
        'display_visualizations_charting_axisTitleX_visibility@v': { omit: true },
        'display_visualizations_charting_axisTitleY_text@v': { omit: true },
        'display_visualizations_charting_axisTitleY_visibility@v': { omit: true },
        'display_visualizations_charting_axisTitleY2_text@v': { omit: true },
        'display_visualizations_charting_axisTitleY2_visibility@v': { omit: true },
        'display_visualizations_charting_axisX_abbreviation@v': { omit: true },
        'display_visualizations_charting_axisX_maximumNumber@v': { omit: true },
        'display_visualizations_charting_axisX_minimumNumber@v': { omit: true },
        'display_visualizations_charting_axisX_scale@v': { omit: true },
        'display_visualizations_charting_axisY_abbreviation@v': { omit: true },
        'display_visualizations_charting_axisY_maximumNumber@v': { omit: true },
        'display_visualizations_charting_axisY_minimumNumber@v': { omit: true },
        'display_visualizations_charting_axisY_scale@v': { omit: true },
        'display_visualizations_charting_axisY2_abbreviation@v': { omit: true },
        'display_visualizations_charting_axisY2_enabled@v': { omit: true },
        'display_visualizations_charting_axisY2_maximumNumber@v': { omit: true },
        'display_visualizations_charting_axisY2_minimumNumber@v': { omit: true },
        'display_visualizations_charting_axisY2_scale@v': { omit: true },
        'display_visualizations_charting_chart@v': { omit: true },
        'display_visualizations_charting_chart_bubbleMaximumSize@v': { omit: true },
        'display_visualizations_charting_chart_bubbleMinimumSize@v': { omit: true },
        'display_visualizations_charting_chart_bubbleSizeBy@v': { omit: true },
        'display_visualizations_charting_chart_nullValueMode@v': { omit: true },
        'display_visualizations_charting_chart_overlayFields@v': { omit: true },
        'display_visualizations_charting_chart_rangeValues@v': { omit: true },
        'display_visualizations_charting_chart_showDataLabels@v': { omit: true },
        'display_visualizations_charting_chart_sliceCollapsingThreshold@v': { omit: true },
        'display_visualizations_charting_chart_stackMode@v': { omit: true },
        'display_visualizations_charting_chart_style@v': { omit: true },
        'display_visualizations_charting_drilldown@v': { omit: true },
        'display_visualizations_charting_fieldColors@v': { omit: true },
        'display_visualizations_charting_fieldDashStyles@v': { omit: true },
        'display_visualizations_charting_gaugeColors@v': { omit: true },
        'display_visualizations_charting_layout_splitSeries@v': { omit: true },
        'display_visualizations_charting_layout_splitSeries_allowIndependentYRanges@v': { omit: true },
        'display_visualizations_charting_legend_labelStyle_overflowMode@v': { omit: true },
        'display_visualizations_charting_legend_mode@v': { omit: true },
        'display_visualizations_charting_legend_placement@v': { omit: true },
        'display_visualizations_charting_lineWidth@v': { omit: true },
        'display_visualizations_custom_drilldown@v': { omit: true },
        'display_visualizations_custom_height@v': { omit: true },
        'display_visualizations_custom_type@v': { omit: true },
        'display_visualizations_mapHeight@v': { omit: true },
        'display_visualizations_mapping_choroplethLayer_colorBins@v': { omit: true },
        'display_visualizations_mapping_choroplethLayer_colorMode@v': { omit: true },
        'display_visualizations_mapping_choroplethLayer_maximumColor@v': { omit: true },
        'display_visualizations_mapping_choroplethLayer_minimumColor@v': { omit: true },
        'display_visualizations_mapping_choroplethLayer_neutralPoint@v': { omit: true },
        'display_visualizations_mapping_choroplethLayer_shapeOpacity@v': { omit: true },
        'display_visualizations_mapping_choroplethLayer_showBorder@v': { omit: true },
        'display_visualizations_mapping_data_maxClusters@v': { omit: true },
        'display_visualizations_mapping_drilldown@v': { omit: true },
        'display_visualizations_mapping_legend_placement@v': { omit: true },
        'display_visualizations_mapping_map_center@v': { omit: true },
        'display_visualizations_mapping_map_panning@v': { omit: true },
        'display_visualizations_mapping_map_scrollZoom@v': { omit: true },
        'display_visualizations_mapping_map_zoom@v': { omit: true },
        'display_visualizations_mapping_markerLayer_markerMaxSize@v': { omit: true },
        'display_visualizations_mapping_markerLayer_markerMinSize@v': { omit: true },
        'display_visualizations_mapping_markerLayer_markerOpacity@v': { omit: true },
        'display_visualizations_mapping_showTiles@v': { omit: true },
        'display_visualizations_mapping_tileLayer_maxZoom@v': { omit: true },
        'display_visualizations_mapping_tileLayer_minZoom@v': { omit: true },
        'display_visualizations_mapping_tileLayer_tileOpacity@v': { omit: true },
        'display_visualizations_mapping_tileLayer_url@v': { omit: true },
        'display_visualizations_mapping_type@v': { omit: true },
        'display_visualizations_show@v': { omit: true },
        'display_visualizations_singlevalue_afterLabel@v': { omit: true },
        'display_visualizations_singlevalue_beforeLabel@v': { omit: true },
        'display_visualizations_singlevalue_colorBy@v': { omit: true },
        'display_visualizations_singlevalue_colorMode@v': { omit: true },
        'display_visualizations_singlevalue_drilldown@v': { omit: true },
        'display_visualizations_singlevalue_numberPrecision@v': { omit: true },
        'display_visualizations_singlevalue_rangeColors@v': { omit: true },
        'display_visualizations_singlevalue_rangeValues@v': { omit: true },
        'display_visualizations_singlevalue_showSparkline@v': { omit: true },
        'display_visualizations_singlevalue_showTrendIndicator@v': { omit: true },
        'display_visualizations_singlevalue_trendColorInterpretation@v': { omit: true },
        'display_visualizations_singlevalue_trendDisplayMode@v': { omit: true },
        'display_visualizations_singlevalue_trendInterval@v': { omit: true },
        'display_visualizations_singlevalue_underLabel@v': { omit: true },
        'display_visualizations_singlevalue_unit@v': { omit: true },
        'display_visualizations_singlevalue_unitPosition@v': { omit: true },
        'display_visualizations_singlevalue_useColors@v': { omit: true },
        'display_visualizations_singlevalue_useThousandSeparators@v': { omit: true },
        'display_visualizations_singlevalueHeight@v': { omit: true },
        'display_visualizations_trellis_enabled@v': { omit: true },
        'display_visualizations_trellis_scales_shared@v': { omit: true },
        'display_visualizations_trellis_size@v': { omit: true },
        'display_visualizations_trellis_splitBy@v': { omit: true },
        'display_visualizations_type@v': { omit: true },
        'dispatch_index_earliest@vu': { omit: true },
        'dispatch_index_latest@vu': { omit: true },
        'dispatch_max_time@vu': { omit: true },
        'dispatch_rate_limit_retry@vuu': { omit: true },

        'action_email@v': {
          omit: true,
        },
        'action_email_to@v': {
          omit: true,
        },
        'action_populate_lookup@vu': {
          omit: true,
        },
        'action_rss@v': {
          omit: true,
        },
        'action_script@v': {
          omit: true,
        },
        'action_summary_index@vu': {
          omit: true,
        },
        'action_summary_index_force_realtime_schedule@vuvuu': {
          omit: true,
        },
        actions: {
          omit: true,
        },
        'alert_digest_mode@vu': {
          omit: true,
        },
        'alert_expires@v': {
          omit: true,
        },
        'alert_managedBy@v': {
          omit: true,
        },
        'alert_severity@v': {
          omit: true,
        },
        'alert_suppress_fields@v': {
          omit: true,
        },
        'alert_suppress_group_name@vvu': {
          omit: true,
        },
        'alert_suppress_period@v': {
          omit: true,
        },
        'alert_track@v': {
          omit: true,
        },
        alert_comparator: {
          omit: true,
        },
        alert_condition: {
          omit: true,
        },
        alert_threshold: {
          omit: true,
        },
        alert_type: {
          omit: true,
        },
        allow_skew: {
          omit: true,
        },
        auto_summarize: {
          omit: true,
        },
        'auto_summarize_command@uv': {
          omit: true,
        },
        'auto_summarize_cron_schedule@uvu': {
          omit: true,
        },
        'auto_summarize_dispatch_earliest_time@uvvu': {
          omit: true,
        },
        'auto_summarize_dispatch_latest_time@uvvu': {
          omit: true,
        },
        'auto_summarize_dispatch_time_format@uvvu': {
          omit: true,
        },
        'auto_summarize_dispatch_ttl@uvv': {
          omit: true,
        },
        'auto_summarize_max_concurrent@uvu': {
          omit: true,
        },
        'auto_summarize_max_disabled_buckets@uvuu': {
          omit: true,
        },
        'auto_summarize_max_summary_ratio@uvuu': {
          omit: true,
        },
        'auto_summarize_max_summary_size@uvuu': {
          omit: true,
        },
        'auto_summarize_max_time@uvu': {
          omit: true,
        },
        'auto_summarize_suspend_period@uvu': {
          omit: true,
        },
        'auto_summarize_timespan@uv': {
          omit: true,
        },
        'auto_summarize_workload_pool@uvu': {
          omit: true,
        },
        calculate_alert_required_fields_in_search: {
          omit: true,
        },
        'action_logevent@v': {
          omit: true,
        },
        'action_logevent_param_event@v': {
          omit: true,
        },
        'alert_suppress@v': {
          omit: true,
        },

        defer_scheduled_searchable_idxc: {
          omit: true,
        },
        max_concurrent: {
          omit: true,
        },
        precalculate_required_fields_for_alerts: {
          omit: true,
        },
        qualifiedSearch: {
          omit: true,
        },
        run_n_times: {
          omit: true,
        },
        run_on_startup: {
          omit: true,
        },
        skip_scheduled_realtime_idxc: {
          omit: true,
        },
      },
    },
  },
})

export const createFetchDefinitions = (credentials: Credentials): definitions.fetch.FetchApiDefinitions<Options> => ({
  instances: {
    default: {
      resource: {
        serviceIDFields: ['id'],
      },
      element: {
        topLevel: {
          elemID: { parts: DEFAULT_ID_PARTS },
          serviceUrl: { baseUrl: `https://${credentials.subdomain}.splunkcloud.com` },
        },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(),
  },
})
