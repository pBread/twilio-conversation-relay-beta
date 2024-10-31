import dotenv from "dotenv-flow";
import express from "express";
import ExpressWs from "express-ws";
import * as demo from "../demo";
import * as log from "./logger";
import * as state from "./state";
import * as twlo from "./twilio";
import * as llm from "./gemini";
import type { CallStatus } from "./twilio-types";

dotenv.config();
const { HOSTNAME, PORT = "3000", RECORD_CALL } = process.env;

const { app } = ExpressWs(express());
app.use(express.urlencoded({ extended: true })).use(express.json());

/****************************************************
 Twilio Voice Webhook Endpoints
****************************************************/
app.post("/incoming-call", async (req, res) => {
  try {
    // reset demo
    log.reset();
    llm.reset();
    state.reset();

    // respond with ConversationRelay TwiML
    const { CallSid, From, To } = req.body;
    log.success(`/incoming-call From ${From} To ${To} CallSid ${CallSid}`);

    res.status(200).type("text/xml").end(`\
<Response>
    <Connect>
        <ConversationRelay 
            url="wss://${HOSTNAME}/convo-relay/${CallSid}" 
            welcomeGreeting="${demo.greeting}"
            welcomeGreetingInterruptible="true"

            voice="${demo.tts.voice}"
            ttsProvider="${demo.tts.provider}"
        />
    </Connect>
</Response>
  `);
  } catch (error) {
    log.error("/incoming-call webhook error", error);
    res.status(500).send();
  }
});

app.post("/call-status-update", async (req, res) => {
  const callSid = req.body.CallSid;
  const status = req.body.CallStatus as CallStatus;

  const msg = `/call-status-update ${status} CallSid ${callSid}`;

  if (status === "error") log.error(msg);
  else log.info(msg);

  res.status(200).send();
});

/****************************************************
 Conversation Relay Websocket
****************************************************/
app.ws("/convo-relay/:callSid", (ws, req) => {
  const { callSid } = req.params;
  // this demo only supports one call at a time hence some variables are global
  twlo.setCallSid(callSid);
  twlo.setWs(ws);

  log.info(`/convo-relay websocket initializing`);
  twlo.onMessage("setup", () =>
    log.success(`/convo-relay websocket initializing`)
  );

  if (RECORD_CALL?.toLowerCase() === "true") twlo.startCallRecording();
  else log.warn("call is not being recorded");
});

/****************************************************
 Start Server
****************************************************/
app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`);
  console.log(`public base URL https://${HOSTNAME}`);
});
