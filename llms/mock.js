function mockSubmit(){
  chrome.runtime.sendMessage({ type: "LLM_RESPONSE", payload:{name:"mock", response: "this is a test", followupQuestions: []}});
}

export async function mock(llm){
  const {currentRequest} = llm
  await chrome.scripting.executeScript({target: {tabId: currentRequest.sender.id}, args: [], func: mockSubmit})
}