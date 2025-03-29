```markdown
          ______
 Ask In  /  Tab  \
------------------ 
```
Connect the current page to the LLM you want to use if is running in your tabs. No more copy/pasting grind—just inline answers to the questions you need.

"Ask in Tab" keeps a local record using IndexedDB of the pages where you used it, so your questions and answers will be there when you come back again (unless the page has changed since the last time; you can still export your conversations, though!).

No need to worry about your data since this runs locally, and don’t worry about paying an extra subscription—just download it and use it with the LLMs you’re already paying for.

## Use
- **Text**: To ask a question, highlight text, then press `CTRL+K`, ask and send. A spinner will show up next to the text a let you know when the response is completed.

- **Input**: It can type for you. Click on any input then press `CTRL+K`, ask, and send. (Should work on any editable content element)

- **Export**: Click the extension icon -> Select the conversation -> Click export. You get all your questions right a text file.

- **Settings**: Click the extension icon -> Click settings icon on the top right corner of the popup.

## Supported LLMs
- Grok (xAI) 
- OpenAI (gpt-4o)

## Install
1. Clone this repo: git clone https://github.com/stevenandersonz/askintab.git
2. Go to `chrome://extensions/` or `about:addons`.
3. Turn on "Developer Mode".
4. Click "Load unpacked" and pick the folder.

## Extension Permisions
  - Tabs: To find the tab id where the llm is
  - scripting:  To inject JS into the tab where the llm is

## Extension Execution
  we inject content.js into all pages so you can always have access to your llms with `CRTL + K`

## Report Issues
You can report issues here 

## License
MIT - use it however you want!