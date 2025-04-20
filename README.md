```markdown
          ______
 Ask In  /  Tab  \
------------------ 
```
Supercharge your browser with a LLM, ask without leaving the tab you are in, forget the copy pasting grind.
Connect & Chat to any LLM through openrouter. 
All messages sent to the LLMs are only share between you and the provider.

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

## Usage:

### Spaces:
A space is a central repository of your messages and resources used. 

To view & edit a space -> click extension icon -> click settings -> click the name of the space on the side panel:
Create a space -> click extension icon -> click settings -> Click Add Space

### Sources:
Each space has a sources property, each source content will be appended to the message send to a provider. 
Available source types:
  - Page: the content of a page can be added by clicking on the extension icon then click add to sources

you can toggle what sources to include on any message: 

- space -> click extension icon -> click settings -> click <space-name> on the side panel
- on the side chat type `/` click sources it will only display the sources that are not currenlty used in context
- All sources are displayed as badges above the input message and can be remove from there

### Search:
ask in tab uses supports web search through open router plugin.
to use it on a message:
- on the side chat type `/` click search. it will add a search badge to let you know search will be used.

### Message History:
By default all message history in a space is send to the provider on each message
you can disable this:
- on the side chat type `/` click standalone message. it will add a standalone badge to let you know your message history will no be included. 

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