export async function mock(msg, onResponse){
  console.log("mock", msg)
  let response = `Well, hello there! Let’s dive right into this fascinating business of ATP synthesis—it’s a real corker of a process, isn’t it? Now, you’re talking about the body’s energy “batteries,” and I love the analogy—four different storage systems, each with its own quirks, all feeding into this universal energy currency called ATP. It’s like nature’s own little power grid! You’ve got glycogen, fats, proteins, and a dash of creatine phosphate, all humming along to keep the lights on in your cells. But the star of the show here is ATP synthesis itself—taking ADP and snapping on that third phosphate group. It’s a simple idea, but the machinery behind it? Oh, that’s where the fun starts.
Let’s picture it. You’ve got this molecule, ADP—adenosine diphosphate—sitting there with two phosphate groups, minding its own business. Along comes some energy from one of those “batteries,” and wham! We attach a third phosphate, turning it into ATP—adenosine triphosphate. It’s like winding up a toy spring: you put energy in, and that bond’s now loaded, ready to release a burst of oomph when it’s broken later. Most of this magic happens in the mitochondria during cellular respiration, via a wild contraption called ATP synthase. Think of it as a tiny molecular turbine—protons flow through it, it spins, and out pops ATP like a freshly minted coin.
Now, since you asked for a diagram, I’ll sketch this out with something nifty called Mermaid.js. Here’s how ATP synthesis looks in the grand scheme of things, focusing on that ATP synthase step in the mitochondria:

- 1
- 2
- 3

This little chart shows how those four “batteries” feed into the system. Glucose or glycogen kicks things off with glycolysis, fats get broken down via beta-oxidation, proteins chip in through amino acids, and creatine phosphate gives a fast jolt—all funneling energy toward ATP synthase, which slaps that phosphate onto ADP. The proton gradient from the electron transport chain is the real powerhouse here—it’s like water turning a mill wheel.
`
let fus = `<q>1</q>\n
<q>2</q>\n
<q>3</q>\n`

let graph = `
\`\`\`mermaid
graph TD
    A[Glucose/Glycogen] -->|Glycolysis| B(Pyruvate)
    B -->|Krebs Cycle| C(NADH + FADH2)
    C -->|Electron Transport Chain| D(Proton Gradient)
    D -->|Drives ATP Synthase| E(ADP + Pi)
    E --> F(ATP)
    G[Fats] -->|Beta-Oxidation| C
    H[Proteins] -->|Amino Acid Breakdown| C
    I[Creatine Phosphate] -->|Quick Burst| E
\`\`\``
let response2 = `"Hello! How can I assist you today? 
<q>1</q>
<q>Can you provide an analysis of a specific historical event?</q>
<q>How can I improve my daily productivity and time management?</q>
`
  setTimeout(() => {
    onResponse({content: response2, responseId:"123", prevMsg: msg})
  }, 1000)
}