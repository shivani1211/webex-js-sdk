// @ts-ignore
import {deviceType} from '@webex/common';

export default {
  // TODO: this needs to be defaulted
  // to JS_SDK and clients set it to WEB or others
  // see https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-73167
  meetings: {
    deviceType: deviceType.WEB,
    mediaSettings: {
      pstn: false,
    },
    reconnection: {
      enabled: false,
      autoRejoin: true,
      detection: true,
      // Timeout duration to wait for ICE to reconnect if a disconnect is received.
      iceReconnectionTimeout: 10000,
      // Amount of times attempting to rejoin a meeting during reconnect
      maxRejoinAttempts: 3,
    },
    stats: {
      // Enable the webrtc stats analyzer that emits quality degradation events
      enableStatsAnalyzer: true,
      // Enable the auto downgrade video quality feature
      autoDowngradeEnabled: false,
      // 1 second intervals to collect stats data
      interval: 1000,
      // we just want to analyze data every 5 sec interval
      analyzerInterval: 5000,
      // hold the last 2 minute of a calls data
      historyMax: 120,
      // Once packet loss hits this ratio, the video will downgrade
      videoPacketLossRatioThreshold: 9, // comparison of packets lost / packets received
      rttThreshold: 500, // 500 ms noticeable quality lag begins based on bandwidth of user
      jitterThreshold: 500, // 500 ms noticeable quality lag begins based on bandwidth of user
    },
    metrics: {
      // change to your client name else data will be muddled
      // you do not need a specific format, and you do not need to register it
      clientName: 'WEBEX_JS_SDK',
      // TODO: for now this line has to be whitelisted, which is problematic for third party
      clientType: 'WEBEX_SDK',
      // Stores the sub client type used when sending metrics
      subClientType: 'WEB_APP',
      // send average values MQA in 60 second intervals
      mqaMetricsInterval: 60000,
      // send to cisco internal MQA data automatically
      // we already send CA
      autoSendMQA: true,
    },
    logging: {
      enable: true,
      verboseEvents: true,
    },
    resolution: {
      maxWidth: 1280,
      maxHeight: 720,
      idealWidth: 1280,
      idealHeight: 720,
    },
    screenResolution: {
      maxWidth: 1920,
      maxHeight: 1080,
      idealWidth: 1920,
      idealHeight: 1080,
    },
    bandwidth: {
      // please note, these are the maximum bandwidth values
      // the server supports, minimums have to be tested
      audio: 64000,
      video: 4000000,
      startBitrate: 2000,
    },
    screenFrameRate: 10,
    videoShareFrameRate: 30,
    aspectRatio: 1.7695852534562213,
    // When enabled, as calls are ended, it will upload the SDK logs and correlate them
    autoUploadLogs: true,
    enableRtx: true,
    receiveTranscription: false,
    enableExtmap: false,
    enableAutomaticLLM: false,
    installedOrgID: undefined,
    experimental: {
      enableMediaNegotiatedEvent: false,
      enableUnifiedMeetings: true,
      enableAdhocMeetings: true,
      enableTcpReachability: false,
      enableTlsReachability: false,
    },
    degradationPreferences: {
      maxMacroblocksLimit: 8192,
    },
    // This only applies to non-multistream meetings
    iceCandidatesGatheringTimeout: undefined,
    backendIpv6NativeSupport: false,
    enableReachabilityChecks: true,
    reachabilityGetClusterTimeout: 5000,
    logUploadIntervalMultiplicationFactor: 0, // if set to 0 or undefined, logs won't be uploaded periodically, if you want periodic logs, recommended value is 1
  },
};
