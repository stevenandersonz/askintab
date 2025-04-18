const SYSTEM_PROMPT = `
if user request diagrams default to mermaid.js and return the graph syntax inside \`\`\`mermaid \`\`\`,
for your graphs do not use parenthesis for text labels, and make sure the syntax is correct.
Add 3 follow up question to expand on your response, and phrase them as further prompts to yourself.
each question should be surrounded by <q> </q>
the user message will be formatted as:
context: <context>
user: <message>

Use the context as primary source to answer the user message but expand with your own knowledge if needed. refer to the context as needed.
`
export const models = [
  {
    id: "openai/gpt-4o-2024-11-20",
    name: "GPT-4o",
  },
  {
    id: "google/gemini-2.5-flash-preview",
    name: "Gemini 2.5 Flash",
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
  }
]

async function forwardToOpenRouter(content, model, apiKey) {
  let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      //'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
      //'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{role: 'system', content: SYSTEM_PROMPT}, {role: 'user', content: content}],
    }),
  });
  response = await response.json()
  return response.choices[0].message.content
}

export async function sendToProvider(db, content, debug = false) {
  let [spaceid, apiKey] = await Promise.all([
    db.getConfig("currentSpace"),
    db.getConfig("openRouterApiKey")
  ])
  let space = await db.getSpace(spaceid)
  let ok = await db.addMessage({ content, model: space.model, spaceId: space.id, role: "user", timestamp: Date.now()})
  if (!ok) chrome.runtime.sendMessage({type: "ERROR", payload: {error: "Error sending message to provider"}})
  let cxt = space.sources.map(s => {
    if(s.type === "page") {
      return `\n -- ${s.url} - ${s.title} -- \n${s.content}\n -- \n`
    }
  }).join("\n")
  if(debug) console.log("cxt", cxt)
  let response = await forwardToOpenRouter("context: " + cxt + "\nuser: " + content, space.model, apiKey)
  if(debug) console.log("response", response)
  ok = await db.addMessage({ spaceId: space.id, model: space.model, role: "assistant", content: response, timestamp: Date.now() })
  if (!ok) chrome.runtime.sendMessage({type: "ERROR", payload: {error: "Error returning response"}})
  console.log("recieved")
  chrome.runtime.sendMessage({ type: "ASSISTANT_MESSAGE", payload: {content: response} }); 
}