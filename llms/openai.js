
export async function openAI(provider){
  const {userPrompt, systemPrompt, openaiKey, lastMessageId, model} = provider
  console.log(provider)
  let body = JSON.stringify({
    model: model,
    instructions: systemPrompt,
    previous_response_id: lastMessageId ? lastMessageId : null,
    input: userPrompt,
  })
  console.log(body)
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`
    },
    body
  });

  if (!response.ok) {
    console.log(response)
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(data)
  return {
    responseId: data.id,
    raw: data.output[0].content[0].text,
    responseAt: Date.now()
  };
}
