/****************************************************
 Twilio Conversation Relay Actions
****************************************************/
export type TwilioAction =
  | EndSession
  | PlayMedia
  | SendDigits
  | SendTextToken
  | SwitchLanguage;

export type EndSession = {
  type: "end";
  handoffData: string; // stringified json
};

export type PlayMedia = {
  type: "play";
  loop?: 1; // Default is 1
  preemptible?: false; // Default is false
  source: string;
};

export type SendDigits = {
  type: "sendDigits";
  digits: string;
};

export type SendTextToken = {
  type: "text";
  last: boolean;
  token: string;
};

type SwitchLanguage = {
  type: "transcriptionLanguage";
  lang: string;
};

/****************************************************
 Twilio Conversation Relay Messages
****************************************************/
export type TwilioRelayMessage =
  | CustomerInterrupt
  | DTMFMessage
  | PromptCompleteMessage
  | SetupMessage;

type ExtractMessageEvent<T> = T extends { type: infer U } ? U : never;
export type TwilioRelayMessageTypes = ExtractMessageEvent<TwilioRelayMessage>;

type CustomerInterrupt = {
  type: "interrupt";

  durationUntilInterruptMs: string;
  utteranceUntilInterrupt: string;
};

type DTMFMessage = {
  type: "dtmf";
  digit: string;
};

type PromptCompleteMessage = {
  type: "prompt";
  voicePrompt: string;
  lang: "en-US";
  last: true;
};

type SetupMessage = {
  accountSid: string;
  applicationSid: string | null;
  callerName: string;
  callSid: string;
  callStatus: string;
  callType: "PSTN";
  direction: "inbound";
  forwardedFrom: string;
  from: string;
  parentCallSid: string;
  sessionId: string;
  to: string;
  type: "setup";
};

/****************************************************
 Misc Twilio
****************************************************/
export type CallStatus = "completed" | "initializing" | "started" | "error";
