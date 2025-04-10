let state = {
    models: ['mock'],
    spaces: [{name:"default", selected:true, id:1, model:"mock", sources:[]}],
    hotKeys: [{description:"open side chat", id:"cmd+k"}]
  }

  function parseParams() {
    let p = {}; let q = window.location.search.slice(1).split('&')
    for (let i=0;i<q.length;i++){let kv=q[i].split('=');p[kv[0]]=kv[1]}
    return p
  }

  function goTo(args) {
    let s=''
    for(let k in args){s+=(!s?'?':'&')+k+'='+encodeURIComponent(args[k])}
    window.history.replaceState({},'',s)
    render()
  }

  function viewSettingClick(e) {
    goTo({section:e.target.dataset.name})
  }

  function viewSpaceClick(e) {
    goTo({section:'spaces',space:e.target.dataset.id})
  }

  function addSpaceClick() {
    let newid = ''+Math.random().toString(36).substring(2)
    let defSpace = {name:'new-space',id:newid,model:'mock',sources:[]}
    state.spaces.push(defSpace)
    goTo({section:'template',template:newid})
  }

  function addSourceClick() {
    let srcWrap = document.getElementById('add-source-wrap')
    if(!srcWrap) return
    srcWrap.innerHTML = ''
    let urlInput = document.createElement('input'); urlInput.placeholder='url'
    let typeSel = document.createElement('select')
    let opt1 = document.createElement('option'); opt1.value='doc'; opt1.textContent='doc'
    let opt2 = document.createElement('option'); opt2.value='page'; opt2.textContent='page'
    typeSel.appendChild(opt1); typeSel.appendChild(opt2)
    let saveBtn = document.createElement('button'); saveBtn.textContent='Save'
    saveBtn.addEventListener('click', function saveSource(){
      let p = parseParams()
      let sp = state.spaces.find(x=>(''+x.id)===p.space)
      if(!sp) return
      sp.sources.push({url:urlInput.value, type:typeSel.value})
      render()
    })
    srcWrap.appendChild(urlInput)
    srcWrap.appendChild(typeSel)
    srcWrap.appendChild(saveBtn)
  }

  function renderMenu() {
    let mg = document.getElementById('menu-general')
    mg.dataset.name='general'
    mg.removeEventListener('click', viewSettingClick); mg.addEventListener('click', viewSettingClick)
    let mAdd = document.getElementById('menu-add-space')
    mAdd.removeEventListener('click', addSpaceClick); mAdd.addEventListener('click', addSpaceClick)
    let ms = document.getElementById('menu-spaces')
    ms.innerHTML=''
    for(let i=0;i<state.spaces.length;i++){
      let s=state.spaces[i]
      let div=document.createElement('div')
      div.className='menu-item'
      div.textContent=s.name
      div.dataset.id=s.id
      div.addEventListener('click', viewSpaceClick)
      ms.appendChild(div)
    }
  }

  function renderGeneral(main, p) {
    main.innerHTML=''
    let h=document.createElement('h2')
    h.textContent='General Settings'
    main.appendChild(h)

    let lbl=document.createElement('div')
    lbl.textContent='Current Space'
    main.appendChild(lbl)
    let sel=document.createElement('select')
    for(let i=0;i<state.spaces.length;i++){
      let sp=state.spaces[i]
      let opt=document.createElement('option')
      opt.value=sp.id; opt.textContent=sp.name
      if(sp.selected) opt.selected=true
      sel.appendChild(opt)
    }
    main.appendChild(sel)

    let hotLbl=document.createElement('div')
    hotLbl.textContent='Hot Keys:'
    main.appendChild(hotLbl)
    let ul=document.createElement('ul')
    for(let i=0;i<state.hotKeys.length;i++){
      let li=document.createElement('li')
      li.textContent=state.hotKeys[i].id+' -> '+state.hotKeys[i].description
      ul.appendChild(li)
    }
    main.appendChild(ul)
  }

  function renderSpace(main, sp) {
    main.innerHTML=''
    let h=document.createElement('h2')
    h.textContent='Space: '+sp.name
    main.appendChild(h)

    let nameLbl=document.createElement('div'); nameLbl.textContent='Name'
    main.appendChild(nameLbl)
    let nameInp=document.createElement('input')
    nameInp.value=sp.name
    main.appendChild(nameInp)

    let modelLbl=document.createElement('div'); modelLbl.textContent='Model'
    main.appendChild(modelLbl)
    let modelSel=document.createElement('select')
    for(let i=0;i<state.models.length;i++){
      let opt=document.createElement('option')
      opt.value=state.models[i]
      opt.textContent=state.models[i]
      if(sp.model===state.models[i]) opt.selected=true
      modelSel.appendChild(opt)
    }
    main.appendChild(modelSel)

    let addSrc=document.createElement('button')
    addSrc.textContent='Add Source'
    addSrc.addEventListener('click', addSourceClick)
    main.appendChild(addSrc)
    let asw=document.createElement('div'); asw.id='add-source-wrap'
    main.appendChild(asw)

    let srcLbl=document.createElement('div'); srcLbl.textContent='Sources'
    main.appendChild(srcLbl)
    let ul=document.createElement('ul')
    for(let i=0;i<sp.sources.length;i++){
      let s=sp.sources[i]
      let li=document.createElement('li')
      li.textContent=s.url+' ['+s.type+'] '
      let rbtn=document.createElement('button'); rbtn.textContent='remove'
      rbtn.addEventListener('click', (function removeSourceCb(index){
        return function(){
          sp.sources.splice(index,1); render()
        }
      })(i))
      li.appendChild(rbtn)
      ul.appendChild(li)
    }
    main.appendChild(ul)
  }

  function renderTemplate(main, p){
    main.innerHTML='New space created. ID='+p.template
  }

  function render() {
    renderMenu()
    let p = parseParams()
    let main = document.getElementById('main-content')
    if(!p.section){
      main.innerHTML='<h2>Choose a menu item</h2>'
      return
    }
    if(p.section==='general'){
      renderGeneral(main, p)
    } else if(p.section==='spaces'){
      if(!p.space) {
        main.innerHTML='<h2>No space selected</h2>'
      } else {
        let sp=state.spaces.find(x=>(''+x.id)===p.space)
        if(sp) renderSpace(main, sp)
        else main.innerHTML='<h2>Space not found</h2>'
      }
    } else if(p.section==='template'){
      renderTemplate(main, p)
    } else {
      main.innerHTML='<h2>Unknown section</h2>'
    }
  }

  document.addEventListener('DOMContentLoaded', function onDomLoad(){
    render()
  })