// Metrics constants ----------------------------------------------------------

const BEHAVIORAL_METRICS = {
  MEETINGS_REGISTRATION_FAILED: 'js_sdk_meetings_registration_failed',
  MEETINGS_REGISTRATION_SUCCESS: 'js_sdk_meetings_registration_success',
  MEETINGS_REGISTRATION_STEP: 'meetings_registration_step',
  MERCURY_CONNECTION_FAILURE: 'js_sdk_mercury_connection_failure',
  MERCURY_CONNECTION_RESTORED: 'js_sdk_mercury_connection_restored',
  JOIN_SUCCESS: 'js_sdk_join_success',
  JOIN_FAILURE: 'js_sdk_join_failures',
  ADD_MEDIA_SUCCESS: 'js_sdk_add_media_success',
  ADD_MEDIA_FAILURE: 'js_sdk_add_media_failures',
  ADD_MEDIA_RETRY: 'js_sdk_add_media_retry',
  ROAP_MERCURY_EVENT_RECEIVED: 'js_sdk_roap_mercury_received',
  CONNECTION_SUCCESS: 'js_sdk_connection_success',
  CONNECTION_FAILURE: 'js_sdk_connection_failures',
  MEETING_LEAVE_FAILURE: 'js_sdk_meeting_leave_failure',
  MEETING_END_ALL_FAILURE: 'js_sdk_meeting_end_for_all_failure',
  MEETING_END_ALL_INITIATED: 'js_sdk_meeting_end_for_all_initiated',
  GET_USER_MEDIA_FAILURE: 'js_sdk_get_user_media_failures',
  GET_DISPLAY_MEDIA_FAILURE: 'js_sdk_get_display_media_failures',
  JOIN_WITH_MEDIA_FAILURE: 'js_sdk_join_with_media_failures',
  LLM_CONNECTION_AFTER_JOIN_FAILURE: 'js_sdk_llm_connection_after_join_failure',
  RECEIVE_TRANSCRIPTION_AFTER_JOIN_FAILURE: 'js_sdk_receive_transcription_after_join_failure',

  DISCONNECT_DUE_TO_INACTIVITY: 'js_sdk_disconnect_due_to_inactivity',
  MEETING_MEDIA_INACTIVE: 'js_sdk_meeting_media_inactive',
  MEETING_RECONNECT_FAILURE: 'js_sdk_meeting_reconnect_failures',
  MEETING_MAX_REJOIN_FAILURE: 'js_sdk_meeting_max_rejoin_failure',
  MEETING_SHARE_SUCCESS: 'js_sdk_meeting_share_success',
  MEETING_SHARE_FAILURE: 'js_sdk_meeting_share_failures',
  MEETING_START_WHITEBOARD_SHARE_FAILURE: 'js_sdk_meeting_start_whiteboard_share_failures',
  MEETING_STOP_WHITEBOARD_SHARE_FAILURE: 'js_sdk_meeting_stop_whiteboard_share_failures',
  MEETING_SHARE_VIDEO_MUTE_STATE_CHANGE: 'js_sdk_meeting_share_video_mute_state_change',
  MUTE_AUDIO_FAILURE: 'js_sdk_mute_audio_failures',
  MUTE_VIDEO_FAILURE: 'js_sdk_mute_video_failures',
  SET_MEETING_QUALITY_FAILURE: 'js_sdk_set_meeting_quality_failures',
  STOP_FLOOR_REQUEST_FAILURE: 'js_sdk_stop_floor_request_failures',
  ADD_DIAL_IN_FAILURE: 'js_sdk_add_dial_in_failure',
  ADD_DIAL_OUT_FAILURE: 'js_sdk_add_dial_out_failure',
  UPDATE_MEDIA_FAILURE: 'js_sdk_update_media_failures',
  UNMUTE_AUDIO_FAILURE: 'js_sdk_unmute_audio_failures',
  UNMUTE_VIDEO_FAILURE: 'js_sdk_unmute_video_failures',
  ROAP_ANSWER_FAILURE: 'js_sdk_roap_answer_failures',
  ROAP_GLARE_CONDITION: 'js_sdk_roap_glar_condition',
  PEERCONNECTION_FAILURE: 'js_sdk_peerConnection_failures',
  INVALID_ICE_CANDIDATE: 'js_sdk_invalid_ice_candidate',
  UPLOAD_LOGS_FAILURE: 'js_sdk_upload_logs_failure',
  UPLOAD_LOGS_SUCCESS: 'js_sdk_upload_logs_success',
  RECEIVE_TRANSCRIPTION_FAILURE: 'js_sdk_receive_transcription_failure',
  FETCH_MEETING_INFO_V1_SUCCESS: 'js_sdk_fetch_meeting_info_v1_success',
  FETCH_MEETING_INFO_V1_FAILURE: 'js_sdk_fetch_meeting_info_v1_failure',
  ADHOC_MEETING_SUCCESS: 'js_sdk_adhoc_meeting_success',
  ADHOC_MEETING_FAILURE: 'js_sdk_adhoc_meeting_failure',
  VERIFY_PASSWORD_SUCCESS: 'js_sdk_verify_password_success',
  VERIFY_PASSWORD_ERROR: 'js_sdk_verify_password_error',
  VERIFY_CAPTCHA_ERROR: 'js_sdk_verify_captcha_error',
  MOVE_TO_SUCCESS: 'js_sdk_move_to_success',
  MOVE_TO_FAILURE: 'js_sdk_move_to_failure',
  MOVE_FROM_SUCCESS: 'js_sdk_move_from_success',
  MOVE_FROM_FAILURE: 'js_sdk_move_from_failure',
  TURN_DISCOVERY_FAILURE: 'js_sdk_turn_discovery_failure',
  MEETING_INFO_POLICY_ERROR: 'js_sdk_meeting_info_policy_error',
  LOCUS_DELTA_SYNC_FAILED: 'js_sdk_locus_delta_sync_failed',
  LOCUS_DELTA_OUT_OF_ORDER: 'js_sdk_locus_delta_ooo',
  PERMISSION_TOKEN_REFRESH: 'js_sdk_permission_token_refresh',
  PERMISSION_TOKEN_REFRESH_ERROR: 'js_sdk_permission_token_refresh_error',
  TURN_DISCOVERY_LATENCY: 'js_sdk_turn_discovery_latency',
  ROAP_OFFER_TO_ANSWER_LATENCY: 'js_sdk_roap_offer_to_answer_latency',
  ROAP_HTTP_RESPONSE_MISSING: 'js_sdk_roap_http_response_missing',
  TURN_DISCOVERY_REQUIRES_OK: 'js_sdk_turn_discovery_requires_ok',
  REACHABILITY_COMPLETED: 'js_sdk_reachability_completed',
  JOIN_WEBINAR_ERROR: 'js_sdk_join_webinar_error',
  GUEST_ENTERED_LOBBY: 'js_sdk_guest_entered_lobby',
  GUEST_EXITED_LOBBY: 'js_sdk_guest_exited_lobby',
  VERIFY_REGISTRATION_ID_SUCCESS: 'js_sdk_verify_registrationId_success',
  VERIFY_REGISTRATION_ID_ERROR: 'js_sdk_verify_registrationId_error',
  JOIN_FORBIDDEN_ERROR: 'js_sdk_join_forbidden_error',
};

export {BEHAVIORAL_METRICS as default};
