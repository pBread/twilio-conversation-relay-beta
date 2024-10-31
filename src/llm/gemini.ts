import {
  ChatSession,
  Content,
  FunctionCall,
  FunctionDeclaration,
  FunctionDeclarationsTool,
  FunctionResponse,
  GoogleGenerativeAI,
  StartChatParams,
  Tool,
} from "@google/generative-ai";
import dotenv from "dotenv-flow";
import * as demo from "../../demo";
import * as fns from "../../demo/functions";
import * as log from "../logger";
import type { AIMessage } from "../state";
import * as state from "../state";
import { LLMEventEmitter } from "./interface";

dotenv.config();

let eventEmitter = new LLMEventEmitter();
export let on = eventEmitter.on;

// only one stream can be open at a time
let controller: AbortController | undefined;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

let functionDeclarations: FunctionDeclaration[] = [];
for (const [name, fn] of Object.entries(fns))
  functionDeclarations.push({
    name: name,
    // parameters: fn.parameters,
    description: fn.description,
  });

function translateMessage(msg: state.StoreMessage): Content | undefined {
  let param: Content | undefined;

  // system messages are sent to Gemini via systemInstructions param.
  // currently, the last system message overrides the demo.llm.instructions
  // and all previous system messages
  if (msg.role === "system") return;

  if (msg.role === "ai" && msg.type === "text") {
    param = {
      role: "model",
      parts: [{ text: msg.content }],
    };
  }

  if (msg.role === "ai" && msg.type === "tool") {
    param = {
      role: "model",
      parts: [{ functionCall: JSON.parse(msg.content) as FunctionCall }],
    };
  }

  if (msg.role === "human")
    param = { role: "user", parts: [{ text: msg.content }] };

  if (msg.role === "tool")
    param = {
      role: "model",
      parts: [
        { functionResponse: JSON.parse(msg.content) as FunctionResponse },
      ],
    };

  return param;
}

export async function startRun() {
  let runAgain = false;
  let chat: ChatSession;
  // systemInstructions will be overriden by the latest system message
  let systemInstruction: string = demo.llm.instructions;

  let history: Content[] = [];
  const stateMsgs = state.getMessages();
  for (const msg of stateMsgs) {
    if (msg.role === "system") systemInstruction = msg.content;
    const param = translateMessage(msg);
    if (param) history.push(param);
  }

  const prompt = history.shift();
  if (!prompt)
    throw Error(`Cannot start run because there are no messages in state`);

  const model = genAI.getGenerativeModel({
    model: demo.llm.model || "gemini-1.5-pro",
    systemInstruction,
  });
  chat = model.startChat({
    history: history.reverse(),
    tools: [{ functionDeclarations }],
  });

  controller = new AbortController();

  log.debug("history arg", JSON.stringify(history, null, 2));

  try {
    // gemini's streaming API doesn't support streaming hence using the REST API
    const result = await chat.sendMessage(prompt.parts);
    log.debug("result", JSON.stringify(result, null, 2));
    const candidate = result.response?.candidates?.[0];

    const fnCall = candidate?.content.parts?.[0]?.functionCall;
    const text = candidate?.content.parts?.[0]?.text;

    if (fnCall) {
      const toolMsg = state.addAIMessage({
        content: JSON.stringify(fnCall),
        type: "tool",
      });
      const fn = fns[fnCall.name as keyof typeof fns];
      if (!fn) log.error(`function not found. name: ${fnCall.name}`);
      runAgain = true;

      const response = await fn(fnCall.args);
      log.info(`function result`, response);

      state.addToolResultMessage({
        content: JSON.stringify(response),
        parentId: toolMsg.id,
      });

      const fnResult = await chat.sendMessage([
        { functionResponse: { name: fnCall.name, response } },
      ]);
      const txt = fnResult.response?.candidates?.[0].content.parts[0]
        .text as string;
      state.addAIMessage({ content: txt, type: "text" });
      eventEmitter.emit("speech", txt, !!candidate.finishReason);
    }

    if (text) {
      state.addAIMessage({ content: text, type: "text" });
      eventEmitter.emit("speech", text, !!candidate.finishReason);
    }
  } catch (error) {
    log.error(`error in gemini completion request`, error);
  }

  controller = undefined;
  // if (runAgain) startRun();

  log.debug(
    "state messages after",
    JSON.stringify(state.getMessages(), null, 2)
  );
  log.debug(
    "chat message after",
    JSON.stringify(await chat.getHistory(), null, 2)
  );
}

export function abort() {
  controller?.abort();
  controller = undefined;
  return;
}

export function reset() {
  abort();

  eventEmitter = new LLMEventEmitter();
  on = eventEmitter.on;
}
