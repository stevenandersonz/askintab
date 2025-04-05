import db from "../db_new.js"
export async function openAI(msg, onResponse){
  const {userPrompt, systemPrompt, model } = msg
  let cfg = await db.getConfig("openai_cfg")
  if(!cfg.key) throw new Error("OpenAI key is not set")
  let body = JSON.stringify({
    model: model,
    instructions: systemPrompt,
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
    content: data.output[0].content[0].text,
    prevMsg: msg
  });
}
