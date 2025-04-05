```markdown
          ______
 Ask In  /  Tab  \
------------------ 
```
Supercharge your browser with a LLM.

"Ask in Tab" uses IndexedDB to store your spaces, sources and messages. 

A Space is a collection of messages between you and the LLM. Messages in a space are shared between tabs and windows.
A Source is context added to the user prompt:
  - a tab: the text content of the selected tab.
  - a highlight: the text content ofa highlight. You can create a highlight by selecting the text and clicking "add highlight to chat". If you click on the highlight in the chat it will be highlighted in the current page if present.

You can connect your LLM in the settings, by bringing up the side chat with `CTRL+K` and clicking on the settings icon. there you need to find the configuration for the LLM you want to use and set the API_KEY.

All messages send to the LLMs are only share between you and the provider.

## Supported LLMs
- OpenAI (gpt-4o): 

## Install
1. Clone this repo: git clone https://github.com/stevenandersonz/askintab.git
2. Go to `chrome://extensions/` or `about:addons`.
3. Turn on "Developer Mode".
4. Click "Load unpacked" and pick the folder.
5. open the side chat with `CRTL + K` or click on the extension icon
6. click on the settings icon and set the API_KEY of the LLM you want to use

## Extension Permisions
- Tabs: to get the text content of a tab when use as a source 
- Scripting: to inject the side chat into the current tab
- Commands: to open the side chat with `CRTL + K`

## Report Issues
You can report issues here 

## License
MIT - use it however you want!