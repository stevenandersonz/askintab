```markdown
          ______
 Ask In  /  Tab  \
------------------ 
```
Supercharge your browser with a LLM.

"Ask in Tab" uses IndexedDB to store your spaces, sources and messages. 

A Space is a collection of messages between you and the LLM. Messages in a space are shared between tabs and windows.
Each space has a sources property, each source content will be appended to the message send to a provider. 

Available source types:
  - Page: the content of a page can be added by clicking on the extension icon then click add to sources

You can connect to any LLM through openrouter. 


All messages send to the LLMs are only share between you and the provider.

## Install
1. Clone this repo: git clone https://github.com/stevenandersonz/askintab.git
2. Go to `chrome://extensions/` or `about:addons`.
3. Turn on "Developer Mode".
4. Click "Load unpacked" and pick the folder.
5. open the side chat with `CRTL + K` or click on the extension icon
6. click on the settings icon and set the API_KEY of the LLM you want to use


## Set OpenRouter API KEY
- Click the extension icon.
- Click the settings icon.
- Settings > General > open route api key
- paste your key then hit enter 

## Extension Permisions
- ActiveTab: enable access to the current page. 
- Scripting: To collect the content of the current page
- Commands: to open the side chat with `CRTL + K`
- SidePanel: open the chat in a side panel.

## Local Dependencies
these are injected into the current tab when the extension is loaded and they are loaded from the `libs` folder.
- [marked.js](https://github.com/markedjs/marked)
- [mermaid.js](https://github.com/mermaid-js/mermaid)

## Report Issues
You can report issues here 

## License
MIT - use it however you want!