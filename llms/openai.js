import { getConfig } from "../db_new.js"
import { mock } from "./mock.js"

export async function openAI(msg, onResponse){
  const {userPrompt, systemPrompt, model, lastMessageId } = msg
  let cfg = await getConfig("openai_cfg")
  if(false) return mock(msg, onResponse)
  if(!cfg.key) throw new Error("OpenAI key is not set")
  let body = JSON.stringify({
    model: model,
    instructions: systemPrompt,
    previous_response_id: lastMessageId ? lastMessageId : null,
    input: userPrompt,
  })
  console.log(JSON.parse(body))
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.key}`
    },
    body
  });

  if (!response.ok) {
    console.log(response)
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(data)
  onResponse({
    responseId: data.id,
    text: data.output[0].content[0].text,
    model: model,
    conversationId: msg.conversationId,
    tabId: msg.tabId,
    tabTitle: msg.tabTitle,
    tabUrl: msg.tabUrl, 
  });
}
