import dotenv from "dotenv-flow";
import twilio from "twilio";
import type { WebSocket } from "ws";
import * as log from "./logger";
import {
  EndSession,
  SendTextToken,
  TwilioRelayMessage,
  TwilioRelayMessageTypes,
} from "./twilio-types";

dotenv.config();
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
export const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// this demo only supports one call at a time hence some variables are global
export let callSid: string | undefined;
export const setCallSid = (sid: string) => (callSid = sid);

export let ws: WebSocket | undefined; // conversation relay websocket
export const setWs = (wss: WebSocket) => (ws = wss);

export function reset() {
  callSid = undefined;

  ws?.close();
  ws?.on("close", () => (ws = undefined));
}

/****************************************************
 Conversation Relay Actions
****************************************************/
export function endSession(handoffData: {}) {
  const action: EndSession = {
    type: "end",
    handoffData: JSON.stringify(handoffData),
  };

  ws?.send(JSON.stringify(action));
}

export function textToSpeech(token: string, last: boolean = false) {
  const action: SendTextToken = { type: "text", token, last };
  ws?.send(JSON.stringify(action));
}
/****************************************************
 Conversation Relay Message Listener
****************************************************/
export function onMessage<T extends TwilioRelayMessageTypes>(
  type: T,
  callback: (message: TwilioRelayMessage & { type: T }) => void
) {
  ws?.on("message", (data) => {
    const msg = JSON.parse(data.toString()) as TwilioRelayMessage;
    if (msg.type === type) callback(msg as TwilioRelayMessage & { type: T });
  });
}

/****************************************************
 Call Actions
****************************************************/
export async function startCallRecording() {
  const rec = await client.calls(callSid as string).recordings.create();

  if (rec.errorCode)
    return log.error(
      `could not start call recording, error code ${rec.errorCode}`
    );

  const mediaUrl = `https://api.twilio.com${rec.uri.replace(".json", "")}`;
  log.success(`started call recording\n${mediaUrl}`);
}
